const express = require("express");
const router = express.Router();
const { Topic } = require("../models");
const { isAuthenticated } = require("../middleware/auth");

// Get all topics - Protected route
router.get("/", isAuthenticated, async (req, res) => {
	try {
		const topics = await Topic.findAll({
			order: [["id", "ASC"]],
		});

		res.render("pages/topics", {
			title: "SQL Topics",
			topics,
		});
	} catch (error) {
		console.error("Error fetching topics:", error);
		res.status(500).render("pages/error", {
			title: "Error",
			message: "Failed to load topics. Please try again later.",
		});
	}
});

// Advanced: Create a new topic (optional, admin only)
// This route is included as an example but not required for the core functionality
router.post("/", isAuthenticated, async (req, res) => {
	try {
		const { name } = req.body;

		if (!name) {
			return res.status(400).json({ error: "Topic name is required" });
		}

		const newTopic = await Topic.create({ name });

		res.redirect("/topics");
	} catch (error) {
		console.error("Error creating topic:", error);
		res.status(500).json({ error: "Failed to create topic" });
	}
});

module.exports = router;
