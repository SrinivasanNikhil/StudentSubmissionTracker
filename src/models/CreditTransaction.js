"use strict";
const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
	class CreditTransaction extends Model {}

	CreditTransaction.init(
		{
			userId: {
				type: DataTypes.INTEGER,
				allowNull: false,
				field: "user_id",
			},
			questionId: {
				type: DataTypes.INTEGER,
				allowNull: true,
				field: "question_id",
			},
			instructorCourseSectionId: {
				// Nullable: AI usage by a student with no resolvable course section
				// is still metered, and those rows carry no section.
				type: DataTypes.INTEGER,
				allowNull: true,
				field: "instructor_course_section_id",
			},
			creditRequestId: {
				type: DataTypes.INTEGER,
				allowNull: true,
				field: "credit_request_id",
			},
			type: {
				type: DataTypes.ENUM("seed", "spend", "grant", "refund"),
				allowNull: false,
				field: "type",
			},
			amount: {
				type: DataTypes.INTEGER,
				allowNull: false,
				field: "amount",
			},
			balanceAfter: {
				type: DataTypes.INTEGER,
				allowNull: true,
				field: "balance_after",
			},
			promptTokens: {
				type: DataTypes.INTEGER,
				allowNull: true,
				field: "prompt_tokens",
			},
			completionTokens: {
				type: DataTypes.INTEGER,
				allowNull: true,
				field: "completion_tokens",
			},
			totalTokens: {
				type: DataTypes.INTEGER,
				allowNull: true,
				field: "total_tokens",
			},
			estimatedCostUsd: {
				type: DataTypes.DECIMAL(10, 6),
				allowNull: true,
				field: "estimated_cost_usd",
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
			occurredAt: {
				type: DataTypes.DATE,
				allowNull: false,
				defaultValue: DataTypes.NOW,
				field: "occurred_at",
			},
		},
		{
			sequelize,
			modelName: "CreditTransaction",
			tableName: "credit_transactions",
			timestamps: true,
			underscored: true,
		}
	);

	return CreditTransaction;
};
