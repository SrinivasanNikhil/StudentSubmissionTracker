const { Sequelize } = require("sequelize");
const { sequelize } = require("../config/database");
const migration = require("../migrations/20250120000006-add-semester-tracking");

async function runMigration() {
	try {
		console.log("Starting semester tracking migration...");

		// Run the migration
		await migration.up(sequelize.getQueryInterface(), Sequelize);
		console.log("Semester tracking migration completed successfully");
	} catch (error) {
		console.error("Migration failed:", error);
		throw error;
	} finally {
		// Close the database connection
		await sequelize.close();
	}
}

runMigration();
