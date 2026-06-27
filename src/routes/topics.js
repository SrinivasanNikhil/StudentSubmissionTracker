const express = require("express");
const router = express.Router();
const { Topic, InstructorCourseSection, InstructorSectionTopicSetting, Completion, Question } = require("../models");
const { isAuthenticated } = require("../middleware/auth");

// Get all topics - Protected route
router.get("/", isAuthenticated, async (req, res) => {
	try {
		const topics = await Topic.findAll({
			order: [["id", "ASC"]],
		});

		const user = req.session.user;
		let visibleTopics = topics;

		if (user.courseSection) {
			const dashIndex = user.courseSection.indexOf("-");
			const courseCode = dashIndex !== -1 ? user.courseSection.slice(0, dashIndex) : user.courseSection;
			const sectionCode = dashIndex !== -1 ? user.courseSection.slice(dashIndex + 1) : "";

			const section = await InstructorCourseSection.findOne({
				where: {
					instructorId: user.associatedInstructorId,
					courseCode,
					sectionCode,
					isActive: true,
				},
			});

			if (section) {
				const sectionSettings = await InstructorSectionTopicSetting.findAll({
					where: { instructorCourseSectionId: section.id },
					attributes: ["topicId", "isVisible", "dueDate"],
				});

				const settingsMap = new Map(sectionSettings.map((s) => [s.topicId, s]));

				visibleTopics = topics
					.filter((t) => settingsMap.get(t.id)?.isVisible !== false)
					.map((t) => ({
						...t.toJSON(),
						dueDate: settingsMap.get(t.id)?.dueDate || null,
						isPastDue: settingsMap.get(t.id)?.dueDate
							? new Date(settingsMap.get(t.id).dueDate) < new Date()
							: false,
					}));
			} else {
				// No matching section (e.g. no associatedInstructorId) — show all topics as plain objects
				visibleTopics = topics.map((t) => ({ ...t.toJSON(), dueDate: null, isPastDue: false }));
			}

			// Add per-topic completion counts for student with a section
			if (visibleTopics.length > 0) {
				const questionsByTopic = await Question.findAll({
					attributes: ["id", "topicId"],
					where: { topicId: visibleTopics.map((t) => t.id) },
				});

				const topicQuestionMap = new Map();
				questionsByTopic.forEach((q) => {
					if (!topicQuestionMap.has(q.topicId)) topicQuestionMap.set(q.topicId, []);
					topicQuestionMap.get(q.topicId).push(q.id);
				});

				const completions = await Completion.findAll({
					where: {
						userId: user.id,
						questionId: questionsByTopic.map((q) => q.id),
						academicYear: user.academicYear,
						semester: user.semester,
					},
					attributes: ["questionId"],
				});

				const completedSet = new Set(completions.map((c) => c.questionId));

				visibleTopics = visibleTopics.map((t) => ({
					...t,
					totalCount: (topicQuestionMap.get(t.id) || []).length,
					completedCount: (topicQuestionMap.get(t.id) || []).filter((id) => completedSet.has(id)).length,
				}));
			}
		} else {
			// Admin/instructor/student without section — no progress rings, safe defaults
			visibleTopics = visibleTopics.map((t) => ({
				...t.toJSON(),
				totalCount: 0,
				completedCount: 0,
			}));
		}

		res.render("pages/topics", {
			title: "SQL Topics",
			topics: visibleTopics,
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
