/**
 * Dependency-free CSRF protection using the synchronizer-token pattern.
 *
 * A per-session random token is generated on first request and exposed to
 * templates as `res.locals.csrfToken`. State-changing requests (POST/PUT/
 * PATCH/DELETE) must echo it back, either in the `x-csrf-token` header (used by
 * the client-side fetch/XHR interceptor) or in a `_csrf` body field (used by
 * full-page HTML forms). Requests whose token is missing or does not match the
 * session token are rejected with HTTP 403.
 *
 * Requires the session middleware and body parsers to run first.
 */

const crypto = require("crypto");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Ensure the session has a CSRF token and expose it to views.
function attachCsrfToken(req, res, next) {
	if (req.session && !req.session.csrfToken) {
		req.session.csrfToken = crypto.randomBytes(32).toString("hex");
	}
	res.locals.csrfToken = (req.session && req.session.csrfToken) || "";
	next();
}

// Constant-time comparison that tolerates differing lengths.
function tokensMatch(a, b) {
	if (typeof a !== "string" || typeof b !== "string" || a.length === 0) {
		return false;
	}
	const bufA = Buffer.from(a);
	const bufB = Buffer.from(b);
	if (bufA.length !== bufB.length) {
		return false;
	}
	return crypto.timingSafeEqual(bufA, bufB);
}

// Reject unsafe requests that don't carry a valid token.
function verifyCsrf(req, res, next) {
	if (SAFE_METHODS.has(req.method)) {
		return next();
	}

	const sessionToken = req.session && req.session.csrfToken;
	const submitted =
		req.get("x-csrf-token") ||
		(req.body && req.body._csrf) ||
		req.query._csrf;

	if (sessionToken && tokensMatch(submitted, sessionToken)) {
		return next();
	}

	// Prefer a JSON error for AJAX callers; render the error page otherwise.
	const wantsJson =
		req.xhr ||
		req.is("application/json") ||
		(req.get("accept") || "").includes("application/json") ||
		req.get("x-csrf-token") !== undefined;

	if (wantsJson) {
		return res.status(403).json({
			success: false,
			message:
				"Invalid or missing security token. Please refresh the page and try again.",
		});
	}

	return res.status(403).render("pages/error", {
		title: "Security Check Failed",
		message:
			"Your session security token was missing or invalid. Please go back, refresh the page, and try again.",
	});
}

module.exports = { attachCsrfToken, verifyCsrf };
