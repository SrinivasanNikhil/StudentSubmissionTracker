const { classicModelsDB, northwindDB, textDB } = require("../config/database");

/**
 * Compare column names with enhanced logic for calculated columns
 * @param {Array} studentColumns - Array of student query column names
 * @param {Array} solutionColumns - Array of solution query column names
 * @param {string} studentQuery - The full student SQL query
 * @param {string} solutionQuery - The full solution SQL query
 * @returns {Object} - Comparison results with missing, extra columns, and match status
 */
const compareColumnNames = (studentColumns, solutionColumns, studentQuery = '', solutionQuery = '') => {
	// If exact match (including order), return early
	if (JSON.stringify(studentColumns) === JSON.stringify(solutionColumns)) {
		return {
			missingColumns: [],
			extraColumns: [],
			columnNamesMatched: true
		};
	}

	// If same columns but different order, still consider it a match
	if (studentColumns.length === solutionColumns.length &&
		studentColumns.every(col => solutionColumns.includes(col))) {
		return {
			missingColumns: [],
			extraColumns: [],
			columnNamesMatched: true
		};
	}

	// Extract SELECT expressions from queries
	const studentExpressions = extractSelectExpressions(studentQuery);
	const solutionExpressions = extractSelectExpressions(solutionQuery);

	// Enhanced matching using both column names and SQL expressions
	const missingColumns = [];
	const extraColumns = [];
	
	// Track which solution columns have been matched
	const matchedSolutionIndices = new Set();
	const matchedStudentIndices = new Set();

	// First pass: exact column name matches
	for (let i = 0; i < solutionColumns.length; i++) {
		const solutionCol = solutionColumns[i];
		const studentIndex = studentColumns.indexOf(solutionCol);
		if (studentIndex !== -1) {
			matchedSolutionIndices.add(i);
			matchedStudentIndices.add(studentIndex);
		}
	}

	// Second pass: expression-based matching for calculated columns
	for (let i = 0; i < solutionColumns.length; i++) {
		if (matchedSolutionIndices.has(i)) continue;
		
		const solutionExpr = solutionExpressions[i];
		if (!solutionExpr) continue;
		
		for (let j = 0; j < studentColumns.length; j++) {
			if (matchedStudentIndices.has(j)) continue;
			
			const studentExpr = studentExpressions[j];
			if (!studentExpr) continue;
			
			// Compare the normalized expressions
			if (normalizeExpression(solutionExpr) === normalizeExpression(studentExpr)) {
				matchedSolutionIndices.add(i);
				matchedStudentIndices.add(j);
				break;
			}
		}
	}

	// Third pass: fallback to normalized column name matching
	for (let i = 0; i < solutionColumns.length; i++) {
		if (matchedSolutionIndices.has(i)) continue;
		
		const normalizedSolution = normalizeColumnName(solutionColumns[i]);
		
		for (let j = 0; j < studentColumns.length; j++) {
			if (matchedStudentIndices.has(j)) continue;
			
			const normalizedStudent = normalizeColumnName(studentColumns[j]);
			
			if (normalizedSolution === normalizedStudent) {
				matchedSolutionIndices.add(i);
				matchedStudentIndices.add(j);
				break;
			}
		}
	}

	// Identify truly missing and extra columns
	for (let i = 0; i < solutionColumns.length; i++) {
		if (!matchedSolutionIndices.has(i)) {
			missingColumns.push(solutionColumns[i]);
		}
	}

	for (let j = 0; j < studentColumns.length; j++) {
		if (!matchedStudentIndices.has(j)) {
			extraColumns.push(studentColumns[j]);
		}
	}

	const columnNamesMatched = missingColumns.length === 0 && extraColumns.length === 0;

	return {
		missingColumns,
		extraColumns,
		columnNamesMatched
	};
};

/**
 * Extract SELECT expressions from a SQL query
 * @param {string} query - The SQL query
 * @returns {Array} - Array of SELECT expressions
 */
