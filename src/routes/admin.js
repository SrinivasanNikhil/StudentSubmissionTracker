const express = require("express");
const router = express.Router();
const { User, Completion, Question, Topic } = require("../models");
const { isAuthenticated, isAdmin } = require("../middleware/auth");
const { Op } = require("sequelize");
const createCsvStringifier = require("csv-writer").createObjectCsvStringifier;
const sequelize = require("sequelize");

// Admin dashboard
router.get("/", isAuthenticated, isAdmin, async (req, res) => {
	try {
		// Count total users, excluding admins
		const userCount = await User.count({ where: { isAdmin: false } });

		// Count total completions
		const completionCount = await Completion.count();

		// Count total questions
		const questionCount = await Question.count();

		// Get all topics for filtering
		const topics = await Topic.findAll();

		// Get all unique email domains
		const users = await User.findAll({ attributes: ["email"] });
		const domains = [...new Set(users.map((user) => user.email.split("@")[1]))];

		// Get all unique codes
		const usersWithCodes = await User.findAll({
			attributes: ["code"],
			where: {
				code: { [Op.not]: null },
			},
		});
		const codes = [...new Set(usersWithCodes.map((user) => user.code))];

		res.render("pages/admin/dashboard", {
			title: "Admin Dashboard",
			userCount,
			completionCount,
			questionCount,
			topics,
			domains,
			codes,
		});
	} catch (error) {
		console.error("Error fetching admin dashboard data:", error);
		res.status(500).render("pages/error", {
			title: "Error",
			message: "Failed to load admin dashboard. Please try again later.",
		});
	}
});

// User management
router.get("/users", isAuthenticated, isAdmin, async (req, res) => {
	try {
		// Get query parameters for filtering
		const { domain, page = 1, limit = 20 } = req.query;
		const offset = (page - 1) * limit;

		// Set up filter conditions
		const whereCondition = {};
		if (domain && domain !== "all") {
			whereCondition.email = {
				[Op.like]: `%@${domain}`,
			};
		}

		// Get users with pagination
		const { count, rows: users } = await User.findAndCountAll({
			where: whereCondition,
			limit: parseInt(limit),
			offset: parseInt(offset),
			order: [["createdAt", "DESC"]],
		});

		// Get all unique email domains for filter dropdown
		const allUsers = await User.findAll({ attributes: ["email"] });
		const domains = [
			...new Set(allUsers.map((user) => user.email.split("@")[1])),
		];

		// Calculate pagination info
		const totalPages = Math.ceil(count / limit);

		res.render("pages/admin/users", {
			title: "User Management",
			users,
			currentPage: parseInt(page),
			totalPages,
			totalUsers: count,
			domain,
			domains,
			limit,
		});
	} catch (error) {
		console.error("Error fetching users:", error);
		res.status(500).render("pages/error", {
			title: "Error",
			message: "Failed to load users. Please try again later.",
		});
	}
});

// Delete user and their data
router.post("/users/:id/delete", isAuthenticated, isAdmin, async (req, res) => {
	try {
		const { id } = req.params;

		// Don't allow admins to be deleted through this route
		const user = await User.findByPk(id);
		if (!user) {
			return res
				.status(404)
				.json({ success: false, message: "User not found" });
		}

		if (user.isAdmin) {
			return res
				.status(403)
				.json({ success: false, message: "Cannot delete admin users" });
		}

		// Delete all completions associated with this user first
		await Completion.destroy({ where: { userId: id } });

		// Then delete the user
		await user.destroy();

		// If this is an AJAX request, return JSON
		if (req.xhr) {
			return res.json({
				success: true,
				message: "User and all associated data deleted successfully",
			});
		}

		// Otherwise redirect with a success message
		req.flash("success", "User and all associated data deleted successfully");
		res.redirect("/admin/users");
	} catch (error) {
		console.error("Error deleting user:", error);

		if (req.xhr) {
			return res
				.status(500)
				.json({ success: false, message: "Failed to delete user" });
		}

		res.status(500).render("pages/error", {
			title: "Error",
			message: "Failed to delete user. Please try again later.",
		});
	}
});

