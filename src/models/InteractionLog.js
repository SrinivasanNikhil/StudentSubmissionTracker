"use strict";
const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
	class InteractionLog extends Model {
		static associate(models) {
			InteractionLog.belongsTo(models.User, { foreignKey: "userId" });
			InteractionLog.belongsTo(models.Question, {
				foreignKey: "questionId",
			});
		}
	}

	InteractionLog.init(
		{
			userId: {
				type: DataTypes.INTEGER,
				allowNull: false,
				field: "user_id",
				references: {
					model: "users",
					key: "id",
				},
			},
			questionId: {
				type: DataTypes.INTEGER,
				allowNull: false,
				field: "question_id",
				references: {
					model: "questions",
					key: "id",
				},
			},
			eventType: {
				type: DataTypes.ENUM(
					"query_attempt",
					"answer_revealed",
					"ai_feedback_requested"
				),
				allowNull: false,
				field: "event_type",
			},
			eventData: {
				type: DataTypes.JSON,
				allowNull: true,
				field: "event_data",
			},
			occurredAt: {
				type: DataTypes.DATE,
				allowNull: false,
				defaultValue: DataTypes.NOW,
				field: "occurred_at",
			},
			academicYear: {
				type: DataTypes.STRING(20),
				allowNull: true,
				field: "academic_year",
			},
			semester: {
				type: DataTypes.ENUM("Fall", "Spring", "Summer", "Winter"),
				allowNull: true,
			},
			courseSection: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: "course_section",
			},
		},
		{
			sequelize,
			modelName: "InteractionLog",
			tableName: "interaction_logs",
			timestamps: true,
			underscored: true,
		}
	);

	return InteractionLog;
};
