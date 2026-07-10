/**
 * Course-timezone helpers for deadline handling.
 *
 * Deadlines are entered by instructors as naive wall-clock times (an
 * <input type="datetime-local"> value like "2026-07-09T23:59") and are meant
 * to be interpreted in the course's timezone — not the server's (UTC in prod)
 * nor the viewer's browser. These helpers convert between that fixed course
 * wall-clock and a true UTC instant so the value can be stored/compared like
 * any real timestamp (see getDeadlineStatus in src/routes/questions.js).
 *
 * Dependency-free and DST-safe: all zone math uses the built-in Intl API.
 */

// The single source of truth for the course timezone. Change here if the
// course is ever taught in a different zone. IANA name -> DST handled for free.
const COURSE_TZ = "America/New_York";

/**
 * Offset (in ms) of `tz` at the given instant, defined as (wall clock in tz) −
 * (UTC), i.e. how far ahead of UTC the zone's local time is. Negative for zones
 * behind UTC (e.g. −4h for EDT, −5h for EST).
 */
function zoneOffsetMs(instant, tz = COURSE_TZ) {
	const dtf = new Intl.DateTimeFormat("en-US", {
		timeZone: tz,
		hourCycle: "h23",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
	const parts = dtf.formatToParts(instant).reduce((acc, p) => {
		acc[p.type] = p.value;
		return acc;
	}, {});
	const asUTC = Date.UTC(
		Number(parts.year),
		Number(parts.month) - 1,
		Number(parts.day),
		Number(parts.hour),
		Number(parts.minute),
		Number(parts.second)
	);
	return asUTC - instant.getTime();
}

/**
 * Convert a wall-clock time in `tz` to the corresponding UTC Date.
 * Two-pass so it stays correct across DST transitions.
 * @returns {Date}
 */
function wallClockToUtc(year, month, day, hour, minute, tz = COURSE_TZ) {
	// First guess: pretend the wall clock is already UTC.
	const guess = Date.UTC(year, month - 1, day, hour, minute);
	const off1 = zoneOffsetMs(new Date(guess), tz);
	let utcMs = guess - off1;
	// The offset at the corrected instant may differ near a DST boundary; if so,
	// recompute once using that offset.
	const off2 = zoneOffsetMs(new Date(utcMs), tz);
	if (off2 !== off1) {
		utcMs = guess - off2;
	}
	return new Date(utcMs);
}

/**
 * Parse a naive datetime-local string ("YYYY-MM-DDTHH:mm"), interpreting it in
 * `tz`, into a UTC Date. Returns null for empty/invalid input.
 * @returns {Date|null}
 */
function parseDatetimeLocalToUtc(str, tz = COURSE_TZ) {
	const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(str || "");
	if (!m) return null;
	return wallClockToUtc(
		Number(m[1]),
		Number(m[2]),
		Number(m[3]),
		Number(m[4]),
		Number(m[5]),
		tz
	);
}

/**
 * Format a UTC Date as a datetime-local value ("YYYY-MM-DDTHH:mm") showing the
 * wall clock in `tz` — used to repopulate the instructor's datetime-local input.
 * @returns {string}
 */
function utcToDatetimeLocal(date, tz = COURSE_TZ) {
	if (!date) return "";
	const d = date instanceof Date ? date : new Date(date);
	if (isNaN(d.getTime())) return "";
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: tz,
		hourCycle: "h23",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	}).formatToParts(d).reduce((acc, p) => {
		acc[p.type] = p.value;
		return acc;
	}, {});
	return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

module.exports = {
	COURSE_TZ,
	zoneOffsetMs,
	wallClockToUtc,
	parseDatetimeLocalToUtc,
	utcToDatetimeLocal,
};
