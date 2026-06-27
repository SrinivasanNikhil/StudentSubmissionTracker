const express = require("express");
const router = express.Router();
const { Question, Topic, Completion, User, InteractionLog, InstructorCourseSection, InstructorSectionTopicSetting } = require("../models");
const { isAuthenticated } = require("../middleware/auth");
const { executeQuery, compareQueries, isSelectOnly } = require("../services/sqlExecutor");
const openai = require("../services/openai");

// Helper: look up a student's InstructorCourseSection from session user
async function getStudentSection(user) {
	if (!user || !user.courseSection || !user.associatedInstructorId) return null;
	const dashIndex = user.courseSection.indexOf("-");
	const courseCode = dashIndex !== -1 ? user.courseSection.slice(0, dashIndex) : user.courseSection;
	const sectionCode = dashIndex !== -1 ? user.courseSection.slice(dashIndex + 1) : "";
	return InstructorCourseSection.findOne({
		where: { instructorId: user.associatedInstructorId, courseCode, sectionCode, isActive: true },
	});
}

// Helper: compute due-date status, accounting for an optional grace period
function getDeadlineStatus(dueDate, gracePeriodMinutes) {
	if (!dueDate) return { isPastDue: false, isPastGrace: false };
	const due = new Date(dueDate);
	const graceCutoff = new Date(due.getTime() + (gracePeriodMinutes || 0) * 60000);
	const now = new Date();
	return { isPastDue: due < now, isPastGrace: graceCutoff < now };
}

// Helper: compute solution unlock status for a user+question
async function getSolutionUnlockStatus(userId, questionId) {
	const existingCompletion = await Completion.findOne({ where: { userId, questionId } });
	if (existingCompletion) return { solutionUnlocked: true, attemptCount: 0, bestRatio: 1, existingCompletion };

	const attemptCount = await InteractionLog.count({
		where: { userId, questionId, eventType: "query_attempt" },
	});

	const recentAttempts = await InteractionLog.findAll({
		where: { userId, questionId, eventType: "query_attempt" },
		order: [["occurred_at", "DESC"]],
		limit: 50,
	});

	const bestRatio = recentAttempts.reduce((best, log) => {
		const data = log.eventData || {};
		if (data.solutionRows > 0) {
			return Math.max(best, (data.studentRows || 0) / data.solutionRows);
		}
		return best;
	}, 0);

	const solutionUnlocked = attemptCount >= 5 && bestRatio >= 0.75;
	return { solutionUnlocked, attemptCount, bestRatio, existingCompletion: null };
}

// Get questions by topic ID
router.get("/topic/:topicId", isAuthenticated, async (req, res) => {
	try {
		const { topicId } = req.params;

		// Get the topic to display its name
		const topic = await Topic.findByPk(topicId);

		if (!topic) {
			return res.status(404).render("pages/error", {
				title: "Topic Not Found",
				message: "The requested topic does not exist.",
			});
		}

		// Check visibility for students in a course section
		let topicDueDate = null;
		let topicIsPastDue = false;
		const sessionUser = req.session.user;
		const studentSection = await getStudentSection(sessionUser);
		if (studentSection) {
			const topicSetting = await InstructorSectionTopicSetting.findOne({
				where: { instructorCourseSectionId: studentSection.id, topicId: topic.id },
			});
			if (topicSetting && topicSetting.isVisible === false) {
				req.flash("error", "That topic is not available for your course section.");
				return res.redirect("/topics");
			}
			if (topicSetting && topicSetting.dueDate) {
				topicDueDate = topicSetting.dueDate;
				topicIsPastDue = new Date(topicSetting.dueDate) < new Date();
			}
		}

		// Get all questions for this topic
		const questions = await Question.findAll({
			where: { topicId },
			order: [["id", "ASC"]],
			attributes: [
				"id",
				"topicId",
				"questionText",
				"modelDescription",
				"expectedOutputs",
				"baseEntities",
				"baseRelationships",
			],
		});

		// Get completions for the current user to mark completed questions
		const completions = await Completion.findAll({
			where: {
				userId: req.session.userId,
			},
			attributes: ["questionId"],
		});

		// Create a Set of completed question IDs for faster lookups
		const completedQuestionIds = new Set(completions.map((c) => c.questionId));

		// Add a 'completed' property to each question
		const questionsWithCompletion = questions.map((question) => ({
			id: question.id,
			topicId: question.topicId,
			questionText: question.questionText,
			completed: completedQuestionIds.has(question.id),
			modelDescription: question.modelDescription,
			expectedOutputs: question.expectedOutputs,
			baseEntities: question.baseEntities,
			baseRelationships: question.baseRelationships,
		}));

		res.render("pages/questions", {
			title: `${topic.name}`,
			topic,
			questions: questionsWithCompletion,
			topicDueDate,
			topicIsPastDue,
		});
	} catch (error) {
		console.error("Error fetching questions:", error);
		res.status(500).render("pages/error", {
			title: "Error",
			message: "Failed to load questions. Please try again later.",
		});
	}
});

