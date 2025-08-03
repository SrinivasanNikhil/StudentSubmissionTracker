"use strict";
const { Model, DataTypes } = require("sequelize");

module.exports = (sequelize) => {
	class InstructorCourseSection extends Model {
		static associate(models) {
			InstructorCourseSection.belongsTo(models.User, {
				foreignKey: "instructorId",
				as: "instructor",
			});
		}

		// Helper method to get full course section identifier
		getFullSectionIdentifier() {
			return `${this.courseCode}-${this.sectionCode}`;
		}

		// Helper method to get display name
		getDisplayName() {
			return `${this.courseCode} ${this.sectionCode} - ${this.courseName} (${this.semester} ${this.academicYear})`;
		}

		// Static method to get current academic year
		static getCurrentAcademicYear() {
			const now = new Date();
			const year = now.getFullYear();
			const month = now.getMonth() + 1; // 0-indexed

			// Academic year typically runs from August to July
			// If we're in January-July, use previous year as start
			if (month >= 1 && month <= 7) {
				return `${year - 1}-${year}`;
			} else {
				return `${year}-${year + 1}`;
			}
		}

		// Static method to get current semester
		static getCurrentSemester() {
			const now = new Date();
			const month = now.getMonth() + 1; // 0-indexed

			if (month >= 8 && month <= 12) {
				return "Fall";
			} else if (month >= 1 && month <= 4) {
				return "Spring";
			} else if (month >= 5 && month <= 7) {
				return "Summer";
			} else {
				return "Fall"; // Default fallback
			}
		}
	}

	InstructorCourseSection.init(
		{
			instructorId: {
				type: DataTypes.INTEGER,
				allowNull: false,
				field: "instructor_id",
				references: {
					model: "users",
					key: "id",
				},
				comment: "ID of the instructor",
			},
			courseCode: {
				type: DataTypes.STRING(20),
				allowNull: false,
				field: "course_code",
				comment: "Course code (e.g., 'CS101', 'CS201')",
			},
			courseName: {
				type: DataTypes.STRING(255),
				allowNull: false,
				field: "course_name",
				comment: "Course name (e.g., 'Introduction to Databases')",
			},
			sectionCode: {
				type: DataTypes.STRING(20),
				allowNull: false,
				field: "section_code",
				comment: "Section code (e.g., 'A', 'B', '01')",
			},
			academicYear: {
				type: DataTypes.STRING(20),
				allowNull: false,
				field: "academic_year",
				comment: "Academic year (e.g., '2024-2025')",
			},
			semester: {
				type: DataTypes.ENUM("Fall", "Spring", "Summer", "Winter"),
				allowNull: false,
				comment: "Semester",
			},
			isActive: {
				type: DataTypes.BOOLEAN,
				defaultValue: true,
				field: "is_active",
				comment: "Whether this course section is currently active",
			},
		},
		{
			sequelize,
			modelName: "InstructorCourseSection",
			tableName: "instructor_course_sections",
			timestamps: true,
			underscored: true,
		}
	);

	return InstructorCourseSection;
};
