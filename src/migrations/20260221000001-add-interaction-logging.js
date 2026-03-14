"use strict";

module.exports = {
	up: async (queryInterface, Sequelize) => {
		try {
			console.log("Adding interaction logging...");

			// Part A — Add ai_feedback_enabled column to users table
			const userTableInfo = await queryInterface.describeTable("users");

			if (!userTableInfo.ai_feedback_enabled) {
				await queryInterface.addColumn("users", "ai_feedback_enabled", {
					type: Sequelize.BOOLEAN,
					allowNull: false,
					defaultValue: true,
					comment: "Whether the student has enabled real-time AI feedback",
				});
				console.log("Added ai_feedback_enabled column to users table");
			}

			// Part B — Create interaction_logs table
			await queryInterface.createTable("interaction_logs", {
				id: {
					type: Sequelize.INTEGER,
					primaryKey: true,
					autoIncrement: true,
				},
				user_id: {
					type: Sequelize.INTEGER,
					allowNull: false,
				},
				question_id: {
					type: Sequelize.INTEGER,
					allowNull: false,
				},
				event_type: {
					type: Sequelize.ENUM(
						"query_attempt",
						"answer_revealed",
						"ai_feedback_requested"
					),
					allowNull: false,
				},
				event_data: {
					type: Sequelize.JSON,
					allowNull: true,
				},
				occurred_at: {
					type: Sequelize.DATE,
					allowNull: false,
					defaultValue: Sequelize.NOW,
				},
				academic_year: {
					type: Sequelize.STRING(20),
					allowNull: true,
				},
				semester: {
					type: Sequelize.ENUM("Fall", "Spring", "Summer", "Winter"),
					allowNull: true,
				},
				course_section: {
					type: Sequelize.STRING(50),
					allowNull: true,
				},
				created_at: {
					type: Sequelize.DATE,
					allowNull: false,
					defaultValue: Sequelize.NOW,
				},
				updated_at: {
					type: Sequelize.DATE,
					allowNull: false,
					defaultValue: Sequelize.NOW,
				},
			});

			console.log("Created interaction_logs table");

			// Add indexes
			try {
				await queryInterface.addIndex("interaction_logs", ["user_id"], {
					name: "idx_user_id",
				});
				console.log("Added index idx_user_id");
			} catch (error) {
				if (error.parent && error.parent.code === "ER_DUP_KEYNAME") {
					console.log("Index idx_user_id already exists");
				} else {
					throw error;
				}
			}

			try {
				await queryInterface.addIndex("interaction_logs", ["question_id"], {
					name: "idx_question_id",
				});
				console.log("Added index idx_question_id");
			} catch (error) {
				if (error.parent && error.parent.code === "ER_DUP_KEYNAME") {
					console.log("Index idx_question_id already exists");
				} else {
					throw error;
				}
			}

			try {
				await queryInterface.addIndex("interaction_logs", ["event_type"], {
					name: "idx_event_type",
				});
				console.log("Added index idx_event_type");
			} catch (error) {
				if (error.parent && error.parent.code === "ER_DUP_KEYNAME") {
					console.log("Index idx_event_type already exists");
				} else {
					throw error;
				}
			}

			try {
				await queryInterface.addIndex("interaction_logs", ["occurred_at"], {
					name: "idx_occurred_at",
				});
				console.log("Added index idx_occurred_at");
			} catch (error) {
				if (error.parent && error.parent.code === "ER_DUP_KEYNAME") {
					console.log("Index idx_occurred_at already exists");
				} else {
					throw error;
				}
			}

			console.log("Interaction logging migration completed successfully");
		} catch (error) {
			console.error("Error in interaction logging migration:", error);
			throw error;
		}
	},

	down: async (queryInterface, Sequelize) => {
		try {
			console.log("Rolling back interaction logging migration...");

			// Drop interaction_logs table
			try {
				await queryInterface.dropTable("interaction_logs");
				console.log("Dropped interaction_logs table");
			} catch (error) {
				console.log(
					"interaction_logs table not found or already dropped"
				);
			}

			// Remove ai_feedback_enabled column from users
			try {
				const tableInfo = await queryInterface.describeTable("users");
				if (tableInfo.ai_feedback_enabled) {
					await queryInterface.removeColumn(
						"users",
						"ai_feedback_enabled"
					);
					console.log(
						"Removed ai_feedback_enabled column from users table"
					);
				}
			} catch (error) {
				console.log(
					"Error removing ai_feedback_enabled column:",
					error.message
				);
			}

			console.log(
				"Interaction logging migration rolled back successfully"
			);
		} catch (error) {
			console.error(
				"Error rolling back interaction logging migration:",
				error
			);
			throw error;
		}
	},
};
