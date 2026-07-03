"use strict";
const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
	class CreditRequest extends Model {}

	CreditRequest.init(
		{
			userId: {
				type: DataTypes.INTEGER,
				allowNull: false,
				field: "user_id",
			},
			instructorCourseSectionId: {
				type: DataTypes.INTEGER,
				allowNull: false,
				field: "instructor_course_section_id",
			},
			status: {
				type: DataTypes.ENUM("pending", "approved", "denied"),
				allowNull: false,
				defaultValue: "pending",
				field: "status",
			},
			studentMessage: {
				type: DataTypes.TEXT,
				allowNull: true,
				field: "student_message",
			},
			requestedAt: {
				type: DataTypes.DATE,
				allowNull: false,
				defaultValue: DataTypes.NOW,
				field: "requested_at",
			},
			resolvedAt: {
				type: DataTypes.DATE,
				allowNull: true,
				field: "resolved_at",
			},
			resolvedByUserId: {
				type: DataTypes.INTEGER,
				allowNull: true,
				field: "resolved_by_user_id",
			},
			creditsGranted: {
				type: DataTypes.INTEGER,
				allowNull: true,
				field: "credits_granted",
			},
			instructorNote: {
				type: DataTypes.TEXT,
				allowNull: true,
				field: "instructor_note",
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
		},
		{
			sequelize,
			modelName: "CreditRequest",
			tableName: "credit_requests",
			timestamps: true,
			underscored: true,
		}
	);

	return CreditRequest;
};
