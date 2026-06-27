const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const { User, InstructorCourseSection } = require("../models");
const { isAuthenticated, isNotAuthenticated } = require("../middleware/auth");
const { validatePassword } = require("../utils/passwordValidator");
const emailService = require("../utils/emailService");

// Rate limiters for auth endpoints
const loginLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 20,
	message: "Too many login attempts, please try again in 15 minutes.",
	standardHeaders: true,
	legacyHeaders: false,
});

const registerLimiter = rateLimit({
	windowMs: 60 * 60 * 1000, // 1 hour
	max: 10,
	message: "Too many registration attempts, please try again later.",
	standardHeaders: true,
	legacyHeaders: false,
});

const passwordResetLimiter = rateLimit({
	windowMs: 60 * 60 * 1000, // 1 hour
	max: 5,
	message: "Too many password reset requests, please try again later.",
	standardHeaders: true,
	legacyHeaders: false,
});

// Display login form
router.get("/login", isNotAuthenticated, (req, res) => {
	res.render("pages/login", { title: "Login", error: null });
});

// Process login
router.post("/login", isNotAuthenticated, loginLimiter, async (req, res) => {
	try {
		const { email, password } = req.body;

		// Find user by email
		const user = await User.findOne({ where: { email } });

		// Check if user exists and password is correct
		if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
			return res.render("pages/login", {
				title: "Login",
				error: "Invalid email or password",
				email,
			});
		}

		// Set session with complete user data
		req.session.userId = user.id;
		req.session.user = {
			id: user.id,
			email: user.email,
			firstName: user.firstName || "",
			lastName: user.lastName || "",
			code: user.code || "",
			isAdmin: Boolean(user.isAdmin), // Backward compatibility
			role: user.role || (user.isAdmin ? "admin" : "student"), // New role system
			instructorCode: user.instructorCode || null,
			associatedInstructorId: user.associatedInstructorId || null,
			courseSection: user.courseSection || null,
			academicYear: user.academicYear || null,
			semester: user.semester || null,
		};

		// Save session explicitly before redirecting
		req.session.save((err) => {
			if (err) {
				console.error("Error saving session:", err);
				return res.render("pages/login", {
					title: "Login",
					error: "An error occurred during login. Please try again.",
					email: req.body.email,
				});
			}

			// Redirect based on role
			if (user.role === "admin" || user.isAdmin) {
				return res.redirect("/admin");
			} else if (user.role === "instructor") {
				return res.redirect("/instructor/dashboard");
			} else {
				return res.redirect("/topics");
			}
		});
	} catch (error) {
		console.error("Login error:", error);
		return res.render("pages/login", {
			title: "Login",
			error: "An error occurred during login. Please try again.",
			email: req.body.email,
		});
	}
});

// Display registration form
router.get("/register", isNotAuthenticated, (req, res) => {
	res.render("pages/register", { title: "Register", error: null });
});