// Get a single question by ID
router.get("/:id", isAuthenticated, async (req, res) => {
	try {
		const { id } = req.params;

		// Find the question with its topic
		const question = await Question.findByPk(id, {
			include: [{ model: Topic, as: "topic" }],
			attributes: [
				"id",
				"topicId",
				"questionText",
				"solution",
				"modelDescription",
				"expectedOutputs",
				"baseEntities",
				"baseRelationships",
			],
		});

		if (!question) {
			return res.status(404).render("pages/error", {
				title: "Question Not Found",
				message: "The requested question does not exist.",
			});
		}

		// Check if the user has completed this question
		const completion = await Completion.findOne({
			where: {
				userId: req.session.userId,
				questionId: id,
			},
		});

		const { solutionUnlocked, attemptCount, bestRatio } = await getSolutionUnlockStatus(
			req.session.userId,
			id
		);

		// Prev/next navigation within the same topic
		const topicQuestions = await Question.findAll({
			where: { topicId: question.topicId },
			order: [["id", "ASC"]],
			attributes: ["id"],
		});
		const idx = topicQuestions.findIndex((q) => q.id === question.id);
		const prevId = idx > 0 ? topicQuestions[idx - 1].id : null;
		const nextId = idx < topicQuestions.length - 1 ? topicQuestions[idx + 1].id : null;

		res.render("pages/question-detail", {
			title: `Question #${question.id}`,
			question,
			completed: !!completion,
			solutionUnlocked,
			solutionQuery: solutionUnlocked ? (question.solution || '') : '',
			attemptCount,
			bestRowMatchPct: Math.round(bestRatio * 100),
			prevId,
			nextId,
			questionIndex: idx + 1,
			totalQuestions: topicQuestions.length,
		});
	} catch (error) {
		console.error("Error fetching question:", error);
		res.status(500).render("pages/error", {
			title: "Error",
			message: "Failed to load question. Please try again later.",
		});
	}
});

