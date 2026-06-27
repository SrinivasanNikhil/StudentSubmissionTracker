const express = require("express");
const router = express.Router();
const {
	User,
	Completion,
	Question,
	Topic,
	InstructorCourseSection,
	InteractionLog,
} = require("../models");
const { isAuthenticated, isInstructor } = require("../middleware/auth");
const { Op } = require("sequelize");
const createCsvStringifier = require("csv-writer").createObjectCsvStringifier;
const {
	buildStudentScopeFilter,
	getFilterOptions,
	formatStudentName,
} = require("../utils/exportHelpers");
const { runMatrixExport, runTopicSummaryExport, runDetailedAttemptsExport } = require("../utils/exportRunners");

// Root instructor route - redirect to dashboard
router.get("/", isAuthenticated, isInstructor, (req, res) => {
	res.redirect("/instructor/dashboard");
});

// Instructor Dashboard
router.get("/dashboard", isAuthenticated, isInstructor, async (req, res) => {
	try {
		const instructorId = req.session.user.id;

		// Get instructor's students
		const students = await User.findAll({
			where: {
				associatedInstructorId: instructorId,
				role: "student",
			},
			attributes: ["id", "email", "firstName", "lastName", "createdAt"],
			order: [["createdAt", "DESC"]],
		});

		// Get completion statistics for instructor's students
		const studentIds = students.map((student) => student.id);
		const completions = await Completion.findAll({
			where: {
				userId: {
					[Op.in]: studentIds,
				},
			},
			include: [
				{
					model: Question,
					as: "question",
					include: [{ model: Topic, as: "topic" }],
				},
			],
		});

		// Calculate statistics
		const totalStudents = students.length;
		const totalCompletions = completions.length;
		const uniqueStudentsWithCompletions = new Set(
			completions.map((c) => c.userId)
		).size;

		// Contextual rates — type lives on Topic, not Question; join to filter
		const totalQuestions = await Question.count({
			include: [{ model: Topic, as: "topic", where: { type: "sql" }, required: true }],
		});
		const possibleCompletions = totalStudents * totalQuestions;
		const completionRate = possibleCompletions > 0
			? Math.round((totalCompletions / possibleCompletions) * 100)
			: 0;
		const engagementRate = totalStudents > 0
			? Math.round((uniqueStudentsWithCompletions / totalStudents) * 100)
			: 0;

		// Per-student completion counts for the recent students table
		const completionCountRows = await Completion.findAll({
			where: { userId: { [Op.in]: studentIds } },
			attributes: ["userId", [require("sequelize").fn("COUNT", require("sequelize").col("id")), "count"]],
			group: ["userId"],
			raw: true,
		});
		const completionMap = Object.fromEntries(completionCountRows.map((r) => [r.userId, Number(r.count)]));
		const studentsWithCounts = students.map((s) => ({
			...s.toJSON(),
			completionCount: completionMap[s.id] || 0,
		}));

		// Get recent ER diagram submissions from instructor's students
		const erSubmissions = await Completion.findAll({
			where: {
				userId: {
					[Op.in]: studentIds,
				},
				diagramImage: {
					[Op.not]: null,
				},
			},
			include: [
				{
					model: User,
					as: "user",
					attributes: ["firstName", "lastName", "email"],
				},
			],
			order: [["createdAt", "DESC"]],
			limit: 10,
		});

		res.render("pages/instructor/dashboard", {
			title: "Instructor Dashboard",
			students: studentsWithCounts,
			completions,
			erSubmissions,
			totalQuestions,
			completionRate,
			engagementRate,
			stats: {
				totalStudents,
				totalCompletions,
				uniqueStudentsWithCompletions,
			},
		});
	} catch (error) {
		console.error("Instructor dashboard error:", error);
		res.status(500).render("pages/error", {
			title: "Error",
			message: "An error occurred while loading the dashboard.",
		});
	}
});

