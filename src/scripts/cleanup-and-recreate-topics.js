require("dotenv").config();
const fs = require("fs").promises;
const path = require("path");
const { sequelize } = require("../config/database");
const { Topic, Question, Completion } = require("../models");

/**
 * Comprehensive cleanup and recreation script for topics and questions
 * This script will:
 * 1. Clear all existing topics, questions, and completions
 * 2. Read all JSON files from reference_files directory
 * 3. Create new topics with correct names from title field
 * 4. Create questions for each topic
 * 5. Handle both SQL and data model question types
 */

const loadReferenceData = async () => {
	try {
		console.log("🔄 Starting comprehensive cleanup and recreation process...");

		// Step 1: Clear all existing data
		console.log("🗑️  Clearing existing topics, questions, and completions...");

		// Clear completions first (due to foreign key constraints)
		await Completion.destroy({ where: {} });
		console.log("✅ Cleared all completions");

		// Clear questions
		await Question.destroy({ where: {} });
		console.log("✅ Cleared all questions");

		// Clear topics
		await Topic.destroy({ where: {} });
		console.log("✅ Cleared all topics");

		console.log("🧹 Database cleanup completed successfully");

		// Step 2: Read all reference files
		console.log("\n📁 Reading reference files...");
		const referenceDir = path.join(__dirname, "../reference_files");
		const files = await fs.readdir(referenceDir);
		const jsonFiles = files.filter(
			(file) => file.endsWith(".json") && !file.startsWith(".")
		);

		console.log(`📋 Found ${jsonFiles.length} reference files:`, jsonFiles);

		// Step 3: Process each reference file
		let totalTopics = 0;
		let totalQuestions = 0;

		for (const file of jsonFiles) {
			try {
				console.log(`\n📖 Processing file: ${file}`);

				const filePath = path.join(referenceDir, file);
				const fileContent = await fs.readFile(filePath, "utf8");
				const data = JSON.parse(fileContent);

				// Validate required fields
				if (!data.title || !data.type) {
					console.log(
						`⚠️  Skipping ${file}: Missing required fields (title or type)`
					);
					continue;
				}

				// Determine database from data or filename
				let database = data.database || "ClassicModels";

				// Create topic
				const topic = await Topic.create({
					name: data.title,
					type: data.type === "data model" ? "data_model" : "sql",
					database: database,
				});

				console.log(
					`✅ Created topic: "${data.title}" (${data.type}) - Database: ${database}`
				);
				totalTopics++;

				// Create questions if they exist
				if (data.questions && Array.isArray(data.questions)) {
					const questions = [];

					for (const q of data.questions) {
						if (q.number && q.text) {
							const questionData = {
								topicId: topic.id,
								questionNumber: q.number,
								questionText: q.text,
								solution: q.solution_query || null,
								expectedResult: JSON.stringify({ database: database }),
								expectedOutputs:
									data.type === "data model"
										? JSON.stringify(data.details || [])
										: null,
								modelDescription:
									data.type === "data model"
										? JSON.stringify(data.details || [])
										: null,
								baseEntities:
									data.type === "data model"
										? JSON.stringify(data.details || [])
										: null,
								baseRelationships:
									data.type === "data model"
										? JSON.stringify(data.details || [])
										: null,
							};

							questions.push(questionData);
						}
					}

					if (questions.length > 0) {
						await Question.bulkCreate(questions);
						console.log(
							`✅ Created ${questions.length} questions for topic: ${data.title}`
						);
						totalQuestions += questions.length;
					}
				} else if (data.type === "data model") {
					// For data model questions without explicit questions array, create a single question
					const questionData = {
						topicId: topic.id,
						questionNumber: 1,
						questionText: `Create a data model for: ${data.title}`,
						solution: null,
						expectedResult: JSON.stringify({ database: database }),
						expectedOutputs: JSON.stringify(data.details || []),
						modelDescription: JSON.stringify(data.details || []),
						baseEntities: JSON.stringify(data.details || []),
						baseRelationships: JSON.stringify(data.details || []),
					};

					await Question.create(questionData);
					console.log(
						`✅ Created data model question for topic: ${data.title}`
					);
					totalQuestions++;
				}
			} catch (error) {
				console.error(`❌ Error processing ${file}:`, error.message);
			}
		}

		console.log(`\n🎉 Process completed successfully!`);
		console.log(`📊 Summary:`);
		console.log(`   - Topics created: ${totalTopics}`);
		console.log(`   - Questions created: ${totalQuestions}`);
		console.log(`   - Reference files processed: ${jsonFiles.length}`);

		// Verify the results
		const finalTopicCount = await Topic.count();
		const finalQuestionCount = await Question.count();
		const finalCompletionCount = await Completion.count();

		console.log(`\n🔍 Verification:`);
		console.log(`   - Topics in database: ${finalTopicCount}`);
		console.log(`   - Questions in database: ${finalQuestionCount}`);
		console.log(`   - Completions in database: ${finalCompletionCount}`);

		if (
			finalTopicCount === totalTopics &&
			finalQuestionCount === totalQuestions &&
			finalCompletionCount === 0
		) {
			console.log(`\n✅ All data verified successfully!`);
		} else {
			console.log(`\n⚠️  Data verification mismatch detected`);
		}
	} catch (error) {
		console.error("❌ Fatal error during cleanup and recreation:", error);
		throw error;
	}
};

// Run the script if executed directly
if (require.main === module) {
	loadReferenceData()
		.then(() => {
			console.log("\n🚀 Script completed successfully!");
			process.exit(0);
		})
		.catch((error) => {
			console.error("\n💥 Script failed:", error);
			process.exit(1);
		});
}

module.exports = loadReferenceData;