// Execute a SQL query for a specific question
router.post("/:id/execute", isAuthenticated, async (req, res) => {
	try {
		const { id } = req.params;
		const { query } = req.body;
		const userId = req.session.userId;

		if (!query || query.trim() === "") {
			return res.status(400).json({
				success: false,
				message: "SQL query is required",
			});
		}

		// Find the question with its topic and solution
		const question = await Question.findByPk(id, {
			include: [{ model: Topic, as: "topic" }],
		});

		if (!question) {
			return res.status(404).json({
				success: false,
				message: "Question not found",
			});
		}

		// Check due date for the student's course section
		let pastDeadline = false;
		let pastGrace = false;
		const execSection = await getStudentSection(req.session.user);
		if (execSection) {
			const deadlineSetting = await InstructorSectionTopicSetting.findOne({
				where: { instructorCourseSectionId: execSection.id, topicId: question.topic.id },
			});
			if (deadlineSetting?.dueDate) {
				const deadlineStatus = getDeadlineStatus(deadlineSetting.dueDate, deadlineSetting.gracePeriodMinutes);
				pastDeadline = deadlineStatus.isPastDue;
				pastGrace = deadlineStatus.isPastGrace;
			}
		}

		// Determine the database to use
		const databaseName = question.topic.database;

		// Execute the query against the appropriate database
		const result = await executeQuery(query, databaseName);

		// If execution was successful and we have a solution, compare them
		let comparison = null;
		let isCompleted = false;

		if (result.success && question.solution) {
			comparison = await compareQueries(query, question.solution, databaseName);

			// Check if the student query matches BOTH rows AND columns
			// Also ensure the comparison object has all required properties for safety
			if (
				comparison &&
				comparison.success &&
				comparison.studentResult &&
				comparison.solutionResult &&
				comparison.rowsMatch && // Rows must match
				comparison.columnsMatch // Column count must match
			) {
				isCompleted = true;

				if (!pastGrace) {
					// Check if the user has already completed this question
					const existingCompletion = await Completion.findOne({
						where: {
							userId,
							questionId: id,
						},
					});

					// If not already completed, mark it as completed
					if (!existingCompletion) {
						// Get user's semester information
						const user = await User.findByPk(userId);

						await Completion.create({
							userId,
							questionId: id,
							completedAt: new Date(),
							academicYear:
								user.academicYear ||
								InstructorCourseSection.getCurrentAcademicYear(),
							semester:
								user.semester || InstructorCourseSection.getCurrentSemester(),
							courseSection: user.courseSection,
						});

						console.log(
							`✅ Question ${id} marked as completed for user ${userId} - All criteria met (rows, columns)`
						);
					} else {
						console.log(`ℹ️ Question ${id} already completed for user ${userId}`);
					}
				} else {
					console.log(`⏰ Question ${id} correct for user ${userId} but grace period has passed — completion not recorded`);
				}
			} else if (comparison && comparison.success) {
				// Log why the question was not completed
				const reasons = [];
				if (!comparison.rowsMatch) reasons.push("row count mismatch");
				if (!comparison.columnsMatch) reasons.push("column count mismatch");

				console.log(
					`❌ Question ${id} NOT completed for user ${userId} - Reasons: ${reasons.join(
						", "
					)}`
				);
			}
		}

		// Only expose the solution in the response if it is unlocked
		const {
			solutionUnlocked: execSolutionUnlocked,
			attemptCount: execAttemptCount,
			bestRatio: execBestRatio,
		} = await getSolutionUnlockStatus(userId, id);

		// Log the query attempt
		const userForLog = await User.findByPk(userId);
		await logInteraction(userId, id, "query_attempt", {
			queryText: query,
			isCorrect: isCompleted,
			rowsMatch: comparison?.rowsMatch || false,
			columnsMatch: comparison?.columnsMatch || false,
			columnNamesMatch: comparison?.columnNamesMatch || false,
			studentRows: comparison?.studentResult?.rows ?? 0,
			solutionRows: comparison?.solutionResult?.rows ?? 0,
			isLate: pastDeadline,
		}, userForLog);

		// Return the results
		return res.json({
			success: result.success,
			executionResult: {
				...result,
				solution: execSolutionUnlocked ? question.solution : null,
			},
			comparison: comparison,
			databaseName: databaseName,
			isCompleted: isCompleted,
			pastDeadline: pastDeadline,
			pastGrace: pastGrace,
			solutionUnlocked: execSolutionUnlocked,
			attemptCount: execAttemptCount,
			bestRowMatchPct: Math.round(execBestRatio * 100),
		});
	} catch (error) {
		console.error("Error executing SQL query:", error);
		return res.status(500).json({
			success: false,
			message: "Error executing query",
			error: error.message,
			executionResult: {
				success: false,
				message: error.message,
				error: error.toString(),
				errorCode: error.code,
				errorState: error.sqlState,
				errorNumber: error.errno,
			},
		});
	}
});

