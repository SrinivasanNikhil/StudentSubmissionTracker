const express = require("express");
const router = express.Router();
const { User, Completion, Question, Topic } = require("../models");
const { isAuthenticated, isAdmin } = require("../middleware/auth");
const { Op } = require("sequelize");
const createCsvStringifier = require("csv-writer").createObjectCsvStringifier;
const sequelize = require("sequelize");
const bcrypt = require("bcryptjs"); // Added for password hashing

// Admin dashboard
router.get("/", isAuthenticated, isAdmin, async (req, res) => {
	try {
		// Count total users by role
		const studentCount = await User.count({ where: { role: "student" } });
		const instructorCount = await User.count({ where: { role: "instructor" } });
		const adminCount = await User.count({ where: { role: "admin" } });

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
			studentCount,
			instructorCount,
			adminCount,
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

		if (user.role === "admin") {
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

// Instructor management
router.get("/instructors", isAuthenticated, isAdmin, async (req, res) => {
	try {
		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 20;
		const offset = (page - 1) * limit;

		// Get instructors with pagination
		const { count, rows: instructors } = await User.findAndCountAll({
			where: { role: "instructor" },
			limit: parseInt(limit),
			offset: parseInt(offset),
			order: [["createdAt", "DESC"]],
		});

		// Get student counts for each instructor
		const instructorIds = instructors.map((instructor) => instructor.id);
		const studentCounts = await User.findAll({
			where: {
				associatedInstructorId: {
					[Op.in]: instructorIds,
				},
				role: "student",
			},
			attributes: [
				"associatedInstructorId",
				[
					require("sequelize").fn("COUNT", require("sequelize").col("id")),
					"studentCount",
				],
			],
			group: ["associatedInstructorId"],
		});

		// Get course section counts for each instructor
		const { InstructorCourseSection } = require("../models");
		const courseSectionCounts = await InstructorCourseSection.findAll({
			where: {
				instructorId: {
					[Op.in]: instructorIds,
				},
			},
			attributes: [
				"instructorId",
				[
					require("sequelize").fn("COUNT", require("sequelize").col("id")),
					"courseSectionCount",
				],
			],
			group: ["instructorId"],
		});

		// Create maps for counts
		const studentMap = {};
		studentCounts.forEach((count) => {
			studentMap[count.associatedInstructorId] = parseInt(
				count.dataValues.studentCount
			);
		});

		const courseSectionMap = {};
		courseSectionCounts.forEach((count) => {
			courseSectionMap[count.instructorId] = parseInt(
				count.dataValues.courseSectionCount
			);
		});

		// Add counts to instructors
		instructors.forEach((instructor) => {
			instructor.dataValues.studentCount = studentMap[instructor.id] || 0;
			instructor.dataValues.courseSectionCount =
				courseSectionMap[instructor.id] || 0;
		});

		const totalPages = Math.ceil(count / limit);

		res.render("pages/admin/instructors", {
			title: "Instructor Management",
			instructors,
			currentPage: page,
			totalPages,
			totalInstructors: count,
			limit,
		});
	} catch (error) {
		console.error("Error fetching instructors:", error);
		res.status(500).render("pages/error", {
			title: "Error",
			message: "Failed to load instructors. Please try again later.",
		});
	}
});

// Create new instructor
router.post("/instructors", isAuthenticated, isAdmin, async (req, res) => {
	try {
		const { email, firstName, lastName, password } = req.body;

		// Validate required fields
		if (!email || !password) {
			return res.status(400).json({
				success: false,
				message: "Email and password are required",
			});
		}

		// Check if user already exists
		const existingUser = await User.findOne({ where: { email } });
		if (existingUser) {
			return res.status(400).json({
				success: false,
				message: "User with this email already exists",
			});
		}

		// Generate instructor code
		const instructorCode = await User.generateInstructorCode();

		// Hash password
		const passwordHash = await bcrypt.hash(password, 10);

		// Create instructor
		const instructor = await User.create({
			email,
			passwordHash,
			firstName: firstName || null,
			lastName: lastName || null,
			role: "instructor",
			instructorCode,
			isAdmin: false, // Ensure they're not admin
		});

		res.json({
			success: true,
			message: "Instructor created successfully",
			instructor: {
				id: instructor.id,
				email: instructor.email,
				firstName: instructor.firstName,
				lastName: instructor.lastName,
				instructorCode: instructor.instructorCode,
			},
		});
	} catch (error) {
		console.error("Error creating instructor:", error);
		res.status(500).json({
			success: false,
			message: "Failed to create instructor",
		});
	}
});

// Promote existing user to instructor
router.post(
	"/users/:id/promote-to-instructor",
	isAuthenticated,
	isAdmin,
	async (req, res) => {
		try {
			const { id } = req.params;
			const user = await User.findByPk(id);

			if (!user) {
				return res.status(404).json({
					success: false,
					message: "User not found",
				});
			}

			if (user.role === "instructor") {
				return res.status(400).json({
					success: false,
					message: "User is already an instructor",
				});
			}

			// Generate instructor code
			const instructorCode = await User.generateInstructorCode();

			// Update user to instructor
			await user.update({
				role: "instructor",
				instructorCode,
				isAdmin: false, // Ensure they're not admin
			});

			res.json({
				success: true,
				message: "User promoted to instructor successfully",
				instructorCode,
			});
		} catch (error) {
			console.error("Error promoting user to instructor:", error);
			res.status(500).json({
				success: false,
				message: "Failed to promote user to instructor",
			});
		}
	}
);

// Associate student with instructor
router.post(
	"/students/:studentId/associate-instructor",
	isAuthenticated,
	isAdmin,
	async (req, res) => {
		try {
			const { studentId } = req.params;
			const { instructorId } = req.body;

			const student = await User.findByPk(studentId);
			if (!student) {
				return res.status(404).json({
					success: false,
					message: "Student not found",
				});
			}

			if (student.role !== "student") {
				return res.status(400).json({
					success: false,
					message: "User is not a student",
				});
			}

			const instructor = await User.findByPk(instructorId);
			if (!instructor || instructor.role !== "instructor") {
				return res.status(404).json({
					success: false,
					message: "Instructor not found",
				});
			}

			// Associate student with instructor
			await student.update({
				associatedInstructorId: instructorId,
			});

			res.json({
				success: true,
				message: "Student associated with instructor successfully",
			});
		} catch (error) {
			console.error("Error associating student with instructor:", error);
			res.status(500).json({
				success: false,
				message: "Failed to associate student with instructor",
			});
		}
	}
);

// Remove student from instructor
router.post(
	"/students/:studentId/remove-instructor",
	isAuthenticated,
	isAdmin,
	async (req, res) => {
		try {
			const { studentId } = req.params;

			const student = await User.findByPk(studentId);
			if (!student) {
				return res.status(404).json({
					success: false,
					message: "Student not found",
				});
			}

			// Remove instructor association
			await student.update({
				associatedInstructorId: null,
			});

			res.json({
				success: true,
				message: "Student removed from instructor successfully",
			});
		} catch (error) {
			console.error("Error removing student from instructor:", error);
			res.status(500).json({
				success: false,
				message: "Failed to remove student from instructor",
			});
		}
	}
);

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

		// Get completion statistics for these users
		const completions = await Completion.findAll({
			where: {
				userId: {
					[Op.in]: userIds,
				},
			},
			attributes: ["userId", "questionId"],
		});

		// Create a map of user completions
		const userCompletions = new Map();
		completions.forEach((completion) => {
			if (!userCompletions.has(completion.userId)) {
				userCompletions.set(completion.userId, new Set());
			}
			userCompletions.get(completion.userId).add(completion.questionId);
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

		const csvData = users.map((user) => ({
			email: user.email,
			name:
				`${user.firstName || ""} ${user.lastName || ""}`.trim() ||
				"Not provided",
			code: user.code || "Not set",
			completionCount: userCompletions.get(user.id)?.size || 0,
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

// Get students for a specific instructor
router.get(
	"/instructors/:id/students",
	isAuthenticated,
	isAdmin,
	async (req, res) => {
		try {
			const { id } = req.params;

			// Verify the instructor exists
			const instructor = await User.findByPk(id);
			if (!instructor || instructor.role !== "instructor") {
				return res.status(404).json({
					success: false,
					message: "Instructor not found",
				});
			}

			// Get students associated with this instructor
			const students = await User.findAll({
				where: {
					associatedInstructorId: id,
					role: "student",
				},
				attributes: ["id", "email", "firstName", "lastName", "createdAt"],
				order: [["createdAt", "DESC"]],
			});

			res.json({
				success: true,
				students,
			});
		} catch (error) {
			console.error("Error fetching instructor students:", error);
			res.status(500).json({
				success: false,
				message: "Failed to fetch students",
			});
		}
	}
);

// Delete instructor
router.post(
	"/instructors/:id/delete",
	isAuthenticated,
	isAdmin,
	async (req, res) => {
		try {
			const { id } = req.params;

			// Find the instructor
			const instructor = await User.findByPk(id);
			if (!instructor) {
				return res.status(404).json({
					success: false,
					message: "Instructor not found",
				});
			}

			if (instructor.role !== "instructor") {
				return res.status(400).json({
					success: false,
					message: "User is not an instructor",
				});
			}

			// Unassign all students from this instructor
			await User.update(
				{ associatedInstructorId: null },
				{ where: { associatedInstructorId: id } }
			);

			// Delete all completions associated with this instructor's students
			const studentIds = await User.findAll({
				where: { associatedInstructorId: id },
				attributes: ["id"],
			});

			if (studentIds.length > 0) {
				const studentIdArray = studentIds.map((student) => student.id);
				await Completion.destroy({ where: { userId: studentIdArray } });
			}

			// Delete the instructor
			await instructor.destroy();

			res.json({
				success: true,
				message: "Instructor and all associated data deleted successfully",
			});
		} catch (error) {
			console.error("Error deleting instructor:", error);
			res.status(500).json({
				success: false,
				message: "Failed to delete instructor",
			});
		}
	}
);

// Export instructor data
router.get(
	"/export/instructors",
	isAuthenticated,
	isAdmin,
	async (req, res) => {
		try {
			// Get all instructors
			const instructors = await User.findAll({
				where: { role: "instructor" },
				attributes: [
					"id",
					"email",
					"firstName",
					"lastName",
					"instructorCode",
					"createdAt",
				],
				order: [["createdAt", "DESC"]],
			});

			// Get student counts for each instructor
			const instructorIds = instructors.map((instructor) => instructor.id);
			const studentCounts = await User.findAll({
				where: {
					associatedInstructorId: {
						[Op.in]: instructorIds,
					},
					role: "student",
				},
				attributes: [
					"associatedInstructorId",
					[sequelize.fn("COUNT", sequelize.col("id")), "studentCount"],
				],
				group: ["associatedInstructorId"],
			});

			// Create a map of instructor student counts
			const studentMap = {};
			studentCounts.forEach((count) => {
				studentMap[count.associatedInstructorId] = parseInt(
					count.dataValues.studentCount
				);
			});

			// Generate CSV data
			const csvStringifier = createCsvStringifier({
				header: [
					{ id: "email", title: "Email" },
					{ id: "name", title: "Name" },
					{ id: "instructorCode", title: "Instructor Code" },
					{ id: "studentCount", title: "Student Count" },
					{ id: "createdAt", title: "Created At" },
				],
			});

			const csvData = instructors.map((instructor) => ({
				email: instructor.email,
				name:
					`${instructor.firstName || ""} ${instructor.lastName || ""}`.trim() ||
					"Not provided",
				instructorCode: instructor.instructorCode,
				studentCount: studentMap[instructor.id] || 0,
				createdAt: new Date(instructor.createdAt).toLocaleDateString(),
			}));

			// Set response headers for CSV download
			res.setHeader("Content-Type", "text/csv");
			res.setHeader(
				"Content-Disposition",
				"attachment; filename=instructors.csv"
			);

			// Write CSV header and data
			res.write(csvStringifier.getHeaderString());
			res.write(csvStringifier.stringifyRecords(csvData));
			res.end();
		} catch (error) {
			console.error("Error exporting instructors:", error);
			res.status(500).render("pages/error", {
				title: "Error",
				message: "Failed to export instructors. Please try again later.",
			});
		}
	}
);

// Get course sections for a specific instructor
router.get(
	"/instructors/:id/course-sections",
	isAuthenticated,
	isAdmin,
	async (req, res) => {
		try {
			const { id } = req.params;

			// Verify the instructor exists
			const instructor = await User.findByPk(id);
			if (!instructor || instructor.role !== "instructor") {
				return res.status(404).json({
					success: false,
					message: "Instructor not found",
				});
			}

			// Get course sections for this instructor
			const { InstructorCourseSection } = require("../models");
			const courseSections = await InstructorCourseSection.findAll({
				where: {
					instructorId: id,
				},
				order: [
					["academicYear", "DESC"],
					["semester", "ASC"],
					["courseCode", "ASC"],
					["sectionCode", "ASC"],
				],
			});

			// Get student counts for each course section
			const courseSectionIds = courseSections.map((section) => section.id);
			const studentCounts = await User.findAll({
				where: {
					courseSection: {
						[Op.in]: courseSections.map((section) =>
							section.getFullSectionIdentifier()
						),
					},
					role: "student",
				},
				attributes: [
					"courseSection",
					[
						require("sequelize").fn("COUNT", require("sequelize").col("id")),
						"studentCount",
					],
				],
				group: ["courseSection"],
			});

			// Create a map of course section student counts
			const studentMap = {};
			studentCounts.forEach((count) => {
				studentMap[count.courseSection] = parseInt(
					count.dataValues.studentCount
				);
			});

			// Add student counts to course sections
			const courseSectionsWithStudents = courseSections.map((section) => {
				const sectionIdentifier = section.getFullSectionIdentifier();
				return {
					id: section.id,
					courseCode: section.courseCode,
					courseName: section.courseName,
					sectionCode: section.sectionCode,
					academicYear: section.academicYear,
					semester: section.semester,
					isActive: section.isActive,
					createdAt: section.createdAt,
					studentCount: studentMap[sectionIdentifier] || 0,
					fullIdentifier: sectionIdentifier,
					displayName: section.getDisplayName(),
				};
			});

			res.json({
				success: true,
				instructor: {
					id: instructor.id,
					email: instructor.email,
					firstName: instructor.firstName,
					lastName: instructor.lastName,
				},
				courseSections: courseSectionsWithStudents,
			});
		} catch (error) {
			console.error("Error fetching instructor course sections:", error);
			res.status(500).json({
				success: false,
				message: "Failed to fetch course sections",
			});
		}
	}
);

// Get students for a specific course section
router.get(
	"/instructors/:instructorId/course-sections/:sectionId/students",
	isAuthenticated,
	isAdmin,
	async (req, res) => {
		try {
			const { instructorId, sectionId } = req.params;

			// Verify the instructor exists
			const instructor = await User.findByPk(instructorId);
			if (!instructor || instructor.role !== "instructor") {
				return res.status(404).json({
					success: false,
					message: "Instructor not found",
				});
			}

			// Get the course section
			const { InstructorCourseSection } = require("../models");
			const courseSection = await InstructorCourseSection.findByPk(sectionId);
			if (
				!courseSection ||
				courseSection.instructorId !== parseInt(instructorId)
			) {
				return res.status(404).json({
					success: false,
					message: "Course section not found",
				});
			}

			// Get students for this course section
			const students = await User.findAll({
				where: {
					courseSection: courseSection.getFullSectionIdentifier(),
					role: "student",
				},
				attributes: [
					"id",
					"email",
					"firstName",
					"lastName",
					"academicYear",
					"semester",
					"createdAt",
				],
				order: [["createdAt", "DESC"]],
			});

			res.json({
				success: true,
				courseSection: {
					id: courseSection.id,
					courseCode: courseSection.courseCode,
					courseName: courseSection.courseName,
					sectionCode: courseSection.sectionCode,
					academicYear: courseSection.academicYear,
					semester: courseSection.semester,
					fullIdentifier: courseSection.getFullSectionIdentifier(),
					displayName: courseSection.getDisplayName(),
				},
				students,
			});
		} catch (error) {
			console.error("Error fetching course section students:", error);
			res.status(500).json({
				success: false,
				message: "Failed to fetch students",
			});
		}
	}
);

module.exports = router;
