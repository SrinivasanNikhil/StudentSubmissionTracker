require("dotenv").config();
const { compareQueries } = require("../services/sqlExecutor");

// We'll also create a simple test for the compareColumnNames function directly
const { classicModelsDB } = require("../config/database");

// Simple function to test column name comparison directly
const testColumnComparisonDirect = () => {
	console.log("🔍 Testing Column Name Comparison Logic Directly\n");
	
	// We'll need to mock some basic functionality for direct testing
	const testCases = [
		{
			name: "Simple Alias Test",
			studentCols: ['total'],
			solutionCols: ['totalSales'],
			studentQuery: 'SELECT quantityOrdered * priceEach AS total FROM OrderDetails',
			solutionQuery: 'SELECT quantityOrdered * priceEach AS totalSales FROM OrderDetails',
			expected: true
		}
	];
	
	// For now, let's comment this out and focus on the integration test
	// We'll test via the full compareQueries function instead
};

/**
 * Test script for the improved column matching logic
 */
const testColumnMatching = async () => {
	console.log("🧪 Testing Enhanced Column Matching Logic\n");

	const testCases = [
		{
			name: "Exact Match",
			student: "SELECT customerName, city FROM Customers",
			solution: "SELECT customerName, city FROM Customers",
			shouldMatch: true
		},
		{
			name: "Different Order (should match)",
			student: "SELECT city, customerName FROM Customers",
			solution: "SELECT customerName, city FROM Customers",
			shouldMatch: true
		},
		{
			name: "Calculated Column - Same Expression, No Alias",
			student: "SELECT quantityOrdered * priceEach FROM OrderDetails LIMIT 5",
			solution: "SELECT quantityOrdered * priceEach FROM OrderDetails LIMIT 5",
			shouldMatch: true
		},
		{
			name: "Calculated Column - Different Aliases",
			student: "SELECT quantityOrdered * priceEach AS total FROM OrderDetails LIMIT 5",
			solution: "SELECT quantityOrdered * priceEach AS totalSales FROM OrderDetails LIMIT 5",
			shouldMatch: true
		},
		{
			name: "Calculated Column - One with alias, one without",
			student: "SELECT quantityOrdered * priceEach FROM OrderDetails LIMIT 5",
			solution: "SELECT quantityOrdered * priceEach AS totalSales FROM OrderDetails LIMIT 5",
			shouldMatch: true
		},
		{
			name: "Function with Calculated Column",
			student: "SELECT SUM(quantityOrdered * priceEach) FROM OrderDetails",
			solution: "SELECT SUM(quantityOrdered * priceEach) AS totalSales FROM OrderDetails",
			shouldMatch: true
		},
		{
			name: "COUNT(*) variations",
			student: "SELECT COUNT(*) FROM Customers",
			solution: "SELECT COUNT(*) AS totalCustomers FROM Customers",
			shouldMatch: true
		},
		{
			name: "Different Calculations (should NOT match)",
			student: "SELECT quantityOrdered + priceEach FROM OrderDetails LIMIT 5",
			solution: "SELECT quantityOrdered * priceEach FROM OrderDetails LIMIT 5",
			shouldMatch: false
		},
		{
			name: "Missing Column (should NOT match)",
			student: "SELECT customerName FROM Customers LIMIT 5",
			solution: "SELECT customerName, city FROM Customers LIMIT 5",
			shouldMatch: false
		},
		{
			name: "Complex Expression with Functions",
			student: "SELECT UPPER(customerName), LENGTH(city) * 2 FROM Customers LIMIT 3",
			solution: "SELECT UPPER(customerName) AS name, LENGTH(city) * 2 AS cityLength FROM Customers LIMIT 3",
			shouldMatch: true
		},
		{
			name: "Multiple Calculations",
			student: "SELECT buyPrice, MSRP, (MSRP - buyPrice) AS profit FROM Products LIMIT 3",
			solution: "SELECT buyPrice, MSRP, (MSRP - buyPrice) AS margin FROM Products LIMIT 3", 
			shouldMatch: true
		}
	];

	for (const testCase of testCases) {
		try {
			console.log(`\n📝 Test: ${testCase.name}`);
			console.log(`   Student: ${testCase.student}`);
			console.log(`   Solution: ${testCase.solution}`);

			const result = await compareQueries(
				testCase.student,
				testCase.solution,
				"ClassicModels"
			);

			if (result.success) {
				const passed = result.columnNamesMatch === testCase.shouldMatch;
				const status = passed ? "✅ PASS" : "❌ FAIL";
				
				console.log(`   Result: ${status}`);
				console.log(`   Student Columns: [${result.studentResult.columns.join(", ")}]`);
				console.log(`   Solution Columns: [${result.solutionResult.columns.join(", ")}]`);
				console.log(`   Column Names Match: ${result.columnNamesMatch} (expected: ${testCase.shouldMatch})`);
				console.log(`   Rows Match: ${result.rowsMatch}`);
				console.log(`   Columns Match: ${result.columnsMatch}`);
				
				if (!passed) {
					console.log(`   ❌ Expected column names match: ${testCase.shouldMatch}, got: ${result.columnNamesMatch}`);
				}
			} else {
				console.log(`   ❌ Query execution failed: ${result.message}`);
			}
		} catch (error) {
			console.log(`   ❌ Error: ${error.message}`);
		}
	}

	console.log("\n🎯 Test Completed!");
};

// Run the test if this script is executed directly
if (require.main === module) {
	testColumnMatching().catch(console.error);
}

module.exports = testColumnMatching;