// Analyze queries using ChatGPT
router.post("/:id/analyze", isAuthenticated, async (req, res) => {
	try {
		const { userQuery, referenceQuery } = req.body;
		const { id } = req.params;

		// Enforce solution unlock gate
		const { solutionUnlocked } = await getSolutionUnlockStatus(req.session.userId, id);
		if (!solutionUnlocked) {
			return res.status(403).json({
				success: false,
				message: "Solution not yet unlocked. Complete more attempts to access AI comparison.",
			});
		}

		if (!userQuery || !referenceQuery) {
			return res.status(400).json({
				success: false,
				message: "Both user query and reference query are required",
			});
		}

		// Create a prompt for ChatGPT
		const prompt = `Compare the following two SQL queries strictly in the context of MySQL:

User Query:
${userQuery}

Reference Query:
${referenceQuery}

Your response can include if necessary:
	1. A step-by-step explanation of how each query works in MySQL
	2. Differences in logic, syntax, and output within MySQL
	3. Provide the response in 250 words or less.

Format your response in a clear, structured way using HTML formatting.`;

		// Get analysis from ChatGPT
		const completion = await openai.chat.completions.create({
			model: "gpt-4.1-nano",
			messages: [
				{
					role: "system",
					content:
						"You are an expert SQL analyst. Analyze the queries and provide a detailed comparison.",
				},
				{
					role: "user",
					content: prompt,
				},
			],
			temperature: 0.5,
			max_tokens: 512,
		});

		const analysis = completion.choices[0].message.content;

		return res.json({
			success: true,
			analysis: analysis,
		});
	} catch (error) {
		console.error("Error analyzing queries:", error);
		return res.status(500).json({
			success: false,
			message: "Failed to analyze queries",
			error: error.message,
		});
	}
});

// On-demand AI syntax feedback
router.post("/:id/analyze-syntax", isAuthenticated, async (req, res) => {
	try {
		const { query } = req.body;
		const { id } = req.params;
		const userId = req.session.userId;

		if (!query || query.trim() === "") {
			return res.status(400).json({
				success: false,
				message: "SQL query is required",
			});
		}

		// Reject oversized payloads (prompt injection / token abuse)
		if (query.length > 2000) {
			return res.status(400).json({
				success: false,
				message: "Query is too long. Please shorten your query.",
			});
		}

		// Validate that the input is a SELECT statement — rejects non-SQL text and
		// destructive statements before they ever reach the OpenAI API
		if (!isSelectOnly(query)) {
			return res.status(400).json({
				success: false,
				message: "Only SELECT queries can be analysed. Please write a SELECT statement.",
			});
		}

		const question = await Question.findByPk(id, {
			include: [{ model: Topic, as: "topic" }],
		});

		if (!question) {
			return res.status(404).json({
				success: false,
				message: "Question not found",
			});
		}

		const prompt = `You are a MySQL TA helping a student for the following question:

Question: ${question.questionText}

The student has written this query:
${query}

Provide feedback on SQL syntax correctness. Keep the response to 128 tokens or less, focus on immediate, actionable feedback. No solution, no code.
Format the response in HTML with appropriate styling.`;

		const completion = await openai.chat.completions.create({
			model: "gpt-4.1-nano",
			messages: [
				{
					role: "system",
					content: "You are an expert MySQL tutor providing feedback to students.",
				},
				{
					role: "user",
					content: prompt,
				},
			],
			temperature: 0.35,
			max_tokens: 128,
		});

		const analysis = completion.choices[0].message.content;

		const user = await User.findByPk(userId);
		await logInteraction(userId, id, "ai_feedback_requested", {
			queryLength: query.length,
			analysisLength: analysis.length,
		}, user);

		return res.json({
			success: true,
			analysis: analysis,
		});
	} catch (error) {
		console.error("Error analyzing query:", error);
		return res.status(500).json({
			success: false,
			message: "Error analyzing query",
			error: error.message,
		});
	}
});

