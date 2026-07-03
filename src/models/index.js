const { sequelize } = require("../config/database");

// Import models
const User = require("./User")(sequelize);
const Topic = require("./Topic")(sequelize);
const Question = require("./Question")(sequelize);
const Completion = require("./Completion")(sequelize);
const InstructorCourseSection = require("./InstructorCourseSection")(sequelize);
const InteractionLog = require("./InteractionLog")(sequelize);
const InstructorSectionTopicSetting = require("./InstructorSectionTopicSetting")(sequelize);
const InstructorSectionCreditSetting = require("./InstructorSectionCreditSetting")(sequelize);
const StudentCreditBalance = require("./StudentCreditBalance")(sequelize);
const CreditTransaction = require("./CreditTransaction")(sequelize);
const CreditRequest = require("./CreditRequest")(sequelize);

// Define associations between models
Topic.hasMany(Question, { foreignKey: "topicId", as: "questions" });
Question.belongsTo(Topic, { foreignKey: "topicId", as: "topic" });

User.hasMany(Completion, { foreignKey: "userId", as: "completions" });
Completion.belongsTo(User, { foreignKey: "userId", as: "user" });

Question.hasMany(Completion, { foreignKey: "questionId", as: "completions" });
Completion.belongsTo(Question, { foreignKey: "questionId", as: "question" });

// Instructor course section associations
User.hasMany(InstructorCourseSection, {
	foreignKey: "instructorId",
	as: "courseSections",
});
InstructorCourseSection.belongsTo(User, {
	foreignKey: "instructorId",
	as: "instructor",
});

// User model associations (instructor-student relationship)
User.hasMany(User, {
	foreignKey: "associatedInstructorId",
	as: "students",
});
User.belongsTo(User, {
	foreignKey: "associatedInstructorId",
	as: "instructor",
});

// InteractionLog associations
InteractionLog.belongsTo(User, { foreignKey: "userId" });
InteractionLog.belongsTo(Question, { foreignKey: "questionId" });

// InstructorSectionTopicSetting associations
InstructorCourseSection.hasMany(InstructorSectionTopicSetting, {
	foreignKey: "instructorCourseSectionId",
	as: "topicSettings",
});
InstructorSectionTopicSetting.belongsTo(InstructorCourseSection, {
	foreignKey: "instructorCourseSectionId",
	as: "section",
});
Topic.hasMany(InstructorSectionTopicSetting, {
	foreignKey: "topicId",
	as: "sectionSettings",
});
InstructorSectionTopicSetting.belongsTo(Topic, {
	foreignKey: "topicId",
	as: "topic",
});

// InstructorSectionCreditSetting associations
InstructorCourseSection.hasOne(InstructorSectionCreditSetting, {
	foreignKey: "instructorCourseSectionId",
	as: "creditSetting",
});
InstructorSectionCreditSetting.belongsTo(InstructorCourseSection, {
	foreignKey: "instructorCourseSectionId",
	as: "section",
});

// StudentCreditBalance associations
User.hasMany(StudentCreditBalance, { foreignKey: "userId", as: "creditBalances" });
StudentCreditBalance.belongsTo(User, { foreignKey: "userId", as: "student" });
InstructorCourseSection.hasMany(StudentCreditBalance, {
	foreignKey: "instructorCourseSectionId",
	as: "creditBalances",
});
StudentCreditBalance.belongsTo(InstructorCourseSection, {
	foreignKey: "instructorCourseSectionId",
	as: "section",
});

// CreditTransaction associations
User.hasMany(CreditTransaction, { foreignKey: "userId", as: "creditTransactions" });
CreditTransaction.belongsTo(User, { foreignKey: "userId", as: "student" });
Question.hasMany(CreditTransaction, { foreignKey: "questionId", as: "creditTransactions" });
CreditTransaction.belongsTo(Question, { foreignKey: "questionId", as: "question" });
InstructorCourseSection.hasMany(CreditTransaction, {
	foreignKey: "instructorCourseSectionId",
	as: "creditTransactions",
});
CreditTransaction.belongsTo(InstructorCourseSection, {
	foreignKey: "instructorCourseSectionId",
	as: "section",
});

// CreditRequest associations
User.hasMany(CreditRequest, { foreignKey: "userId", as: "creditRequests" });
CreditRequest.belongsTo(User, { foreignKey: "userId", as: "student" });
User.hasMany(CreditRequest, { foreignKey: "resolvedByUserId", as: "resolvedCreditRequests" });
CreditRequest.belongsTo(User, { foreignKey: "resolvedByUserId", as: "resolvedBy" });
InstructorCourseSection.hasMany(CreditRequest, {
	foreignKey: "instructorCourseSectionId",
	as: "creditRequests",
});
CreditRequest.belongsTo(InstructorCourseSection, {
	foreignKey: "instructorCourseSectionId",
	as: "section",
});
CreditRequest.hasMany(CreditTransaction, { foreignKey: "creditRequestId", as: "transactions" });
CreditTransaction.belongsTo(CreditRequest, { foreignKey: "creditRequestId", as: "creditRequest" });

// Re-export the models
module.exports = {
	User,
	Topic,
	Question,
	Completion,
	InstructorCourseSection,
	InteractionLog,
	InstructorSectionTopicSetting,
	InstructorSectionCreditSetting,
	StudentCreditBalance,
	CreditTransaction,
	CreditRequest,
};
