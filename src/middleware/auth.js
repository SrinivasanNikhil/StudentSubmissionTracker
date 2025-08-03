/**
 * Authentication middleware to protect routes
 */

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
	if (req.session && req.session.userId) {
		return next();
	}

	// If not authenticated, redirect to login page
	return res.redirect("/login");
};

// Middleware to check if user is NOT authenticated
// Used for login/register pages to redirect already logged in users
const isNotAuthenticated = (req, res, next) => {
	if (req.session && req.session.userId) {
		// Redirect based on role
		if (
			req.session.user &&
			(req.session.user.isAdmin || req.session.user.role === "admin")
		) {
			return res.redirect("/admin");
		} else if (req.session.user && req.session.user.role === "instructor") {
			return res.redirect("/instructor/dashboard");
		} else {
			return res.redirect("/topics");
		}
	}

	return next();
};

// Middleware to check if user is an administrator
const isAdmin = (req, res, next) => {
	if (
		req.session &&
		req.session.userId &&
		req.session.user &&
		(req.session.user.isAdmin || req.session.user.role === "admin")
	) {
		return next();
	}

	// If not admin, show access denied page
	return res.status(403).render("pages/error", {
		title: "Access Denied",
		message:
			"You do not have permission to access this page. Administrator privileges required.",
	});
};

// Middleware to check if user is an instructor
const isInstructor = (req, res, next) => {
	if (
		req.session &&
		req.session.userId &&
		req.session.user &&
		req.session.user.role === "instructor"
	) {
		return next();
	}

	// If not instructor, show access denied page
	return res.status(403).render("pages/error", {
		title: "Access Denied",
		message:
			"You do not have permission to access this page. Instructor privileges required.",
	});
};

// Middleware to check if user is an instructor or admin
const isInstructorOrAdmin = (req, res, next) => {
	if (
		req.session &&
		req.session.userId &&
		req.session.user &&
		(req.session.user.role === "instructor" ||
			req.session.user.role === "admin" ||
			req.session.user.isAdmin)
	) {
		return next();
	}

	// If not instructor or admin, show access denied page
	return res.status(403).render("pages/error", {
		title: "Access Denied",
		message:
			"You do not have permission to access this page. Instructor or Administrator privileges required.",
	});
};

// Middleware to check if user is a student
const isStudent = (req, res, next) => {
	if (
		req.session &&
		req.session.userId &&
		req.session.user &&
		req.session.user.role === "student"
	) {
		return next();
	}

	// If not student, show access denied page
	return res.status(403).render("pages/error", {
		title: "Access Denied",
		message:
			"You do not have permission to access this page. Student privileges required.",
	});
};

module.exports = {
	isAuthenticated,
	isNotAuthenticated,
	isAdmin,
	isInstructor,
	isInstructorOrAdmin,
	isStudent,
};
