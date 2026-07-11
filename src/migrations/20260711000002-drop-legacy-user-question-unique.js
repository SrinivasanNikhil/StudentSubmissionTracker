"use strict";

module.exports = {
	/**
	 * Companion to 20260711000001-completion-unique-per-term: the completions
	 * table carried a SECOND legacy unique index on (user_id, question_id) named
	 * `user_question_unique` (from an earlier sync era), separate from the
	 * `unique_user_question_completion` constraint the previous migration
	 * removed. It still enforced one-completion-per-question-ever, defeating the
	 * per-term key. Drop it if present (idempotent across environments).
	 */
	up: async (queryInterface, Sequelize) => {
		const indexes = await queryInterface.sequelize.query(
			`SHOW INDEX FROM completions WHERE Key_name = 'user_question_unique'`,
			{ type: Sequelize.QueryTypes.SELECT }
		);

		if (indexes.length === 0) {
			console.log(
				"Legacy index user_question_unique not present — nothing to drop."
			);
			return;
		}

		await queryInterface.removeIndex("completions", "user_question_unique");
		console.log(
			"Dropped legacy unique index user_question_unique (user_id, question_id)."
		);
	},

	down: async (queryInterface, Sequelize) => {
		// Restoring the legacy one-per-question-ever index would re-break
		// per-term completions and fail if cross-term rows now exist; the
		// per-term unique index continues to protect against duplicates.
		console.log(
			"drop-legacy-user-question-unique: down is a no-op (legacy index intentionally not restored)."
		);
	},
};
