const express = require("express");
const router = express.Router();
const {
	User,
	Completion,
	Question,
	Topic,
	InstructorCourseSection,
} = require("../models");
const { isAuthenticated, isInstructor } = require("../middleware/auth");
const { Op } = require("sequelize");
const createCsvStringifier = require("csv-writer").createObjectCsvStringifier;

// Course section management dashboard
router.get(
	"/course-sections",
	isAuthenticated,
	isInstructor,
	async (req, res) => {
		try {
			const instructorId = req.session.user.id;

			// Get all course sections for this instructor
			const courseSections = await InstructorCourseSection.findAll({
				where: { instructorId },
				order: [
					["academicYear", "DESC"],
					["semester", "ASC"],
					["courseCode", "ASC"],
					["sectionCode", "ASC"],
				],
			});

			// Get student counts for each course section
			const courseSectionIds = courseSections.map((cs) =>
				cs.getFullSectionIdentifier()
			);
			const studentCounts = await User.findAll({
				where: {
					associatedInstructorId: instructorId,
					role: "student",
					courseSection: {
						[Op.in]: courseSectionIds,
					},
				},
				attributes: [
					"courseSection",
					[
						require("sequelize").fn("COUNT", require("sequelize").col("id")),
						"studentCount",
					],
				],
				group: ["courseSection"],
			});

			// Create a map of course section student counts
			const studentMap = {};
			studentCounts.forEach((count) => {
				studentMap[count.courseSection] = parseInt(
					count.dataValues.studentCount
				);
			});

			// Add student counts to course sections
			courseSections.forEach((section) => {
				section.dataValues.studentCount =
					studentMap[section.getFullSectionIdentifier()] || 0;
			});

			res.render("pages/instructor/course-sections", {
				title: "Course Sections",
				courseSections,
			});
		} catch (error) {
			console.error("Course sections error:", error);
			res.status(500).render("pages/error", {
				title: "Error",
				message: "An error occurred while loading course sections.",
			});
		}
	}
);

// Create new course section
router.post(
	"/course-sections",
	isAuthenticated,
	isInstructor,
	async (req, res) => {
		try {
			const instructorId = req.session.user.id;
			const { courseCode, courseName, sectionCode, academicYear, semester } =
				req.body;

			// Validate required fields
			if (
				!courseCode ||
				!courseName ||
				!sectionCode ||
				!academicYear ||
				!semester
			) {
				return res.status(400).json({
					success: false,
					message: "All fields are required",
				});
			}

			// Check if course section already exists
			const existingSection = await InstructorCourseSection.findOne({
				where: {
					instructorId,
					courseCode,
					sectionCode,
					academicYear,
					semester,
				},
			});

			if (existingSection) {
				return res.status(400).json({
					success: false,
					message:
						"This course section already exists for the specified semester",
				});
			}

			// Create new course section
			const courseSection = await InstructorCourseSection.create({
				instructorId,
				courseCode: courseCode.toUpperCase(),
				courseName,
				sectionCode: sectionCode.toUpperCase(),
				academicYear,
				semester,
				isActive: true,
			});

			res.json({
				success: true,
				message: "Course section created successfully",
				courseSection: {
					id: courseSection.id,
					displayName: courseSection.getDisplayName(),
					fullIdentifier: courseSection.getFullSectionIdentifier(),
				},
			});
		} catch (error) {
			console.error("Error creating course section:", error);
			res.status(500).json({
				success: false,
				message: "Failed to create course section",
			});
		}
	}
);

// Toggle course section active status
router.post(
	"/course-sections/:id/toggle",
	isAuthenticated,
	isInstructor,
	async (req, res) => {
		try {
			const instructorId = req.session.user.id;
			const { id } = req.params;

			const courseSection = await InstructorCourseSection.findOne({
				where: {
					id,
					instructorId,
				},
			});

			if (!courseSection) {
				return res.status(404).json({
					success: false,
					message: "Course section not found",
				});
			}

			// Toggle active status
			await courseSection.update({
				isActive: !courseSection.isActive,
			});

			res.json({
				success: true,
				message: `Course section ${
					courseSection.isActive ? "activated" : "deactivated"
				} successfully`,
				isActive: courseSection.isActive,
			});
		} catch (error) {
			console.error("Error toggling course section:", error);
			res.status(500).json({
				success: false,
				message: "Failed to toggle course section status",
			});
		}
	}
);

// View students by course section
router.get(
	"/course-sections/:id/students",
	isAuthenticated,
	isInstructor,
	async (req, res) => {
		try {
			const instructorId = req.session.user.id;
			const { id } = req.params;

			// Get course section
			const courseSection = await InstructorCourseSection.findOne({
				where: {
					id,
					instructorId,
				},
			});

			if (!courseSection) {
				return res.status(404).render("pages/error", {
					title: "Course Section Not Found",
					message: "The requested course section was not found.",
				});
			}

			// Get students for this course section
			const students = await User.findAll({
				where: {
					associatedInstructorId: instructorId,
					role: "student",
					courseSection: courseSection.getFullSectionIdentifier(),
				},
				attributes: ["id", "email", "firstName", "lastName", "createdAt"],
				order: [["createdAt", "DESC"]],
			});

			// Get completion statistics for these students
			const studentIds = students.map((student) => student.id);
			const completions = await Completion.findAll({
				where: {
					userId: {
						[Op.in]: studentIds,
					},
				},
				attributes: ["userId", "questionId"],
			});

			// Create a map of student completions
			const studentCompletions = new Map();
			completions.forEach((completion) => {
				if (!studentCompletions.has(completion.userId)) {
					studentCompletions.set(completion.userId, new Set());
				}
				studentCompletions.get(completion.userId).add(completion.questionId);
			});

			// Add completion counts to students
			students.forEach((student) => {
				student.dataValues.completionCount =
					studentCompletions.get(student.id)?.size || 0;
			});

			res.render("pages/instructor/course-section-students", {
				title: `${courseSection.getDisplayName()} - Students`,
				courseSection,
				students,
			});
		} catch (error) {
			console.error("Course section students error:", error);
			res.status(500).render("pages/error", {
				title: "Error",
				message: "An error occurred while loading students.",
			});
		}
	}
);

