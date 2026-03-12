const express = require("express");
const router = express.Router();
const { User, Completion, Question, Topic, InstructorCourseSection } = require("../models");
const { isAuthenticated, isInstructor } = require("../middleware/auth");
const { Op } = require("sequelize");
const createCsvStringifier = require("csv-writer").createObjectCsvStringifier;

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
			students,
			completions,
			erSubmissions,
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

// Export student completions matrix (instructor version)
router.get(
	"/export/students",
	isAuthenticated,
	isInstructor,
	async (req, res) => {
		try {
			const instructorId = req.session.user.id;
			const { topicId } = req.query;

			// Get instructor's students
			const students = await User.findAll({
				where: {
					associatedInstructorId: instructorId,
					role: "student",
				},
				attributes: ["id", "email", "firstName", "lastName", "code"],
				order: [["createdAt", "DESC"]],
			});

			if (students.length === 0) {
				return res.status(404).render("pages/error", {
					title: "No Students",
					message: "You don't have any students assigned to export data for.",
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
				{ id: "code", title: "Code" },
			];

			// Add question columns to headers
			questions.forEach((question) => {
				const topicName = question.topic ? question.topic.name : "Unknown";
				const headerId = `q${question.id}`;
				const headerTitle = `${topicName} - Q${question.questionNumber}`;
				headers.push({ id: headerId, title: headerTitle });
			});

			const csvStringifier = createCsvStringifier({ header: headers });

			// Generate CSV data
			const csvData = students.map((student) => {
				const studentData = {
					email: student.email,
					name:
						`${student.firstName || ""} ${student.lastName || ""}`.trim() ||
						"Not provided",
					code: student.code || "Not set",
				};

				// Add completion status for each question
				const studentCompletedQuestions =
					studentCompletions.get(student.id) || new Set();
				questions.forEach((question) => {
					const headerId = `q${question.id}`;
					studentData[headerId] = studentCompletedQuestions.has(question.id)
						? "1"
						: "0";
				});

				return studentData;
			});

			// Set response headers for CSV download
			res.setHeader("Content-Type", "text/csv");
			res.setHeader(
				"Content-Disposition",
				`attachment; filename="my-students-completions-matrix-${Date.now()}.csv"`
			);

			// Write CSV header and data
			res.write(csvStringifier.getHeaderString());
			res.write(csvStringifier.stringifyRecords(csvData));
			res.end();
		} catch (error) {
			console.error("Error exporting student completions matrix:", error);
			res.status(500).render("pages/error", {
				title: "Error",
				message:
					"Failed to export student completions matrix. Please try again later.",
			});
		}
	}
);

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

// Export student completion summary (instructor version)
router.get(
	"/export/summary",
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
				attributes: ["id", "email", "firstName", "lastName", "code"],
				order: [["createdAt", "DESC"]],
			});

			if (students.length === 0) {
				return res.status(404).render("pages/error", {
					title: "No Students",
					message: "You don't have any students assigned to export data for.",
				});
			}

			// Get student IDs
			const studentIds = students.map((student) => student.id);

			// Get completion statistics for these students
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

			// Generate CSV data
			const csvStringifier = createCsvStringifier({
				header: [
					{ id: "email", title: "Email" },
					{ id: "name", title: "Name" },
					{ id: "code", title: "Code" },
					{ id: "completionCount", title: "Questions Completed" },
				],
			});

			const csvData = students.map((student) => ({
				email: student.email,
				name:
					`${student.firstName || ""} ${student.lastName || ""}`.trim() ||
					"Not provided",
				code: student.code || "Not set",
				completionCount: studentCompletions.get(student.id)?.size || 0,
			}));

			// Set response headers for CSV download
			res.setHeader("Content-Type", "text/csv");
			res.setHeader(
				"Content-Disposition",
				`attachment; filename="my-students-summary-${Date.now()}.csv"`
			);

			// Write CSV header and data
			res.write(csvStringifier.getHeaderString());
			res.write(csvStringifier.stringifyRecords(csvData));
			res.end();
		} catch (error) {
			console.error("Error exporting student summary:", error);
			res.status(500).render("pages/error", {
				title: "Error",
				message: "Failed to export student summary. Please try again later.",
			});
		}
	}
);

// Export by topic form page
router.get(
	"/export/by-topic/form",
	isAuthenticated,
	isInstructor,
	async (req, res) => {
		try {
			const instructorId = req.session.user.id;

			// Get all topics with question counts
			const topics = await Topic.findAll({
				attributes: ["id", "name", "type", "database"],
				order: [["name", "ASC"]],
			});

			// Get question counts for each topic
			const topicsWithCounts = await Promise.all(
				topics.map(async (topic) => {
					const questionCount = await Question.count({
						where: { topicId: topic.id },
					});
					return {
						id: topic.id,
						name: topic.name,
						type: topic.type,
						database: topic.database,
						questionCount,
					};
				})
			);

			// Filter out topics with no questions
			const filteredTopics = topicsWithCounts.filter(
				(topic) => topic.questionCount > 0
			);

			// Get unique academic years and semesters from instructor's course sections
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

			// Extract unique academic years and semesters
			const academicYearsSet = new Set();
			const semestersSet = new Set();
			const courseSectionsMap = new Map();

			courseSectionsData.forEach((cs) => {
				academicYearsSet.add(cs.academicYear);
				semestersSet.add(cs.semester);
				const identifier = `${cs.courseCode}-${cs.sectionCode}`;
				if (!courseSectionsMap.has(identifier)) {
					courseSectionsMap.set(identifier, {
						identifier,
						displayName: `${cs.courseCode} ${cs.sectionCode} - ${cs.courseName}`,
					});
				}
			});

			res.render("pages/instructor/export-by-topic", {
				title: "Export by Topic",
				topics: filteredTopics,
				academicYears: Array.from(academicYearsSet).sort().reverse(),
				semesters: Array.from(semestersSet),
				courseSections: Array.from(courseSectionsMap.values()),
				isAdmin: false,
			});
		} catch (error) {
			console.error("Error loading export by topic form:", error);
			res.status(500).render("pages/error", {
				title: "Error",
				message: "Failed to load export form. Please try again later.",
			});
		}
	}
);