// Helper function to calculate similarity between two queries
function calculateSimilarity(query1, query2) {
	// Normalize queries for comparison
	const normalizeQuery = (q) => q.toLowerCase().replace(/\s+/g, " ").trim();
	const norm1 = normalizeQuery(query1);
	const norm2 = normalizeQuery(query2);

	// Use Levenshtein distance to calculate similarity
	const distance = levenshteinDistance(norm1, norm2);
	const maxLength = Math.max(norm1.length, norm2.length);

	return maxLength === 0 ? 1 : (maxLength - distance) / maxLength;
}

// Helper function to calculate Levenshtein distance
function levenshteinDistance(str1, str2) {
	const matrix = [];

	for (let i = 0; i <= str2.length; i++) {
		matrix[i] = [i];
	}

	for (let j = 0; j <= str1.length; j++) {
		matrix[0][j] = j;
	}

	for (let i = 1; i <= str2.length; i++) {
		for (let j = 1; j <= str1.length; j++) {
			if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
				matrix[i][j] = matrix[i - 1][j - 1];
			} else {
				matrix[i][j] = Math.min(
					matrix[i - 1][j - 1] + 1,
					matrix[i][j - 1] + 1,
					matrix[i - 1][j] + 1
				);
			}
		}
	}

	return matrix[str2.length][str1.length];
}

// Helper function to create a simple hash of the query
function hashQuery(query) {
	let hash = 0;
	const str = query.toLowerCase().trim();

	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32-bit integer
	}

	return hash.toString();
}

