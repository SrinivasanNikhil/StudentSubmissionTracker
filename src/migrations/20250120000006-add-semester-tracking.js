"use strict";

module.exports = {
	up: async (queryInterface, Sequelize) => {
		try {
			console.log("Adding semester tracking fields...");

			// Add semester fields to users table
			const userTableInfo = await queryInterface.describeTable("users");

			// Add academic_year field to users table
			if (!userTableInfo.academic_year) {
				await queryInterface.addColumn("users", "academic_year", {
					type: Sequelize.STRING(20),
					allowNull: true,
					comment: "Academic year when student registered (e.g., '2024-2025')",
				});
				console.log("Added academic_year column to users table");
			}

			// Add semester field to users table
			if (!userTableInfo.semester) {
				await queryInterface.addColumn("users", "semester", {
					type: Sequelize.ENUM("Fall", "Spring", "Summer", "Winter"),
					allowNull: true,
					comment: "Semester when student registered",
				});
				console.log("Added semester column to users table");
			}

			// Add course_section field to users table
			if (!userTableInfo.course_section) {
				await queryInterface.addColumn("users", "course_section", {
					type: Sequelize.STRING(50),
					allowNull: true,
					comment: "Course section identifier (e.g., 'CS101-A', 'CS101-B')",
				});
				console.log("Added course_section column to users table");
			}

			// Add semester fields to completions table
			const completionTableInfo = await queryInterface.describeTable(
				"completions"
			);

			// Add academic_year field to completions table
			if (!completionTableInfo.academic_year) {
				await queryInterface.addColumn("completions", "academic_year", {
					type: Sequelize.STRING(20),
					allowNull: true,
					comment: "Academic year when completion occurred",
				});
				console.log("Added academic_year column to completions table");
			}

			// Add semester field to completions table
			if (!completionTableInfo.semester) {
				await queryInterface.addColumn("completions", "semester", {
					type: Sequelize.ENUM("Fall", "Spring", "Summer", "Winter"),
					allowNull: true,
					comment: "Semester when completion occurred",
				});
				console.log("Added semester column to completions table");
			}

			// Add course_section field to completions table
			if (!completionTableInfo.course_section) {
				await queryInterface.addColumn("completions", "course_section", {
					type: Sequelize.STRING(50),
					allowNull: true,
					comment: "Course section when completion occurred",
				});
				console.log("Added course_section column to completions table");
			}

			// Create a new table for instructor course sections
			await queryInterface.createTable("instructor_course_sections", {
				id: {
					type: Sequelize.INTEGER,
					primaryKey: true,
					autoIncrement: true,
				},
				instructor_id: {
					type: Sequelize.INTEGER,
					allowNull: false,
					references: {
						model: "users",
						key: "id",
					},
					comment: "ID of the instructor",
				},
				course_code: {
					type: Sequelize.STRING(20),
					allowNull: false,
					comment: "Course code (e.g., 'CS101', 'CS201')",
				},
				course_name: {
					type: Sequelize.STRING(255),
					allowNull: false,
					comment: "Course name (e.g., 'Introduction to Databases')",
				},
				section_code: {
					type: Sequelize.STRING(20),
					allowNull: false,
					comment: "Section code (e.g., 'A', 'B', '01')",
				},
				academic_year: {
					type: Sequelize.STRING(20),
					allowNull: false,
					comment: "Academic year (e.g., '2024-2025')",
				},
				semester: {
					type: Sequelize.ENUM("Fall", "Spring", "Summer", "Winter"),
					allowNull: false,
					comment: "Semester",
				},
				is_active: {
					type: Sequelize.BOOLEAN,
					defaultValue: true,
					comment: "Whether this course section is currently active",
				},
				created_at: {
					type: Sequelize.DATE,
					allowNull: false,
					defaultValue: Sequelize.NOW,
				},
				updated_at: {
					type: Sequelize.DATE,
					allowNull: false,
					defaultValue: Sequelize.NOW,
				},
			});

			// Add unique constraint to prevent duplicate course sections
			try {
				await queryInterface.addConstraint("instructor_course_sections", {
					fields: [
						"instructor_id",
						"course_code",
						"section_code",
						"academic_year",
						"semester",
					],
					type: "unique",
					name: "unique_instructor_course_section",
				});
				console.log(
					"Added unique constraint to instructor_course_sections table"
				);
			} catch (error) {
				if (error.parent && error.parent.code === "ER_DUP_KEYNAME") {
					console.log(
						"Unique constraint already exists in instructor_course_sections table"
					);
				} else {
					throw error;
				}
			}

			console.log("Created instructor_course_sections table");

			// Add indexes for better performance
			try {
				await queryInterface.addIndex(
					"users",
					["associated_instructor_id", "academic_year", "semester"],
					{
						name: "idx_users_instructor_semester",
					}
				);
				console.log("Added index idx_users_instructor_semester");
			} catch (error) {
				if (error.parent && error.parent.code === "ER_DUP_KEYNAME") {
					console.log("Index idx_users_instructor_semester already exists");
				} else {
					throw error;
				}
			}

			try {
				await queryInterface.addIndex(
					"completions",
					["user_id", "academic_year", "semester"],
					{
						name: "idx_completions_user_semester",
					}
				);
				console.log("Added index idx_completions_user_semester");
			} catch (error) {
				if (error.parent && error.parent.code === "ER_DUP_KEYNAME") {
					console.log("Index idx_completions_user_semester already exists");
				} else {
					throw error;
				}
			}

			try {
				await queryInterface.addIndex(
					"instructor_course_sections",
					["instructor_id", "is_active"],
					{
						name: "idx_course_sections_instructor_active",
					}
				);
				console.log("Added index idx_course_sections_instructor_active");
			} catch (error) {
				if (error.parent && error.parent.code === "ER_DUP_KEYNAME") {
					console.log(
						"Index idx_course_sections_instructor_active already exists"
					);
				} else {
					throw error;
				}
			}

			console.log("Semester tracking migration completed successfully");
		} catch (error) {
			console.error("Error in semester tracking migration:", error);
			throw error;
		}
	},

	down: async (queryInterface, Sequelize) => {
		try {
			console.log("Rolling back semester tracking migration...");

			// Remove indexes
			try {
				await queryInterface.removeIndex(
					"users",
					"idx_users_instructor_semester"
				);
			} catch (error) {
				console.log(
					"Index idx_users_instructor_semester not found or already removed"
				);
			}

			try {
				await queryInterface.removeIndex(
					"completions",
					"idx_completions_user_semester"
				);
			} catch (error) {
				console.log(
					"Index idx_completions_user_semester not found or already removed"
				);
			}

			try {
				await queryInterface.removeIndex(
					"instructor_course_sections",
					"idx_course_sections_instructor_active"
				);
			} catch (error) {
				console.log(
					"Index idx_course_sections_instructor_active not found or already removed"
				);
			}

			// Drop instructor_course_sections table
			try {
				await queryInterface.dropTable("instructor_course_sections");
				console.log("Dropped instructor_course_sections table");
			} catch (error) {
				console.log(
					"instructor_course_sections table not found or already dropped"
				);
			}

			// Remove columns from completions table
			const completionColumnsToRemove = [
				"academic_year",
				"semester",
				"course_section",
			];
			for (const column of completionColumnsToRemove) {
				try {
					const tableInfo = await queryInterface.describeTable("completions");
					if (tableInfo[column]) {
						await queryInterface.removeColumn("completions", column);
						console.log(`Removed ${column} column from completions table`);
					}
				} catch (error) {
					console.log(
						`Error removing ${column} column from completions:`,
						error.message
					);
				}
			}

			// Remove columns from users table
			const userColumnsToRemove = [
				"academic_year",
				"semester",
				"course_section",
			];
			for (const column of userColumnsToRemove) {
				try {
					const tableInfo = await queryInterface.describeTable("users");
					if (tableInfo[column]) {
						await queryInterface.removeColumn("users", column);
						console.log(`Removed ${column} column from users table`);
					}
				} catch (error) {
					console.log(
						`Error removing ${column} column from users:`,
						error.message
					);
				}
			}

			console.log("Semester tracking migration rolled back successfully");
		} catch (error) {
			console.error("Error rolling back semester tracking migration:", error);
			throw error;
		}
	},
};
