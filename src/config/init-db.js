require("dotenv").config();
const { sequelize, initializeDatabase } = require("./database");
const User = require("../models/User");
const Topic = require("../models/Topic");
const Question = require("../models/Question");
const Completion = require("../models/Completion");
const bcrypt = require("bcrypt");
const createDatabase = require("./create-db");

// Sample data for initial database setup
const topics = [
	{ name: "SELECT Statements", database: "ClassicModels" },
	{ name: "WHERE Clauses", database: "ClassicModels" },
	{ name: "JOIN Operations", database: "ClassicModels" },
	{ name: "Aggregation Functions", database: "ClassicModels" },
	{ name: "GROUP BY Clauses", database: "ClassicModels" },
	{ name: "Subqueries", database: "ClassicModels" },
];

const questions = [
	{
		topicId: 1,
		questionNumber: 1,
		questionText:
			'Write a SQL query to select all columns from the "customers" table.',
		solution: "SELECT * FROM customers;",
		expectedResult: JSON.stringify({ structure: "table", minRows: 1 }),
	},
	{
		topicId: 1,
		questionNumber: 2,
		questionText:
			'Write a SQL query to select only the "name" and "email" columns from the "customers" table.',
		solution: "SELECT name, email FROM customers;",
		expectedResult: JSON.stringify({
			structure: "table",
			columns: ["name", "email"],
		}),
	},
	{
		topicId: 2,
		questionNumber: 1,
		questionText:
			'Write a SQL query to select all customers where the "age" is greater than 25.',
		solution: "SELECT * FROM customers WHERE age > 25;",
		expectedResult: JSON.stringify({ structure: "table", filter: "age > 25" }),
	},
	{
		topicId: 2,
		questionNumber: 2,
		questionText:
			'Write a SQL query to select all products where the "price" is between 10 and 20.',
		solution: "SELECT * FROM products WHERE price BETWEEN 10 AND 20;",
		expectedResult: JSON.stringify({
			structure: "table",
			filter: "price between 10 and 20",
		}),
	},
	{
		topicId: 3,
		questionNumber: 1,
		questionText:
			'Write a SQL query to join the "orders" and "customers" tables on the customer_id column.',
		solution:
			"SELECT * FROM orders JOIN customers ON orders.customer_id = customers.id;",
		expectedResult: JSON.stringify({ structure: "table", join: true }),
	},
	{
		topicId: 3,
		questionNumber: 2,
		questionText:
			'Write a SQL query to perform a left join between "employees" and "departments".',
		solution:
			"SELECT * FROM employees LEFT JOIN departments ON employees.department_id = departments.id;",
		expectedResult: JSON.stringify({ structure: "table", join: "left" }),
	},
	{
		topicId: 4,
		questionNumber: 1,
		questionText:
			"Write a SQL query to find the average salary of all employees.",
		solution: "SELECT AVG(salary) as average_salary FROM employees;",
		expectedResult: JSON.stringify({ structure: "aggregate", function: "AVG" }),
	},
	{
		topicId: 4,
		questionNumber: 2,
		questionText:
			"Write a SQL query to count the number of products in each category.",
		solution:
			"SELECT category_id, COUNT(*) as product_count FROM products GROUP BY category_id;",
		expectedResult: JSON.stringify({
			structure: "aggregate",
			function: "COUNT",
			groupBy: true,
		}),
	},
	{
		topicId: 5,
		questionNumber: 1,
		questionText:
			"Write a SQL query to group sales by region and calculate the total amount.",
		solution:
			"SELECT region, SUM(amount) as total_sales FROM sales GROUP BY region;",
		expectedResult: JSON.stringify({
			structure: "aggregate",
			function: "SUM",
			groupBy: true,
		}),
	},
	{
		topicId: 5,
		questionNumber: 2,
		questionText:
			"Write a SQL query to find the highest salary in each department using GROUP BY.",
		solution:
			"SELECT department_id, MAX(salary) as highest_salary FROM employees GROUP BY department_id;",
		expectedResult: JSON.stringify({
			structure: "aggregate",
			function: "MAX",
			groupBy: true,
		}),
	},
	{
		topicId: 6,
		questionNumber: 1,
		questionText:
			"Write a SQL query that uses a subquery to find all employees who earn more than the average salary.",
		solution:
			"SELECT * FROM employees WHERE salary > (SELECT AVG(salary) FROM employees);",
		expectedResult: JSON.stringify({ structure: "subquery", type: "filter" }),
	},
	{
		topicId: 6,
		questionNumber: 2,
		questionText:
			"Write a SQL query with a subquery to find all products that have never been ordered.",
		solution:
			"SELECT * FROM products WHERE id NOT IN (SELECT product_id FROM order_items);",
		expectedResult: JSON.stringify({ structure: "subquery", type: "not in" }),
	},
];

// Function to initialize the database
const initDb = async () => {
	try {
		// First, ensure the database exists
		console.log(`Ensuring database ${process.env.APP_DB_NAME} exists...`);
		await createDatabase();

		// Run migrations
		console.log("Running database migrations...");
		await initializeDatabase();

		// Create topics
		console.log("Creating topics...");
		const createdTopics = await Topic.bulkCreate(topics);

		// Create questions with the correct topic IDs
		console.log("Creating questions...");
		const questionsWithTopicIds = questions.map((q) => ({
			...q,
			topicId: q.topicId,
		}));
		await Question.bulkCreate(questionsWithTopicIds);

		// Create a test user (if needed)
		if (process.env.NODE_ENV === "development") {
			console.log("Creating test user...");
			const passwordHash = await bcrypt.hash("password123", 10);
			await User.create({
				email: "test@university.edu",
				passwordHash,
			});
		}

		console.log("Database initialization completed successfully!");
	} catch (error) {
		console.error("Error initializing database:", error);
	}
};

// Run the initialization if this script is executed directly
if (require.main === module) {
	initDb();
}

module.exports = initDb;
