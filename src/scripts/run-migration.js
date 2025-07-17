const { Sequelize } = require("sequelize");
const { sequelize } = require("../config/database");
const migration = require("../migrations/20240321_add_code_to_users");

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
