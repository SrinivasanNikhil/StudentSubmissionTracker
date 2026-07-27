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
					attributes: ["topicId", "isVisible", "dueDate", "assignmentType"],
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
						assignmentType: settingsMap.get(t.id)?.assignmentType || "practice",
					}));
			} else {
				// No matching section (e.g. no associatedInstructorId) — show all topics as plain objects
				visibleTopics = topics.map((t) => ({ ...t.toJSON(), dueDate: null, isPastDue: false, assignmentType: "practice" }));
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
				assignmentType: "practice",
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

// NOTE: a POST /topics route used to exist here. Its comment claimed "admin
// only" but it was guarded by isAuthenticated alone, so any student could
// create global Topic rows visible to every user. It had no caller anywhere in
// the app — topics are managed through the reference-data loader
// (src/utils/referenceLoader.js), which upserts from src/reference_files/*.json.
// The route was removed rather than guarded, to drop the write surface entirely.

module.exports = router;
