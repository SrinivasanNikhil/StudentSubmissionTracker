"use strict";
const { Model, DataTypes } = require("sequelize");

/**
 * Audit trail for student course-section changes.
 *
 * Deadline and topic-visibility enforcement are both keyed on the student's
 * `courseSection`, which students can edit themselves. Clearing a section is
 * now blocked outright, but switching between an instructor's sections is still
 * allowed — and sections can carry different due dates for the same topic. This
 * table records every change so an instructor can see movement around a
 * deadline.
 *
 * Deliberately separate from InteractionLog: that table is the research dataset
 * and requires a questionId, which a profile change does not have.
 */
module.exports = (sequelize) => {
	class CourseSectionChange extends Model {
		static associate(models) {
			CourseSectionChange.belongsTo(models.User, {
				foreignKey: "userId",
				as: "user",
			});
		}
	}

	CourseSectionChange.init(
		{
			userId: {
				type: DataTypes.INTEGER,
				allowNull: false,
				field: "user_id",
				references: { model: "users", key: "id" },
			},
			previousSection: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: "previous_section",
				comment: "courseSection before the change (null on first set)",
			},
			newSection: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: "new_section",
			},
			previousAcademicYear: {
				type: DataTypes.STRING(20),
				allowNull: true,
				field: "previous_academic_year",
			},
			newAcademicYear: {
				type: DataTypes.STRING(20),
				allowNull: true,
				field: "new_academic_year",
			},
			previousSemester: {
				type: DataTypes.STRING(20),
				allowNull: true,
				field: "previous_semester",
			},
			newSemester: {
				type: DataTypes.STRING(20),
				allowNull: true,
				field: "new_semester",
			},
			changedAt: {
				type: DataTypes.DATE,
				allowNull: false,
				defaultValue: DataTypes.NOW,
				field: "changed_at",
			},
		},
		{
			sequelize,
			modelName: "CourseSectionChange",
			tableName: "course_section_changes",
			timestamps: true,
			underscored: true,
			indexes: [{ fields: ["user_id"] }, { fields: ["changed_at"] }],
		}
	);

	return CourseSectionChange;
};
