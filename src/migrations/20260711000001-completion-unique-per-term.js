"use strict";

module.exports = {
	/**
	 * Allow students who retake the course to earn completions again in the new
	 * term. The old unique key on (user_id, question_id) meant one completion per
	 * user+question EVER, so a retaker's prior-term rows permanently blocked new
	 * ones. Widen the key to include the term columns.
	 *
	 * Schema-only: the old key was strictly tighter, so no duplicate
	 * (user, question, year, semester) tuples can exist and the new index cannot
	 * fail to build. No rows are modified.
	 */
	up: async (queryInterface, Sequelize) => {
		try {
			console.log(
				"Replacing completions unique key (user,question) with (user,question,academic_year,semester)..."
			);

			// Add the new wider unique index first so the table is never without
			// duplicate protection.
			await queryInterface.addIndex("completions", {
				fields: ["user_id", "question_id", "academic_year", "semester"],
				unique: true,
				name: "unique_user_question_term_completion",
			});

			// Then drop the old, stricter constraint.
			await queryInterface.removeConstraint(
				"completions",
				"unique_user_question_completion"
			);

			console.log(
				"completions unique key is now per (user, question, academic_year, semester)."
			);
		} catch (error) {
			console.error("Error in completion-unique-per-term migration:", error);
			throw error;
		}
	},

	down: async (queryInterface, Sequelize) => {
		// Restore the original key. NOTE: this will fail if per-term duplicate
		// (user, question) rows have been created since the up migration ran —
		// those rows must be resolved manually first.
		await queryInterface.addConstraint("completions", {
			fields: ["user_id", "question_id"],
			type: "unique",
			name: "unique_user_question_completion",
		});
		await queryInterface.removeIndex(
			"completions",
			"unique_user_question_term_completion"
		);
		console.log("Restored original (user_id, question_id) unique constraint.");
	},
};
