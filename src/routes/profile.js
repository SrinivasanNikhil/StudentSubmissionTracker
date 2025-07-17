const express = require("express");
const router = express.Router();
const { User } = require("../models");
const { isAuthenticated } = require("../middleware/auth");

// Display profile page
router.get("/", isAuthenticated, async (req, res) => {
	try {
		// Get user from database to ensure we have the latest data
		const user = await User.findByPk(req.session.userId);

		if (!user) {
			return res.status(404).render("pages/error", {
				title: "Error",
				message: "User not found.",
			});
		}

		res.render("pages/profile", {
			title: "My Profile",
			user: {
				id: user.id,
				email: user.email,
				firstName: user.firstName || "",
				lastName: user.lastName || "",
				code: user.code || "",
			},
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
		const { firstName, lastName, code } = req.body;
		const userId = req.session.userId;

		// Update user in database
		const user = await User.findByPk(userId);

		if (!user) {
			return res.status(404).render("pages/error", {
				title: "Error",
				message: "User not found.",
			});
		}

		// Update user details
		await user.update({
			firstName: firstName || null,
			lastName: lastName || null,
			code: code || null,
		});

		// Update session data
		req.session.user = {
			id: user.id,
			email: user.email,
			firstName: user.firstName || "",
			lastName: user.lastName || "",
			code: user.code || "",
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

module.exports = router;
