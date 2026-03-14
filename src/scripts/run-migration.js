const { Sequelize } = require("sequelize");
const { sequelize } = require("../config/database");
const migration = require("../migrations/20260221000001-add-interaction-logging");

async function runMigration() {
	try {
		// Run the migration
		await migration.up(sequelize.getQueryInterface(), Sequelize);
		console.log("Migration completed successfully");
	} catch (error) {
		console.error("Migration failed:", error);
	} finally {
		// Close the database connection
		await sequelize.close();
	}
}

runMigration();
