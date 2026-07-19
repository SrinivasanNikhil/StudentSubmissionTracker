/**
 * Repair broken reference solutions found by the 2026-07-18 sweep (see
 * verify-solutions.js). Eleven stored solution queries fail to execute, which —
 * combined with compareQueries not checking solutionResult.success — showed
 * students the misleading "expected solution returns 0 rows and 0 columns".
 *
 * DRY-RUN BY DEFAULT — prints old -> new and validates each corrected query by
 * executing it (must succeed) before anything is written. Nothing is written
 * unless --apply is passed.
 *
 * Usage:
 *   node src/scripts/fix-broken-solutions.js                 # dry-run all
 *   node src/scripts/fix-broken-solutions.js --only 724,729  # subset
 *   node src/scripts/fix-broken-solutions.js --apply         # write all
 *   node src/scripts/fix-broken-solutions.js --only 724 --apply
 *
 * Fix categories:
 *  - Whitespace corruption (lost newlines glued tokens): 729, 730, 731
 *  - Missing join in outer query: 724, and 560/563/564/565 use the real
 *    Northwind table name `Order Details` (aliased so the rest is unchanged)
 *  - Schema-impossible questions (column doesn't exist in the practice DB):
 *    570, 572, 627 — these REWRITE the question text minimally to preserve the
 *    pedagogical intent using columns that actually exist.
 */

const { Sequelize } = require("sequelize");
const { sequelize } = require("../config/database");
const { executeQuery } = require("../services/sqlExecutor");

const FIXES = {
	// --- ClassicModels – General Queries (topic 50) ---
	724: {
		note: "outer query referenced buyPrice without joining Products",
		solution:
			"SELECT customerName, FORMAT(SUM(quantityOrdered*(priceEach-buyPrice)),0) AS Profit, FORMAT(SUM(quantityOrdered*(priceEach-buyPrice))/(SELECT SUM(quantityOrdered*(priceEach-buyPrice)) FROM Customers JOIN Orders ON Customers.customerNumber = Orders.customerNumber JOIN OrderDetails ON Orders.orderNumber = OrderDetails.orderNumber JOIN Products ON Products.productCode = OrderDetails.productCode)*100,2) AS Percent FROM Customers JOIN Orders ON Customers.customerNumber = Orders.customerNumber JOIN OrderDetails ON Orders.orderNumber = OrderDetails.orderNumber JOIN Products ON Products.productCode = OrderDetails.productCode GROUP BY customerName ORDER BY Percent DESC",
	},
	729: {
		note: "lost whitespace: 'productCodeORDER BY'",
		solution:
			"SELECT productName, format(t2003.OrderValue,0) AS Y2003, format(t2004.OrderValue,0) AS Y2004, FORMAT(t2004.OrderValue/t2003.OrderValue,2) as Ratio FROM (SELECT productName, Products.productCode, sum(quantityOrdered*priceEach) AS OrderValue FROM Orders JOIN OrderDetails ON Orders.`orderNumber` = OrderDetails.`orderNumber` JOIN Products ON OrderDetails.productCode = Products.productCode WHERE YEAR(orderDate) = 2003 GROUP BY Products.productCode) as t2003 JOIN (SELECT Products.productCode, sum(quantityOrdered*priceEach) AS OrderValue FROM Orders JOIN OrderDetails ON Orders.`orderNumber` = OrderDetails.`orderNumber` JOIN Products ON OrderDetails.productCode = Products.productCode WHERE YEAR(orderDate) = 2004 GROUP BY Products.productCode) AS t2004 ON t2003.productCode = t2004.productCode ORDER BY t2004.OrderValue/t2003.OrderValue DESC",
	},
	730: {
		note: "lost whitespace: 'asY2004' and 'customerNumberorder by'",
		solution:
			"SELECT t2003.customerName as `Customer name`, format(t2003.Payments,0) as Y2003, format(t2004.Payments,0) as Y2004, FORMAT(t2004.Payments/t2003.Payments,2) as Ratio FROM (SELECT customerName, Customers.customerNumber, sum(amount) as Payments FROM Customers JOIN Payments ON Customers.`customerNumber` = Payments.customerNumber WHERE YEAR(paymentDate) = 2003 GROUP BY Customers.customerNumber) as t2003 JOIN (SELECT customerName, Customers.customerNumber, sum(amount) as Payments FROM Customers JOIN Payments ON Customers.`customerNumber` = Payments.customerNumber WHERE YEAR(paymentDate) = 2004 GROUP BY Customers.customerNumber) as t2004 ON t2003.customerNumber = t2004.customerNumber ORDER BY t2004.Payments/t2003.Payments DESC",
	},
	731: {
		note: "lost whitespace: '2003AND'",
		solution:
			"SELECT productName FROM Products JOIN OrderDetails ON Products.productCode = OrderDetails.productCode JOIN Orders ON Orders.orderNumber = OrderDetails.orderNumber WHERE YEAR(orderDate) = 2003 AND Products.productCode NOT IN (SELECT Products.productCode FROM Products JOIN OrderDetails ON Products.productCode = OrderDetails.productCode JOIN Orders ON Orders.orderNumber = OrderDetails.orderNumber WHERE YEAR(orderDate) = 2004)",
	},

	// --- Northwind – Join, Group By and Having: real table name is `Order Details` ---
	560: {
		note: "Northwind table is `Order Details` (with space); aliased to keep query unchanged",
		solution:
			"SELECT Orders.OrderID, Orders.OrderDate, COUNT(OrderDetails.ProductID) AS ProductCount FROM Orders JOIN `Order Details` AS OrderDetails ON Orders.OrderID = OrderDetails.OrderID GROUP BY Orders.OrderID, Orders.OrderDate",
	},
	563: {
		note: "Northwind table is `Order Details`",
		solution:
			"SELECT OrderDetails.OrderID, SUM(OrderDetails.Quantity) AS TotalQuantity FROM `Order Details` AS OrderDetails GROUP BY OrderDetails.OrderID HAVING SUM(OrderDetails.Quantity) > 10",
	},
	564: {
		note: "Northwind table is `Order Details`",
		solution:
			"SELECT Orders.OrderID, Orders.CustomerID, SUM(OrderDetails.UnitPrice * OrderDetails.Quantity) AS TotalPrice FROM Orders JOIN `Order Details` AS OrderDetails ON Orders.OrderID = OrderDetails.OrderID GROUP BY Orders.OrderID, Orders.CustomerID HAVING SUM(OrderDetails.UnitPrice * OrderDetails.Quantity) > 500",
	},
	565: {
		note: "Northwind table is `Order Details`",
		solution:
			"SELECT Employees.EmployeeID, SUM(OrderDetails.UnitPrice * OrderDetails.Quantity) AS TotalSales FROM Employees JOIN Orders ON Employees.EmployeeID = Orders.EmployeeID JOIN `Order Details` AS OrderDetails ON Orders.OrderID = OrderDetails.OrderID GROUP BY Employees.EmployeeID ORDER BY TotalSales DESC",
	},

	// --- Schema-impossible questions: minimal question-text rewrite required ---
	570: {
		note: "Northwind Customers has no CreditLimit column — rewrite preserving 'filter' intent",
		questionText:
			"List the CustomerID, CompanyName, and Fax for customers that have no fax number on file.",
		solution: "SELECT CustomerID, CompanyName, Fax FROM Customers WHERE Fax IS NULL",
	},
	572: {
		note: "Northwind Orders has no Status column — 'pending' maps to not-yet-shipped",
		questionText:
			"List the OrderID, OrderDate, and ShippedDate for all orders that have not yet been shipped.",
		solution:
			"SELECT OrderID, OrderDate, ShippedDate FROM Orders WHERE ShippedDate IS NULL",
	},
	627: {
		note: "ClassicModels Products has no on-order column — rewrite preserving the OR-condition intent",
		questionText:
			"List the productCode, productName, and quantityInStock for products with either no units in stock or a buy price under $20.",
		solution:
			"SELECT productCode, productName, quantityInStock FROM Products WHERE quantityInStock = 0 OR buyPrice < 20",
	},
};

