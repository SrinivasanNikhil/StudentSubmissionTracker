"use strict";
const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
	class Topic extends Model {
		static associate(models) {
			Topic.hasMany(models.Question, {
				foreignKey: "topicId",
				as: "questions",
			});
		}
	}

	Topic.init(
		{
			name: {
				type: DataTypes.STRING(255),
				allowNull: false,
				unique: true,
			},
			type: {
				type: DataTypes.STRING(20),
				allowNull: false,
				defaultValue: "sql",
				comment: "Type of topic: sql or data_model",
			},
			database: {
				type: DataTypes.STRING(50),
				allowNull: false,
				defaultValue: "ClassicModels",
				comment: "Database name: ClassicModels or Northwind",
			},
		},
		{
			sequelize,
			modelName: "Topic",
			tableName: "topics",
			timestamps: true,
			underscored: true,
			charset: "utf8mb4",
			collate: "utf8mb4_unicode_ci",
			engine: "InnoDB",
		}
	);

	return Topic;
};
