const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

/**
 * Content-hash based cache busting for static assets.
 *
 * nginx serves /css/ and /js/ with `expires 1y` + `Cache-Control: immutable`,
 * which tells the browser never to revalidate. That is the correct header — but
 * only for a URL that changes when the content changes. Because the templates
 * referenced bare paths like "/js/main.js", the URL never changed, so a browser
 * that cached the file once kept it for a year and never saw a deploy.
 *
 * That is not hypothetical: window.sstSanitizeHtml was added to main.js on
 * 2026-07-27, and browsers holding a pre-July copy threw
 * "sstSanitizeHtml is not a function" on every AI feedback response — the call
 * succeeded and the credit was spent, but the student saw "Failed to get
 * feedback. Please try again."
 *
 * Appending a content hash makes the URL change exactly when the bytes change,
 * which makes the immutable cache both safe and maximally effective.
 */

const PUBLIC_DIR = path.resolve(__dirname, "../../public");
const HASH_LENGTH = 10;

// Hashes are stable for the life of the process in production; in development
// we re-read so an edit shows up on refresh without restarting the server.
const cache = new Map();
const warned = new Set();

function computeHash(publicPath) {
	const relative = publicPath.replace(/^\/+/, "");
	const absolute = path.resolve(PUBLIC_DIR, relative);

	// Defence in depth: these paths are template literals today, but never let a
	// caller escape the public directory.
	if (absolute !== PUBLIC_DIR && !absolute.startsWith(PUBLIC_DIR + path.sep)) {
		throw new Error(`Asset path escapes public directory: ${publicPath}`);
	}

	return crypto
		.createHash("sha1")
		.update(fs.readFileSync(absolute))
		.digest("hex")
		.slice(0, HASH_LENGTH);
}

/**
 * Return a static asset path with a ?v=<content-hash> query string appended.
 *
 * Falls back to the unversioned path if the file cannot be read — a missing
 * hash costs cache freshness, but a thrown error would blank the whole page.
 */
function assetUrl(publicPath) {
	const isProduction = process.env.NODE_ENV === "production";

	if (isProduction && cache.has(publicPath)) {
		return cache.get(publicPath);
	}

	let versioned;
	try {
		versioned = `${publicPath}?v=${computeHash(publicPath)}`;
	} catch (error) {
		if (!warned.has(publicPath)) {
			warned.add(publicPath);
			console.error(
				`[assetVersion] Could not hash ${publicPath}; serving it unversioned.`,
				error.message
			);
		}
		versioned = publicPath;
	}

	if (isProduction) {
		cache.set(publicPath, versioned);
	}

	return versioned;
}

module.exports = { assetUrl };
