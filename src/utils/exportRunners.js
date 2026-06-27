"use strict";

const { Op } = require("sequelize");
const { User, Completion, Question, Topic, InteractionLog } = require("../models");
const { formatStudentName } = require("./exportHelpers");

const ATTEMPT_RATIO_WINDOW = 50;

function csvHeaders(headers) {
	return headers;
}

async function runMatrixExport({ studentWhere, topicId, summaryOnly, res, createCsvStringifier }) {
	const students = await User.findAll({
		where: studentWhere,
		attributes: ["id", "email", "firstName", "lastName", "code", "courseSection"],
		order: [["lastName", "ASC"], ["firstName", "ASC"]],
	});

	if (students.length === 0) {
		return { notFound: true };
	}

	const studentIds = students.map((student) => student.id);

	const completions = await Completion.findAll({
		where: { userId: { [Op.in]: studentIds } },
		attributes: ["userId", "questionId"],
	});

	const studentCompletions = new Map();
	completions.forEach((completion) => {
		if (!studentCompletions.has(completion.userId)) {
			studentCompletions.set(completion.userId, new Set());
		}
		studentCompletions.get(completion.userId).add(completion.questionId);
	});

	if (summaryOnly) {
		const headers = csvHeaders([
			{ id: "email", title: "Email" },
			{ id: "name", title: "Name" },
			{ id: "code", title: "Code" },
			{ id: "courseSection", title: "Course Section" },
			{ id: "completionCount", title: "Questions Completed" },
		]);

		const csvData = students.map((student) => ({
			email: student.email,
			name: formatStudentName(student),
			code: student.code || "Not set",
			courseSection: student.courseSection || "Not set",
			completionCount: studentCompletions.get(student.id)?.size || 0,
		}));

		return { headers, csvData, filenamePrefix: "completion-summary" };
	}

	const questionInclude = [{ model: Topic, as: "topic" }];
	if (topicId && topicId !== "all") {
		questionInclude[0].where = { id: topicId };
	}

	const questions = await Question.findAll({
		include: questionInclude,
		order: [
			[{ model: Topic, as: "topic" }, "name", "ASC"],
			["questionNumber", "ASC"],
		],
	});

	const headers = csvHeaders([
		{ id: "email", title: "Email" },
		{ id: "name", title: "Name" },
		{ id: "code", title: "Code" },
		{ id: "courseSection", title: "Course Section" },
	]);

	questions.forEach((question) => {
		const topicName = question.topic ? question.topic.name : "Unknown";
		headers.push({ id: `q${question.id}`, title: `${topicName} - Q${question.questionNumber}` });
	});

	const csvData = students.map((student) => {
		const row = {
			email: student.email,
			name: formatStudentName(student),
			code: student.code || "Not set",
			courseSection: student.courseSection || "Not set",
		};

		const completedQuestionIds = studentCompletions.get(student.id) || new Set();
		questions.forEach((question) => {
			row[`q${question.id}`] = completedQuestionIds.has(question.id) ? 1 : 0;
		});

		return row;
	});

	return { headers, csvData, filenamePrefix: "completions-matrix" };
}

async function runTopicSummaryExport({ studentWhere, topicIds }) {
	const students = await User.findAll({
		where: studentWhere,
		attributes: ["id", "email", "firstName", "lastName", "code"],
		order: [["lastName", "ASC"], ["firstName", "ASC"]],
	});

	if (students.length === 0) {
		return { notFound: true };
	}

	const topics = await Topic.findAll({
		where: { id: { [Op.in]: topicIds } },
		attributes: ["id", "name"],
		order: [["name", "ASC"]],
	});

	const topicQuestionCounts = {};
	for (const topic of topics) {
		topicQuestionCounts[topic.id] = await Question.count({ where: { topicId: topic.id } });
	}

	const studentIds = students.map((student) => student.id);

	const completions = await Completion.findAll({
		where: { userId: { [Op.in]: studentIds } },
		include: [
			{
				model: Question,
				as: "question",
				where: { topicId: { [Op.in]: topicIds } },
				attributes: ["id", "topicId"],
			},
		],
		attributes: ["userId", "questionId"],
	});

	const studentTopicCompletions = new Map();
	completions.forEach((completion) => {
		const userId = completion.userId;
		const topicId = completion.question.topicId;
		if (!studentTopicCompletions.has(userId)) {
			studentTopicCompletions.set(userId, new Map());
		}
		const topicMap = studentTopicCompletions.get(userId);
		topicMap.set(topicId, (topicMap.get(topicId) || 0) + 1);
	});

	const headers = csvHeaders([
		{ id: "email", title: "Email" },
		{ id: "name", title: "Name" },
		{ id: "code", title: "Code" },
	]);

	topics.forEach((topic) => {
		headers.push({ id: `topic_${topic.id}_completed`, title: `${topic.name} - Completed` });
		headers.push({ id: `topic_${topic.id}_total`, title: `${topic.name} - Total` });
	});
	headers.push({ id: "totalCompleted", title: "Total Completed" });
	headers.push({ id: "totalQuestions", title: "Total Questions" });

	const csvData = students.map((student) => {
		const row = {
			email: student.email,
			name: formatStudentName(student),
			code: student.code || "Not set",
		};

		let totalCompleted = 0;
		let totalQuestions = 0;

		const topicMap = studentTopicCompletions.get(student.id) || new Map();
		topics.forEach((topic) => {
			const completed = topicMap.get(topic.id) || 0;
			const total = topicQuestionCounts[topic.id] || 0;
			row[`topic_${topic.id}_completed`] = completed;
			row[`topic_${topic.id}_total`] = total;
			totalCompleted += completed;
			totalQuestions += total;
		});

		row.totalCompleted = totalCompleted;
		row.totalQuestions = totalQuestions;

		return row;
	});

	return { headers, csvData, filenamePrefix: "topic-completion-summary" };
}

