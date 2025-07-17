const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const { User } = require("../models");
const { isAuthenticated, isNotAuthenticated } = require("../middleware/auth");

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

// Logout
router.get("/logout", isAuthenticated, (req, res) => {
	req.session.destroy((err) => {
		if (err) {
			console.error("Error destroying session:", err);
		}
		res.redirect("/login");
	});
});

module.exports = router;