function parseArgs(argv) {
	const args = { apply: false, only: null };
	for (let i = 2; i < argv.length; i++) {
		if (argv[i] === "--apply") args.apply = true;
		else if (argv[i] === "--only") {
			args.only = argv[++i].split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
		}
	}
	return args;
}

(async () => {
	try {
		const args = parseArgs(process.argv);
		const ids = Object.keys(FIXES).map(Number).filter((id) => !args.only || args.only.includes(id));
		if (ids.length === 0) {
			console.log("No matching fix ids. Known ids:", Object.keys(FIXES).join(", "));
			process.exit(1);
		}

		const rows = await sequelize.query(
			"SELECT q.id, q.question_number qn, q.question_text, q.solution, t.name tname, t.`database` dbname FROM questions q JOIN topics t ON t.id=q.topic_id WHERE q.id IN (:ids)",
			{ replacements: { ids }, type: Sequelize.QueryTypes.SELECT }
		);
		const byId = new Map(rows.map((r) => [r.id, r]));

		let ok = 0, failed = 0;
		const applied = [];
		for (const id of ids) {
			const fix = FIXES[id];
			const row = byId.get(id);
			if (!row) { console.log(`id=${id}: NOT FOUND in DB — skipping`); failed++; continue; }

			console.log("=".repeat(90));
			console.log(`id=${id}  ${row.tname}  Q${row.qn}  — ${fix.note}`);
			if (fix.questionText) {
				console.log(`  OLD QUESTION: ${row.question_text.replace(/\s+/g, " ").slice(0, 140)}`);
				console.log(`  NEW QUESTION: ${fix.questionText}`);
			}
			console.log(`  OLD SOLUTION: ${(row.solution || "").replace(/\s+/g, " ").slice(0, 140)}...`);
			console.log(`  NEW SOLUTION: ${fix.solution.replace(/\s+/g, " ").slice(0, 140)}...`);

			// Validate: the corrected solution must execute successfully.
			const result = await executeQuery(fix.solution, row.dbname);
			if (!result.success) {
				console.log(`  VALIDATION FAILED: ${result.message} — will NOT write this fix`);
				failed++;
				continue;
			}
			console.log(`  VALIDATION OK: ${result.rows} rows, ${result.columns.length} columns`);
			if (result.rows === 0) {
				console.log("  WARNING: corrected solution returns 0 rows — double-check intent");
			}
			ok++;

			if (args.apply) {
				const sets = ["solution = :solution"];
				const repl = { solution: fix.solution, id };
				if (fix.questionText) { sets.push("question_text = :qt"); repl.qt = fix.questionText; }
				await sequelize.query(
					`UPDATE questions SET ${sets.join(", ")} WHERE id = :id`,
					{ replacements: repl, type: Sequelize.QueryTypes.UPDATE }
				);
				applied.push(id);
			}
		}

		console.log("=".repeat(90));
		console.log(`${ok} validated, ${failed} failed validation.`);
		if (args.apply) {
			console.log(`APPLIED ${applied.length} fix(es): [${applied.join(", ")}]`);
		} else {
			console.log("DRY RUN — nothing written. Re-run with --apply to write the validated fixes.");
		}
		process.exit(failed > 0 ? 1 : 0);
	} catch (err) {
		console.error("fix-broken-solutions failed:", err.message);
		process.exit(1);
	}
})();
