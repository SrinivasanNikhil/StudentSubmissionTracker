"use strict";

module.exports = {
	up: async (queryInterface, Sequelize) => {
		try {
			console.log("Creating instructor_section_credit_settings table...");

			await queryInterface.createTable("instructor_section_credit_settings", {
				id: {
					type: Sequelize.INTEGER,
					primaryKey: true,
					autoIncrement: true,
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
				default_credits: {
					type: Sequelize.INTEGER,
					allowNull: false,
					defaultValue: 10,
				},
				cost_per_request: {
					type: Sequelize.INTEGER,
					allowNull: false,
					defaultValue: 1,
				},
				unlimited: {
					type: Sequelize.BOOLEAN,
					allowNull: false,
					defaultValue: false,
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

			console.log("Created instructor_section_credit_settings table");

			await queryInterface.addIndex(
				"instructor_section_credit_settings",
				["instructor_course_section_id"],
				{
					unique: true,
					name: "idx_credit_setting_section_unique",
				}
			);

			console.log("Added unique index on instructor_course_section_id");
			console.log("instructor_section_credit_settings migration completed successfully");
		} catch (error) {
			console.error("Error in instructor_section_credit_settings migration:", error);
			throw error;
		}
	},

	down: async (queryInterface, Sequelize) => {
		try {
			console.log("Rolling back instructor_section_credit_settings migration...");
			await queryInterface.dropTable("instructor_section_credit_settings");
			console.log("Dropped instructor_section_credit_settings table");
		} catch (error) {
			console.error("Error rolling back instructor_section_credit_settings migration:", error);
			throw error;
		}
	},
};
