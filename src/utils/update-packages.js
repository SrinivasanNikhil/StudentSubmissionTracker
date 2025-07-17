/**
 * Utility script to update package.json with required dependencies
 */

const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

const updatePackages = async () => {
	try {
		console.log("Updating package.json with required dependencies...");

		// Path to package.json
		const packageJsonPath = path.join(__dirname, "../../package.json");

		// Read package.json
		const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

		// Add required dependencies if not present
		packageJson.dependencies = packageJson.dependencies || {};

		if (!packageJson.dependencies["connect-flash"]) {
			packageJson.dependencies["connect-flash"] = "^0.1.1";
			console.log("Added connect-flash dependency");
		}

		if (!packageJson.dependencies["csv-writer"]) {
			packageJson.dependencies["csv-writer"] = "^1.6.0";
			console.log("Added csv-writer dependency");
		}

		// Write updated package.json
		fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

		console.log("Package.json updated successfully!");
		console.log("Now run: npm install");

		// Ask user if they want to install packages now
		console.log("Installing new packages...");
		exec(
			"npm install",
			{ cwd: path.join(__dirname, "../..") },
			(error, stdout, stderr) => {
				if (error) {
					console.error(`Error installing packages: ${error.message}`);
					return;
				}
				if (stderr) {
					console.error(`stderr: ${stderr}`);
					return;
				}
				console.log(`stdout: ${stdout}`);
				console.log("Packages installed successfully!");
			}
		);
	} catch (error) {
		console.error("Error updating package.json:", error);
	}
};

// Run the function
updatePackages();
