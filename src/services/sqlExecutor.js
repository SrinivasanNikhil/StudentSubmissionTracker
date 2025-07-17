const { classicModelsDB, northwindDB } = require("../config/database");

/**
 * Execute a SQL query on the appropriate MySQL database
 * @param {string} query - The SQL query to execute
 * @param {string} databaseName - Database name: 'ClassicModels' or 'Northwind'
 * @returns {object} - Result object with success status, data, error, and columns
 */
const executeQuery = async (query, databaseName) => {
	try {
		// Select the correct database connection
		const dbConnection =
			databaseName === "Northwind" ? northwindDB : classicModelsDB;

		// Execute the query
		const [results, metadata] = await dbConnection.query(query);

		// Format the results
		if (!results || results.length === 0) {
			return {
				success: true,
				message: "Query executed successfully, but returned no results",
				rows: 0,
				data: [],
				columns: [],
			};
		}

		// Get column names from the first result
		const columns = Object.keys(results[0]);

		return {
			success: true,
			message: "Query executed successfully",
			rows: results.length,
			data: results,
			columns: columns,
		};
	} catch (error) {
		console.error("Error executing SQL query:", error);
		return {
			success: false,
			message: error.message || "Unknown error",
			error: error.toString(),
			errorCode: error.code,
			errorState: error.sqlState,
			errorNumber: error.errno,
			data: [],
			columns: [],
			rows: 0,
		};
	}
};

/**
 * Compare a student's SQL query with the solution
 * @param {string} studentQuery - The student's SQL query
 * @param {string} solutionQuery - The solution SQL query
 * @param {string} databaseName - Database name: 'ClassicModels' or 'Northwind'
 * @returns {object} - Comparison results
 */
const compareQueries = async (studentQuery, solutionQuery, databaseName) => {
	try {
		// Execute both queries and compare results
		const studentResult = await executeQuery(studentQuery, databaseName);
		const solutionResult = await executeQuery(solutionQuery, databaseName);

		// If student query failed, return the error
		if (!studentResult.success) {
			return {
				success: false,
				message: "Your query has an error",
				error: studentResult.message,
				differences: [],
				feedback: "Fix the syntax error in your query.",
				studentResult, // Include both results even on error
				solutionResult,
			};
		}

		// Compare the results
		const differences = [];
		let isCorrect = true;
		let rowsMatch = true;
		let columnsMatch = true;
		let columnNamesMatch = true;

		// Check if column counts match
		if (studentResult.columns.length !== solutionResult.columns.length) {
			differences.push(
				`Expected ${solutionResult.columns.length} columns but got ${studentResult.columns.length}`
			);
			isCorrect = false;
			columnsMatch = false;
		}

		// Check if row counts match (no leeway given - must be exact)
		if (studentResult.rows !== solutionResult.rows) {
			differences.push(
				`Expected ${solutionResult.rows} rows but got ${studentResult.rows}`
			);
			isCorrect = false;
			rowsMatch = false;
		}

		// Check for column names (may be in different order)
		const missingColumns = solutionResult.columns.filter(
			(col) => !studentResult.columns.includes(col)
		);
		const extraColumns = studentResult.columns.filter(
			(col) => !solutionResult.columns.includes(col)
		);

		if (missingColumns.length > 0) {
			differences.push(`Missing columns: ${missingColumns.join(", ")}`);
			isCorrect = false;
			columnNamesMatch = false;
		}

		if (extraColumns.length > 0) {
			differences.push(`Extra columns: ${extraColumns.join(", ")}`);
			isCorrect = false;
			columnNamesMatch = false;
		}

		// Build feedback
		let feedback = "";
		if (isCorrect) {
			feedback =
				"Great job! Your query is correct. It matches the expected solution in both rows returned (" +
				solutionResult.rows +
				" rows) and columns selected.";
		} else {
			feedback = "Your query results differ from the expected solution.";

			// Add specific feedback on matches and mismatches
			if (rowsMatch) {
				feedback +=
					" Your query correctly returns the expected number of rows (" +
					solutionResult.rows +
					" rows).";
			} else {
				feedback +=
					" Your query returns " +
					studentResult.rows +
					" rows, but the expected solution returns " +
					solutionResult.rows +
					" rows.";
			}

			if (columnsMatch && columnNamesMatch) {
				feedback += " Your query correctly selects all the expected columns.";
			} else if (columnsMatch) {
				feedback +=
					" Your query has the correct number of columns, but some column names differ.";
			} else {
				feedback +=
					" Your query selects " +
					studentResult.columns.length +
					" columns, but the expected solution uses " +
					solutionResult.columns.length +
					" columns.";
			}

			// Add specific hints based on differences
			if (missingColumns.length > 0) {
				feedback += ` Make sure to include all required columns: ${missingColumns.join(
					", "
				)}.`;
			}
		}

		return {
			success: true,
			isCorrect,
			differences,
			feedback,
			studentResult,
			solutionResult,
			rowsMatch,
			columnsMatch,
			columnNamesMatch,
		};
	} catch (error) {
		console.error("Error comparing queries:", error);
		return {
			success: false,
			message: "Error comparing queries",
			error: error.toString(),
			differences: [],
			feedback:
				"An error occurred while comparing your query with the solution.",
			studentResult: { rows: 0 },
			solutionResult: { rows: 0 },
		};
	}
};

module.exports = {
	executeQuery,
	compareQueries,
};
