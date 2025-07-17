require("dotenv").config();

module.exports = {
	development: {
		username: process.env.APP_DB_USER,
		password: process.env.APP_DB_PASSWORD,
		database: process.env.APP_DB_NAME,
		host: process.env.APP_DB_HOST,
		port: process.env.APP_DB_PORT,
		dialect: "mysql",
	},
	test: {
		username: process.env.APP_DB_USER,
		password: process.env.APP_DB_PASSWORD,
		database: process.env.APP_DB_NAME,
		host: process.env.APP_DB_HOST,
		port: process.env.APP_DB_PORT,
		dialect: "mysql",
	},
	production: {
		username: process.env.APP_DB_USER,
		password: process.env.APP_DB_PASSWORD,
		database: process.env.APP_DB_NAME,
		host: process.env.APP_DB_HOST,
		port: process.env.APP_DB_PORT,
		dialect: "mysql",
	},
};
