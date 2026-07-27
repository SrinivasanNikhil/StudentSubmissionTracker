const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const crypto = require("crypto");
const {
	Completion,
	Question,
	User,
	Topic,
	InstructorCourseSection,
} = require("../models");
const {
	isAuthenticated,
	isAdmin,
	isInstructorOrAdmin,
} = require("../middleware/auth");
const { Op } = require("sequelize");
const openai = require("../services/openai");

// Treat a principal as an admin only when they genuinely are one.
//
// The ownership checks below are deliberately written as "if NOT an admin,
// scope to your own students" rather than "if an instructor, scope". The old
// shape meant any principal reaching these handlers without
// role === "instructor" — e.g. via the legacy isAdmin boolean that
// isInstructorOrAdmin also accepts — skipped the ownership branch entirely and
// got unrestricted read/grade access to every submission.
function isAdminUser(sessionUser) {
	return (
		Boolean(sessionUser) &&
		(sessionUser.role === "admin" || sessionUser.isAdmin === true)
	);
}

// Ensure upload directory exists
const uploadDir = path.join(__dirname, "../public/uploads/diagrams");
fs.mkdir(uploadDir, { recursive: true }).catch(console.error);

// Configure multer for file uploads
const storage = multer.diskStorage({
	destination: async (req, file, cb) => {
		try {
			await fs.mkdir(uploadDir, { recursive: true });
			cb(null, uploadDir);
		} catch (error) {
			console.error("Error creating upload directory:", error);
			cb(error);
		}
	},
	filename: (req, file, cb) => {
		// NEVER derive the extension from file.originalname — it is user-controlled,
		// and an attacker-chosen extension (e.g. .html) would be written to disk and
		// later served with that content type, giving stored XSS on our own origin.
		// The extension is hard-coded to .png; content is verified after write.
		const uniqueSuffix = crypto.randomBytes(16).toString("hex");
		cb(null, `diagram-${uniqueSuffix}.png`);
	},
});

// PNG signature: \x89 P N G \r \n \x1a \n
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Verify a file really is a PNG by reading its magic bytes. `file.mimetype` is
 * just the client-supplied Content-Type header and is trivially spoofed, so it
 * must never be the only check.
 */
async function isRealPng(filePath) {
	let handle;
	try {
		handle = await fs.open(filePath, "r");
		const { buffer, bytesRead } = await handle.read(Buffer.alloc(8), 0, 8, 0);
		return bytesRead === 8 && buffer.equals(PNG_MAGIC);
	} catch (error) {
		console.error("Error verifying PNG signature:", error);
		return false;
	} finally {
		if (handle) await handle.close().catch(() => {});
	}
}

const upload = multer({
	storage,
	limits: {
		fileSize: 5 * 1024 * 1024, // 5MB limit
	},
	fileFilter: (req, file, cb) => {
		// First-pass rejection only; the authoritative check is isRealPng() after write.
		if (file.mimetype === "image/png") {
			cb(null, true);
		} else {
			cb(new Error("Only PNG files are allowed"));
		}
	},
});

// Get ER diagram submission form
router.get("/submit/:questionId", isAuthenticated, async (req, res) => {
	try {
		const question = await Question.findByPk(req.params.questionId, {
			include: [{ model: Topic, as: "topic" }],
		});

		if (!question || question.topic.type !== "data_model") {
			return res.status(404).render("pages/error", {
				title: "Not Found",
				message: "Question not found or not a data model question",
			});
		}

		res.render("pages/er-diagram-submit", {
			title: "Submit ER Diagram",
			question,
		});
	} catch (error) {
		console.error("Error loading submission form:", error);
		res.status(500).render("pages/error", {
			title: "Error",
			message: "Failed to load submission form",
		});
	}
});

