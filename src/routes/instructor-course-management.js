const express = require("express");
const router = express.Router();
const {
	User,
	Completion,
	Question,
	Topic,
	InstructorCourseSection,
	InstructorSectionTopicSetting,
} = require("../models");
const { isAuthenticated, isInstructor } = require("../middleware/auth");
const { Op, fn, col } = require("sequelize");
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
					[fn("COUNT", col("id")), "studentCount"],
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
			const completions = studentIds.length
				? await Completion.findAll({
					where: { userId: { [Op.in]: studentIds } },
				  })
				: [];

			// Create a map of student completions
			const studentCompletions = new Map();
			completions.forEach((completion) => {
				if (!studentCompletions.has(completion.userId)) {
					studentCompletions.set(completion.userId, new Set());
				}
				studentCompletions.get(completion.userId).add(completion.questionId);
			});
			// Add completion counts and convert to plain objects so EJS can access completionCount directly
			const studentsWithCounts = students.map((student) => {
				const plain = student.toJSON();
				plain.completionCount = studentCompletions.get(student.id)?.size || 0;
				return plain;
			});

			res.render("pages/instructor/course-section-students", {
				title: `${courseSection.getDisplayName()} - Students`,
				courseSection,
				students: studentsWithCounts,
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

// View and manage topic settings for a course section
router.get(
	"/course-sections/:id/topics",
	isAuthenticated,
	isInstructor,
	async (req, res) => {
		try {
			const instructorId = req.session.user.id;
			const { id } = req.params;

			const courseSection = await InstructorCourseSection.findOne({
				where: { id, instructorId },
			});

			if (!courseSection) {
				return res.status(404).render("pages/error", {
					title: "Course Section Not Found",
					message: "The requested course section was not found.",
				});
			}

			const topics = await Topic.findAll({ order: [["id", "ASC"]] });

			const existingSettings = await InstructorSectionTopicSetting.findAll({
				where: { instructorCourseSectionId: id },
			});

			const settingsMap = new Map(
				existingSettings.map((s) => [s.topicId, s])
			);

			const topicsWithSettings = topics.map((t) => {
				const setting = settingsMap.get(t.id);
				return {
					...t.toJSON(),
					isVisible: setting ? setting.isVisible : true,
					dueDate: setting ? setting.dueDate : null,
					gracePeriodMinutes: setting ? setting.gracePeriodMinutes : 0,
				};
			});

			res.render("pages/instructor/section-topics", {
				title: `${courseSection.getDisplayName()} - Topic Settings`,
				courseSection,
				topicsWithSettings,
			});
		} catch (error) {
			console.error("Section topics error:", error);
			res.status(500).render("pages/error", {
				title: "Error",
				message: "An error occurred while loading topic settings.",
			});
		}
	}
);

// Save topic settings for a course section (handles one topic at a time via individual row forms)
router.post(
	"/course-sections/:id/topics/settings",
	isAuthenticated,
	isInstructor,
	async (req, res) => {
		try {
			const instructorId = req.session.user.id;
			const { id } = req.params;

			const courseSection = await InstructorCourseSection.findOne({
				where: { id, instructorId },
			});

			if (!courseSection) {
				return res.status(404).json({
					success: false,
					message: "Course section not found",
				});
			}

			const { topicId, isVisible, dueDate, gracePeriodMinutes } = req.body;

			await InstructorSectionTopicSetting.upsert({
				instructorCourseSectionId: parseInt(id),
				topicId: parseInt(topicId),
				isVisible: Boolean(isVisible),
				dueDate: dueDate || null,
				gracePeriodMinutes: parseInt(gracePeriodMinutes, 10) || 0,
			});

			return res.json({ success: true });
		} catch (error) {
			console.error("Save topic settings error:", error);
			return res.status(500).json({
				success: false,
				message: "Failed to save topic settings",
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
