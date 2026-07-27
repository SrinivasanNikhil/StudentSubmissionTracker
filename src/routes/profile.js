const express = require("express");
const router = express.Router();
const {
	User,
	InstructorCourseSection,
	CourseSectionChange,
} = require("../models");
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
			error: req.session.error,
		});

		// Clear any flash messages after displaying them
		delete req.session.success;
		delete req.session.error;
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

		// Re-fetch so session reflects the persisted values, not the pre-update instance
		const updatedUser = await User.findByPk(userId);

		// Update session data
		req.session.user = {
			id: updatedUser.id,
			email: updatedUser.email,
			firstName: updatedUser.firstName || "",
			lastName: updatedUser.lastName || "",
			code: updatedUser.code || "",
			isAdmin: Boolean(updatedUser.isAdmin),
			role: updatedUser.role || "student",
			instructorCode: updatedUser.instructorCode || null,
			associatedInstructorId: updatedUser.associatedInstructorId || null,
			courseSection: updatedUser.courseSection || null,
			academicYear: updatedUser.academicYear || null,
			semester: updatedUser.semester || null,
		};

		// Set success message
		req.session.success = "Profile updated successfully!";

		// Redirect back to profile page
		res.redirect("/profile");
	} catch (error) {
		console.error("Error updating profile:", error);

		// Field validation failures (e.g. invalid characters in a name) are the
		// user's to correct — show them the reason rather than a 500 page.
		if (error.name === "SequelizeValidationError") {
			req.session.error = error.errors.map((e) => e.message).join(". ");
			return res.redirect("/profile");
		}

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
			// academicYear/semester are intentionally NOT read from the body — they
			// are derived from the selected section record below.
			const { courseSection } = req.body;
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

			// Clearing an already-set section is not permitted. Deadline and
			// topic-visibility enforcement key off courseSection, so a student who
			// could blank it out would escape their section's due dates entirely
			// (clear -> submit past-due work -> restore). Setting a section for the
			// first time, and switching between the instructor's active sections,
			// both remain self-service.
			if (!(courseSection && courseSection.trim()) && user.courseSection) {
				req.session.error =
					"Your course section can't be removed once set. Choose a different section, or ask your instructor if you need it cleared.";
				return res.redirect("/profile/course-section");
			}

			// Snapshot the previous values for the audit trail.
			const previous = {
				section: user.courseSection,
				academicYear: user.academicYear,
				semester: user.semester,
			};

			// If course section is provided, validate it exists for the instructor
			if (courseSection && courseSection.trim()) {
				const dashIndex = courseSection.indexOf("-");
				const parsedCourseCode = dashIndex !== -1 ? courseSection.slice(0, dashIndex) : courseSection;
				const parsedSectionCode = dashIndex !== -1 ? courseSection.slice(dashIndex + 1) : "";
				const courseSectionExists = await InstructorCourseSection.findOne({
					where: {
						instructorId: user.associatedInstructorId,
						courseCode: parsedCourseCode,
						sectionCode: parsedSectionCode,
						isActive: true,
					},
				});

				if (!courseSectionExists) {
					req.session.error =
						"The selected course section is not available for your instructor. Please select a valid course section.";
					return res.redirect("/profile/course-section");
				}

				// Term is derived from the section record, never from the request
				// body. Previously academicYear/semester were taken from the body,
				// letting a student stamp an arbitrary term onto their account and
				// move their completions in and out of term-scoped exports.
				await user.update({
					academicYear: courseSectionExists.academicYear,
					semester: courseSectionExists.semester,
					courseSection: courseSectionExists.getFullSectionIdentifier(),
				});
			} else {
				// Only reachable when the student has no section and submitted none;
				// nothing to change (clearing an existing section is rejected above).
				req.session.error = "Please select a course section.";
				return res.redirect("/profile/course-section");
			}

			// Reload so the spread below reads committed DB values, not the pre-update instance
			await user.reload();

			// Record the change for instructor review. Switching between sections is
			// still allowed and those sections can carry different due dates, so the
			// movement is worth auditing. Non-blocking: a logging failure must not
			// fail the update.
			if (previous.section !== user.courseSection) {
				try {
					await CourseSectionChange.create({
						userId: user.id,
						previousSection: previous.section,
						newSection: user.courseSection,
						previousAcademicYear: previous.academicYear,
						newAcademicYear: user.academicYear,
						previousSemester: previous.semester,
						newSemester: user.semester,
						changedAt: new Date(),
					});
				} catch (auditError) {
					console.error(
						"CourseSectionChange audit write failed (non-blocking):",
						auditError.message
					);
				}
			}

			// Update session data
			req.session.user = {
				...req.session.user,
				associatedInstructorId: user.associatedInstructorId,
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