// View instructor's students
router.get("/students", isAuthenticated, isInstructor, async (req, res) => {
	try {
		const instructorId = req.session.user.id;
		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 20;
		const offset = (page - 1) * limit;

		// Get instructor's students with pagination
		const { count, rows: students } = await User.findAndCountAll({
			where: {
				associatedInstructorId: instructorId,
				role: "student",
			},
			attributes: ["id", "email", "firstName", "lastName", "createdAt"],
			order: [["createdAt", "DESC"]],
			limit,
			offset,
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

		const totalPages = Math.ceil(count / limit);

		res.render("pages/instructor/students", {
			title: "My Students",
			students,
			currentPage: page,
			totalPages,
			totalStudents: count,
			limit,
		});
	} catch (error) {
		console.error("Instructor students error:", error);
		res.status(500).render("pages/error", {
			title: "Error",
			message: "An error occurred while loading students.",
		});
	}
});

// View individual student progress
router.get(
	"/students/:studentId",
	isAuthenticated,
	isInstructor,
	async (req, res) => {
		try {
			const instructorId = req.session.user.id;
			const studentId = parseInt(req.params.studentId);

			// Verify the student belongs to this instructor
			const student = await User.findOne({
				where: {
					id: studentId,
					associatedInstructorId: instructorId,
					role: "student",
				},
			});

			if (!student) {
				return res.status(404).render("pages/error", {
					title: "Student Not Found",
					message:
						"The requested student was not found or does not belong to your class.",
				});
			}

			// Get student's completions
			const completions = await Completion.findAll({
				where: { userId: studentId },
				include: [
					{
						model: Question,
						as: "question",
						include: [{ model: Topic, as: "topic" }],
					},
				],
				order: [["createdAt", "DESC"]],
			});

			// Get ER diagram submissions
			const erSubmissions = await Completion.findAll({
				where: {
					userId: studentId,
					diagramImage: {
						[Op.not]: null,
					},
				},
				order: [["createdAt", "DESC"]],
			});

			// Calculate progress statistics
			const totalQuestions = await Question.count();
			const completedQuestions = completions.length;
			const progressPercentage =
				totalQuestions > 0 ? (completedQuestions / totalQuestions) * 100 : 0;

			// Group completions by topic
			const completionsByTopic = {};
			completions.forEach((completion) => {
				if (completion.question && completion.question.topic) {
					const topicName = completion.question.topic.name;
					if (!completionsByTopic[topicName]) {
						completionsByTopic[topicName] = [];
					}
					completionsByTopic[topicName].push(completion);
				}
			});

			res.render("pages/instructor/student-detail", {
				title: `Student Progress - ${student.firstName} ${student.lastName}`,
				student,
				completions,
				completionsByTopic,
				erSubmissions,
				stats: {
					totalQuestions,
					completedQuestions,
					progressPercentage,
				},
			});
		} catch (error) {
			console.error("Student detail error:", error);
			res.status(500).render("pages/error", {
				title: "Error",
				message: "An error occurred while loading student details.",
			});
		}
	}
);

// Export Center page
router.get("/export", isAuthenticated, isInstructor, async (req, res) => {
	try {
		const instructorId = req.session.user.id;

		const topics = await Topic.findAll({
			attributes: ["id", "name", "type", "database"],
			order: [["name", "ASC"]],
		});

		const topicsWithCounts = await Promise.all(
			topics.map(async (topic) => {
				const questionCount = await Question.count({ where: { topicId: topic.id } });
				return {
					id: topic.id,
					name: topic.name,
					type: topic.type,
					database: topic.database,
					questionCount,
				};
			})
		);
		const filteredTopics = topicsWithCounts.filter((topic) => topic.questionCount > 0);

		const filterOptions = await getFilterOptions("instructor", instructorId);

		res.render("pages/instructor/export-center", {
			title: "Export Center",
			topics: filteredTopics,
			academicYears: filterOptions.academicYears,
			semesters: filterOptions.semesters,
			courseSections: filterOptions.courseSections,
			isAdmin: false,
			initialType: req.query.type || "topic-summary",
			initialFilters: {
				academicYear: req.query.academicYear || "all",
				semester: req.query.semester || "all",
				courseSection: req.query.courseSection || "all",
			},
		});
	} catch (error) {
		console.error("Error loading export center:", error);
		res.status(500).render("pages/error", {
			title: "Error",
			message: "Failed to load export center. Please try again later.",
		});
	}
});

// Export Center dispatcher
router.get("/export/run", isAuthenticated, isInstructor, async (req, res) => {
	try {
		const instructorId = req.session.user.id;
		const { type } = req.query;

		if (type === "submissions") {
			return res.redirect(307, "/instructor/export/submissions");
		}

		const studentWhere = buildStudentScopeFilter("instructor", instructorId, req.query);

		let result;
		if (type === "matrix") {
			result = await runMatrixExport({
				studentWhere,
				topicId: req.query.topicId,
				summaryOnly: req.query.summaryOnly === "true",
				createCsvStringifier,
			});
		} else if (type === "detailed-attempts") {
			let topicIds = req.query.detailedAttemptsTopicIds;
			if (!topicIds) {
				return res.redirect("/instructor/export?type=detailed-attempts");
			}
			if (!Array.isArray(topicIds)) topicIds = [topicIds];
			topicIds = topicIds.map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));
			if (topicIds.length === 0) {
				return res.redirect("/instructor/export?type=detailed-attempts");
			}
			result = await runDetailedAttemptsExport({ studentWhere, topicIds });
		} else {
			// default / topic-summary
			let topicIds = req.query.topicSummaryTopicIds;
			if (!topicIds) {
				return res.redirect("/instructor/export?type=topic-summary");
			}
			if (!Array.isArray(topicIds)) topicIds = [topicIds];
			topicIds = topicIds.map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));
			if (topicIds.length === 0) {
				return res.redirect("/instructor/export?type=topic-summary");
			}
			result = await runTopicSummaryExport({ studentWhere, topicIds });
		}

		if (result.notFound) {
			return res.status(404).render("pages/error", {
				title: "No Data",
				message: "No students or questions found matching the selected filters.",
			});
		}

		const csvStringifier = createCsvStringifier({ header: result.headers });
		res.setHeader("Content-Type", "text/csv");
		res.setHeader(
			"Content-Disposition",
			`attachment; filename="${result.filenamePrefix}-${Date.now()}.csv"`
		);
		res.write(csvStringifier.getHeaderString());
		res.write(csvStringifier.stringifyRecords(result.csvData));
		res.end();
	} catch (error) {
		console.error("Error running export:", error);
		res.status(500).render("pages/error", {
			title: "Error",
			message: "Failed to export data. Please try again later.",
		});
	}
});