async function runDetailedAttemptsExport({ studentWhere, topicIds }) {
	const students = await User.findAll({
		where: studentWhere,
		attributes: ["id", "email", "firstName", "lastName", "code", "courseSection"],
		order: [["lastName", "ASC"], ["firstName", "ASC"]],
	});

	if (students.length === 0) {
		return { notFound: true };
	}

	const questions = await Question.findAll({
		where: { topicId: { [Op.in]: topicIds } },
		include: [{ model: Topic, as: "topic", attributes: ["id", "name", "type"] }],
		order: [
			[{ model: Topic, as: "topic" }, "name", "ASC"],
			["questionNumber", "ASC"],
		],
	});

	if (questions.length === 0) {
		return { notFound: true };
	}

	const studentIds = students.map((student) => student.id);
	const questionIds = questions.map((question) => question.id);

	const completions = await Completion.findAll({
		where: {
			userId: { [Op.in]: studentIds },
			questionId: { [Op.in]: questionIds },
		},
		attributes: [
			"userId",
			"questionId",
			"completedAt",
			"aiScore",
			"adminScore",
			"status",
		],
	});

	const completionMap = new Map();
	completions.forEach((completion) => {
		completionMap.set(`${completion.userId}_${completion.questionId}`, completion);
	});

	const attempts = await InteractionLog.findAll({
		where: {
			userId: { [Op.in]: studentIds },
			questionId: { [Op.in]: questionIds },
			eventType: "query_attempt",
		},
		attributes: ["userId", "questionId", "eventData", "occurredAt"],
		order: [["occurredAt", "DESC"]],
	});

	const attemptsByPair = new Map();
	attempts.forEach((attempt) => {
		const key = `${attempt.userId}_${attempt.questionId}`;
		if (!attemptsByPair.has(key)) {
			attemptsByPair.set(key, []);
		}
		attemptsByPair.get(key).push(attempt);
	});

	const headers = csvHeaders([
		{ id: "email", title: "Email" },
		{ id: "name", title: "Name" },
		{ id: "code", title: "Code" },
		{ id: "courseSection", title: "Course Section" },
		{ id: "topicName", title: "Topic" },
		{ id: "questionNumber", title: "Question #" },
		{ id: "questionType", title: "Question Type" },
		{ id: "attemptCount", title: "Attempt Count" },
		{ id: "bestMatchPercent", title: "Best Match %" },
		{ id: "completed", title: "Completed" },
		{ id: "completedAt", title: "Completed At" },
		{ id: "aiScore", title: "AI Score" },
		{ id: "adminScore", title: "Admin Score" },
		{ id: "status", title: "Status" },
	]);

	const csvData = [];
	students.forEach((student) => {
		questions.forEach((question) => {
			const key = `${student.id}_${question.id}`;
			const completion = completionMap.get(key);
			const pairAttempts = attemptsByPair.get(key) || [];

			let bestMatchPercent = "";
			if (question.topic.type !== "data_model") {
				const ratioWindow = pairAttempts.slice(0, ATTEMPT_RATIO_WINDOW);
				const bestRatio = ratioWindow.reduce((best, attempt) => {
					const data = attempt.eventData || {};
					if (data.solutionRows > 0) {
						return Math.max(best, (data.studentRows || 0) / data.solutionRows);
					}
					return best;
				}, 0);
				if (ratioWindow.length > 0) {
					bestMatchPercent = Math.round(bestRatio * 100);
				}
			}

			csvData.push({
				email: student.email,
				name: formatStudentName(student),
				code: student.code || "Not set",
				courseSection: student.courseSection || "Not set",
				topicName: question.topic.name,
				questionNumber: question.questionNumber,
				questionType: question.topic.type,
				attemptCount: pairAttempts.length,
				bestMatchPercent,
				completed: completion ? 1 : 0,
				completedAt: completion ? new Date(completion.completedAt).toISOString() : "",
				aiScore: completion && completion.aiScore != null ? completion.aiScore : "",
				adminScore: completion && completion.adminScore != null ? completion.adminScore : "",
				status: completion ? completion.status : "",
			});
		});
	});

	return { headers, csvData, filenamePrefix: "detailed-question-attempts" };
}

module.exports = { runMatrixExport, runTopicSummaryExport, runDetailedAttemptsExport };
