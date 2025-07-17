"use strict";
const { Model, DataTypes } = require("sequelize");
const bcrypt = require("bcryptjs");

module.exports = (sequelize) => {
	class User extends Model {
		static associate(models) {
			User.hasMany(models.Completion, { foreignKey: "userId" });
		}

		async validatePassword(password) {
			return bcrypt.compare(password, this.password);
		}

		// Static method to check if email exists
		static async isEmailUnique(email) {
			const user = await this.findOne({ where: { email } });
			return !user;
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
		},
		{
			sequelize,
			modelName: "User",
			tableName: "users",
			timestamps: true,
			underscored: true,
			hooks: {
				beforeCreate: async (user) => {
					if (user.password) {
						user.password = await bcrypt.hash(user.password, 10);
					}
				},
				beforeUpdate: async (user) => {
					if (user.changed("password")) {
						user.password = await bcrypt.hash(user.password, 10);
					}
				},
			},
		}
	);

	return User;
};
