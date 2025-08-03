"use strict";

module.exports = {
	up: async (queryInterface, Sequelize) => {
		try {
			console.log("Adding unique constraint to completions table...");

			// First, let's check if there are any duplicate records and clean them up
			console.log("Checking for duplicate completion records...");

			const duplicates = await queryInterface.sequelize.query(`
				SELECT user_id, question_id, COUNT(*) as count
				FROM completions 
				GROUP BY user_id, question_id 
				HAVING COUNT(*) > 1
			`);

			if (duplicates[0].length > 0) {
				console.log(
					`Found ${duplicates[0].length} duplicate completion records. Cleaning up...`
				);

				// For each duplicate group, keep only the most recent completion
				for (const duplicate of duplicates[0]) {
					await queryInterface.sequelize.query(
						`
						DELETE c1 FROM completions c1
						INNER JOIN completions c2 
						WHERE c1.user_id = c2.user_id 
						AND c1.question_id = c2.question_id 
						AND c1.user_id = ? 
						AND c1.question_id = ?
						AND c1.id < c2.id
					`,
						{
							replacements: [duplicate.user_id, duplicate.question_id],
						}
					);
				}

				console.log("Duplicate records cleaned up successfully");
			} else {
				console.log("No duplicate completion records found");
			}

			// Add unique constraint
			await queryInterface.addConstraint("completions", {
				fields: ["user_id", "question_id"],
				type: "unique",
				name: "unique_user_question_completion",
			});

			console.log("Unique constraint added successfully to completions table");
		} catch (error) {
			console.error("Error adding unique constraint:", error);
			throw error;
		}
	},

	down: async (queryInterface, Sequelize) => {
		try {
			console.log("Removing unique constraint from completions table...");

			await queryInterface.removeConstraint(
				"completions",
				"unique_user_question_completion"
			);

			console.log(
				"Unique constraint removed successfully from completions table"
			);
		} catch (error) {
			console.error("Error removing unique constraint:", error);
			throw error;
		}
	},
};
