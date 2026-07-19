/**
 * Verify every SQL question's stored reference solution actually executes
 * against its topic's database. Read-only.
 *
 * A failing solution is invisible to students in a misleading way — because
 * compareQueries treats a failed solution as "0 rows / 0 columns", the student
 * sees a bogus mismatch instead of an error. Run this after any content change.
 *
 * Usage:  node src/scripts/verify-solutions.js
 * Exit code 1 if any solution is broken (CI-friendly), 0 if all pass.
 */

const { Sequelize } = require("sequelize");
const { sequelize } = require("../config/database");
const { executeQuery } = require("../services/sqlExecutor");

(async () => {
	try {
		const questions = await sequelize.query(
			"SELECT q.id, q.question_number qn, t.name tname, t.`database` dbname " +
				"FROM questions q JOIN topics t ON t.id=q.topic_id " +
				"WHERE t.type='sql' AND q.solution IS NOT NULL AND q.solution != '' " +
				"ORDER BY t.id, q.question_number",
			{ type: Sequelize.QueryTypes.SELECT }
		);

		// Re-fetch solution per row (kept out of the join to avoid huge log lines)
		const solutions = await sequelize.query(
			"SELECT id, solution FROM questions WHERE solution IS NOT NULL AND solution != ''",
			{ type: Sequelize.QueryTypes.SELECT }
		);
		const solById = new Map(solutions.map((s) => [s.id, s.solution]));

		const broken = [];
		for (const q of questions) {
			const r = await executeQuery(solById.get(q.id), q.dbname);
			if (!r.success) {
				broken.push({ id: q.id, topic: q.tname, qn: q.qn, err: (r.message || "").slice(0, 100) });
			}
		}

		console.log(`Checked ${questions.length} SQL solutions.`);
		if (broken.length === 0) {
			console.log("All solutions execute successfully. ✅");
			process.exit(0);
		}
		console.log(`\n${broken.length} BROKEN solution(s):`);
		for (const b of broken) {
			console.log(`  id=${b.id}  ${b.topic}  Q${b.qn}: ${b.err}`);
		}
		process.exit(1);
	} catch (err) {
		console.error("verify-solutions failed:", err.message);
		process.exit(2);
	}
})();