// Process registration
router.post("/register", isNotAuthenticated, registerLimiter, async (req, res) => {
	try {
		const {
			email,
			password,
			confirmPassword,
			firstName,
			lastName,
			instructorCode,
			courseSection,
		} = req.body;

		// Basic validation
		if (!email || !password || !confirmPassword) {
			return res.render("pages/register", {
				title: "Register",
				error: "Email and password are required",
				email,
				firstName,
				lastName,
				instructorCode,
			});
		}

		// Check if passwords match
		if (password !== confirmPassword) {
			return res.render("pages/register", {
				title: "Register",
				error: "Passwords do not match",
				email,
				firstName,
				lastName,
				instructorCode,
			});
		}

		// Validate password strength
		const passwordValidation = validatePassword(password);
		if (!passwordValidation.isValid) {
			return res.render("pages/register", {
				title: "Register",
				error: passwordValidation.errors.join(". "),
				email,
				firstName,
				lastName,
				instructorCode,
			});
		}

		// Validate email format
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			return res.render("pages/register", {
				title: "Register",
				error: "Please enter a valid email address",
				email,
				firstName,
				lastName,
				instructorCode,
			});
		}

		// Check if user already exists
		const existingUser = await User.findOne({ where: { email } });
		if (existingUser) {
			return res.render("pages/register", {
				title: "Register",
				error: "Email already registered",
				email,
				firstName,
				lastName,
				instructorCode,
			});
		}

		// Validate instructor code if provided
		let associatedInstructorId = null;
		let academicYear = null;
		let semester = null;
		let validatedCourseSection = null;

		if (instructorCode && instructorCode.trim()) {
			const instructor = await User.findInstructorByCode(instructorCode.trim());
			if (!instructor) {
				return res.render("pages/register", {
					title: "Register",
					error:
						"Invalid instructor code. Please check the code or leave it blank if you don't have one.",
					email,
					firstName,
					lastName,
					instructorCode,
					courseSection,
				});
			}
			associatedInstructorId = instructor.id;

			// Validate course section if provided
			if (courseSection && courseSection.trim()) {
				const dashIndex = courseSection.indexOf("-");
				const parsedCourseCode = dashIndex !== -1 ? courseSection.slice(0, dashIndex) : courseSection;
				const parsedSectionCode = dashIndex !== -1 ? courseSection.slice(dashIndex + 1) : "";
				const courseSectionRecord = await InstructorCourseSection.findOne({
					where: {
						instructorId: instructor.id,
						courseCode: parsedCourseCode,
						sectionCode: parsedSectionCode,
						isActive: true,
					},
				});

				if (courseSectionRecord) {
					validatedCourseSection =
						courseSectionRecord.getFullSectionIdentifier();
					academicYear = courseSectionRecord.academicYear;
					semester = courseSectionRecord.semester;
				} else {
					// Section string doesn't match any active section for this instructor.
					// Reject with a clear message so the student can correct it.
					return res.render("pages/register", {
						title: "Register",
						error: "That course section was not found for your instructor. Please check the section code, or leave it blank to register without one.",
						email,
						firstName,
						lastName,
						instructorCode,
						courseSection,
					});
				}
			} else {
				// If no course section provided, use current academic year/semester
				academicYear = InstructorCourseSection.getCurrentAcademicYear();
				semester = InstructorCourseSection.getCurrentSemester();
			}
		}

		// Hash password
		const passwordHash = await bcrypt.hash(password, 10);

		// Create new user
		const newUser = await User.create({
			email,
			passwordHash,
			firstName: firstName || null,
			lastName: lastName || null,
			code: null, // Keep the old code field for backward compatibility
			isAdmin: false, // Explicitly set isAdmin to false for new users
			role: "student", // Set role to student
			associatedInstructorId: associatedInstructorId,
			academicYear: academicYear,
			semester: semester,
			courseSection: validatedCourseSection,
		});

		// Set session (automatic login after registration)
		req.session.userId = newUser.id;
		req.session.user = {
			id: newUser.id,
			email: newUser.email,
			firstName: newUser.firstName || "",
			lastName: newUser.lastName || "",
			code: newUser.code || "",
			isAdmin: newUser.isAdmin || false,
			role: newUser.role || "student",
			instructorCode: newUser.instructorCode || null,
			associatedInstructorId: newUser.associatedInstructorId || null,
			courseSection: newUser.courseSection || null,
			academicYear: newUser.academicYear || null,
			semester: newUser.semester || null,
		};

		// Persist session before redirecting (same pattern as login)
		req.session.save((err) => {
			if (err) {
				console.error("Error saving session after registration:", err);
				return res.render("pages/register", {
					title: "Register",
					error: "An error occurred during registration. Please try again.",
					email: req.body.email,
					firstName: req.body.firstName,
					lastName: req.body.lastName,
					instructorCode: req.body.instructorCode,
				});
			}
			res.redirect("/topics");
		});
	} catch (error) {
		console.error("Registration error:", error);
		res.render("pages/register", {
			title: "Register",
			error:
				error.message ||
				"An error occurred during registration. Please try again.",
			email: req.body.email,
			firstName: req.body.firstName,
			lastName: req.body.lastName,
			instructorCode: req.body.instructorCode,
		});
	}
});

// Request password reset
router.get("/forgot-password", isNotAuthenticated, (req, res) => {
	res.render("pages/forgot-password", {
		title: "Forgot Password",
		error: null,
		success: null,
	});
});