// Export by topic CSV generation
router.get(
	"/export/by-topic",
	isAuthenticated,
	isInstructor,
	async (req, res) => {
		try {
			const instructorId = req.session.user.id;
			let { topicIds, academicYear, semester, courseSection } = req.query;

			// Handle topicIds - can be a single value or array
			if (!topicIds) {
				return res.redirect("/instructor/export/by-topic/form");
			}

			// Ensure topicIds is an array
			if (!Array.isArray(topicIds)) {
				topicIds = [topicIds];
			}

			// Convert to integers
			topicIds = topicIds.map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));

			if (topicIds.length === 0) {
				return res.redirect("/instructor/export/by-topic/form");
			}

			// Build student filter conditions
			const studentWhereCondition = {
				associatedInstructorId: instructorId,
				role: "student",
			};

			// Add semester filters if provided
			if (academicYear && academicYear !== "all") {
				studentWhereCondition.academicYear = academicYear;
			}
			if (semester && semester !== "all") {
				studentWhereCondition.semester = semester;
			}
			if (courseSection && courseSection !== "all") {
				studentWhereCondition.courseSection = courseSection;
			}

			// Get instructor's students with filters
			const students = await User.findAll({
				where: studentWhereCondition,
				attributes: ["id", "email", "firstName", "lastName", "code"],
				order: [["lastName", "ASC"], ["firstName", "ASC"]],
			});

			if (students.length === 0) {
				return res.status(404).render("pages/error", {
					title: "No Students",
					message: "You don't have any students assigned to export data for.",
				});
			}

			// Get selected topics with their question counts
			const topics = await Topic.findAll({
				where: {
					id: {
						[Op.in]: topicIds,
					},
				},
				attributes: ["id", "name"],
				order: [["name", "ASC"]],
			});

			// Get question counts per topic
			const topicQuestionCounts = {};
			for (const topic of topics) {
				topicQuestionCounts[topic.id] = await Question.count({
					where: { topicId: topic.id },
				});
			}

			// Get student IDs
			const studentIds = students.map((student) => student.id);

			// Get all completions for these students for the selected topics
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
						where: {
							topicId: {
								[Op.in]: topicIds,
							},
						},
						attributes: ["id", "topicId"],
					},
				],
				attributes: ["userId", "questionId"],
			});

			// Build a map of student -> topic -> completion count
			const studentTopicCompletions = new Map();
			completions.forEach((completion) => {
				const userId = completion.userId;
				const topicId = completion.question.topicId;

				if (!studentTopicCompletions.has(userId)) {
					studentTopicCompletions.set(userId, new Map());
				}

				const topicMap = studentTopicCompletions.get(userId);
				if (!topicMap.has(topicId)) {
					topicMap.set(topicId, 0);
				}
				topicMap.set(topicId, topicMap.get(topicId) + 1);
			});

			// Build CSV headers
			const headers = [
				{ id: "email", title: "Email" },
				{ id: "name", title: "Name" },
				{ id: "code", title: "Code" },
			];

			// Add topic columns
			topics.forEach((topic) => {
				headers.push({
					id: `topic_${topic.id}`,
					title: topic.name,
				});
			});

			// Add total column
			headers.push({ id: "total", title: "Total" });

			const csvStringifier = createCsvStringifier({ header: headers });

			// Generate CSV data
			const csvData = students.map((student) => {
				const studentData = {
					email: student.email,
					name:
						`${student.firstName || ""} ${student.lastName || ""}`.trim() ||
						"Not provided",
					code: student.code || "Not set",
				};

				let totalCompleted = 0;
				let totalQuestions = 0;

				// Add completion data for each topic
				const topicMap = studentTopicCompletions.get(student.id) || new Map();
				topics.forEach((topic) => {
					const completed = topicMap.get(topic.id) || 0;
					const total = topicQuestionCounts[topic.id] || 0;
					studentData[`topic_${topic.id}`] = `${completed}/${total}`;
					totalCompleted += completed;
					totalQuestions += total;
				});

				studentData.total = `${totalCompleted}/${totalQuestions}`;

				return studentData;
			});

			// Set response headers for CSV download
			res.setHeader("Content-Type", "text/csv");
			res.setHeader(
				"Content-Disposition",
				`attachment; filename="students-by-topic-${Date.now()}.csv"`
			);

			// Write CSV header and data
			res.write(csvStringifier.getHeaderString());
			res.write(csvStringifier.stringifyRecords(csvData));
			res.end();
		} catch (error) {
			console.error("Error exporting by topic:", error);
			res.status(500).render("pages/error", {
				title: "Error",
				message: "Failed to export data by topic. Please try again later.",
			});
		}
	}
);

module.exports = router;
