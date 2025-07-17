/**
 * Admin User Creation Script
 *
 * This script creates a new admin user or updates an existing user
 * to have admin privileges.
 *
 * Usage:
 * node src/utils/create-admin.js <email> <password>
 */

const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
const { User } = require("../models");
const { testConnection } = require("../config/database");

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
};

async function createAdminUser() {
	console.log(
		`\n${colors.bright}${colors.blue}===== SQL Practice App - Admin User Creation =====${colors.reset}\n`
	);

	try {
		// Check command line arguments
		const args = process.argv.slice(2);

		if (args.length < 2) {
			console.error(
				`${colors.red}Error: Missing required arguments${colors.reset}`
			);
			console.log(`\nUsage: node src/utils/create-admin.js <email> <password>`);
			process.exit(1);
		}

		const email = args[0];
		const password = args[1];

		// Validate email
		if (!email.includes("@")) {
			console.error(`${colors.red}Error: Invalid email format${colors.reset}`);
			process.exit(1);
		}

		// Validate password
		if (password.length < 8) {
			console.error(
				`${colors.red}Error: Password must be at least 8 characters long${colors.reset}`
			);
			process.exit(1);
		}

		// Connect to database
		await testConnection();
		console.log(
			`${colors.green}✓ Database connection successful${colors.reset}`
		);

		// Check if user already exists
		const existingUser = await User.findOne({ where: { email } });

		if (existingUser) {
			// If user exists but is not admin, make them admin
			if (!existingUser.isAdmin) {
				await existingUser.update({ isAdmin: true });
				console.log(
					`\n${colors.green}✓ User ${email} granted admin privileges${colors.reset}`
				);
			} else {
				console.log(
					`\n${colors.yellow}ℹ User ${email} is already an admin${colors.reset}`
				);
			}
		} else {
			// Create new admin user
			const passwordHash = await bcrypt.hash(password, 10);

			await User.create({
				email,
				passwordHash,
				isAdmin: true,
			});

			console.log(
				`\n${colors.green}✓ Admin user ${email} created successfully${colors.reset}`
			);
		}

		console.log(
			`\n${colors.bright}You can now log in with these credentials at the admin interface.${colors.reset}\n`
		);
	} catch (error) {
		console.error(
			`\n${colors.red}${colors.bright}ERROR: ${error.message}${colors.reset}`
		);
		process.exit(1);
	}
}

// Run the script
createAdminUser();
