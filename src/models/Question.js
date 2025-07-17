"use strict";
const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
	class Question extends Model {
		static associate(models) {
			Question.belongsTo(models.Topic, { foreignKey: "topicId" });
			Question.hasMany(models.Completion, { foreignKey: "questionId" });
		}

		// Helper method to check if this is a data model question
		isDataModelQuestion() {
			return this.Topic && this.Topic.type === "data_model";
		}
	}

	Question.init(
		{
			topicId: {
				type: DataTypes.INTEGER,
				allowNull: false,
				references: {
					model: "topics",
					key: "id",
				},
			},
			questionNumber: {
				type: DataTypes.INTEGER,
				allowNull: false,
				comment: "Question number within its topic",
			},
			questionText: {
				type: DataTypes.TEXT,
				allowNull: false,
			},
			solution: {
				type: DataTypes.TEXT,
				allowNull: true,
				comment: "The correct SQL query solution",
			},
			expectedResult: {
				type: DataTypes.TEXT,
				allowNull: true,
				comment: "JSON string of expected result structure",
			},
			expectedOutputs: {
				type: DataTypes.TEXT,
				allowNull: true,
				comment: "JSON string of expected outputs for data model questions",
				validate: {
					isValidJSON(value) {
						if (value) {
							try {
								JSON.parse(value);
							} catch (e) {
								throw new Error("expectedOutputs must be a valid JSON string");
							}
						}
					},
				},
			},
			modelDescription: {
				type: DataTypes.TEXT,
				allowNull: true,
				comment:
					"Detailed description of the data model for data model questions",
			},
			baseEntities: {
				type: DataTypes.TEXT,
				allowNull: true,
				comment: "JSON string of base entities required in the data model",
				validate: {
					isValidJSON(value) {
						if (value) {
							try {
								JSON.parse(value);
							} catch (e) {
								throw new Error("baseEntities must be a valid JSON string");
							}
						}
					},
				},
			},
			baseRelationships: {
				type: DataTypes.TEXT,
				allowNull: true,
				comment: "JSON string of base relationships required in the data model",
				validate: {
					isValidJSON(value) {
						if (value) {
							try {
								JSON.parse(value);
							} catch (e) {
								throw new Error(
									"baseRelationships must be a valid JSON string"
								);
							}
						}
					},
				},
			},
		},
		{
			sequelize,
			modelName: "Question",
			tableName: "questions",
			timestamps: true,
			underscored: true,
			hooks: {
				beforeValidate: (question) => {
					// Ensure expectedOutputs is valid JSON for data model questions
					if (question.topicId && question.expectedOutputs) {
						try {
							JSON.parse(question.expectedOutputs);
						} catch (e) {
							throw new Error("expectedOutputs must be a valid JSON string");
						}
					}
				},
			},
		}
	);

	return Question;
};
