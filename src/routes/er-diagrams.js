const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const { Completion, Question, User, Topic } = require("../models");
const { isAuthenticated, isAdmin } = require("../middleware/auth");
const { OpenAI } = require("openai");
const { Op } = require("sequelize");

// Debug: Verify Topic is imported
console.log("Topic model imported:", typeof Topic);

// Initialize OpenAI client
const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

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
		const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
		cb(null, `diagram-${uniqueSuffix}${path.extname(file.originalname)}`);
	},
});

const upload = multer({
	storage,
	limits: {
		fileSize: 5 * 1024 * 1024, // 5MB limit
	},
	fileFilter: (req, file, cb) => {
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

			// Validate file type
			if (!req.file.mimetype.match(/^image\/png$/)) {
				await fs.unlink(req.file.path);
				return res.status(400).json({
					success: false,
					message: "Only PNG files are allowed",
				});
			}

			uploadedFile = req.file;

			// Check for existing submission
			const existingSubmission = await Completion.findOne({
				where: {
					userId,
					questionId,
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
				diagramImage: `/uploads/diagrams/${req.file.filename}`,
				enhancements,
				aiReflection,
				status: "pending",
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

// Admin: Get all ER diagram submissions
router.get("/admin/submissions", isAdmin, async (req, res) => {
	try {
		const submissions = await Completion.findAll({
			where: {
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

		res.render("pages/admin/er-submissions", {
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

// Admin: Get single submission details
router.get("/admin/submissions/:id", isAdmin, async (req, res) => {
	try {
		const submission = await Completion.findByPk(req.params.id, {
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
		});

		if (!submission) {
			return res.status(404).render("pages/error", {
				title: "Not Found",
				message: "Submission not found",
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
					console.log(aiScoreData);
					console.log(evaluation.analysis);
					aiFeedbackData = evaluation.analysis
						.replace(/"/g, "&quot;")
						.replace(/\n/g, "&#10;");
				}
			} catch (e) {
				aiFeedback = "Error parsing AI feedback";
				console.error("Error parsing evaluation data:", e);
			}
		}

		res.render("pages/admin/er-submission-detail", {
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

// Admin: Update submission (comments and score)
router.post("/admin/submissions/:id", isAdmin, async (req, res) => {
	try {
		const { adminComments, adminScore } = req.body;
		const submission = await Completion.findByPk(req.params.id);

		if (!submission) {
			return res.status(404).json({
				success: false,
				message: "Submission not found",
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
});

// Admin: Trigger AI evaluation for a submission
router.post("/admin/submissions/:id/evaluate", isAdmin, async (req, res) => {
	try {
		const submission = await Completion.findByPk(req.params.id, {
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
		});

		if (!submission) {
			return res.status(404).json({
				success: false,
				message: "Submission not found",
			});
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
			error: error.message,
		});
	}
});

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
			"../public",
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
		console.log(aiAnalysis);
		console.log(aiScore);
		return { aiAnalysis, aiScore };
	} catch (error) {
		console.warn("AI evaluation failed:", error.message);
		throw error;
	}
}

module.exports = router;
