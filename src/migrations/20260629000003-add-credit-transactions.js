"use strict";

module.exports = {
	up: async (queryInterface, Sequelize) => {
		try {
			console.log("Creating credit_transactions table...");

			await queryInterface.createTable("credit_transactions", {
				id: {
					type: Sequelize.INTEGER,
					primaryKey: true,
					autoIncrement: true,
				},
				user_id: {
					type: Sequelize.INTEGER,
					allowNull: false,
					references: {
						model: "users",
						key: "id",
					},
				},
				question_id: {
					type: Sequelize.INTEGER,
					allowNull: true,
					references: {
						model: "questions",
						key: "id",
					},
				},
				instructor_course_section_id: {
					type: Sequelize.INTEGER,
					allowNull: false,
					references: {
						model: "instructor_course_sections",
						key: "id",
					},
				},
				credit_request_id: {
					type: Sequelize.INTEGER,
					allowNull: true,
					// FK to credit_requests added after that table is created in migration 000004
				},
				type: {
					type: Sequelize.ENUM("seed", "spend", "grant", "refund"),
					allowNull: false,
				},
				amount: {
					type: Sequelize.INTEGER,
					allowNull: false,
				},
				balance_after: {
					type: Sequelize.INTEGER,
					allowNull: true,
				},
				prompt_tokens: {
					type: Sequelize.INTEGER,
					allowNull: true,
				},
				completion_tokens: {
					type: Sequelize.INTEGER,
					allowNull: true,
				},
				total_tokens: {
					type: Sequelize.INTEGER,
					allowNull: true,
				},
				estimated_cost_usd: {
					type: Sequelize.DECIMAL(10, 6),
					allowNull: true,
				},
				academic_year: {
					type: Sequelize.STRING(20),
					allowNull: true,
				},
				semester: {
					type: Sequelize.ENUM("Fall", "Spring", "Summer", "Winter"),
					allowNull: true,
				},
				occurred_at: {
					type: Sequelize.DATE,
					allowNull: false,
					defaultValue: Sequelize.NOW,
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

			console.log("Created credit_transactions table");

			await queryInterface.addIndex("credit_transactions", ["user_id"], {
				name: "idx_credit_tx_user",
			});
			await queryInterface.addIndex("credit_transactions", ["question_id"], {
				name: "idx_credit_tx_question",
			});
			await queryInterface.addIndex("credit_transactions", ["instructor_course_section_id"], {
				name: "idx_credit_tx_section",
			});

			console.log("Added indexes on credit_transactions");
			console.log("credit_transactions migration completed successfully");
		} catch (error) {
			console.error("Error in credit_transactions migration:", error);
			throw error;
		}
	},

	down: async (queryInterface, Sequelize) => {
		try {
			console.log("Rolling back credit_transactions migration...");
			await queryInterface.dropTable("credit_transactions");
			console.log("Dropped credit_transactions table");
		} catch (error) {
			console.error("Error rolling back credit_transactions migration:", error);
			throw error;
		}
	},
};
