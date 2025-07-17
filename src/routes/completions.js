const express = require("express");
const router = express.Router();
const { Completion, Question, Topic } = require("../models");
const { isAuthenticated } = require("../middleware/auth");

// Get a user's completions (for profile page)
router.get("/user/progress", isAuthenticated, async (req, res) => {
	try {
		const userId = req.session.userId;

		// Get all of the user's completions with question and topic info
		const completions = await Completion.findAll({
			where: { userId },
			include: [
				{
					model: Question,
					as: "question",
					include: [{ model: Topic, as: "topic" }],
				},
			],
			order: [["completedAt", "DESC"]],
		});

		// Get total number of questions in the system
		const totalQuestions = await Question.count();

		// Group completions by topic
		const completionsByTopic = {};
		completions.forEach((completion) => {
			const topicName = completion.question.topic.name;
			if (!completionsByTopic[topicName]) {
				completionsByTopic[topicName] = [];
			}
			completionsByTopic[topicName].push(completion);
		});

		// Get count of questions by topic for more detailed progress tracking
		const topics = await Topic.findAll({
			include: [
				{
					model: Question,
					as: "questions",
					attributes: ["id"],
				},
			],
		});

		const questionsByTopic = {};
		topics.forEach((topic) => {
			questionsByTopic[topic.name] = topic.questions.length;
		});

		res.render("pages/progress", {
			title: "My Progress",
			completions,
			completionsByTopic,
			totalQuestions,
			questionsByTopic,
		});
	} catch (error) {
		console.error("Error fetching user progress:", error);
		res.status(500).render("pages/error", {
			title: "Error",
			message: "Failed to load progress data. Please try again later.",
		});
	}
});

module.exports = router;
