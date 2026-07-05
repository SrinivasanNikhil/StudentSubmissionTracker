"use strict";

module.exports = {
	up: async (queryInterface, Sequelize) => {
		try {
			console.log("Adding assignment_type column to instructor_section_topic_settings...");

			await queryInterface.addColumn(
				"instructor_section_topic_settings",
				"assignment_type",
				{
					type: Sequelize.STRING(20),
					allowNull: false,
					defaultValue: "practice",
				}
			);

			console.log("Added assignment_type column");
		} catch (error) {
			console.error("Error adding assignment_type column:", error);
			throw error;
		}
	},

	down: async (queryInterface, Sequelize) => {
		try {
			console.log("Removing assignment_type column from instructor_section_topic_settings...");
			await queryInterface.removeColumn(
				"instructor_section_topic_settings",
				"assignment_type"
			);
			console.log("Removed assignment_type column");
		} catch (error) {
			console.error("Error rolling back assignment_type column:", error);
			throw error;
		}
	},
};
