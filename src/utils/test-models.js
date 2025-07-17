/**
 * Database Model Testing Utility
 *
 * This script verifies that database models are correctly defined and match the database schema.
 * It attempts to query each model and reports any errors.
 *
 * Usage:
 * node src/utils/test-models.js
 */

const dotenv = require("dotenv");
const { testConnection, sequelize } = require("../config/database");
const { User, Topic, Question, Completion } = require("../models");

// Load environment variables
dotenv.config();

// Define colors for console output
const colors = {
	reset: "\x1b[0m",
	bright: "\x1b[1m",
	red: "\x1b[31m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	blue: "\x1b[34m",
	cyan: "\x1b[36m",
};

async function testModel(model, name) {
	try {
		// Try to find first record
		const record = await model.findOne();

		// Get field mappings from model
		const attributes = model.getAttributes();
		const fields = Object.entries(attributes).map(([key, attr]) => {
			const fieldName = attr.field || key;
			const mappingInfo =
				attr.field && attr.field !== key ? `(→ ${attr.field})` : "";

			return `${key} ${mappingInfo}`;
		});

		console.log(
			`  ${colors.bright}${colors.green}✓ ${name} model verified${colors.reset}`
		);

		// Show field mappings summary
		console.log(`    Fields: ${fields.join(", ")}`);

		// Show sample data (if found)
		if (record) {
			console.log(`    Sample record found: ID=${record.id}`);
		} else {
			console.log(
				`    ${colors.yellow}No records found in ${name} table${colors.reset}`
			);
		}
	} catch (error) {
		console.error(
			`  ${colors.bright}${colors.red}✗ ${name} model error:${colors.reset} ${error.message}`
		);

		// Provide more helpful information based on error type
		if (error.name === "SequelizeDatabaseError") {
			console.error(
				`    ${colors.yellow}This might be a schema mismatch. Try running the schema update script:${colors.reset}`
			);
			console.error(`    node src/utils/update-schema.js`);
		} else if (error.name === "SequelizeConnectionError") {
			console.error(
				`    ${colors.yellow}Database connection error. Check your .env configuration.${colors.reset}`
			);
		}
	}
}

async function testModels() {
	console.log(
		`\n${colors.bright}${colors.blue}===== SQL Practice App - Database Model Test =====${colors.reset}\n`
	);

	try {
		// Test database connection
		console.log(`${colors.cyan}Testing database connection...${colors.reset}`);
		await testConnection();
		console.log(
			`${colors.green}✓ Database connection successful${colors.reset}\n`
		);

		// Test models
		console.log(`${colors.cyan}Testing database models...${colors.reset}`);

		await testModel(User, "User");
		await testModel(Topic, "Topic");
		await testModel(Question, "Question");
		await testModel(Completion, "Completion");

		// Get database version info
		const [dbInfo] = await sequelize.query("SELECT version() as version");
		const dbVersion = dbInfo[0]?.version || "Unknown";

		console.log(`\n${colors.cyan}Database information:${colors.reset}`);
		console.log(`  Version: ${dbVersion}`);
		console.log(`  Dialect: ${sequelize.options.dialect}`);
		console.log(`  Database: ${sequelize.config.database}`);

		console.log(
			`\n${colors.bright}${colors.green}✅ All models tested${colors.reset}\n`
		);
	} catch (error) {
		console.error(
			`\n${colors.red}${colors.bright}ERROR: ${error.message}${colors.reset}`
		);
	} finally {
		// Close the database connection
		await sequelize.close();
	}
}

// Run the tests
testModels();
