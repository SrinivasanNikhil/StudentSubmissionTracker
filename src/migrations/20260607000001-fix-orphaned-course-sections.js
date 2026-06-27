"use strict";

module.exports = {
	up: async (queryInterface, Sequelize) => {
		try {
			console.log("Scanning for students with orphaned courseSection values...");

			// Fetch all student users who have a courseSection set
			const students = await queryInterface.sequelize.query(
				`SELECT u.id, u.course_section, u.associated_instructor_id
				 FROM users u
				 WHERE u.role = 'student'
				   AND u.course_section IS NOT NULL
				   AND u.associated_instructor_id IS NOT NULL`,
				{ type: Sequelize.QueryTypes.SELECT }
			);

			// For each student, check whether their courseSection resolves to a real
			// InstructorCourseSection row. Use the same first-dash parse the app uses.
			const orphanedIds = [];
			for (const student of students) {
				const courseSection = student.course_section;
				const dashIndex = courseSection.indexOf("-");
				const courseCode = dashIndex !== -1 ? courseSection.slice(0, dashIndex) : courseSection;
				const sectionCode = dashIndex !== -1 ? courseSection.slice(dashIndex + 1) : "";

				const rows = await queryInterface.sequelize.query(
					`SELECT id FROM instructor_course_sections
					 WHERE instructor_id = :instructorId
					   AND course_code = :courseCode
					   AND section_code = :sectionCode
					   AND is_active = 1
					 LIMIT 1`,
					{
						replacements: {
							instructorId: student.associated_instructor_id,
							courseCode,
							sectionCode,
						},
						type: Sequelize.QueryTypes.SELECT,
					}
				);

				if (!rows || rows.length === 0) {
					orphanedIds.push(student.id);
				}
			}

			if (orphanedIds.length === 0) {
				console.log("No orphaned courseSection values found. Nothing to fix.");
				return;
			}

			console.log(`Found ${orphanedIds.length} student(s) with unresolvable courseSection: ids [${orphanedIds.join(", ")}]`);

			// Null out courseSection, academicYear, and semester for these students
			await queryInterface.sequelize.query(
				`UPDATE users
				 SET course_section = NULL,
				     academic_year = NULL,
				     semester = NULL
				 WHERE id IN (:ids)`,
				{
					replacements: { ids: orphanedIds },
					type: Sequelize.QueryTypes.UPDATE,
				}
			);

			console.log(`Cleared courseSection for ${orphanedIds.length} student(s). They will need to re-enter their section via their profile.`);
		} catch (error) {
			console.error("Error in fix-orphaned-course-sections migration:", error);
			throw error;
		}
	},

	down: async (queryInterface, Sequelize) => {
		// This migration is a data-repair; the original bad data is not recoverable.
		// The down migration is intentionally a no-op.
		console.log("fix-orphaned-course-sections: down migration is a no-op (data not reversible).");
	},
};
