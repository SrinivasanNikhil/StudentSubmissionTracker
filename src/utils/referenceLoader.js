const fs = require("fs").promises;
const path = require("path");
const { Topic, Question } = require("../models");

/**
 * Load all topics and questions from JSON files in the reference_files directory
 * Only updates topics and questions that are missing or have changed
 */
const loadReferenceData = async () => {
	try {
		const referenceDir = path.join(__dirname, "../reference_files");
		const files = await fs.readdir(referenceDir);
		const jsonFiles = files.filter((file) => file.endsWith(".json"));

		if (jsonFiles.length === 0) {
			console.log("No reference files found");
			return;
		}

		console.log(`Found ${jsonFiles.length} reference files`);

		// Get all existing topics and questions in a single query
		const existingTopics = await Topic.findAll({
			include: [
				{
					model: Question,
					as: "questions",
					attributes: [
						"id",
						"questionNumber",
						"questionText",
						"solution",
						"modelDescription",
						"expectedOutputs",
					],
				},
			],
		});

		// Create maps for quick lookups
		const existingTopicsMap = new Map(
			existingTopics.map((topic) => [topic.name, topic])
		);

		// Process files in parallel for better performance
		await Promise.all(
			jsonFiles.map(async (file) => {
				try {
					const filePath = path.join(referenceDir, file);
					const fileContent = await fs.readFile(filePath, "utf8");
					const data = JSON.parse(fileContent);

					// Determine database prefix and type
					const dbPrefix = file.startsWith("n_")
						? "Northwind: "
						: "ClassicModels: ";
					const topicName = dbPrefix + data.title;
					const topicType = data.type === "data model" ? "data_model" : "sql";

					// Check if topic exists
					let topic = existingTopicsMap.get(topicName);
					if (!topic) {
						// Create new topic
						topic = await Topic.create({
							name: topicName,
							database: data.database || "ClassicModels",
							type: topicType,
						});
						console.log(`Created new topic: ${topicName}`);
					} else if (
						topic.database !== data.database ||
						topic.type !== topicType
					) {
						// Update topic if database or type has changed
						await topic.update({
							database: data.database || topic.database,
							type: topicType,
						});
						console.log(`Updated database and type for topic: ${topicName}`);
					}

					// Create map of existing questions
					const existingQuestionsMap = new Map(
						topic.questions.map((q) => [q.questionNumber, q])
					);

					// Prepare bulk operations for questions
					const questionsToCreate = [];
					const questionsToUpdate = [];

					if (topicType === "sql") {
						// Process SQL questions
						for (const q of data.questions) {
							const existingQuestion = existingQuestionsMap.get(q.number);
							if (!existingQuestion) {
								questionsToCreate.push({
									topicId: topic.id,
									questionNumber: q.number,
									questionText: q.text,
									solution: q.solution_query,
									expectedResult: JSON.stringify({ database: data.database }),
								});
							} else if (
								existingQuestion.questionText !== q.text ||
								existingQuestion.solution !== q.solution_query
							) {
								questionsToUpdate.push({
									id: existingQuestion.id,
									questionText: q.text,
									solution: q.solution_query,
									expectedResult: JSON.stringify({ database: data.database }),
								});
							}
						}
					} else {
						// Process data model questions
						for (const [index, detail] of data.details.entries()) {
							const questionNumber = index + 1;
							const existingQuestion = existingQuestionsMap.get(questionNumber);

							const questionData = {
								topicId: topic.id,
								questionNumber: questionNumber,
								questionText: detail.scenario,
								modelDescription: detail.scenario,
								expectedOutputs: JSON.stringify(detail.Outputs),
							};

							if (!existingQuestion) {
								questionsToCreate.push(questionData);
							} else if (
								existingQuestion.questionText !== detail.scenario ||
								existingQuestion.modelDescription !== detail.scenario ||
								existingQuestion.expectedOutputs !==
									JSON.stringify(detail.Outputs)
							) {
								questionsToUpdate.push({
									id: existingQuestion.id,
									...questionData,
								});
							}
						}
					}

					// Perform bulk operations
					if (questionsToCreate.length > 0) {
						await Question.bulkCreate(questionsToCreate);
						console.log(
							`Created ${questionsToCreate.length} new questions for topic: ${topicName}`
						);
					}

					if (questionsToUpdate.length > 0) {
						await Promise.all(
							questionsToUpdate.map((q) =>
								Question.update(q, { where: { id: q.id } })
							)
						);
						console.log(
							`Updated ${questionsToUpdate.length} questions for topic: ${topicName}`
						);
					}

					console.log(
						`Processed ${
							data.questions?.length || data.details?.length
						} questions for topic ${topicName}`
					);
				} catch (error) {
					console.error(`Error processing file ${file}:`, error);
					throw error;
				}
			})
		);

		console.log("Reference data loading completed successfully");
	} catch (error) {
		console.error("Error loading reference data:", error);
		throw error;
	}
};

module.exports = { loadReferenceData };
