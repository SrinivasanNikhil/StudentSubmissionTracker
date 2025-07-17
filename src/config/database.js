const { Sequelize } = require("sequelize");
require("dotenv").config();

// MySQL connection configuration for ClassicModels
const classicModelsDB = new Sequelize({
	dialect: "mysql",
	host: process.env.DB_HOST,
	port: process.env.DB_PORT,
	username: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_NAME, // ClassicModels
	logging: process.env.NODE_ENV === "development" ? console.log : false,
	pool: {
		max: 5,
		min: 0,
		acquire: 30000,
		idle: 10000,
	},
	define: {
		charset: "utf8mb4",
		collate: "utf8mb4_unicode_ci",
		timestamps: true,
		underscored: true,
	},
});

// Northwind database connection (same server, different database)
const northwindDB = new Sequelize({
	dialect: "mysql",
	host: process.env.DB_HOST,
	port: process.env.DB_PORT,
	username: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	database: "northwind",
	logging: process.env.NODE_ENV === "development" ? console.log : false,
	pool: {
		max: 5,
		min: 0,
		acquire: 30000,
		idle: 10000,
	},
	define: {
		charset: "utf8mb4",
		collate: "utf8mb4_unicode_ci",
		timestamps: true,
		underscored: true,
	},
});

// MySQL connection for application data (users, completions, etc.)
const appDB = new Sequelize({
	dialect: "mysql",
	host: process.env.APP_DB_HOST,
	port: process.env.APP_DB_PORT,
	username: process.env.APP_DB_USER,
	password: process.env.APP_DB_PASSWORD,
	database: process.env.APP_DB_NAME,
	logging: process.env.NODE_ENV === "development" ? console.log : false,
	pool: {
		max: 5,
		min: 0,
		acquire: 30000,
		idle: 10000,
	},
	define: {
		charset: "utf8mb4",
		collate: "utf8mb4_unicode_ci",
		timestamps: true,
		underscored: true,
	},
});

// Test the database connection
const testConnection = async () => {
	try {
		await appDB.authenticate();
		console.log(
			"Application database connection has been established successfully."
		);
		return true;
	} catch (error) {
		console.error("Unable to connect to the database:", error);
		return false;
	}
};

// Initialize database
const initializeDatabase = async () => {
	try {
		await testConnection();

		// Run migrations
		console.log("Setting up migrations...");
		const { Umzug, SequelizeStorage } = require("umzug");
		const umzug = new Umzug({
			migrations: {
				glob: "src/migrations/*.js",
				resolve: ({ name, path, context }) => {
					console.log(`Resolving migration: ${name}`);
					const migration = require(path);
					return {
						name,
						up: async () => {
							try {
								console.log(`Running migration: ${name}`);
								await migration.up(context, Sequelize);
								console.log(`Successfully completed migration: ${name}`);
							} catch (error) {
								console.error(`Error in migration ${name}:`, error);
								throw error;
							}
						},
						down: async () => {
							try {
								console.log(`Rolling back migration: ${name}`);
								await migration.down(context, Sequelize);
								console.log(`Successfully rolled back migration: ${name}`);
							} catch (error) {
								console.error(`Error rolling back migration ${name}:`, error);
								throw error;
							}
						},
					};
				},
			},
			context: appDB.getQueryInterface(),
			storage: new SequelizeStorage({ sequelize: appDB }),
			logger: console,
		});

		// Check if migrations need to be run
		console.log("Checking for pending migrations...");
		const pending = await umzug.pending();
		console.log(
			"Pending migrations:",
			pending.map((m) => m.name)
		);

		if (pending.length > 0) {
			console.log(`Running ${pending.length} pending migrations...`);
			await umzug.up();
			console.log("Database migrations completed successfully");
		} else {
			console.log("No pending migrations");
		}
	} catch (error) {
		console.error("Error initializing database:", error);
		process.exit(1);
	}
};

module.exports = {
	sequelize: appDB,
	classicModelsDB,
	northwindDB,
	testConnection,
	initializeDatabase,
};
