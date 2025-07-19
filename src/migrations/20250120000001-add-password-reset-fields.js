"use strict";

module.exports = {
	up: async (queryInterface, Sequelize) => {
		try {
			// Add password reset fields to users table
			const columnsToAdd = [
				{
					name: "reset_token",
					definition: {
						type: Sequelize.STRING(255),
						allowNull: true,
						comment: "Secure token for password reset",
					},
				},
				{
					name: "reset_token_expires",
					definition: {
						type: Sequelize.DATE,
						allowNull: true,
						comment: "Expiration time for reset token",
					},
				},
				{
					name: "reset_token_used",
					definition: {
						type: Sequelize.BOOLEAN,
						defaultValue: false,
						comment: "Whether the reset token has been used",
					},
				},
			];

			// Add each column with existence check
			for (const column of columnsToAdd) {
				try {
					const tableInfo = await queryInterface.describeTable("users");
					if (!tableInfo[column.name]) {
						await queryInterface.addColumn(
							"users",
							column.name,
							column.definition
						);
						console.log(`Added ${column.name} column to users table`);
					} else {
						console.log(`${column.name} column already exists in users table`);
					}
				} catch (error) {
					console.log(`Error adding ${column.name} column:`, error.message);
				}
			}

			console.log("Password reset schema updates completed successfully");
		} catch (error) {
			console.error("Error in migration:", error);
			throw error;
		}
	},

	down: async (queryInterface, Sequelize) => {
		try {
			// Remove password reset columns from users table
			const columnsToRemove = [
				"reset_token",
				"reset_token_expires",
				"reset_token_used",
			];

			for (const column of columnsToRemove) {
				try {
					const tableInfo = await queryInterface.describeTable("users");
					if (tableInfo[column]) {
						await queryInterface.removeColumn("users", column);
						console.log(`Removed ${column} column from users table`);
					}
				} catch (error) {
					console.log(`Error removing ${column} column:`, error.message);
				}
			}

			console.log("Password reset schema rollback completed successfully");
		} catch (error) {
			console.error("Error in migration rollback:", error);
			throw error;
		}
	},
};
