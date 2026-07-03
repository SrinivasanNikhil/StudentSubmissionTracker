"use strict";
const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
	class InstructorSectionCreditSetting extends Model {}

	InstructorSectionCreditSetting.init(
		{
			instructorCourseSectionId: {
				type: DataTypes.INTEGER,
				allowNull: false,
				field: "instructor_course_section_id",
			},
			defaultCredits: {
				type: DataTypes.INTEGER,
				allowNull: false,
				defaultValue: 10,
				field: "default_credits",
			},
			costPerRequest: {
				type: DataTypes.INTEGER,
				allowNull: false,
				defaultValue: 1,
				field: "cost_per_request",
			},
			unlimited: {
				type: DataTypes.BOOLEAN,
				allowNull: false,
				defaultValue: false,
				field: "unlimited",
			},
		},
		{
			sequelize,
			modelName: "InstructorSectionCreditSetting",
			tableName: "instructor_section_credit_settings",
			timestamps: true,
			underscored: true,
		}
	);

	return InstructorSectionCreditSetting;
};
