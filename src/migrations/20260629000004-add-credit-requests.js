"use strict";

module.exports = {
	up: async (queryInterface, Sequelize) => {
		try {
			console.log("Creating credit_requests table...");

			await queryInterface.createTable("credit_requests", {
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
				instructor_course_section_id: {
					type: Sequelize.INTEGER,
					allowNull: false,
					references: {
						model: "instructor_course_sections",
						key: "id",
					},
				},
				status: {
					type: Sequelize.ENUM("pending", "approved", "denied"),
					allowNull: false,
					defaultValue: "pending",
				},
				student_message: {
					type: Sequelize.TEXT,
					allowNull: true,
				},
				requested_at: {
					type: Sequelize.DATE,
					allowNull: false,
					defaultValue: Sequelize.NOW,
				},
				resolved_at: {
					type: Sequelize.DATE,
					allowNull: true,
				},
				resolved_by_user_id: {
					type: Sequelize.INTEGER,
					allowNull: true,
					references: {
						model: "users",
						key: "id",
					},
				},
				credits_granted: {
					type: Sequelize.INTEGER,
					allowNull: true,
				},
				instructor_note: {
					type: Sequelize.TEXT,
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

			console.log("Created credit_requests table");

			await queryInterface.addIndex("credit_requests", ["user_id"], {
				name: "idx_credit_req_user",
			});
			await queryInterface.addIndex("credit_requests", ["instructor_course_section_id"], {
				name: "idx_credit_req_section",
			});
			await queryInterface.addIndex("credit_requests", ["status"], {
				name: "idx_credit_req_status",
			});

			// Add FK from credit_transactions.credit_request_id → credit_requests.id now that table exists
			await queryInterface.addConstraint("credit_transactions", {
				fields: ["credit_request_id"],
				type: "foreign key",
				name: "fk_credit_tx_request",
				references: {
					table: "credit_requests",
					field: "id",
				},
				onDelete: "SET NULL",
			});

			console.log("Added FK from credit_transactions.credit_request_id → credit_requests.id");
			console.log("credit_requests migration completed successfully");
		} catch (error) {
			console.error("Error in credit_requests migration:", error);
			throw error;
		}
	},

	down: async (queryInterface, Sequelize) => {
		try {
			console.log("Rolling back credit_requests migration...");
			try {
				await queryInterface.removeConstraint("credit_transactions", "fk_credit_tx_request");
			} catch (e) {
				console.log("FK removal skipped (may not exist):", e.message);
			}
			await queryInterface.dropTable("credit_requests");
			console.log("Dropped credit_requests table");
		} catch (error) {
			console.error("Error rolling back credit_requests migration:", error);
			throw error;
		}
	},
};
