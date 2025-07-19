const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const { User } = require("../models");
const { isAuthenticated, isNotAuthenticated } = require("../middleware/auth");
const { validatePassword } = require("../utils/passwordValidator");

// Display login form
router.get("/login", isNotAuthenticated, (req, res) => {
	res.render("pages/login", { title: "Login", error: null });
});

// Process login
router.post("/login", isNotAuthenticated, async (req, res) => {
	try {
		const { email, password } = req.body;

		// Find user by email
		const user = await User.findOne({ where: { email } });

		// Debug logging
		console.log("Login attempt:", {
			email,
			userFound: !!user,
			isAdmin: user?.isAdmin,
			isAdminType: typeof user?.isAdmin,
		});

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
			isAdmin: Boolean(user.isAdmin), // Explicitly convert to boolean
		};

		// Debug logging
		console.log("Session data set:", {
			userId: req.session.userId,
			user: req.session.user,
			isAdmin: req.session.user.isAdmin,
			isAdminType: typeof req.session.user.isAdmin,
		});

		// Save session explicitly
		req.session.save((err) => {
			if (err) {
				console.error("Error saving session:", err);
				return res.render("pages/login", {
					title: "Login",
					error: "An error occurred during login. Please try again.",
					email: req.body.email,
				});
			}

			// Debug logging
			console.log("Session saved successfully:", {
				userId: req.session.userId,
				user: req.session.user,
				isAdmin: req.session.user.isAdmin,
				isAdminType: typeof req.session.user.isAdmin,
			});

			// Redirect admin users to admin dashboard, regular users to topics page
			if (user.isAdmin) {
				return res.redirect("/admin");
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
router.post("/register", isNotAuthenticated, async (req, res) => {
	try {
		const { email, password, confirmPassword, firstName, lastName, code } =
			req.body;

		// Basic validation
		if (!email || !password || !confirmPassword) {
			return res.render("pages/register", {
				title: "Register",
				error: "Email and password are required",
				email,
				firstName,
				lastName,
				code,
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
				code,
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
				code,
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
				code,
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
				code,
			});
		}

		// Hash password
		const passwordHash = await bcrypt.hash(password, 10);

		// Create new user
		const newUser = await User.create({
			email,
			passwordHash,
			firstName: firstName || null,
			lastName: lastName || null,
			code: code || null,
			isAdmin: false, // Explicitly set isAdmin to false for new users
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
		};

		// Redirect to topics page
		res.redirect("/topics");
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
			code: req.body.code,
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

router.post("/forgot-password", isNotAuthenticated, async (req, res) => {
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
			// Generate reset token
			const resetToken = await User.createPasswordReset(user);

			// Send email
			const emailService = require("../utils/emailService");
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

		// Update password and invalidate token
		const passwordHash = await bcrypt.hash(password, 10);
		await user.update({
			passwordHash,
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
