"use strict";

module.exports = {
	/**
	 * Audit table for student course-section changes. Deadline and visibility
	 * enforcement key off the student's own editable `courseSection`, so changes
	 * need to be recorded for instructor review.
	 */
	up: async (queryInterface, Sequelize) => {
		const tables = await queryInterface.showAllTables();
		if (tables.map((t) => String(t).toLowerCase()).includes("course_section_changes")) {
			console.log("course_section_changes already exists — skipping.");
			return;
		}

		await queryInterface.createTable("course_section_changes", {
			id: {
				type: Sequelize.INTEGER,
				primaryKey: true,
				autoIncrement: true,
				allowNull: false,
			},
			user_id: {
				type: Sequelize.INTEGER,
				allowNull: false,
				references: { model: "users", key: "id" },
				onDelete: "CASCADE",
			},
			previous_section: { type: Sequelize.STRING(50), allowNull: true },
			new_section: { type: Sequelize.STRING(50), allowNull: true },
			previous_academic_year: { type: Sequelize.STRING(20), allowNull: true },
			new_academic_year: { type: Sequelize.STRING(20), allowNull: true },
			previous_semester: { type: Sequelize.STRING(20), allowNull: true },
			new_semester: { type: Sequelize.STRING(20), allowNull: true },
			changed_at: {
				type: Sequelize.DATE,
				allowNull: false,
				defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
			},
			created_at: { type: Sequelize.DATE, allowNull: false },
			updated_at: { type: Sequelize.DATE, allowNull: false },
		});

		await queryInterface.addIndex("course_section_changes", ["user_id"], {
			name: "idx_csc_user_id",
		});
		await queryInterface.addIndex("course_section_changes", ["changed_at"], {
			name: "idx_csc_changed_at",
		});

		console.log("Created course_section_changes audit table.");
	},

	down: async (queryInterface) => {
		await queryInterface.dropTable("course_section_changes");
	},
};
