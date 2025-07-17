"use strict";

module.exports = {
	up: async (queryInterface, Sequelize) => {
		try {
			// Get current table info
			const tableInfo = await queryInterface.describeTable("users");

			// Add new columns if they don't exist
			if (!tableInfo.first_name) {
				await queryInterface.addColumn("users", "first_name", {
					type: Sequelize.STRING,
					allowNull: true,
				});
			}

			if (!tableInfo.last_name) {
				await queryInterface.addColumn("users", "last_name", {
					type: Sequelize.STRING,
					allowNull: true,
				});
			}

			if (!tableInfo.code) {
				await queryInterface.addColumn("users", "code", {
					type: Sequelize.STRING,
					allowNull: true,
				});
			}

			if (!tableInfo.is_admin) {
				await queryInterface.addColumn("users", "is_admin", {
					type: Sequelize.BOOLEAN,
					defaultValue: false,
				});
			}

			// Rename password to password_hash if it exists and password_hash doesn't
			if (tableInfo.password && !tableInfo.password_hash) {
				await queryInterface.renameColumn("users", "password", "password_hash");
			}

			// Remove the role column if it exists
			if (tableInfo.role) {
				await queryInterface.removeColumn("users", "role");
			}

			// Remove the username column if it exists
			if (tableInfo.username) {
				await queryInterface.removeColumn("users", "username");
			}
		} catch (error) {
			console.error("Migration error:", error);
			throw error;
		}
	},

	down: async (queryInterface, Sequelize) => {
		try {
			const tableInfo = await queryInterface.describeTable("users");

			// Remove the new columns if they exist
			if (tableInfo.first_name) {
				await queryInterface.removeColumn("users", "first_name");
			}
			if (tableInfo.last_name) {
				await queryInterface.removeColumn("users", "last_name");
			}
			if (tableInfo.code) {
				await queryInterface.removeColumn("users", "code");
			}
			if (tableInfo.is_admin) {
				await queryInterface.removeColumn("users", "is_admin");
			}

			// Rename password_hash back to password if it exists
			if (tableInfo.password_hash) {
				await queryInterface.renameColumn("users", "password_hash", "password");
			}

			// Add back the role column if it doesn't exist
			if (!tableInfo.role) {
				await queryInterface.addColumn("users", "role", {
					type: Sequelize.ENUM("student", "admin"),
					defaultValue: "student",
				});
			}

			// Add back the username column if it doesn't exist
			if (!tableInfo.username) {
				await queryInterface.addColumn("users", "username", {
					type: Sequelize.STRING,
					allowNull: false,
					unique: true,
				});
			}
		} catch (error) {
			console.error("Migration rollback error:", error);
			throw error;
		}
	},
};
