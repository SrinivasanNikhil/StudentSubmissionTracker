"use strict";
const { Model, DataTypes, Op } = require("sequelize");
const bcrypt = require("bcryptjs");

module.exports = (sequelize) => {
	class User extends Model {
		static associate(models) {
			User.hasMany(models.Completion, { foreignKey: "userId" });
		}

		async validatePassword(password) {
			return bcrypt.compare(password, this.passwordHash);
		}

		// Static method to check if email exists
		static async isEmailUnique(email) {
			const user = await this.findOne({ where: { email } });
			return !user;
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
