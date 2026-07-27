"use strict";

/**
 * Allow credit rows that are not tied to a course section.
 *
 * The AI credit gate previously lived entirely inside `if (section)`, so any
 * user without a resolvable InstructorCourseSection — currently 405 of 478
 * students — bypassed metering completely: no balance check, no cap, and no
 * ledger row at all (22,738 AI calls had produced 0 spend rows).
 *
 * Metering those users requires writing CreditTransaction rows that have no
 * section, so instructor_course_section_id becomes nullable on both credit
 * tables. Existing rows are unaffected.
 *
 * Note: no unique index is added for the section-less case. MySQL treats NULLs
 * as distinct, so a unique key including this column would not constrain them
 * anyway; the section-less quota is enforced by summing ledger rows instead of
 * by a balance row.
 */
module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.changeColumn(
			"credit_transactions",
			"instructor_course_section_id",
			{ type: Sequelize.INTEGER, allowNull: true }
		);
		await queryInterface.changeColumn(
			"student_credit_balances",
			"instructor_course_section_id",
			{ type: Sequelize.INTEGER, allowNull: true }
		);
		console.log(
			"instructor_course_section_id is now nullable on credit_transactions and student_credit_balances."
		);
	},

	down: async (queryInterface, Sequelize) => {
		// Reverting requires that no section-less rows exist, or the NOT NULL
		// constraint cannot be re-applied.
		await queryInterface.changeColumn(
			"credit_transactions",
			"instructor_course_section_id",
			{ type: Sequelize.INTEGER, allowNull: false }
		);
		await queryInterface.changeColumn(
			"student_credit_balances",
			"instructor_course_section_id",
			{ type: Sequelize.INTEGER, allowNull: false }
		);
	},
};
