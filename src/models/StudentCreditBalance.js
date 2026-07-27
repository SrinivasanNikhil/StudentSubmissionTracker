"use strict";
const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
	class StudentCreditBalance extends Model {}

	StudentCreditBalance.init(
		{
			userId: {
				type: DataTypes.INTEGER,
				allowNull: false,
				field: "user_id",
			},
			instructorCourseSectionId: {
				// Nullable: AI usage by a student with no resolvable course section
				// is still metered, and those rows carry no section.
				type: DataTypes.INTEGER,
				allowNull: true,
				field: "instructor_course_section_id",
			},
			academicYear: {
				type: DataTypes.STRING(20),
				allowNull: true,
				field: "academic_year",
			},
			semester: {
				type: DataTypes.ENUM("Fall", "Spring", "Summer", "Winter"),
				allowNull: true,
				field: "semester",
			},
			creditsRemaining: {
				type: DataTypes.INTEGER,
				allowNull: false,
				defaultValue: 0,
				field: "credits_remaining",
			},
			creditsGrantedTotal: {
				type: DataTypes.INTEGER,
				allowNull: false,
				defaultValue: 0,
				field: "credits_granted_total",
			},
		},
		{
			sequelize,
			modelName: "StudentCreditBalance",
			tableName: "student_credit_balances",
			timestamps: true,
			underscored: true,
		}
	);

	return StudentCreditBalance;
};
