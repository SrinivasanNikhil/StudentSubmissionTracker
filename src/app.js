const express = require("express");
const session = require("express-session");
const path = require("path");
const dotenv = require("dotenv");
const expressLayouts = require("express-ejs-layouts");
const flash = require("connect-flash");
const {
	testConnection,
	initializeDatabase,
	sequelize,
} = require("./config/database");
const { loadReferenceData } = require("./utils/referenceLoader");
const createDatabase = require("./config/create-db");
const { Topic } = require("./models");
const SequelizeStore = require("connect-session-sequelize")(session.Store);

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Setup view engine (EJS)
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use(expressLayouts);
app.set("layout", "layouts/main");

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "../public")));

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

// Create session store
const sessionStore = new SequelizeStore({
	db: sequelize,
	expiration: 1000 * 60 * 60 * 24, // 1 day
	checkExpirationInterval: 15 * 60 * 1000, // Clean up expired sessions every 15 minutes
	tableName: "Sessions",
	createTableIfMissing: true,
});

// Session configuration
app.use(
	session({
		secret: process.env.SESSION_SECRET || "fallback_session_secret",
		store: sessionStore,
		resave: true, // Changed to true to ensure session is saved
		saveUninitialized: true, // Changed to true to save new sessions
		rolling: true,
		cookie: {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			maxAge: 1000 * 60 * 60 * 24, // 1 day
			sameSite: "lax",
			path: "/",
		},
		name: "sessionId",
	})
);

// Flash messages
app.use(flash());

// Pass user info to all templates
app.use((req, res, next) => {
	try {
		// Debug logging
		console.log("Template middleware - Session state:", {
			hasSession: !!req.session,
			hasUserId: !!req.session?.userId,
			hasUser: !!req.session?.user,
			userData: req.session?.user,
			isAdmin: req.session?.user?.isAdmin,
			isAdminType: typeof req.session?.user?.isAdmin,
			sessionID: req.sessionID,
			cookie: req.session?.cookie,
		});

		// Pass session info to templates
		res.locals.sessionID = req.sessionID;
		res.locals.sessionCookie = req.session?.cookie;

		if (req.session?.user) {
			// Ensure we're working with a fresh copy of the user data
			const userData = {
				...req.session.user,
				isAdmin: Boolean(req.session.user.isAdmin),
			};

			res.locals.user = userData;

			// Debug logging
			console.log("Template middleware - Locals set:", {
				user: res.locals.user,
				isAdmin: res.locals.user.isAdmin,
				isAdminType: typeof res.locals.user.isAdmin,
				sessionID: req.sessionID,
			});
		} else {
			res.locals.user = null;
		}
		res.locals.isAuthenticated = Boolean(req.session?.userId);
		res.locals.error = req.flash("error")[0];
		res.locals.success = req.flash("success")[0];
		next();
	} catch (error) {
		console.error("Error in session middleware:", error);
		next(error);
	}
});

// Import routes
const authRoutes = require("./routes/auth");
const topicRoutes = require("./routes/topics");
const questionRoutes = require("./routes/questions");
const completionRoutes = require("./routes/completions");
const profileRoutes = require("./routes/profile");
const adminRoutes = require("./routes/admin");
const erDiagramRoutes = require("./routes/er-diagrams");

// Register routes
app.use("/", authRoutes);
app.use("/topics", topicRoutes);
app.use("/questions", questionRoutes);
app.use("/completions", completionRoutes);
app.use("/profile", profileRoutes);
app.use("/admin", adminRoutes);
app.use("/er-diagrams", erDiagramRoutes);

// Home route
app.get("/", (req, res) => {
	if (req.session.userId) {
		return res.redirect("/topics");
	}
	res.render("pages/home", { title: "Welcome" });
});

// Error handling middleware
app.use((req, res, next) => {
	res.status(404).render("pages/error", {
		title: "404 Not Found",
		message: "The page you are looking for does not exist.",
	});
});

app.use((err, req, res, next) => {
	console.error(err.stack);
	res.status(500).render("pages/error", {
		title: "Server Error",
		message:
			process.env.NODE_ENV === "production"
				? "Something went wrong on our end."
				: err.message,
	});
});

// Initialize the application
const initializeApp = async () => {
	try {
		// Initialize database and run migrations
		await initializeDatabase();

		// Ensure database connection is established
		await sequelize.authenticate();
		console.log("Database connection verified for session store");

		// Sync session store and wait for it to complete
		await sessionStore.sync({ force: false });
		console.log("Session store synchronized successfully");

		// Load reference data
		await loadReferenceData();
		console.log("Application initialized successfully");
	} catch (error) {
		console.error("Error initializing application:", error);
		process.exit(1);
	}
};

// Initialize application when starting up
initializeApp().catch((error) => {
	console.error("Failed to initialize application:", error);
	process.exit(1);
});

module.exports = app;
