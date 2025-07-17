const express = require("express");
const router = express.Router();
const { Question, Topic, Completion } = require("../models");
const { isAuthenticated } = require("../middleware/auth");
const { executeQuery, compareQueries } = require("../services/sqlExecutor");
const { OpenAI } = require("openai");
const { parseString } = require("xml2js");

// Initialize OpenAI client
const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

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

		res.render("pages/question-detail", {
			title: `Question #${question.id}`,
			question,
			completed: !!completion,
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

		// Determine the database to use
		const databaseName = question.topic.database;

		// Execute the query against the appropriate database
		const result = await executeQuery(query, databaseName);

		// If execution was successful and we have a solution, compare them
		let comparison = null;
		let isCompleted = false;

		if (result.success && question.solution) {
			comparison = await compareQueries(query, question.solution, databaseName);

			// Check if the student query returns the same number of rows as the reference query
			if (
				comparison.studentResult &&
				comparison.solutionResult &&
				comparison.studentResult.rows === comparison.solutionResult.rows
			) {
				// Check if the user has already completed this question
				const existingCompletion = await Completion.findOne({
					where: {
						userId,
						questionId: id,
					},
				});

				// If not already completed, mark it as completed
				if (!existingCompletion) {
					await Completion.create({
						userId,
						questionId: id,
						completedAt: new Date(),
					});
				}

				isCompleted = true;
			}
		}

		// Return the results
		return res.json({
			success: result.success,
			executionResult: {
				...result,
				solution: question.solution,
			},
			comparison: comparison,
			databaseName: databaseName,
			isCompleted: isCompleted,
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

Your response must include:
	1. A step-by-step explanation of how each query works in MySQL
	2. Differences in logic, syntax, and output within MySQL
	3. Assume the audience is an undergraduate student with a technical background learning SQL in MySQL. Provide clear explanations with relevant MySQL examples if necessary.
	4. Provide the response in 500 words or less.

Format your response in a clear, structured way using HTML formatting.`;

		// Get analysis from ChatGPT
		const completion = await openai.chat.completions.create({
			model: "gpt-4",
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
			temperature: 0.7,
			max_tokens: 1000,
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

// Real-time query analysis
router.post("/:id/analyze-realtime", isAuthenticated, async (req, res) => {
	try {
		const { query } = req.body;
		const { id } = req.params;

		if (!query || query.trim() === "") {
			return res.status(400).json({
				success: false,
				message: "SQL query is required",
			});
		}

		// Get the question to understand the context
		const question = await Question.findByPk(id, {
			include: [{ model: Topic, as: "topic" }],
		});

		if (!question) {
			return res.status(404).json({
				success: false,
				message: "Question not found",
			});
		}

		// Create a prompt for ChatGPT
		const prompt = `You are an SQL tutor helping a student write a query for the following question:

Question: ${question.questionText}

The student has started writing this query:
${query}

Provide real-time feedback on:
1. Syntax correctness
2. Common mistakes to avoid

Keep the response concise (max 100 words) and focus on immediate, actionable feedback. Do not provide any type of actual solution or code.
Format the response in HTML with appropriate styling.`;

		// Get analysis from ChatGPT
		const completion = await openai.chat.completions.create({
			model: "gpt-4",
			messages: [
				{
					role: "system",
					content:
						"You are an expert SQL tutor providing real-time feedback to students.",
				},
				{
					role: "user",
					content: prompt,
				},
			],
			temperature: 0.7,
			max_tokens: 200,
		});

		const analysis = completion.choices[0].message.content;

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
					questionId: questionId,
				},
				defaults: {
					userId: req.session.userId,
					questionId: questionId,
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

module.exports = router;
