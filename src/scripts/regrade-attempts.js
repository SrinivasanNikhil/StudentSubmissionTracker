/**
 * Re-grade logged query attempts against CORRECTED reference solutions.
 *
 * Background: some questions' stored solutions were broken (see
 * fix-broken-solutions.js), so students' correct queries could never be marked
 * correct — every attempt compared against a failed solution (0 rows/0 cols).
 * After the solutions are fixed, this script replays each student's logged
 * attempts (read-only SELECTs) against the corrected solution and credits a
 * completion at the ORIGINAL attempt time for the earliest attempt that now
 * matches, honoring the topic deadline+grace at that attempt time.
 *
 * DRY-RUN BY DEFAULT — nothing is written unless --apply is passed.
 *
 * Usage:
 *   node src/scripts/regrade-attempts.js --questionIds 724,729,730,731
 *   node src/scripts/regrade-attempts.js --questionIds 724,729,730,731 --apply
 */

const {
	User,
	Question,
	Topic,
	Completion,
	InteractionLog,
	InstructorCourseSection,
	InstructorSectionTopicSetting,
} = require("../models");
const { Op } = require("sequelize");
const { compareQueries } = require("../services/sqlExecutor");

function parseArgs(argv) {
	const args = { apply: false, questionIds: null };
	for (let i = 2; i < argv.length; i++) {
		if (argv[i] === "--apply") args.apply = true;
		else if (argv[i] === "--questionIds") {
			args.questionIds = argv[++i].split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
		}
	}
	return args;
}

// Deadline+grace lookup for a user's section and a topic; returns Date or null.
async function graceCutoffFor(user, topicId, cache) {
	if (!user.courseSection || !user.associatedInstructorId) return null;
	const key = `${user.id}|${topicId}`;
	if (cache.has(key)) return cache.get(key);

	const dashIndex = user.courseSection.indexOf("-");
	const courseCode = dashIndex !== -1 ? user.courseSection.slice(0, dashIndex) : user.courseSection;
	const sectionCode = dashIndex !== -1 ? user.courseSection.slice(dashIndex + 1) : "";
	// isActive: true required — duplicate inactive section rows exist (CLAUDE.md)
	const section = await InstructorCourseSection.findOne({
		where: { instructorId: user.associatedInstructorId, courseCode, sectionCode, isActive: true },
	});
	let cutoff = null;
	if (section) {
		const setting = await InstructorSectionTopicSetting.findOne({
			where: { instructorCourseSectionId: section.id, topicId },
		});
		if (setting && setting.dueDate) {
			cutoff = new Date(
				new Date(setting.dueDate).getTime() + (setting.gracePeriodMinutes || 0) * 60000
			);
		}
	}
	cache.set(key, cutoff);
	return cutoff;
}

(async () => {
	try {
		const args = parseArgs(process.argv);
		if (!args.questionIds || args.questionIds.length === 0) {
			console.log("Usage: node src/scripts/regrade-attempts.js --questionIds 724,729 [--apply]");
			process.exit(1);
		}

		const questions = await Question.findAll({
			where: { id: { [Op.in]: args.questionIds } },
			include: [{ model: Topic, as: "topic" }],
		});
		const questionById = new Map(questions.map((q) => [q.id, q]));
		console.log(`Re-grading ${questions.length} question(s): [${questions.map((q) => q.id).join(", ")}]\n`);

		// All attempts with query text for these questions, oldest first
		const attempts = await InteractionLog.findAll({
			where: {
				questionId: { [Op.in]: args.questionIds },
				eventType: "query_attempt",
			},
			order: [["occurred_at", "ASC"]],
		});
		console.log(`Found ${attempts.length} logged attempts to replay.\n`);

		// Group attempts by (userId, questionId)
		const byPair = new Map();
		for (const a of attempts) {
			const qt = (a.eventData || {}).queryText;
			if (!qt) continue;
			const key = `${a.userId}|${a.questionId}`;
			if (!byPair.has(key)) byPair.set(key, []);
			byPair.get(key).push(a);
		}

		const cutoffCache = new Map();
		const userCache = new Map();
		const compareCache = new Map(); // queryHash per question -> verdict, to avoid re-running identical SQL
		const toCreate = [];
		let pairsChecked = 0;

		for (const [key, pairAttempts] of byPair) {
			const [userIdStr, questionIdStr] = key.split("|");
			const userId = parseInt(userIdStr, 10);
			const questionId = parseInt(questionIdStr, 10);
			const question = questionById.get(questionId);
			if (!question) continue;
			pairsChecked++;

			if (!userCache.has(userId)) userCache.set(userId, await User.findByPk(userId));
			const user = userCache.get(userId);
			if (!user || user.role !== "student") continue;

			// Skip if already completed this term
			const existing = await Completion.findOne({
				where: {
					userId,
					questionId,
					academicYear: user.academicYear || null,
					semester: user.semester || null,
				},
			});
			if (existing) {
				console.log(`user=${userId} (${user.email}) q=${questionId}: SKIP already completed this term`);
				continue;
			}

			const cutoff = await graceCutoffFor(user, question.topicId, cutoffCache);

			// Earliest attempt that now matches the corrected solution
			let credited = false;
			for (const a of pairAttempts) {
				const queryText = (a.eventData || {}).queryText;
				const cacheKey = `${questionId}|${queryText.toLowerCase().replace(/\s+/g, " ").trim()}`;
				let verdict = compareCache.get(cacheKey);
				if (verdict === undefined) {
					const cmp = await compareQueries(queryText, question.solution, question.topic.database);
					verdict = !!(cmp && cmp.success && cmp.rowsMatch && cmp.columnsMatch && cmp.columnNamesMatch);
					compareCache.set(cacheKey, verdict);
				}
				if (!verdict) continue;

				const attemptAt = new Date(a.occurredAt);
				if (cutoff && attemptAt > cutoff) {
					console.log(`user=${userId} (${user.email}) q=${questionId}: correct at ${attemptAt.toISOString()} but past cutoff ${cutoff.toISOString()} — SKIP`);
					credited = true; // stop scanning later (even-later) attempts
					break;
				}
				console.log(`user=${userId} (${user.email}) q=${questionId}: CREDIT at ${attemptAt.toISOString()}`);
				toCreate.push({ userId, questionId, attemptAt, user });
				credited = true;
				break;
			}
			if (!credited) {
				console.log(`user=${userId} (${user.email}) q=${questionId}: no attempt matches corrected solution — no credit`);
			}
		}

		console.log(`\n${pairsChecked} (student, question) pairs checked; ${toCreate.length} completion(s) would be created.`);

		if (!args.apply) {
			console.log("DRY RUN — nothing written. Re-run with --apply to create the rows.");
			process.exit(0);
		}

		for (const item of toCreate) {
			await Completion.create({
				userId: item.userId,
				questionId: item.questionId,
				completedAt: item.attemptAt,
				academicYear: item.user.academicYear || null,
				semester: item.user.semester || null,
				courseSection: item.user.courseSection || null,
			});
		}
		console.log(`APPLIED: created ${toCreate.length} completion(s).`);
		process.exit(0);
	} catch (err) {
		console.error("regrade-attempts failed:", err.message);
		process.exit(1);
	}
})();
