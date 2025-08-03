const express = require("express");
const router = express.Router();
const { User, InstructorCourseSection } = require("../models");
const { isAuthenticated, isStudent } = require("../middleware/auth");

// Display profile page
router.get("/", isAuthenticated, async (req, res) => {
	try {
		// Get user from database with associated instructor information
		const user = await User.findByPk(req.session.userId, {
			include: [
				{
					model: User,
					as: "instructor",
					attributes: ["id", "email", "firstName", "lastName"],
				},
			],
		});

		if (!user) {
			return res.status(404).render("pages/error", {
				title: "Error",
				message: "User not found.",
			});
		}

		const userData = {
			id: user.id,
			email: user.email,
			firstName: user.firstName || "",
			lastName: user.lastName || "",
			code: user.code || "",
			instructorCode: user.instructorCode || "",
			associatedInstructor: user.instructor,
			academicYear: user.academicYear || "",
			semester: user.semester || "",
			courseSection: user.courseSection || "",
			role: user.role || "student", // Explicitly include role
		};

		res.render("pages/profile", {
			title: "My Profile",
			user: userData,
			success: req.session.success,
		});

		// Clear any success message after displaying it
		delete req.session.success;
	} catch (error) {
		console.error("Error fetching profile:", error);
		res.status(500).render("pages/error", {
			title: "Error",
			message: "Failed to load profile data. Please try again later.",
		});
	}
});

// Update profile
router.post("/update", isAuthenticated, async (req, res) => {
	try {
		const { firstName, lastName, instructorCode } = req.body;
		const userId = req.session.userId;

		// Update user in database
		const user = await User.findByPk(userId);

		if (!user) {
			return res.status(404).render("pages/error", {
				title: "Error",
				message: "User not found.",
			});
		}

		// Handle instructor association
		let associatedInstructorId = null;
		if (instructorCode && instructorCode.trim()) {
			const instructor = await User.findInstructorByCode(instructorCode.trim());
			if (!instructor) {
				return res.render("pages/profile", {
					title: "My Profile",
					user: {
						id: user.id,
						email: user.email,
						firstName: user.firstName || "",
						lastName: user.lastName || "",
						code: user.code || "",
						instructorCode: instructorCode,
						associatedInstructor: user.instructor,
						academicYear: user.academicYear || "",
						semester: user.semester || "",
						courseSection: user.courseSection || "",
					},
					error:
						"Invalid instructor code. Please check the code or leave it blank if you don't have one.",
				});
			}
			associatedInstructorId = instructor.id;
		}

		// Update user details
		await user.update({
			firstName: firstName || null,
			lastName: lastName || null,
			associatedInstructorId: associatedInstructorId,
		});

		// Update session data
		req.session.user = {
			id: user.id,
			email: user.email,
			firstName: user.firstName || "",
			lastName: user.lastName || "",
			code: user.code || "",
			role: user.role || "student",
			instructorCode: user.instructorCode || null,
			associatedInstructorId: user.associatedInstructorId || null,
		};

		// Set success message
		req.session.success = "Profile updated successfully!";

		// Redirect back to profile page
		res.redirect("/profile");
	} catch (error) {
		console.error("Error updating profile:", error);
		res.status(500).render("pages/error", {
			title: "Error",
			message: "Failed to update profile. Please try again later.",
		});
	}
});

// Course section management page for students
router.get("/course-section", isAuthenticated, isStudent, async (req, res) => {
	try {
		const userId = req.session.userId;
		const user = await User.findByPk(userId, {
			include: [
				{
					model: User,
					as: "instructor",
					attributes: ["id", "email", "firstName", "lastName"],
				},
			],
		});

		if (!user) {
			return res.status(404).render("pages/error", {
				title: "Error",
				message: "User not found.",
			});
		}

		// Get available course sections from the associated instructor
		let availableCourseSections = [];
		if (user.associatedInstructorId) {
			availableCourseSections = await InstructorCourseSection.findAll({
				where: {
					instructorId: user.associatedInstructorId,
					isActive: true,
				},
				order: [
					["academicYear", "DESC"],
					["semester", "ASC"],
					["courseCode", "ASC"],
					["sectionCode", "ASC"],
				],
			});
		}

		res.render("pages/course-section-management", {
			title: "Course Section Management",
			user: {
				id: user.id,
				email: user.email,
				firstName: user.firstName || "",
				lastName: user.lastName || "",
				academicYear: user.academicYear || "",
				semester: user.semester || "",
				courseSection: user.courseSection || "",
				associatedInstructor: user.instructor,
			},
			availableCourseSections,
			success: req.session.success,
			error: req.session.error,
		});

		// Clear messages
		delete req.session.success;
		delete req.session.error;
	} catch (error) {
		console.error("Error loading course section management:", error);
		res.status(500).render("pages/error", {
			title: "Error",
			message:
				"Failed to load course section management. Please try again later.",
		});
	}
});

// Update course section information
router.post(
	"/course-section/update",
	isAuthenticated,
	isStudent,
	async (req, res) => {
		try {
			const { academicYear, semester, courseSection } = req.body;
			const userId = req.session.userId;

			const user = await User.findByPk(userId, {
				include: [
					{
						model: User,
						as: "instructor",
						attributes: ["id", "email", "firstName", "lastName"],
					},
				],
			});

			if (!user) {
				return res.status(404).render("pages/error", {
					title: "Error",
					message: "User not found.",
				});
			}

			// Validate that user has an associated instructor
			if (!user.associatedInstructorId) {
				req.session.error =
					"You must be associated with an instructor to update course section information.";
				return res.redirect("/profile/course-section");
			}

			// If course section is provided, validate it exists for the instructor
			if (courseSection && courseSection.trim()) {
				const courseSectionExists = await InstructorCourseSection.findOne({
					where: {
						instructorId: user.associatedInstructorId,
						courseCode: courseSection.split("-")[0] || courseSection,
						sectionCode: courseSection.split("-")[1] || "",
						isActive: true,
					},
				});

				if (!courseSectionExists) {
					req.session.error =
						"The selected course section is not available for your instructor. Please select a valid course section.";
					return res.redirect("/profile/course-section");
				}

				// Use the course section's academic year and semester if not provided
				const finalAcademicYear =
					academicYear || courseSectionExists.academicYear;
				const finalSemester = semester || courseSectionExists.semester;
				const finalCourseSection =
					courseSectionExists.getFullSectionIdentifier();

				// Update user with course section information
				await user.update({
					academicYear: finalAcademicYear,
					semester: finalSemester,
					courseSection: finalCourseSection,
				});
			} else {
				// Update with provided academic year and semester only
				await user.update({
					academicYear: academicYear || null,
					semester: semester || null,
					courseSection: null,
				});
			}

			// Update session data
			req.session.user = {
				...req.session.user,
				academicYear: user.academicYear,
				semester: user.semester,
				courseSection: user.courseSection,
			};

			req.session.success = "Course section information updated successfully!";
			res.redirect("/profile/course-section");
		} catch (error) {
			console.error("Error updating course section:", error);
			req.session.error =
				"Failed to update course section information. Please try again later.";
			res.redirect("/profile/course-section");
		}
	}
);

module.exports = router;
