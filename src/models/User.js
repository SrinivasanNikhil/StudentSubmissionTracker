"use strict";
const { Model, DataTypes, Op } = require("sequelize");
const bcrypt = require("bcryptjs");

module.exports = (sequelize) => {
	class User extends Model {
		async validatePassword(password) {
			return bcrypt.compare(password, this.passwordHash);
		}

		// Role helper methods (prefixed with "role" to avoid colliding with the isAdmin DB column)
		isAdminRole() {
			return this.role === "admin";
		}

		isInstructorRole() {
			return this.role === "instructor";
		}

		isStudentRole() {
			return this.role === "student";
		}

		// Static method to check if email exists
		static async isEmailUnique(email) {
			const user = await this.findOne({ where: { email } });
			return !user;
		}

		// Generate unique instructor code
		static async generateInstructorCode() {
			const crypto = require("crypto");
			let code;
			let isUnique = false;

			while (!isUnique) {
				code = crypto.randomBytes(4).toString("hex").toUpperCase();
				const existingUser = await this.findOne({
					where: { instructor_code: code },
				});
				isUnique = !existingUser;
			}

			return code;
		}

		// Find instructor by code
		static async findInstructorByCode(code) {
			return await this.findOne({
				where: {
					instructor_code: code,
					role: "instructor",
				},
			});
		}

		// Password reset methods
		static async generateResetToken() {
			const crypto = require("crypto");
			return crypto.randomBytes(32).toString("hex");
		}

		static async createPasswordReset(user) {
			const resetToken = await this.generateResetToken();
			const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

			await user.update({
				resetToken,
				resetTokenExpires,
				resetTokenUsed: false,
			});

			return resetToken;
		}

		static async validateResetToken(token) {
			const user = await this.findOne({
				where: {
					resetToken: token,
					resetTokenExpires: { [Op.gt]: new Date() },
					resetTokenUsed: false,
				},
			});

			return user;
		}
	}

	User.init(
		{
			email: {
				type: DataTypes.STRING,
				allowNull: false,
				validate: {
					isEmail: true,
					async isUnique(value) {
						const isUnique = await User.isEmailUnique(value);
						if (!isUnique) {
							throw new Error("Email already exists");
						}
					},
				},
			},
			passwordHash: {
				type: DataTypes.STRING,
				allowNull: false,
			},
			// Names are rendered in instructor and admin views, so they are
			// bounded and restricted at write time as defense in depth behind
			// output escaping. Angle brackets and quotes are rejected outright —
			// no legitimate name needs them.
			firstName: {
				type: DataTypes.STRING,
				allowNull: true,
				validate: {
					len: { args: [0, 100], msg: "First name must be 100 characters or fewer" },
					noMarkup(value) {
						// Only angle brackets and backslash are rejected. Apostrophes and
					// quotes are legitimate in names (O'Brien), and output escaping —
					// not this filter — is what makes them safe to render.
					if (value && /[<>\\]/.test(value)) {
							throw new Error("First name contains invalid characters");
						}
					},
				},
			},
			lastName: {
				type: DataTypes.STRING,
				allowNull: true,
				validate: {
					len: { args: [0, 100], msg: "Last name must be 100 characters or fewer" },
					noMarkup(value) {
						// Only angle brackets and backslash are rejected. Apostrophes and
					// quotes are legitimate in names (O'Brien), and output escaping —
					// not this filter — is what makes them safe to render.
					if (value && /[<>\\]/.test(value)) {
							throw new Error("Last name contains invalid characters");
						}
					},
				},
			},
			code: {
				type: DataTypes.STRING,
				allowNull: true,
			},
			isAdmin: {
				type: DataTypes.BOOLEAN,
				defaultValue: false,
			},
			// New role-based fields
			role: {
				type: DataTypes.ENUM("admin", "instructor", "student"),
				allowNull: false,
				defaultValue: "student",
				comment: "User role: admin, instructor, or student",
			},
			instructorCode: {
				type: DataTypes.STRING(255),
				allowNull: true,
				unique: true,
				field: "instructor_code",
				comment: "Unique code for instructor identification",
			},
			associatedInstructorId: {
				type: DataTypes.INTEGER,
				allowNull: true,
				field: "associated_instructor_id",
				references: {
					model: "users",
					key: "id",
				},
				comment: "ID of the instructor this student is associated with",
			},
			// Password reset fields
			resetToken: {
				type: DataTypes.STRING(255),
				allowNull: true,
			},
			resetTokenExpires: {
				type: DataTypes.DATE,
				allowNull: true,
			},
			resetTokenUsed: {
				type: DataTypes.BOOLEAN,
				defaultValue: false,
			},
			// Semester tracking fields
			academicYear: {
				type: DataTypes.STRING(20),
				allowNull: true,
				field: "academic_year",
				comment: "Academic year when student registered (e.g., '2024-2025')",
			},
			semester: {
				type: DataTypes.ENUM("Fall", "Spring", "Summer", "Winter"),
				allowNull: true,
				comment: "Semester when student registered",
			},
			courseSection: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: "course_section",
				comment: "Course section identifier (e.g., 'CS101-A', 'CS101-B')",
			},
			aiFeedbackEnabled: {
				type: DataTypes.BOOLEAN,
				allowNull: false,
				defaultValue: true,
				field: "ai_feedback_enabled",
				comment: "Whether the student has enabled real-time AI feedback",
			},
		},
		{
			sequelize,
			modelName: "User",
			tableName: "users",
			timestamps: true,
			underscored: true,
		}
	);

	return User;
};
