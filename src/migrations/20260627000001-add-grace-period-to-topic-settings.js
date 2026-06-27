"use strict";

module.exports = {
	up: async (queryInterface, Sequelize) => {
		try {
			console.log("Adding grace_period_minutes column to instructor_section_topic_settings...");

			await queryInterface.addColumn(
				"instructor_section_topic_settings",
				"grace_period_minutes",
				{
					type: Sequelize.INTEGER,
					allowNull: false,
					defaultValue: 0,
				}
			);

			console.log("Added grace_period_minutes column");
		} catch (error) {
			console.error("Error adding grace_period_minutes column:", error);
			throw error;
		}
	},

	down: async (queryInterface, Sequelize) => {
		try {
			console.log("Removing grace_period_minutes column from instructor_section_topic_settings...");
			await queryInterface.removeColumn(
				"instructor_section_topic_settings",
				"grace_period_minutes"
			);
			console.log("Removed grace_period_minutes column");
		} catch (error) {
			console.error("Error rolling back grace_period_minutes column:", error);
			throw error;
		}
	},
};
