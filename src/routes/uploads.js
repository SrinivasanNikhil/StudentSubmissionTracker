/**
 * Authorized serving of student-uploaded ER diagrams.
 *
 * These files were previously exposed by a bare `express.static` mount, which
 * meant any anonymous visitor who had (or guessed) a filename could download a
 * student's submitted coursework — a privacy problem in its own right, and the
 * delivery half of a stored-XSS chain when combined with attacker-chosen file
 * extensions.
 *
 * The URL shape is deliberately unchanged (`/uploads/diagrams/<file>`) so the
 * existing templates keep working without edits.
 */

const express = require("express");
const router = express.Router();
const path = require("path");
const { Completion, User } = require("../models");
const { isAuthenticated } = require("../middleware/auth");

const uploadDir = path.join(__dirname, "../public/uploads/diagrams");

// Filenames are generated server-side as `diagram-<32 hex chars>.png`. Older
// rows may use the legacy `diagram-<timestamp>-<random>.png` form, so accept a
// conservative superset while still refusing anything with path separators.
const SAFE_FILENAME = /^diagram-[A-Za-z0-9._-]+\.png$/;

router.get("/diagrams/:filename", isAuthenticated, async (req, res) => {
	try {
		// Collapse any traversal attempt to a bare filename, then allowlist it.
		const filename = path.basename(req.params.filename);
		if (!SAFE_FILENAME.test(filename)) {
			return res.status(400).send("Invalid file name");
		}

		const completion = await Completion.findOne({
			where: { diagramImage: `/diagrams/${filename}` },
			include: [
				{
					model: User,
					as: "user",
					attributes: ["id", "associatedInstructorId"],
				},
			],
		});

		if (!completion) {
			return res.status(404).send("Not found");
		}

		const sessionUser = req.session.user || {};
		const isOwner = completion.userId === req.session.userId;
		const isAdminUser =
			Boolean(sessionUser.isAdmin) || sessionUser.role === "admin";
		const isTheirInstructor =
			sessionUser.role === "instructor" &&
			completion.user &&
			completion.user.associatedInstructorId === req.session.userId;

		if (!isOwner && !isAdminUser && !isTheirInstructor) {
			return res.status(403).send("You do not have access to this file");
		}

		// Serve with an explicit content type so the file can never be
		// interpreted as HTML/script regardless of what was stored.
		res.type("image/png");
		return res.sendFile(path.join(uploadDir, filename), (err) => {
			if (err && !res.headersSent) {
				res.status(404).send("Not found");
			}
		});
	} catch (error) {
		console.error("Error serving diagram:", error);
		return res.status(500).send("Error serving file");
	}
});

module.exports = router;
