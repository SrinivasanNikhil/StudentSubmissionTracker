require("dotenv").config();
const mysql = require("mysql2/promise");

/**
 * Script to inspect the actual schema of the Text database
 * This will show us all tables and their structures
 */

const inspectTextDatabaseSchema = async () => {
	let connection;
	try {
		console.log("🔍 Inspecting Text database schema...");

		// Try to connect using the same credentials as the main database
		connection = await mysql.createConnection({
			host: process.env.DB_HOST,
			port: process.env.DB_PORT,
			user: process.env.DB_USER,
			password: process.env.DB_PASSWORD,
			database: "Text", // Updated to match the correct database name
		});

		console.log("✅ Connected to Text database successfully");

		// Get all tables in the database
		console.log("\n📋 Tables in Text database:");
		const [tables] = await connection.execute("SHOW TABLES");
		console.log(tables);

		// For each table, get its structure
		for (const tableRow of tables) {
			const tableName = Object.values(tableRow)[0];
			console.log(`\n🔍 Table: ${tableName}`);

			// Get table structure
			const [columns] = await connection.execute(`DESCRIBE \`${tableName}\``);
			console.log("Columns:");
			columns.forEach((col) => {
				console.log(
					`  - ${col.Field}: ${col.Type} ${
						col.Null === "NO" ? "NOT NULL" : "NULL"
					} ${col.Key === "PRI" ? "PRIMARY KEY" : ""} ${
						col.Default ? `DEFAULT ${col.Default}` : ""
					}`
				);
			});

			// Get sample data (first 3 rows)
			try {
				const [sampleData] = await connection.execute(
					`SELECT * FROM \`${tableName}\` LIMIT 3`
				);
				console.log(`Sample data (first 3 rows):`);
				console.log(sampleData);
			} catch (error) {
				console.log(`Could not retrieve sample data: ${error.message}`);
			}
		}

		console.log("\n✅ Text database schema inspection completed successfully!");
	} catch (error) {
		console.error("❌ Error inspecting Text database schema:", error.message);
	} finally {
		if (connection) {
			await connection.end();
			console.log("Database connection closed");
		}
	}
};

// Run the inspection
inspectTextDatabaseSchema();