// Export user completions matrix (filtered)
router.get(
	"/export/completions",
	isAuthenticated,
	isAdmin,
	async (req, res) => {
		try {
			const { domain, topicId, code } = req.query;

			// Set up filter conditions for users
			const userWhereCondition = {};
			if (domain && domain !== "all") {
				userWhereCondition.email = {
					[Op.like]: `%@${domain}`,
				};
			}
			if (code && code !== "all") {
				userWhereCondition.code = code;
			}

			// Find all users matching filter
			const users = await User.findAll({
				where: userWhereCondition,
				attributes: ["id", "email", "firstName", "lastName", "code"],
			});

			// Get user IDs for completion filter
			const userIds = users.map((user) => user.id);

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

			// Get all completions for these users
			const completions = await Completion.findAll({
				where: {
					userId: {
						[Op.in]: userIds,
					},
				},
				attributes: ["userId", "questionId"],
			});

			// Create a map of user completions for quick lookup
			const userCompletions = new Map();
			completions.forEach((completion) => {
				if (!userCompletions.has(completion.userId)) {
					userCompletions.set(completion.userId, new Set());
				}
				userCompletions.get(completion.userId).add(completion.questionId);
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
			const csvData = users.map((user) => {
				const userData = {
					email: user.email,
					name:
						`${user.firstName || ""} ${user.lastName || ""}`.trim() ||
						"Not provided",
					code: user.code || "Not set",
				};

				// Add completion status for each question
				const userCompletedQuestions =
					userCompletions.get(user.id) || new Set();
				questions.forEach((question) => {
					const headerId = `q${question.id}`;
					userData[headerId] = userCompletedQuestions.has(question.id)
						? "1"
						: "0";
				});

				return userData;
			});

			// Set response headers for CSV download
			res.setHeader("Content-Type", "text/csv");
			res.setHeader(
				"Content-Disposition",
				"attachment; filename=user-completions-matrix.csv"
			);

			// Write CSV header and data
			res.write(csvStringifier.getHeaderString());
			res.write(csvStringifier.stringifyRecords(csvData));
			res.end();
		} catch (error) {
			console.error("Error exporting completions matrix:", error);
			res.status(500).render("pages/error", {
				title: "Error",
				message: "Failed to export completions matrix. Please try again later.",
			});
		}
	}
);

// Export completion summary
router.get("/export/summary", isAuthenticated, isAdmin, async (req, res) => {
	try {
		const { domain, code } = req.query;

		// Set up filter conditions for users
		const userWhereCondition = {};
		if (domain && domain !== "all") {
			userWhereCondition.email = {
				[Op.like]: `%@${domain}`,
			};
		}
		if (code && code !== "all") {
			userWhereCondition.code = code;
		}

		// Get all users matching filter
		const users = await User.findAll({
			where: userWhereCondition,
			attributes: ["id", "email", "firstName", "lastName", "code"],
		});

		// Get user IDs
		const userIds = users.map((user) => user.id);

		// Get completion counts for each user
		const completionCounts = await Completion.findAll({
			attributes: [
				"userId",
				[sequelize.fn("COUNT", sequelize.col("id")), "completionCount"],
			],
			where: {
				userId: {
					[Op.in]: userIds,
				},
			},
			group: ["userId"],
		});

		// Create a map of user IDs to completion counts
		const completionMap = new Map(
			completionCounts.map((count) => [
				count.userId,
				count.get("completionCount"),
			])
		);

		// Generate CSV data
		const csvStringifier = createCsvStringifier({
			header: [
				{ id: "email", title: "Email" },
				{ id: "name", title: "Name" },
				{ id: "code", title: "Code" },
				{ id: "completionCount", title: "Questions Completed" },
			],
		});

		const csvData = users.map((user) => ({
			email: user.email,
			name:
				`${user.firstName || ""} ${user.lastName || ""}`.trim() ||
				"Not provided",
			code: user.code || "Not set",
			completionCount: completionMap.get(user.id) || 0,
		}));

		// Set response headers for CSV download
		res.setHeader("Content-Type", "text/csv");
		res.setHeader(
			"Content-Disposition",
			"attachment; filename=completion-summary.csv"
		);

		// Write CSV header and data
		res.write(csvStringifier.getHeaderString());
		res.write(csvStringifier.stringifyRecords(csvData));
		res.end();
	} catch (error) {
		console.error("Error exporting summary:", error);
		res.status(500).render("pages/error", {
			title: "Error",
			message: "Failed to export summary. Please try again later.",
		});
	}
});

module.exports = router;
