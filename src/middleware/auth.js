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
		// Redirect admin users to admin dashboard, regular users to topics page
		if (req.session.user && req.session.user.isAdmin) {
			return res.redirect("/admin");
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
		req.session.user.isAdmin
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

module.exports = {
	isAuthenticated,
	isNotAuthenticated,
	isAdmin,
};