// Submit ER diagram
router.post(
	"/submit/:questionId",
	isAuthenticated,
	upload.single("diagram"),
	async (req, res) => {
		let uploadedFile = null;
		try {
			const { questionId } = req.params;
			const { enhancements, aiReflection } = req.body;
			const userId = req.session.userId;

			// Enhanced validation
			if (!enhancements || enhancements.trim() === "") {
				return res.status(400).json({
					success: false,
					message: "Enhancements explanation is required",
				});
			}

			if (!aiReflection || aiReflection.trim() === "") {
				return res.status(400).json({
					success: false,
					message: "AI tool usage reflection is required",
				});
			}

			// Validate question exists and is data model type
			const question = await Question.findByPk(questionId, {
				include: [{ model: Topic, as: "topic" }],
			});

			if (!question) {
				return res.status(404).json({
					success: false,
					message: "Question not found",
				});
			}

			if (question.topic.type !== "data_model") {
				return res.status(400).json({
					success: false,
					message: "This endpoint is only for data model questions",
				});
			}

			if (!req.file) {
				return res.status(400).json({
					success: false,
					message: "Diagram image is required",
				});
			}

			// Validate file type by CONTENT, not by the client-supplied mimetype.
			if (!(await isRealPng(req.file.path))) {
				await fs.unlink(req.file.path);
				return res.status(400).json({
					success: false,
					message: "Only PNG files are allowed",
				});
			}

			uploadedFile = req.file;

			// Completions are unique per (user, question, academicYear, semester);
			// scope the duplicate check to the student's effective term so a
			// retaking student can submit again in a new term.
			const submitUser = await User.findByPk(userId);
			const effectiveYear =
				submitUser.academicYear ||
				InstructorCourseSection.getCurrentAcademicYear();
			const effectiveSemester =
				submitUser.semester || InstructorCourseSection.getCurrentSemester();

			// Check for existing submission this term
			const existingSubmission = await Completion.findOne({
				where: {
					userId,
					questionId,
					academicYear: effectiveYear,
					semester: effectiveSemester,
				},
			});

			if (existingSubmission) {
				await fs.unlink(req.file.path);
				return res.status(400).json({
					success: false,
					message: "You have already submitted an answer for this question",
				});
			}

			// Create completion record
			const completion = await Completion.create({
				userId,
				questionId,
				completedAt: new Date(),
				diagramImage: `/diagrams/${req.file.filename}`,
				enhancements,
				aiReflection,
				status: "pending",
				academicYear: effectiveYear,
				semester: effectiveSemester,
				courseSection: submitUser.courseSection,
			});

			res.json({
				success: true,
				message: "Submission successful",
				completionId: completion.id,
			});
		} catch (error) {
			console.error("Error submitting ER diagram:", error);

			// Clean up uploaded file if there was an error
			if (uploadedFile) {
				try {
					await fs.unlink(uploadedFile.path);
				} catch (cleanupError) {
					console.error("Error cleaning up uploaded file:", cleanupError);
				}
			}

			// Enhanced error response
			const errorMessage = error.message || "Error submitting ER diagram";
			const statusCode = error.statusCode || 500;

			res.status(statusCode).json({
				success: false,
				message: errorMessage,
				error: process.env.NODE_ENV === "development" ? error.stack : undefined,
			});
		}
	}
);

