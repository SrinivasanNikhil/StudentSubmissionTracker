const { Sequelize, DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

async function updateSchema() {
	try {
		const queryInterface = sequelize.getQueryInterface();

		console.log("Starting schema update...");

		// Add type to topics table
		console.log("Adding type column to topics table...");
		await queryInterface.addColumn("topics", "type", {
			type: DataTypes.STRING(20),
			allowNull: false,
			defaultValue: "sql",
			comment: "Type of topic: sql or data_model",
		});
		console.log("Successfully added type column to topics table");

		// Add data model specific fields to questions table
		console.log("Adding expected_outputs column to questions table...");
		await queryInterface.addColumn("questions", "expected_outputs", {
			type: DataTypes.TEXT,
			allowNull: true,
			comment: "JSON string of expected outputs for data model questions",
		});
		console.log(
			"Successfully added expected_outputs column to questions table"
		);

		console.log("Adding model_description column to questions table...");
		await queryInterface.addColumn("questions", "model_description", {
			type: DataTypes.TEXT,
			allowNull: true,
			comment:
				"Detailed description of the data model for data model questions",
		});
		console.log(
			"Successfully added model_description column to questions table"
		);

		console.log("Schema update completed successfully!");
		process.exit(0);
	} catch (error) {
		if (error.name === "SequelizeDatabaseError") {
			if (error.parent.code === "ER_DUP_FIELDNAME") {
				console.log(
					"One or more columns already exist. This is not an error, continuing..."
				);
				process.exit(0);
			}
		}
		console.error("Error updating schema:", error);
		process.exit(1);
	}
}

// Run the update
updateSchema();
