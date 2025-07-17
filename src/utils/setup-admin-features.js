/**
 * Comprehensive setup script for admin features
 *
 * This script:
 * 1. Checks and installs required dependencies
 * 2. Updates the database schema with new fields
 * 3. Creates an admin user (if specified)
 *
 * Usage:
 * node src/utils/setup-admin-features.js [admin-email] [admin-password]
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
const { sequelize, testConnection } = require("../config/database");
const { User } = require("../models");

// Load environment variables
dotenv.config();

// Define colors for console output
const colors = {
	reset: "\x1b[0m",
	bright: "\x1b[1m",
	dim: "\x1b[2m",
	red: "\x1b[31m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	blue: "\x1b[34m",
	cyan: "\x1b[36m",
};

async function setupAdminFeatures() {
	console.log(
		`\n${colors.bright}${colors.blue}===== SQL Practice App - Admin Features Setup =====${colors.reset}\n`
	);

	try {
		// Step 1: Check for required dependencies
		console.log(
			`${colors.cyan}Step 1: Checking dependencies...${colors.reset}`
		);

		const packageJsonPath = path.join(__dirname, "../../package.json");
		let packageJson;
		let dependenciesUpdated = false;

		try {
			packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
			packageJson.dependencies = packageJson.dependencies || {};

			// Check for connect-flash
			if (!packageJson.dependencies["connect-flash"]) {
				console.log(
					`  ${colors.yellow}➤ Adding connect-flash dependency${colors.reset}`
				);
				packageJson.dependencies["connect-flash"] = "^0.1.1";
				dependenciesUpdated = true;
			} else {
				console.log(
					`  ${colors.green}✓ connect-flash already installed${colors.reset}`
				);
			}

			// Check for csv-writer
			if (!packageJson.dependencies["csv-writer"]) {
				console.log(
					`  ${colors.yellow}➤ Adding csv-writer dependency${colors.reset}`
				);
				packageJson.dependencies["csv-writer"] = "^1.6.0";
				dependenciesUpdated = true;
			} else {
				console.log(
					`  ${colors.green}✓ csv-writer already installed${colors.reset}`
				);
			}

			// Write changes if needed
			if (dependenciesUpdated) {
				fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
				console.log(
					`\n  ${colors.yellow}➤ Installing new dependencies...${colors.reset}`
				);

				try {
					execSync("npm install", {
						cwd: path.join(__dirname, "../.."),
						stdio: "inherit",
					});
					console.log(
						`  ${colors.green}✓ Dependencies installed successfully${colors.reset}`
					);
				} catch (installError) {
					console.error(
						`\n  ${colors.red}✗ Error installing dependencies:${colors.reset}`,
						installError.message
					);
					console.log(
						`\n  ${colors.yellow}➤ Please run 'npm install' manually${colors.reset}`
					);
				}
			}
		} catch (packageJsonError) {
			console.error(
				`\n  ${colors.red}✗ Error reading/writing package.json:${colors.reset}`,
				packageJsonError.message
			);
			console.log(
				`\n  ${colors.yellow}➤ Please manually install the following packages:${colors.reset}`
			);
			console.log(`    npm install connect-flash csv-writer`);
		}

		// Step 2: Update database schema
		console.log(
			`\n${colors.cyan}Step 2: Updating database schema...${colors.reset}`
		);

		try {
			// Test database connection
			await testConnection();
			console.log(
				`  ${colors.green}✓ Database connection successful${colors.reset}`
			);

			// Update schema
			console.log(
				`  ${colors.yellow}➤ Adding new columns to users table...${colors.reset}`
			);
			await User.sync({ alter: true });
			console.log(
				`  ${colors.green}✓ Schema updated successfully${colors.reset}`
			);
			console.log(`    Added columns: first_name, last_name, is_admin`);
		} catch (dbError) {
			console.error(
				`\n  ${colors.red}✗ Database error:${colors.reset}`,
				dbError.message
			);
			console.log(
				`\n  ${colors.yellow}➤ Please check your database configuration${colors.reset}`
			);
			process.exit(1);
		}

		// Step 3: Create admin user if requested
		const args = process.argv.slice(2);
		if (args.length >= 2) {
			console.log(
				`\n${colors.cyan}Step 3: Creating admin user...${colors.reset}`
			);

			const email = args[0];
			const password = args[1];

			// Validate email
			if (!email.includes("@")) {
				console.error(`\n  ${colors.red}✗ Invalid email format${colors.reset}`);
				process.exit(1);
			}

			// Validate password
			if (password.length < 8) {
				console.error(
					`\n  ${colors.red}✗ Password must be at least 8 characters long${colors.reset}`
				);
				process.exit(1);
			}

			try {
				// Check if user already exists
				const existingUser = await User.findOne({ where: { email } });

				if (existingUser) {
					// If user exists but is not admin, make them admin
					if (!existingUser.isAdmin) {
						await existingUser.update({ isAdmin: true });
						console.log(
							`  ${colors.green}✓ User ${email} granted admin privileges${colors.reset}`
						);
					} else {
						console.log(
							`  ${colors.green}✓ User ${email} is already an admin${colors.reset}`
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
						`  ${colors.green}✓ Admin user ${email} created successfully${colors.reset}`
					);
				}
			} catch (userError) {
				console.error(
					`\n  ${colors.red}✗ Error creating admin user:${colors.reset}`,
					userError.message
				);
				console.log(
					`\n  ${colors.yellow}➤ You can try creating an admin user later with:${colors.reset}`
				);
				console.log(`    node src/utils/create-admin.js <email> <password>`);
			}
		} else {
			console.log(
				`\n${colors.cyan}Step 3: No admin user credentials provided, skipping${colors.reset}`
			);
			console.log(
				`  ${colors.yellow}➤ You can create an admin user with:${colors.reset}`
			);
			console.log(`    node src/utils/create-admin.js <email> <password>`);
		}

		// Done
		console.log(
			`\n${colors.bright}${colors.green}✅ Setup complete!${colors.reset}`
		);
		console.log(`\n${colors.bright}Run the application with:${colors.reset}`);
		console.log(`  npm start\n`);
	} catch (error) {
		console.error(
			`\n${colors.red}${colors.bright}ERROR: ${error.message}${colors.reset}`
		);
		process.exit(1);
	}
}

// Run the setup
setupAdminFeatures();
