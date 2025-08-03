"use strict";

module.exports = {
	up: async (queryInterface, Sequelize) => {
		try {
			console.log("Adding role-based system fields to users table...");

			// Check if columns already exist
			const tableInfo = await queryInterface.describeTable("users");

			// Add role field (admin, instructor, student) if it doesn't exist
			if (!tableInfo.role) {
				await queryInterface.addColumn("users", "role", {
					type: Sequelize.ENUM("admin", "instructor", "student"),
					allowNull: false,
					defaultValue: "student",
					comment: "User role: admin, instructor, or student",
				});
				console.log("Added role column to users table");
			} else {
				console.log("Role column already exists in users table");
			}

			// Add instructor_code field for instructor identification if it doesn't exist
			if (!tableInfo.instructor_code) {
				await queryInterface.addColumn("users", "instructor_code", {
					type: Sequelize.STRING(255),
					allowNull: true,
					unique: true,
					comment: "Unique code for instructor identification",
				});
				console.log("Added instructor_code column to users table");
			} else {
				console.log("instructor_code column already exists in users table");
			}

			// Add associated_instructor_id field for student-instructor relationship if it doesn't exist
			if (!tableInfo.associated_instructor_id) {
				await queryInterface.addColumn("users", "associated_instructor_id", {
					type: Sequelize.INTEGER,
					allowNull: true,
					references: {
						model: "users",
						key: "id",
					},
					comment: "ID of the instructor this student is associated with",
				});
				console.log("Added associated_instructor_id column to users table");
			} else {
				console.log(
					"associated_instructor_id column already exists in users table"
				);
			}

			// Migrate existing users only if role column was just added
			if (!tableInfo.role) {
				console.log("Migrating existing users to new role system...");

				// Set all existing admins to role='admin'
				await queryInterface.sequelize.query(`
					UPDATE users 
					SET role = 'admin' 
					WHERE is_admin = true
				`);

				// Set all existing non-admins to role='student'
				await queryInterface.sequelize.query(`
					UPDATE users 
					SET role = 'student' 
					WHERE is_admin = false
				`);
			} else {
				console.log("Role column already exists, skipping user migration");
			}

			console.log("Role-based system migration completed successfully");
		} catch (error) {
			console.error("Error in role-based system migration:", error);
			throw error;
		}
	},

	down: async (queryInterface, Sequelize) => {
		try {
			console.log("Rolling back role-based system migration...");

			// Check if columns exist before removing them
			const tableInfo = await queryInterface.describeTable("users");

			// Remove the new columns if they exist
			if (tableInfo.associated_instructor_id) {
				await queryInterface.removeColumn("users", "associated_instructor_id");
				console.log("Removed associated_instructor_id column");
			}

			if (tableInfo.instructor_code) {
				await queryInterface.removeColumn("users", "instructor_code");
				console.log("Removed instructor_code column");
			}

			if (tableInfo.role) {
				await queryInterface.removeColumn("users", "role");
				console.log("Removed role column");
			}

			console.log("Role-based system migration rolled back successfully");
		} catch (error) {
			console.error("Error rolling back role-based system migration:", error);
			throw error;
		}
	},
};
