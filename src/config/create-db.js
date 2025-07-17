require("dotenv").config();
const mysql = require("mysql2/promise");

// Create the database if it doesn't exist
const createDatabase = async () => {
	try {
		// Create a connection without specifying the database
		const connection = await mysql.createConnection({
			host: process.env.APP_DB_HOST,
			port: process.env.APP_DB_PORT,
			user: process.env.APP_DB_USER,
			password: process.env.APP_DB_PASSWORD,
		});

		console.log("Connected to MySQL server");

		// Create the database if it doesn't exist
		const dbName = process.env.APP_DB_NAME;
		console.log(`Creating database ${dbName} if it doesn't exist...`);

		await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` 
                           CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);

		console.log(`Database ${dbName} created or already exists`);

		// Close the connection
		await connection.end();
		console.log("Database creation script completed successfully!");

		return true;
	} catch (error) {
		console.error("Error creating database:", error);
		return false;
	}
};

// Run the function if this script is executed directly
if (require.main === module) {
	createDatabase().then((success) => {
		process.exit(success ? 0 : 1);
	});
}

module.exports = createDatabase;
