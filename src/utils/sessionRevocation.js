"use strict";

const { Sequelize } = require("sequelize");
const { sequelize } = require("../config/database");

/**
 * Delete all stored sessions belonging to a user.
 *
 * Authorization in this app is a snapshot taken at login: the middleware in
 * src/middleware/auth.js reads role and identity from req.session and never
 * re-checks the database. Combined with `rolling: true`, an active session
 * refreshes on every request and effectively never expires. That means:
 *
 *   - a deleted user keeps browsing as an authenticated principal whose row no
 *     longer exists (and routes that do User.findByPk(...).academicYear then
 *     throw on null),
 *   - a demoted instructor keeps instructor privileges until they log out,
 *   - a hijacked session survives the victim's password reset.
 *
 * Revoking at the moment of the privilege change fixes all three without adding
 * a database round-trip to every request.
 *
 * Sessions are stored by connect-session-sequelize as JSON text in the
 * `Sessions` table, so the owning user is matched with JSON_EXTRACT (exact,
 * unlike a LIKE match which would also hit userId 1234 when targeting 123).
 *
 * Never throws — revocation is a security hardening step layered on top of the
 * primary action, and must not roll back a completed delete or password reset.
 *
 * @param {number} userId
 * @returns {Promise<number>} sessions removed (0 if the query failed)
 */
async function destroyUserSessions(userId) {
	const id = Number(userId);
	if (!Number.isInteger(id)) return 0;

	try {
		const [, metadata] = await sequelize.query(
			"DELETE FROM `Sessions` WHERE JSON_EXTRACT(`data`, '$.userId') = :id",
			{ replacements: { id }, type: Sequelize.QueryTypes.RAW }
		);
		const removed = (metadata && metadata.affectedRows) || 0;
		if (removed > 0) {
			console.log(`Revoked ${removed} session(s) for userId=${id}`);
		}
		return removed;
	} catch (error) {
		console.error(
			`Failed to revoke sessions for userId=${id} (non-blocking):`,
			error.message
		);
		return 0;
	}
}

module.exports = { destroyUserSessions };
