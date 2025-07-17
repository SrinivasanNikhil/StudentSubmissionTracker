"use strict";

module.exports = {
	up: async (queryInterface, Sequelize) => {
		try {
			// Add baseEntities and baseRelationships columns to questions table
			const columnsToAdd = [
				{
					name: "base_entities",
					definition: {
						type: Sequelize.TEXT,
						allowNull: true,
						comment: "JSON string of base entities required in the data model",
					},
				},
				{
					name: "base_relationships",
					definition: {
						type: Sequelize.TEXT,
						allowNull: true,
						comment:
							"JSON string of base relationships required in the data model",
					},
				},
			];

			// Add each column with existence check
			for (const column of columnsToAdd) {
				try {
					const tableInfo = await queryInterface.describeTable("questions");
					if (!tableInfo[column.name]) {
						await queryInterface.addColumn(
							"questions",
							column.name,
							column.definition
						);
						console.log(`Added ${column.name} column to questions table`);
					} else {
						console.log(
							`${column.name} column already exists in questions table`
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
			// Remove columns from questions table
			const columnsToRemove = ["base_entities", "base_relationships"];

			for (const column of columnsToRemove) {
				try {
					const tableInfo = await queryInterface.describeTable("questions");
					if (tableInfo[column]) {
						await queryInterface.removeColumn("questions", column);
						console.log(`Removed ${column} column from questions table`);
					}
				} catch (error) {
					console.log(`Error removing ${column} column:`, error.message);
				}
			}

			console.log("Schema rollback completed successfully");
		} catch (error) {
			console.error("Error in migration rollback:", error);
			throw error;
		}
	},
};
