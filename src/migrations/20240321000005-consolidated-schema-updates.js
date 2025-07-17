"use strict";

module.exports = {
	up: async (queryInterface, Sequelize) => {
		try {
			// First, handle the topics table changes
			console.log("Updating topics table...");
			try {
				await queryInterface.addColumn("topics", "type", {
					type: Sequelize.STRING(20),
					allowNull: false,
					defaultValue: "sql",
					comment: "Type of topic: sql or data_model",
				});
				console.log("Added type column to topics table");
			} catch (error) {
				console.log("type column already exists in topics table");
			}

			// Now handle the completions table changes
			console.log("Updating completions table...");

			// First, drop old columns if they exist
			try {
				await queryInterface.removeColumn("completions", "diagram_data");
				console.log("Removed diagram_data column");
			} catch (error) {
				console.log(
					"diagram_data column does not exist or could not be removed"
				);
			}

			try {
				await queryInterface.removeColumn("completions", "svg_data");
				console.log("Removed svg_data column");
			} catch (error) {
				console.log("svg_data column does not exist or could not be removed");
			}

			// Add new columns for data model questions
			const columnsToAdd = [
				{
					name: "diagram_image",
					definition: {
						type: Sequelize.STRING,
						allowNull: true,
						comment: "Path to the uploaded ER diagram image",
					},
				},
				{
					name: "enhancements",
					definition: {
						type: Sequelize.TEXT,
						allowNull: true,
						comment:
							"Student's explanation of enhancements made to the base scenario",
					},
				},
				{
					name: "ai_reflection",
					definition: {
						type: Sequelize.TEXT,
						allowNull: true,
						comment: "Student's reflection on AI tool usage",
					},
				},
				{
					name: "evaluation",
					definition: {
						type: Sequelize.TEXT,
						allowNull: true,
						comment: "JSON string containing evaluation results",
					},
				},
				{
					name: "admin_comments",
					definition: {
						type: Sequelize.TEXT,
						allowNull: true,
						comment: "Admin's feedback on the submission",
					},
				},
				{
					name: "admin_score",
					definition: {
						type: Sequelize.INTEGER,
						allowNull: true,
						comment: "Admin's score for the submission (0-10)",
					},
				},
				{
					name: "ai_score",
					definition: {
						type: Sequelize.INTEGER,
						allowNull: true,
						comment: "AI's score for the submission (0-10)",
					},
				},
				{
					name: "status",
					definition: {
						type: Sequelize.ENUM("pending", "evaluated", "reviewed"),
						allowNull: false,
						defaultValue: "pending",
						comment: "Current status of the submission",
					},
				},
			];

			// Add each column with existence check
			for (const column of columnsToAdd) {
				try {
					const tableInfo = await queryInterface.describeTable("completions");
					if (!tableInfo[column.name]) {
						await queryInterface.addColumn(
							"completions",
							column.name,
							column.definition
						);
						console.log(`Added ${column.name} column to completions table`);
					} else {
						console.log(
							`${column.name} column already exists in completions table`
						);
					}
				} catch (error) {
					console.log(`Error adding ${column.name} column:`, error.message);
				}
			}

			console.log("Schema updates completed successfully");
		} catch (error) {
			console.error("Error in migration:", error);
			throw error;
		}
	},

	down: async (queryInterface, Sequelize) => {
		try {
			// Remove columns from completions table
			const columnsToRemove = [
				"diagram_image",
				"enhancements",
				"ai_reflection",
				"evaluation",
				"admin_comments",
				"admin_score",
				"ai_score",
				"status",
			];

			for (const column of columnsToRemove) {
				try {
					const tableInfo = await queryInterface.describeTable("completions");
					if (tableInfo[column]) {
						await queryInterface.removeColumn("completions", column);
						console.log(`Removed ${column} column from completions table`);
					}
				} catch (error) {
					console.log(`Error removing ${column} column:`, error.message);
				}
			}

			// Add back old columns
			try {
				await queryInterface.addColumn("completions", "diagram_data", {
					type: Sequelize.TEXT,
					allowNull: true,
					comment: "XMLPNG string containing the draw.io diagram data",
				});
				console.log("Added back diagram_data column");
			} catch (error) {
				console.log("Could not add back diagram_data column");
			}

			try {
				await queryInterface.addColumn("completions", "svg_data", {
					type: Sequelize.TEXT,
					allowNull: true,
					comment: "SVG string containing the diagram data for AI evaluation",
				});
				console.log("Added back svg_data column");
			} catch (error) {
				console.log("Could not add back svg_data column");
			}

			// Remove type column from topics table
			try {
				await queryInterface.removeColumn("topics", "type");
				console.log("Removed type column from topics table");
			} catch (error) {
				console.log("Could not remove type column from topics table");
			}

			console.log("Schema rollback completed successfully");
		} catch (error) {
			console.error("Error in migration rollback:", error);
			throw error;
		}
	},
};
