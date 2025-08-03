"use strict";
const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
	class Completion extends Model {
		static associate(models) {
			Completion.belongsTo(models.User, { foreignKey: "userId", as: "user" });
			Completion.belongsTo(models.Question, {
				foreignKey: "questionId",
				as: "question",
			});
		}
	}

	Completion.init(
		{
			userId: {
				type: DataTypes.INTEGER,
				allowNull: false,
				references: {
					model: "users",
					key: "id",
				},
			},
			questionId: {
				type: DataTypes.INTEGER,
				allowNull: false,
				references: {
					model: "questions",
					key: "id",
				},
			},
			completedAt: {
				type: DataTypes.DATE,
				allowNull: false,
				defaultValue: DataTypes.NOW,
			},
			diagramImage: {
				type: DataTypes.STRING,
				allowNull: true,
				comment: "Path to the uploaded ER diagram image",
			},
			enhancements: {
				type: DataTypes.TEXT,
				allowNull: true,
				comment:
					"Student's explanation of enhancements made to the base scenario",
			},
			aiReflection: {
				type: DataTypes.TEXT,
				allowNull: true,
				comment: "Student's reflection on AI tool usage",
			},
			evaluation: {
				type: DataTypes.TEXT,
				allowNull: true,
				comment: "JSON string containing evaluation results",
				get() {
					const rawValue = this.getDataValue("evaluation");
					return rawValue ? JSON.parse(rawValue) : null;
				},
				set(value) {
					this.setDataValue("evaluation", JSON.stringify(value));
				},
			},
			adminComments: {
				type: DataTypes.TEXT,
				allowNull: true,
				comment: "Admin's feedback on the submission",
			},
			adminScore: {
				type: DataTypes.INTEGER,
				allowNull: true,
				comment: "Admin's score for the submission (0-10)",
				validate: {
					min: 0,
					max: 10,
				},
			},
			aiScore: {
				type: DataTypes.INTEGER,
				allowNull: true,
				comment: "AI's score for the submission (0-10)",
				validate: {
					min: 0,
					max: 10,
				},
			},
			status: {
				type: DataTypes.ENUM("pending", "evaluated", "reviewed"),
				allowNull: false,
				defaultValue: "pending",
				comment: "Current status of the submission",
			},
			// Semester tracking fields
			academicYear: {
				type: DataTypes.STRING(20),
				allowNull: true,
				field: "academic_year",
				comment: "Academic year when completion occurred",
			},
			semester: {
				type: DataTypes.ENUM("Fall", "Spring", "Summer", "Winter"),
				allowNull: true,
				comment: "Semester when completion occurred",
			},
			courseSection: {
				type: DataTypes.STRING(50),
				allowNull: true,
				field: "course_section",
				comment: "Course section when completion occurred",
			},
		},
		{
			sequelize,
			modelName: "Completion",
			tableName: "completions",
			timestamps: true,
			underscored: true,
			indexes: [
				{
					unique: true,
					fields: ["userId", "questionId"],
					name: "unique_user_question_completion",
				},
			],
		}
	);

	return Completion;
};
