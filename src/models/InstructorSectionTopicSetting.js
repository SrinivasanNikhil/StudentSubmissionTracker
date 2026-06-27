"use strict";
const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
	class InstructorSectionTopicSetting extends Model {}

	InstructorSectionTopicSetting.init(
		{
			instructorCourseSectionId: {
				type: DataTypes.INTEGER,
				allowNull: false,
				field: "instructor_course_section_id",
			},
			topicId: {
				type: DataTypes.INTEGER,
				allowNull: false,
				field: "topic_id",
			},
			dueDate: {
				type: DataTypes.DATE,
				allowNull: true,
				field: "due_date",
			},
			isVisible: {
				type: DataTypes.BOOLEAN,
				allowNull: false,
				defaultValue: true,
				field: "is_visible",
			},
			gracePeriodMinutes: {
				type: DataTypes.INTEGER,
				allowNull: false,
				defaultValue: 0,
				field: "grace_period_minutes",
			},
		},
		{
			sequelize,
			modelName: "InstructorSectionTopicSetting",
			tableName: "instructor_section_topic_settings",
			timestamps: true,
			underscored: true,
		}
	);

	return InstructorSectionTopicSetting;
};