// Submit a data model answer
router.post("/:id/submit-model", isAuthenticated, async (req, res) => {
	try {
		const { id } = req.params;
		const { answer, scenario } = req.body;
		const userId = req.session.userId;

		if (!answer || answer.trim() === "") {
			return res.status(400).json({
				success: false,
				message: "Answer is required",
			});
		}

		// Find the question
		const question = await Question.findByPk(id);

		if (!question) {
			return res.status(404).json({
				success: false,
				message: "Question not found",
			});
		}

		// Get the topic to check its type
		const topic = await Topic.findByPk(question.topicId);

		if (!topic || topic.type !== "data_model") {
			return res.status(400).json({
				success: false,
				message: "This endpoint is only for data model questions",
			});
		}

		// Create a prompt for ChatGPT
		const prompt = `You are an expert in database design and ER diagram analysis. Analyze the provided answer and provide a detailed evaluation.

Scenario: ${scenario}

Answer: ${answer}

Your response MUST be a valid JSON object in the following format:
{
    "entities": [
        {
            "name": "entity name",
            "attributes": ["attribute1", "attribute2", ...]
        }
    ],
    "relationships": [
        {
            "name": "relationship name",
            "source": "source entity",
            "target": "target entity",
            "type": "relationship type (e.g., one-to-many, many-to-many)"
        }
    ],
    "analysis": "detailed analysis of how well the answer represents the scenario",
    "suggestions": ["suggestion 1", "suggestion 2", ...],
    "score": number
}

IMPORTANT: Your response must be a valid JSON object. Do not include any text before or after the JSON object.`;

		// Call OpenAI API
		let completion;
		try {
			completion = await openai.chat.completions.create({
				model: "gpt-4",
				messages: [
					{
						role: "system",
						content:
							"You are an expert in database design and ER diagram analysis. Your response must be a valid JSON object. Do not include any text before or after the JSON object. Do not use markdown formatting or code blocks.",
					},
					{
						role: "user",
						content: prompt,
					},
				],
				temperature: 0.7,
				max_tokens: 1000,
			});
		} catch (openaiError) {
			console.error("OpenAI API Error:", openaiError);
			return res.status(500).json({
				error: "OpenAI API Error",
				message: "Failed to get evaluation from OpenAI",
				details: openaiError.message,
			});
		}

		// Parse the response
		let response;
		try {
			const content = completion.choices[0].message.content;
			console.log("Raw OpenAI response:", content);

			// Try to extract JSON from the response
			const jsonMatch = content.match(/\{[\s\S]*\}/);
			if (!jsonMatch) {
				throw new Error("No JSON object found in response");
			}

			response = JSON.parse(jsonMatch[0]);
		} catch (parseError) {
			console.error("Response Parse Error:", parseError);
			console.error(
				"Raw response that failed to parse:",
				completion.choices[0].message.content
			);
			return res.status(500).json({
				error: "Parse Error",
				message: "Failed to parse OpenAI response",
				details: parseError.message,
			});
		}

		// Ensure all required fields are present
		if (!response.entities) response.entities = [];
		if (!response.relationships) response.relationships = [];
		if (!response.analysis) response.analysis = "No analysis available";
		if (!response.suggestions) response.suggestions = [];
		if (typeof response.score !== "number") response.score = 0;

		// Store the evaluation in the database
		try {
			const [completionRecord, created] = await Completion.findOrCreate({
				where: {
					userId: req.session.userId,
					questionId: id,
				},
				defaults: {
					userId: req.session.userId,
					questionId: id,
					completedAt: new Date(),
					evaluation: JSON.stringify(response),
				},
			});

			if (!created) {
				// Update existing completion record
				await completionRecord.update({
					evaluation: JSON.stringify(response),
				});
			}

			res.json(response);
		} catch (dbError) {
			console.error("Database Error:", dbError);
			return res.status(500).json({
				error: "Database Error",
				message: "Failed to save evaluation",
				details: dbError.message,
			});
		}
	} catch (error) {
		console.error("Unexpected Error:", error);
		res.status(500).json({
			error: "Unexpected Error",
			message: "An unexpected error occurred",
			details: error.message,
		});
	}
});

// Get completion data for a question
router.get("/:id/completion", isAuthenticated, async (req, res) => {
	try {
		const { id } = req.params;
		const userId = req.session.userId;

		// Find the completion record
		const completion = await Completion.findOne({
			where: {
				userId: userId,
				questionId: id,
			},
		});

		if (!completion) {
			return res.status(404).json({
				success: false,
				message: "Completion record not found",
			});
		}

		// Parse the evaluation JSON
		let evaluation = null;
		try {
			evaluation = JSON.parse(completion.evaluation);
		} catch (error) {
			evaluation = {
				entities: [],
				relationships: [],
				analysis: "Unable to parse evaluation results.",
				suggestions: ["Please try submitting again."],
				score: 0,
			};
		}

		res.json({
			success: true,
			evaluation: evaluation,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: "Error fetching completion data",
			error: error.message,
		});
	}
});

// Log answer reveal event
router.post("/:id/log-reveal", isAuthenticated, async (req, res) => {
	try {
		const { id } = req.params;
		const userId = req.session.userId;
		const user = await User.findByPk(userId);
		await logInteraction(userId, id, "answer_revealed", {}, user);
		return res.json({ success: true });
	} catch (error) {
		console.error("Error logging reveal:", error);
		return res.status(500).json({ success: false });
	}
});

async function logInteraction(userId, questionId, eventType, eventData, user) {
	try {
		await InteractionLog.create({
			userId,
			questionId,
			eventType,
			eventData,
			occurredAt: new Date(),
			academicYear: user?.academicYear || null,
			semester: user?.semester || null,
			courseSection: user?.courseSection || null,
		});
	} catch (err) {
		console.error("InteractionLog write failed (non-blocking):", err.message);
	}
}

module.exports = router;
