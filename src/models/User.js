"use strict";
const { Model, DataTypes, Op } = require("sequelize");
const bcrypt = require("bcryptjs");

module.exports = (sequelize) => {
	class User extends Model {
		async validatePassword(password) {
			return bcrypt.compare(password, this.passwordHash);
		}

		// Role helper methods
		isAdmin() {
			return this.role === "admin" || this.isAdmin === true;
		}

		isInstructor() {
			return this.role === "instructor";
		}

		isStudent() {
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
			firstName: {
				type: DataTypes.STRING,
				allowNull: true,
			},
			lastName: {
				type: DataTypes.STRING,
				allowNull: true,
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
