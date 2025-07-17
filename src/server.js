const app = require("./app");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// Get port from environment variables or use default
const PORT = process.env.PORT || 3000;

// Start the server
app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
	console.log(`Environment: ${process.env.NODE_ENV}`);
});
