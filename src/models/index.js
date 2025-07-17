const { sequelize } = require("../config/database");

// Import models
const User = require("./User")(sequelize);
const Topic = require("./Topic")(sequelize);
const Question = require("./Question")(sequelize);
const Completion = require("./Completion")(sequelize);

// Define associations between models
Topic.hasMany(Question, { foreignKey: "topicId", as: "questions" });
Question.belongsTo(Topic, { foreignKey: "topicId", as: "topic" });

User.hasMany(Completion, { foreignKey: "userId", as: "completions" });
Completion.belongsTo(User, { foreignKey: "userId", as: "user" });

Question.hasMany(Completion, { foreignKey: "questionId", as: "completions" });
Completion.belongsTo(Question, { foreignKey: "questionId", as: "question" });

// Re-export the models
module.exports = {
	User,
	Topic,
	Question,
	Completion,
};