// Export semester-based data
router.get(
	"/export/semester",
	isAuthenticated,
	isInstructor,
	async (req, res) => {
		try {
			const instructorId = req.session.user.id;
			const { academicYear, semester, courseSection, topicId } = req.query;

			// Build filter conditions
			const userWhereCondition = {
				associatedInstructorId: instructorId,
				role: "student",
			};

			if (academicYear && academicYear !== "all") {
				userWhereCondition.academicYear = academicYear;
			}
			if (semester && semester !== "all") {
				userWhereCondition.semester = semester;
			}
			if (courseSection && courseSection !== "all") {
				userWhereCondition.courseSection = courseSection;
			}

			// Get students matching filters
			const students = await User.findAll({
				where: userWhereCondition,
				attributes: [
					"id",
					"email",
					"firstName",
					"lastName",
					"academicYear",
					"semester",
					"courseSection",
				],
				order: [["createdAt", "DESC"]],
			});

			if (students.length === 0) {
				return res.status(404).render("pages/error", {
					title: "No Students",
					message: "No students found for the selected filters.",
				});
			}

			// Get student IDs for completion filter
			const studentIds = students.map((student) => student.id);

			// Get all questions with their topics
			const questionInclude = [{ model: Topic, as: "topic" }];
			if (topicId && topicId !== "all") {
				questionInclude[0].where = { id: topicId };
			}

			const questions = await Question.findAll({
				include: questionInclude,
				order: [
					[{ model: Topic, as: "topic" }, "name", "ASC"],
					["questionNumber", "ASC"],
				],
			});

			// Get all completions for these students
			const completions = await Completion.findAll({
				where: {
					userId: {
						[Op.in]: studentIds,
					},
				},
				attributes: ["userId", "questionId"],
			});

			// Create a map of student completions for quick lookup
			const studentCompletions = new Map();
			completions.forEach((completion) => {
				if (!studentCompletions.has(completion.userId)) {
					studentCompletions.set(completion.userId, new Set());
				}
				studentCompletions.get(completion.userId).add(completion.questionId);
			});

			// Generate CSV headers
			const headers = [
				{ id: "email", title: "Email" },
				{ id: "name", title: "Name" },
				{ id: "academicYear", title: "Academic Year" },
				{ id: "semester", title: "Semester" },
				{ id: "courseSection", title: "Course Section" },
			];

			// Add question columns
			questions.forEach((question) => {
				headers.push({
					id: `q${question.id}`,
					title: `${question.topic.name} - Q${question.questionNumber}`,
				});
			});

			// Generate CSV data
			const csvStringifier = createCsvStringifier({ header: headers });

			const csvData = students.map((student) => {
				const row = {
					email: student.email,
					name:
						`${student.firstName || ""} ${student.lastName || ""}`.trim() ||
						"Not provided",
					academicYear: student.academicYear || "Not specified",
					semester: student.semester || "Not specified",
					courseSection: student.courseSection || "Not specified",
				};

				// Add completion status for each question
				questions.forEach((question) => {
					const hasCompleted =
						studentCompletions.get(student.id)?.has(question.id) || false;
					row[`q${question.id}`] = hasCompleted ? "Completed" : "Not Completed";
				});

				return row;
			});

			// Set response headers for CSV download
			const filename = `completions_${academicYear || "all"}_${
				semester || "all"
			}_${courseSection || "all"}_${
				new Date().toISOString().split("T")[0]
			}.csv`;
			res.setHeader("Content-Type", "text/csv");
			res.setHeader(
				"Content-Disposition",
				`attachment; filename="${filename}"`
			);

			// Send CSV data
			res.write(csvStringifier.getHeaderString());
			res.write(csvStringifier.stringifyRecords(csvData));
			res.end();
		} catch (error) {
			console.error("Export semester data error:", error);
			res.status(500).render("pages/error", {
				title: "Error",
				message: "An error occurred while exporting data.",
			});
		}
	}
);

// Get available semesters for filtering
router.get("/semesters", isAuthenticated, isInstructor, async (req, res) => {
	try {
		const instructorId = req.session.user.id;

		// Get unique academic years and semesters from course sections
		const courseSections = await InstructorCourseSection.findAll({
			where: { instructorId },
			attributes: ["academicYear", "semester"],
			group: ["academicYear", "semester"],
			order: [
				["academicYear", "DESC"],
				["semester", "ASC"],
			],
		});

		// Get unique course sections
		const sections = await InstructorCourseSection.findAll({
			where: { instructorId },
			attributes: ["courseCode", "sectionCode", "courseName"],
			group: ["courseCode", "sectionCode", "courseName"],
			order: [
				["courseCode", "ASC"],
				["sectionCode", "ASC"],
			],
		});

		res.json({
			success: true,
			semesters: courseSections.map((cs) => ({
				academicYear: cs.academicYear,
				semester: cs.semester,
			})),
			courseSections: sections.map((s) => ({
				identifier: `${s.courseCode}-${s.sectionCode}`,
				displayName: `${s.courseCode} ${s.sectionCode} - ${s.courseName}`,
			})),
		});
	} catch (error) {
		console.error("Error fetching semesters:", error);
		res.status(500).json({
			success: false,
			message: "Failed to fetch semester data",
		});
	}
});

module.exports = router;
