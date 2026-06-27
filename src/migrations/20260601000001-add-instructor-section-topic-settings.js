"use strict";

module.exports = {
	up: async (queryInterface, Sequelize) => {
		try {
			console.log("Creating instructor_section_topic_settings table...");

			await queryInterface.createTable("instructor_section_topic_settings", {
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
				topic_id: {
					type: Sequelize.INTEGER,
					allowNull: false,
					references: {
						model: "topics",
						key: "id",
					},
					onDelete: "CASCADE",
				},
				due_date: {
					type: Sequelize.DATE,
					allowNull: true,
				},
				is_visible: {
					type: Sequelize.BOOLEAN,
					allowNull: false,
					defaultValue: true,
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

			console.log("Created instructor_section_topic_settings table");

			await queryInterface.addIndex(
				"instructor_section_topic_settings",
				["instructor_course_section_id", "topic_id"],
				{
					unique: true,
					name: "idx_section_topic_unique",
				}
			);

			console.log("Added unique index on (instructor_course_section_id, topic_id)");
			console.log("instructor_section_topic_settings migration completed successfully");
		} catch (error) {
			console.error("Error in instructor_section_topic_settings migration:", error);
			throw error;
		}
	},

	down: async (queryInterface, Sequelize) => {
		try {
			console.log("Rolling back instructor_section_topic_settings migration...");
			await queryInterface.dropTable("instructor_section_topic_settings");
			console.log("Dropped instructor_section_topic_settings table");
		} catch (error) {
			console.error("Error rolling back instructor_section_topic_settings migration:", error);
			throw error;
		}
	},
};
