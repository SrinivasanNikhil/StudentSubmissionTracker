const { sequelize } = require("../config/database");

// Import models
const User = require("./User")(sequelize);
const Topic = require("./Topic")(sequelize);
const Question = require("./Question")(sequelize);
const Completion = require("./Completion")(sequelize);
const InstructorCourseSection = require("./InstructorCourseSection")(sequelize);
const InteractionLog = require("./InteractionLog")(sequelize);
const InstructorSectionTopicSetting = require("./InstructorSectionTopicSetting")(sequelize);

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

// Re-export the models
module.exports = {
	User,
	Topic,
	Question,
	Completion,
	InstructorCourseSection,
	InteractionLog,
	InstructorSectionTopicSetting,
};