// Admin/Instructor: Get all ER diagram submissions (filtered for instructors)
router.get("/admin/submissions", isInstructorOrAdmin, async (req, res) => {
	try {
		let whereCondition = {
			diagramImage: {
				[Op.not]: null,
			},
		};

		// Non-admins only ever see submissions from their own students
		if (!isAdminUser(req.session.user)) {
			const instructorId = req.session.user.id;
			const students = await User.findAll({
				where: {
					associatedInstructorId: instructorId,
					role: "student",
				},
				attributes: ["id"],
			});
			const studentIds = students.map((student) => student.id);
			whereCondition.userId = {
				[Op.in]: studentIds,
			};
		}

		const submissions = await Completion.findAll({
			where: whereCondition,
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

		const templatePath =
			req.session.user.role === "instructor"
				? "pages/instructor/submissions"
				: "pages/admin/er-submissions";

		res.render(templatePath, {
			title: "ER Diagram Submissions",
			submissions,
		});
	} catch (error) {
		console.error("Error fetching submissions:", error);
		res.status(500).render("pages/error", {
			title: "Error",
			message: "Failed to load submissions",
		});
	}
});

// Admin/Instructor: Get single submission details
router.get("/admin/submissions/:id", isInstructorOrAdmin, async (req, res) => {
	try {
		const submission = await Completion.findByPk(req.params.id, {
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

		// Non-admins may only act on submissions from their own students
		if (!isAdminUser(req.session.user)) {
			const instructorId = req.session.user.id;
			if (submission.user.associatedInstructorId !== instructorId) {
				return res.status(403).render("pages/error", {
					title: "Access Denied",
					message: "You can only view submissions from your students.",
				});
			}
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

		const templatePath =
			req.session.user.role === "instructor"
				? "pages/instructor/submission-detail"
				: "pages/admin/er-submission-detail";

		res.render(templatePath, {
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
});

// Admin/Instructor: Update submission (comments and score)
router.post("/admin/submissions/:id", isInstructorOrAdmin, async (req, res) => {
	try {
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

		// Non-admins may only act on submissions from their own students
		if (!isAdminUser(req.session.user)) {
			const instructorId = req.session.user.id;
			if (submission.user.associatedInstructorId !== instructorId) {
				return res.status(403).json({
					success: false,
					message: "You can only update submissions from your students.",
				});
			}
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
		});
	}
});

// Admin/Instructor: Trigger AI evaluation for a submission
router.post(
	"/admin/submissions/:id/evaluate",
	isInstructorOrAdmin,
	async (req, res) => {
		try {
			const submission = await Completion.findByPk(req.params.id, {
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
				return res.status(404).json({
					success: false,
					message: "Submission not found",
				});
			}

			// Non-admins may only act on submissions from their own students
			if (!isAdminUser(req.session.user)) {
				const instructorId = req.session.user.id;
				if (submission.user.associatedInstructorId !== instructorId) {
					return res.status(403).json({
						success: false,
						message: "You can only evaluate submissions from your students.",
					});
				}
			}

			if (!submission.diagramImage) {
				return res.status(400).json({
					success: false,
					message: "No diagram image found for evaluation",
				});
			}

			// Use shared AI evaluation function
			const { aiAnalysis, aiScore } = await evaluateERDiagram(submission);

			// Update completion with AI feedback
			await submission.update({
				evaluation: {
					analysis: aiAnalysis || "AI evaluation not available",
					score: aiScore,
					timestamp: new Date().toISOString(),
				},
				aiScore,
				status: aiAnalysis ? "evaluated" : "pending",
			});

			res.json({
				success: true,
				message: "AI evaluation completed successfully",
				aiScore,
				aiAnalysis,
			});
		} catch (error) {
			console.error("Error triggering AI evaluation:", error);
			res.status(500).json({
				success: false,
				message: "Error triggering AI evaluation",
			});
		}
	}
);

// Student: View their submitted ER diagram
router.get("/my-submission/:questionId", isAuthenticated, async (req, res) => {
	try {
		const { questionId } = req.params;
		const userId = req.session.userId;

		// Find the student's submission for this question
		const submission = await Completion.findOne({
			where: {
				userId,
				questionId,
				diagramImage: {
					[Op.not]: null,
				},
			},
			include: [
				{
					model: Question,
					as: "question",
					attributes: ["id", "questionText", "modelDescription"],
					include: [{ model: Topic, as: "topic" }],
				},
			],
		});

		if (!submission) {
			return res.status(404).render("pages/error", {
				title: "Not Found",
				message: "No ER diagram submission found for this question",
			});
		}

		res.render("pages/er-diagram-view", {
			title: "My ER Diagram Submission",
			submission,
		});
	} catch (error) {
		console.error("Error fetching student submission:", error);
		res.status(500).render("pages/error", {
			title: "Error",
			message: "Failed to load submission details",
		});
	}
});

// Shared AI evaluation function
async function evaluateERDiagram(submission) {
	try {
		const imagePath = path.join(
			__dirname,
			"../public/uploads",
			submission.diagramImage
		);
		const imageBuffer = await fs.readFile(imagePath);
		const base64Image = imageBuffer.toString("base64");

		const prompt = `Analyze this ER diagram in the context of the following question:

Question: ${submission.question.questionText}

Student Enhancements: ${submission.enhancements || "No enhancements specified"}

Please evaluate this ER diagram considering:
1. How well it addresses the specific question requirements. If the question is not addressed, give a score of 0 and don't move further in the evaluation.
2. Entity relationships and cardinality
3. Attribute completeness
4. Overall design quality

Provide a score from 0-10 and summarize feedback and suggestions for improvement.`;

		const response = await openai.chat.completions.create({
			model: "gpt-4o",
			messages: [
				{
					role: "system",
					content:
						"You are an expert in database design and ER diagram analysis.",
				},
				{
					role: "user",
					content: [
						{ type: "text", text: prompt },
						{
							type: "image_url",
							image_url: {
								url: `data:image/png;base64,${base64Image}`,
							},
						},
					],
				},
			],
			max_tokens: 1000,
		});

		const aiAnalysis = response.choices[0].message.content;

		// Try multiple patterns to extract score
		let aiScore = null;
		const scorePatterns = [
			/Score:\s*(\d+)/i,
			/score:\s*(\d+)/i,
			/Score\s*(\d+)/i,
			/score\s*(\d+)/i,
			/(\d+)\s*\/\s*10/i,
			/out of 10:\s*(\d+)/i,
			/rating:\s*(\d+)/i,
			/Rating:\s*(\d+)/i,
		];

		for (const pattern of scorePatterns) {
			const match = aiAnalysis.match(pattern);
			if (match) {
				const score = parseInt(match[1]);
				if (score >= 0 && score <= 10) {
					aiScore = score;
					break;
				}
			}
		}

		// If no score found, try to extract any number between 0-10
		if (aiScore === null) {
			const numberMatch = aiAnalysis.match(/(\d+)/g);
			if (numberMatch) {
				for (const num of numberMatch) {
					const score = parseInt(num);
					if (score >= 0 && score <= 10) {
						aiScore = score;
						break;
					}
				}
			}
		}
		return { aiAnalysis, aiScore };
	} catch (error) {
		console.warn("AI evaluation failed:", error.message);
		throw error;
	}
}

module.exports = router;