const extractSelectExpressions = (query) => {
	if (!query || typeof query !== 'string') return [];
	
	try {
		// Remove comments and normalize whitespace
		const cleanQuery = query
			.replace(/--.*$/gm, '') // Remove line comments
			.replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
			.replace(/\s+/g, ' ') // Normalize whitespace
			.trim();

		// Find the SELECT clause
		const selectMatch = cleanQuery.match(/SELECT\s+(.*?)\s+FROM/i);
		if (!selectMatch) return [];

		const selectClause = selectMatch[1];
		
		// Handle SELECT * 
		if (selectClause.trim() === '*') {
			return ['*'];
		}

		// Split by commas, but be careful about nested functions and parentheses
		const expressions = [];
		let currentExpr = '';
		let parenCount = 0;
		let inQuotes = false;
		let quoteChar = '';

		for (let i = 0; i < selectClause.length; i++) {
			const char = selectClause[i];
			
			if (!inQuotes && (char === '"' || char === "'" || char === '`')) {
				inQuotes = true;
				quoteChar = char;
			} else if (inQuotes && char === quoteChar) {
				inQuotes = false;
				quoteChar = '';
			} else if (!inQuotes) {
				if (char === '(') {
					parenCount++;
				} else if (char === ')') {
					parenCount--;
				} else if (char === ',' && parenCount === 0) {
					expressions.push(currentExpr.trim());
					currentExpr = '';
					continue;
				}
			}
			
			currentExpr += char;
		}
		
		if (currentExpr.trim()) {
			expressions.push(currentExpr.trim());
		}

		return expressions;
	} catch (error) {
		console.warn('Error parsing SELECT expressions:', error);
		return [];
	}
};

/**
 * Normalize SQL expressions for comparison
 * @param {string} expression - The SQL expression to normalize
 * @returns {string} - Normalized expression
 */
const normalizeExpression = (expression) => {
	if (!expression || typeof expression !== 'string') return '';
	
	return expression
		.toLowerCase()
		.trim()
		// Remove AS alias clauses
		.replace(/\s+as\s+\w+$/i, '')
		// Remove quotes and backticks
		.replace(/[`'"]/g, '')
		// Normalize whitespace around operators
		.replace(/\s*\*\s*/g, ' * ')
		.replace(/\s*\+\s*/g, ' + ')
		.replace(/\s*-\s*/g, ' - ')
		.replace(/\s*\/\s*/g, ' / ')
		.replace(/\s*=\s*/g, ' = ')
		// Normalize function calls
		.replace(/\s*\(\s*/g, '(')
		.replace(/\s*\)\s*/g, ')')
		.replace(/\s*,\s*/g, ', ')
		// Clean up extra spaces
		.replace(/\s+/g, ' ')
		.trim();
};

/**
 * Normalize column names for better matching of calculated columns
 * @param {string} columnName - The column name to normalize
 * @returns {string} - Normalized column name
 */
const normalizeColumnName = (columnName) => {
	// Remove common MySQL auto-generated prefixes/patterns
	let normalized = columnName
		.toLowerCase()
		.trim()
		// Remove quotes and backticks
		.replace(/[`'"]/g, '')
		// Handle auto-generated names like "sum(column)" -> "sum_column"
		.replace(/\(/g, '_')
		.replace(/\)/g, '')
		// Handle expressions like "column1 * column2" -> "column1_column2"
		.replace(/\s*\*\s*/g, '_mul_')
		.replace(/\s*\+\s*/g, '_add_')
		.replace(/\s*-\s*/g, '_sub_')
		.replace(/\s*\/\s*/g, '_div_')
		// Remove extra spaces and replace with underscores
		.replace(/\s+/g, '_')
		// Clean up multiple underscores
		.replace(/_+/g, '_')
		// Remove leading/trailing underscores
		.replace(/^_+|_+$/g, '');

	// Handle common function patterns
	const functionPatterns = [
		{ pattern: /^count_\*/, replacement: 'count_all' },
		{ pattern: /^count_/, replacement: 'count_' },
		{ pattern: /^sum_/, replacement: 'sum_' },
		{ pattern: /^avg_/, replacement: 'avg_' },
		{ pattern: /^min_/, replacement: 'min_' },
		{ pattern: /^max_/, replacement: 'max_' }
	];

	for (const { pattern, replacement } of functionPatterns) {
		if (pattern.test(normalized)) {
			// Keep the function pattern consistent
			break;
		}
	}

	return normalized;
};

/**
 * Execute a SQL query on the appropriate MySQL database
 * @param {string} query - The SQL query to execute
 * @param {string} databaseName - Database name: 'ClassicModels', 'Northwind', or 'Text'
 * @returns {object} - Result object with success status, data, error, and columns
 */
const executeQuery = async (query, databaseName) => {
	try {
		// Select the correct database connection
		let dbConnection;
		switch (databaseName) {
			case "Northwind":
				dbConnection = northwindDB;
				break;
			case "Text":
				dbConnection = textDB;
				break;
			default:
				dbConnection = classicModelsDB; // Default to ClassicModels
		}

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
 * @param {string} databaseName - Database name: 'ClassicModels', 'Northwind', or 'Text'
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
		// Enhanced logic to handle calculated columns and auto-generated names
		const { missingColumns, extraColumns, columnNamesMatched } = compareColumnNames(
			studentResult.columns,
			solutionResult.columns,
			studentQuery,
			solutionQuery
		);

		// Update columnNamesMatch based on enhanced comparison
		columnNamesMatch = columnNamesMatched;

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
