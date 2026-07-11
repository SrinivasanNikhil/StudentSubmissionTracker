"use strict";

const { User, InstructorCourseSection } = require("../models");

function buildStudentScopeFilter(role, instructorId, query) {
	const { academicYear, semester, courseSection } = query;
	const where = { role: "student" };

	if (role === "instructor") {
		where.associatedInstructorId = instructorId;
	}
	if (academicYear && academicYear !== "all") {
		where.academicYear = academicYear;
	}
	if (semester && semester !== "all") {
		where.semester = semester;
	}
	if (courseSection && courseSection !== "all") {
		where.courseSection = courseSection;
	}

	return where;
}

// Completion-level term filter, mirroring buildStudentScopeFilter's
// "all means no filter" semantics. Completions carry their own
// academicYear/semester stamps (unique per user+question+term), so exports
// must scope the COMPLETION rows to the selected term as well — otherwise a
// retaking student's prior-term completions would be credited to the term
// being exported.
function buildCompletionTermFilter(query) {
	const { academicYear, semester } = query;
	const where = {};

	if (academicYear && academicYear !== "all") {
		where.academicYear = academicYear;
	}
	if (semester && semester !== "all") {
		where.semester = semester;
	}

	return where;
}

async function getFilterOptions(role, instructorId) {
	const academicYearsSet = new Set();
	const semestersSet = new Set();
	const courseSectionsMap = new Map();

	if (role === "instructor") {
		const courseSectionsData = await InstructorCourseSection.findAll({
			where: { instructorId },
			attributes: ["academicYear", "semester", "courseCode", "sectionCode", "courseName"],
			order: [
				["academicYear", "DESC"],
				["semester", "ASC"],
				["courseCode", "ASC"],
				["sectionCode", "ASC"],
			],
		});

		courseSectionsData.forEach((cs) => {
			if (cs.academicYear) academicYearsSet.add(cs.academicYear);
			if (cs.semester) semestersSet.add(cs.semester);
			const identifier = `${cs.courseCode}-${cs.sectionCode}`;
			if (!courseSectionsMap.has(identifier)) {
				courseSectionsMap.set(identifier, {
					identifier,
					displayName: `${cs.courseCode} ${cs.sectionCode} - ${cs.courseName}`,
				});
			}
		});
	} else {
		const students = await User.findAll({
			where: { role: "student" },
			attributes: ["academicYear", "semester", "courseSection"],
		});

		students.forEach((student) => {
			if (student.academicYear) academicYearsSet.add(student.academicYear);
			if (student.semester) semestersSet.add(student.semester);
			if (student.courseSection && !courseSectionsMap.has(student.courseSection)) {
				courseSectionsMap.set(student.courseSection, {
					identifier: student.courseSection,
					displayName: student.courseSection,
				});
			}
		});
	}

	return {
		academicYears: Array.from(academicYearsSet).sort().reverse(),
		semesters: Array.from(semestersSet),
		courseSections: Array.from(courseSectionsMap.values()),
	};
}

function formatStudentName(user) {
	return `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Not provided";
}

module.exports = {
	buildStudentScopeFilter,
	buildCompletionTermFilter,
	getFilterOptions,
	formatStudentName,
};