// Export submissions data
router.get(
	"/export/submissions",
	isAuthenticated,
	isInstructor,
	async (req, res) => {
		try {
			const instructorId = req.session.user.id;

			// Get instructor's students
			const students = await User.findAll({
				where: {
					associatedInstructorId: instructorId,
					role: "student",
				},
				attributes: ["id"],
			});

			const studentIds = students.map((student) => student.id);

			// Get ER diagram submissions from instructor's students
			const submissions = await Completion.findAll({
				where: {
					userId: {
						[Op.in]: studentIds,
					},
					diagramImage: {
						[Op.not]: null,
					},
				},
				include: [
					{
						model: User,
						as: "user",
						attributes: ["id", "email", "firstName", "lastName"],
					},
					{
						model: Question,
						as: "question",
						attributes: ["id", "questionText", "modelDescription"],
					},
				],
				order: [["completedAt", "DESC"]],
			});

			// Generate CSV data
			const csvStringifier = createCsvStringifier({
				header: [
					{ id: "studentName", title: "Student Name" },
					{ id: "studentEmail", title: "Student Email" },
					{ id: "questionText", title: "Question" },
					{ id: "status", title: "Status" },
					{ id: "aiScore", title: "AI Score" },
					{ id: "adminScore", title: "Admin Score" },
					{ id: "submittedAt", title: "Submitted At" },
				],
			});

			const csvData = submissions.map((submission) => ({
				studentName:
					`${submission.user.firstName || ""} ${
						submission.user.lastName || ""
					}`.trim() || "Not provided",
				studentEmail: submission.user.email,
				questionText: submission.question
					? submission.question.questionText
					: "Question not found",
				status: submission.status,
				aiScore: submission.aiScore || "Not evaluated",
				adminScore: submission.adminScore || "Not evaluated",
				submittedAt: new Date(submission.createdAt).toLocaleDateString(),
			}));

			// Set response headers for CSV download
			res.setHeader("Content-Type", "text/csv");
			res.setHeader(
				"Content-Disposition",
				"attachment; filename=submissions.csv"
			);

			// Write CSV header and data
			res.write(csvStringifier.getHeaderString());
			res.write(csvStringifier.stringifyRecords(csvData));
			res.end();
		} catch (error) {
			console.error("Error exporting submissions:", error);
			res.status(500).render("pages/error", {
				title: "Error",
				message: "Failed to export submissions. Please try again later.",
			});
		}
	}
);