router.post("/forgot-password", isNotAuthenticated, passwordResetLimiter, async (req, res) => {
	try {
		const { email } = req.body;

		// Validate email
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			return res.render("pages/forgot-password", {
				title: "Forgot Password",
				error: "Please enter a valid email address",
				success: null,
			});
		}

		// Find user
		const user = await User.findOne({ where: { email } });

		if (user) {
			// Check in-memory whether this user already has a valid, unexpired, unused token
			const hasValidToken =
				user.resetToken &&
				user.resetTokenExpires &&
				user.resetTokenExpires > new Date() &&
				!user.resetTokenUsed;

			if (hasValidToken) {
				// Don't issue a new token while a valid one exists
				return res.render("pages/forgot-password", {
					title: "Forgot Password",
					error: null,
					success:
						"If an account with that email exists, a password reset link has been sent.",
				});
			}

			// Generate and store a new reset token
			const resetToken = await User.createPasswordReset(user);

			// Send email
			const emailSent = await emailService.sendPasswordResetEmail(
				email,
				resetToken,
				user.firstName || user.email
			);

			if (emailSent) {
				return res.render("pages/forgot-password", {
					title: "Forgot Password",
					error: null,
					success:
						"If an account with that email exists, a password reset link has been sent.",
				});
			} else {
				console.error(`Failed to send password reset email to ${email}`);
				return res.render("pages/forgot-password", {
					title: "Forgot Password",
					error: "Failed to send reset email. Please try again later.",
					success: null,
				});
			}
		} else {
			// Don't reveal if user exists or not (security best practice)
			return res.render("pages/forgot-password", {
				title: "Forgot Password",
				error: null,
				success:
					"If an account with that email exists, a password reset link has been sent.",
			});
		}
	} catch (error) {
		console.error("Password reset request error:", error);
		return res.render("pages/forgot-password", {
			title: "Forgot Password",
			error: "An error occurred. Please try again later.",
			success: null,
		});
	}
});

// Reset password with token
router.get("/reset-password/:token", isNotAuthenticated, async (req, res) => {
	try {
		const { token } = req.params;

		// Validate token
		const user = await User.validateResetToken(token);

		if (!user) {
			return res.render("pages/error", {
				title: "Invalid Reset Link",
				message:
					"This password reset link is invalid or has expired. Please request a new one.",
			});
		}

		res.render("pages/reset-password", {
			title: "Reset Password",
			token,
			error: null,
		});
	} catch (error) {
		console.error("Reset password error:", error);
		res.render("pages/error", {
			title: "Error",
			message: "An error occurred. Please try again later.",
		});
	}
});

router.post("/reset-password/:token", isNotAuthenticated, async (req, res) => {
	try {
		const { token } = req.params;
		const { password, confirmPassword } = req.body;

		// Validate token
		const user = await User.validateResetToken(token);

		if (!user) {
			return res.render("pages/error", {
				title: "Invalid Reset Link",
				message:
					"This password reset link is invalid or has expired. Please request a new one.",
			});
		}

		// Validate passwords
		if (!password || !confirmPassword) {
			return res.render("pages/reset-password", {
				title: "Reset Password",
				token,
				error: "Both password fields are required.",
			});
		}

		if (password !== confirmPassword) {
			return res.render("pages/reset-password", {
				title: "Reset Password",
				token,
				error: "Passwords do not match.",
			});
		}

		// Validate password strength
		const passwordValidation = validatePassword(password);
		if (!passwordValidation.isValid) {
			return res.render("pages/reset-password", {
				title: "Reset Password",
				token,
				error: passwordValidation.errors.join(". "),
			});
		}

		// Update password and fully clear the reset token so it cannot be replayed
		const passwordHash = await bcrypt.hash(password, 10);
		await user.update({
			passwordHash,
			resetToken: null,
			resetTokenExpires: null,
			resetTokenUsed: true,
		});

		// Redirect to login with success message
		req.flash(
			"success",
			"Password has been reset successfully. Please log in with your new password."
		);
		res.redirect("/auth/login");
	} catch (error) {
		console.error("Password reset error:", error);
		res.render("pages/reset-password", {
			title: "Reset Password",
			token: req.params.token,
			error: "An error occurred. Please try again later.",
		});
	}
});

// Logout
router.get("/logout", isAuthenticated, (req, res) => {
	req.session.destroy((err) => {
		if (err) {
			console.error("Error destroying session:", err);
		}
		res.redirect("/auth/login");
	});
});

module.exports = router;
