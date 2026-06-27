require("dotenv").config();
const http = require("http");

/**
 * Test script to verify the analyze-syntax route is working
 */

const testAnalyzeSyntax = async () => {
	try {
		console.log("🧪 Testing analyze-syntax route...");

		// Test data
		const testData = {
			query: "SELECT * FROM customers WHERE city = 'NYC'",
		};

		console.log("Test query:", testData.query);

		// Create HTTP request
		const postData = JSON.stringify(testData);

		const options = {
			hostname: "localhost",
			port: 3000,
			path: "/questions/1/analyze-syntax",
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Content-Length": Buffer.byteLength(postData),
			},
		};

		const req = http.request(options, (res) => {
			console.log(`Status: ${res.statusCode}`);
			console.log(`Headers:`, res.headers);

			let data = "";
			res.on("data", (chunk) => {
				data += chunk;
			});

			res.on("end", () => {
				try {
					const result = JSON.parse(data);
					if (res.statusCode === 200) {
						console.log("✅ Success! Response:", result);
					} else {
						console.log("❌ Error response:", result);
					}
				} catch (e) {
					console.log("Raw response:", data);
				}
			});
		});

		req.on("error", (e) => {
			console.error(`❌ Request error: ${e.message}`);
		});

		req.write(postData);
		req.end();
	} catch (error) {
		console.error("❌ Test failed:", error.message);
	}
};

// Run the test
testAnalyzeSyntax();