// View ER diagram submissions from instructor's students
router.get("/submissions", isAuthenticated, isInstructor, async (req, res) => {
	try {
		const instructorId = req.session.user.id;
		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 20;
		const offset = (page - 1) * limit;

		// Get instructor's students
		const students = await User.findAll({
			where: {
				associatedInstructorId: instructorId,
				role: "student",
			},
			attributes: ["id"],
		});

		const studentIds = students.map((student) => student.id);

		// Get ER diagram submissions from instructor's students with pagination
		const { count, rows: submissions } = await Completion.findAndCountAll({
			where: {
				userId: {
					[Op.in]: studentIds,
				},
				diagramImage: {
					[Op.not]: null,
				},
			},
			include: [
				{
					model: User,
					as: "user",
					attributes: ["id", "email", "firstName", "lastName"],
				},
				{
					model: Question,
					as: "question",
					attributes: ["id", "questionText", "modelDescription"],
				},
			],
			order: [["completedAt", "DESC"]],
			limit,
			offset,
		});

		const totalPages = Math.ceil(count / limit);

		res.render("pages/instructor/submissions", {
			title: "ER Diagram Submissions",
			submissions,
			currentPage: page,
			totalPages,
			totalSubmissions: count,
			limit,
		});
	} catch (error) {
		console.error("Error fetching submissions:", error);
		res.status(500).render("pages/error", {
			title: "Error",
			message: "Failed to load submissions",
		});
	}
});

// View single submission details (instructor version)
router.get(
	"/submissions/:id",
	isAuthenticated,
	isInstructor,
	async (req, res) => {
		try {
			const instructorId = req.session.user.id;
			const submissionId = req.params.id;

			const submission = await Completion.findByPk(submissionId, {
				include: [
					{
						model: User,
						as: "user",
						attributes: [
							"id",
							"email",
							"firstName",
							"lastName",
							"associatedInstructorId",
						],
					},
					{
						model: Question,
						as: "question",
						attributes: ["id", "questionText", "modelDescription"],
					},
				],
			});

			if (!submission) {
				return res.status(404).render("pages/error", {
					title: "Not Found",
					message: "Submission not found",
				});
			}

			// Verify the submission belongs to one of the instructor's students
			if (submission.user.associatedInstructorId !== instructorId) {
				return res.status(403).render("pages/error", {
					title: "Access Denied",
					message: "You can only view submissions from your students.",
				});
			}

			// Process evaluation data for template
			let aiFeedback = "No AI feedback available";
			let showCopyButton = false;
			let aiScoreData = "";
			let aiFeedbackData = "";

			if (submission.evaluation) {
				try {
					const evaluation =
						typeof submission.evaluation === "string"
							? JSON.parse(submission.evaluation)
							: submission.evaluation;
					aiFeedback = evaluation.analysis || "No AI feedback available";

					// Check if we can show the copy button
					if (
						submission.aiScore !== null &&
						submission.aiScore !== undefined &&
						evaluation.analysis
					) {
						showCopyButton = true;
						aiScoreData = submission.aiScore;
						aiFeedbackData = evaluation.analysis
							.replace(/"/g, "&quot;")
							.replace(/\n/g, "&#10;");
					}
				} catch (e) {
					aiFeedback = "Error parsing AI feedback";
					console.error("Error parsing evaluation data:", e);
				}
			}

			res.render("pages/instructor/submission-detail", {
				title: "Submission Details",
				submission,
				aiFeedback,
				showCopyButton,
				aiScoreData,
				aiFeedbackData,
			});
		} catch (error) {
			console.error("Error fetching submission details:", error);
			res.status(500).render("pages/error", {
				title: "Error",
				message: "Failed to load submission details",
			});
		}
	}
);

// Update submission (comments and score) - instructor version
router.post(
	"/submissions/:id",
	isAuthenticated,
	isInstructor,
	async (req, res) => {
		try {
			const instructorId = req.session.user.id;
			const { adminComments, adminScore } = req.body;
			const submission = await Completion.findByPk(req.params.id, {
				include: [
					{
						model: User,
						as: "user",
						attributes: ["id", "associatedInstructorId"],
					},
				],
			});

			if (!submission) {
				return res.status(404).json({
					success: false,
					message: "Submission not found",
				});
			}

			// Verify the submission belongs to one of the instructor's students
			if (submission.user.associatedInstructorId !== instructorId) {
				return res.status(403).json({
					success: false,
					message: "You can only update submissions from your students.",
				});
			}

			await submission.update({
				adminComments,
				adminScore: adminScore ? parseInt(adminScore) : null,
			});

			res.json({
				success: true,
				message: "Submission updated successfully",
			});
		} catch (error) {
			console.error("Error updating submission:", error);
			res.status(500).json({
				success: false,
				message: "Error updating submission",
				error: error.message,
			});
		}
	}
);

module.exports = router;
