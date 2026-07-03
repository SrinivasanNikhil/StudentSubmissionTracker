"use strict";

module.exports = {
	up: async (queryInterface, Sequelize) => {
		try {
			console.log("Creating student_credit_balances table...");

			await queryInterface.createTable("student_credit_balances", {
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
					onDelete: "CASCADE",
				},
				instructor_course_section_id: {
					type: Sequelize.INTEGER,
					allowNull: false,
					references: {
						model: "instructor_course_sections",
						key: "id",
					},
					onDelete: "CASCADE",
				},
				academic_year: {
					type: Sequelize.STRING(20),
					allowNull: true,
				},
				semester: {
					type: Sequelize.ENUM("Fall", "Spring", "Summer", "Winter"),
					allowNull: true,
				},
				credits_remaining: {
					type: Sequelize.INTEGER,
					allowNull: false,
					defaultValue: 0,
				},
				credits_granted_total: {
					type: Sequelize.INTEGER,
					allowNull: false,
					defaultValue: 0,
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

			console.log("Created student_credit_balances table");

			await queryInterface.addIndex(
				"student_credit_balances",
				["user_id", "instructor_course_section_id", "academic_year", "semester"],
				{
					unique: true,
					name: "idx_credit_balance_unique",
				}
			);

			console.log("Added unique index on (user_id, instructor_course_section_id, academic_year, semester)");
			console.log("student_credit_balances migration completed successfully");
		} catch (error) {
			console.error("Error in student_credit_balances migration:", error);
			throw error;
		}
	},

	down: async (queryInterface, Sequelize) => {
		try {
			console.log("Rolling back student_credit_balances migration...");
			await queryInterface.dropTable("student_credit_balances");
			console.log("Dropped student_credit_balances table");
		} catch (error) {
			console.error("Error rolling back student_credit_balances migration:", error);
			throw error;
		}
	},
};
