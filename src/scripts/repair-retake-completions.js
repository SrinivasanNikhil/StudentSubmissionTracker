/**
 * Repair completions for a student RETAKING the course.
 *
 * Background: completions used to be unique per (user, question) forever, so a
 * retaker's prior-term rows blocked new completions from being recorded even
 * though their correct attempts were logged. After the unique key was widened
 * to (user, question, academicYear, semester), this script back-fills the
 * missing current-term completions from the student's own interaction logs.
 *
 * DRY-RUN BY DEFAULT — prints what it would do; nothing is written unless
 * --apply is passed.
 *
 * Usage:
 *   node src/scripts/repair-retake-completions.js --userId 194 --since 2026-06-01
 *   node src/scripts/repair-retake-completions.js --userId 194 --since 2026-06-01 --apply
 *   node src/scripts/repair-retake-completions.js --scan     # list other possible retakers
 *
 * Policy honored per question: the EARLIEST correct attempt since --since is
 * used as the completion time, and it must fall within the topic's
 * dueDate + gracePeriodMinutes for the student's section (mirroring
 * getDeadlineStatus in src/routes/questions.js). Questions already completed
 * this term are skipped.
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

function parseArgs(argv) {
	const args = { apply: false, scan: false, userId: null, since: null };
	for (let i = 2; i < argv.length; i++) {
		const a = argv[i];
		if (a === "--apply") args.apply = true;
		else if (a === "--scan") args.scan = true;
		else if (a === "--userId") args.userId = parseInt(argv[++i], 10);
		else if (a === "--since") args.since = argv[++i];
	}
	return args;
}

// List users whose completion rows carry a term different from their current
// user-profile term — candidates for this repair.
async function scanForRetakers() {
	const students = await User.findAll({
		where: { role: "student" },
		attributes: ["id", "email", "firstName", "lastName", "academicYear", "semester"],
	});
	const byId = new Map(students.map((s) => [s.id, s]));

	const completions = await Completion.findAll({
		attributes: ["userId", "academicYear", "semester"],
	});

	const mismatches = new Map();
	for (const c of completions) {
		const s = byId.get(c.userId);
		if (!s || !s.academicYear || !s.semester) continue;
		if (c.academicYear !== s.academicYear || c.semester !== s.semester) {
			mismatches.set(c.userId, (mismatches.get(c.userId) || 0) + 1);
		}
	}

	if (mismatches.size === 0) {
		console.log("No students found with completions from a different term than their current profile.");
		return;
	}
	console.log("Students with prior-term completion rows (possible retakers):\n");
	for (const [userId, count] of mismatches) {
		const s = byId.get(userId);
		console.log(
			`  userId=${userId}  ${s.email}  current term=${s.academicYear}/${s.semester}  prior-term completions=${count}`
		);
	}
	console.log(
		"\nRun with --userId <id> --since <YYYY-MM-DD> to preview a repair for a specific student."
	);
}

async function repair(args) {
	const user = await User.findByPk(args.userId);
	if (!user || user.role !== "student") {
		throw new Error(`User ${args.userId} not found or not a student.`);
	}
	if (!user.academicYear || !user.semester) {
		throw new Error(
			`User ${args.userId} has no academicYear/semester on their profile — set their course section first.`
		);
	}
	const since = new Date(args.since);
	if (isNaN(since.getTime())) {
		throw new Error(`--since '${args.since}' is not a valid date (use YYYY-MM-DD).`);
	}

	console.log(
		`Repairing completions for userId=${user.id} (${user.email}) — term ${user.academicYear}/${user.semester}, section ${user.courseSection || "none"}`
	);
	console.log(`Considering correct attempts since ${since.toISOString()}\n`);

	// Section topic settings (deadline + grace) — isActive:true is required to
	// avoid stale duplicate section rows (see CLAUDE.md).
	const settingsByTopic = new Map();
	if (user.courseSection && user.associatedInstructorId) {
		const dashIndex = user.courseSection.indexOf("-");
		const courseCode = dashIndex !== -1 ? user.courseSection.slice(0, dashIndex) : user.courseSection;
		const sectionCode = dashIndex !== -1 ? user.courseSection.slice(dashIndex + 1) : "";
		const section = await InstructorCourseSection.findOne({
			where: {
				instructorId: user.associatedInstructorId,
				courseCode,
				sectionCode,
				isActive: true,
			},
		});
		if (section) {
			const settings = await InstructorSectionTopicSetting.findAll({
				where: { instructorCourseSectionId: section.id },
			});
			settings.forEach((s) => settingsByTopic.set(s.topicId, s));
		} else {
			console.log("WARNING: no active InstructorCourseSection matched — deadlines cannot be checked; treating all topics as having no deadline.\n");
		}
	}

	// All correct attempts since the cutoff, oldest first, so the first one we
	// see per question is the earliest.
	const attempts = await InteractionLog.findAll({
		where: {
			userId: user.id,
			eventType: "query_attempt",
			occurredAt: { [Op.gte]: since },
		},
		order: [["occurred_at", "ASC"]],
	});

	const earliestCorrectByQuestion = new Map();
	for (const log of attempts) {
		const data = log.eventData || {};
		if (data.isCorrect === true && !earliestCorrectByQuestion.has(log.questionId)) {
			earliestCorrectByQuestion.set(log.questionId, log);
		}
	}

	if (earliestCorrectByQuestion.size === 0) {
		console.log("No correct attempts found in the window. Nothing to do.");
		return;
	}

	const questionIds = Array.from(earliestCorrectByQuestion.keys());
	const questions = await Question.findAll({
		where: { id: { [Op.in]: questionIds } },
		include: [{ model: Topic, as: "topic" }],
	});
	const questionById = new Map(questions.map((q) => [q.id, q]));

	const existing = await Completion.findAll({
		where: {
			userId: user.id,
			questionId: { [Op.in]: questionIds },
			academicYear: user.academicYear,
			semester: user.semester,
		},
		attributes: ["questionId"],
	});
	const alreadyDone = new Set(existing.map((c) => c.questionId));

	const toCreate = [];
	console.log("question  topic                                    attempt time (UTC)    verdict");
	console.log("-".repeat(100));
	for (const [questionId, log] of earliestCorrectByQuestion) {
		const q = questionById.get(questionId);
		const topicName = q ? q.topic.name : "?";
		const attemptAt = new Date(log.occurredAt);
		let verdict;

		if (!q) {
			verdict = "SKIP (question no longer exists)";
		} else if (alreadyDone.has(questionId)) {
			verdict = "SKIP (already completed this term)";
		} else {
			const setting = settingsByTopic.get(q.topicId);
			if (setting && setting.dueDate) {
				const graceCutoff = new Date(
					new Date(setting.dueDate).getTime() +
						(setting.gracePeriodMinutes || 0) * 60000
				);
				if (attemptAt > graceCutoff) {
					verdict = `SKIP (past deadline+grace ${graceCutoff.toISOString()})`;
				} else {
					verdict = "CREATE (within deadline)";
					toCreate.push({ questionId, attemptAt });
				}
			} else {
				verdict = "CREATE (no deadline set)";
				toCreate.push({ questionId, attemptAt });
			}
		}

		console.log(
			`${String(questionId).padEnd(9)} ${topicName.padEnd(40).slice(0, 40)} ${attemptAt.toISOString()}  ${verdict}`
		);
	}

	console.log(`\n${toCreate.length} completion(s) would be created.`);

	if (!args.apply) {
		console.log("DRY RUN — nothing written. Re-run with --apply to create the rows.");
		return;
	}

	for (const item of toCreate) {
		await Completion.create({
			userId: user.id,
			questionId: item.questionId,
			completedAt: item.attemptAt,
			academicYear: user.academicYear,
			semester: user.semester,
			courseSection: user.courseSection,
		});
	}
	console.log(`APPLIED: created ${toCreate.length} completion(s) for userId=${user.id}.`);
}

(async () => {
	try {
		const args = parseArgs(process.argv);
		if (args.scan) {
			await scanForRetakers();
		} else if (args.userId && args.since) {
			await repair(args);
		} else {
			console.log(
				"Usage:\n  node src/scripts/repair-retake-completions.js --userId <id> --since <YYYY-MM-DD> [--apply]\n  node src/scripts/repair-retake-completions.js --scan"
			);
		}
		process.exit(0);
	} catch (err) {
		console.error("Repair failed:", err.message);
		process.exit(1);
	}
})();
