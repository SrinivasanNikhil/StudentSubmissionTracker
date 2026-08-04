# Student Submission Tracker

A comprehensive web application designed to help university students track and manage their course submissions, with advanced features for students, instructors, and administrators. The application leverages cutting-edge AI technology to provide intelligent SQL query analysis and automated ER diagram evaluation, along with comprehensive semester tracking and multi-role user management.

## Features

### Student Features

- **User Authentication**: Secure login and registration system with role-based access (student/instructor/admin)
- **Password Reset**: Secure password reset functionality with email verification and token-based authentication
- **SQL Practice**: Interactive SQL question practice with real-time query execution
- **Fuzzy Completion**: Questions are marked complete when the row count, the column count, **and** the column names all match. Column-name matching is fuzzy (alias and ordering differences are tolerated), but selecting genuinely different columns still fails
- **Solution Unlock**: The reference solution and AI comparison stay hidden until one of two paths is met (or the question is already completed):
  - **Proximity** — ≥ 5 attempts, and one attempt got the correct **column count** *and* landed within 25% of the expected row count. The row score is symmetric, so returning far *more* rows than expected scores as poorly as too few — a broad `SELECT *` cannot unlock anything.
  - **Effort fallback** — ≥ 10 **distinct**, successfully executed, non-`SELECT *` queries, so a genuinely stuck student is never permanently locked out. Repeating one query counts once.
- **Due Date Awareness**: Topics with deadlines show warning/danger badges. Instructors can set a **grace period**; a correct answer submitted after the due date but still inside the grace window is recorded normally. Once the grace window closes the query still executes but no completion is recorded. Deadlines are stored as true UTC instants and displayed in the course timezone with an explicit label (e.g. "Jul 9, 2026, 11:59 PM EDT")
- **Assignment/Practice Badges**: Each topic shows whether it's classified as a graded Assignment or ungraded Practice for the student's course section, on both the topics list and the question list
- **ER Diagram Submissions**: Upload and submit ER diagrams for data modeling questions
- **Progress Tracking**: Monitor completion status across all topics and question types
- **Student Dashboard**: View submitted diagrams and instructor feedback
- **Profile Management**: Update personal information and track individual progress
- **Course Section Self-Service**: Students set their own course section, or switch between their instructor's active sections. A section cannot be *cleared* once set (deadline and visibility enforcement depend on it), and every change is recorded in an audit trail for the instructor
- **AI Feedback Credits**: On-demand AI feedback is metered. Students in a section draw on an instructor-configured balance and can request more; students without a section get a default per-term allowance
- **Semester Integration**: Automatic semester and academic year tracking for all submissions
- **Course Section Association**: Register with specific instructor course sections

### Instructor Features

- **Instructor Dashboard**: Comprehensive dashboard for course and student management
- **Course Section Management**: Create and manage multiple course sections per semester
- **Per-Section Topic Settings**: Control which topics are visible to each course section, set per-topic due dates, and classify each topic as Assignment (graded) or Practice (ungraded) — managed via a dedicated settings page accessible from the Course Sections list
- **Student Enrollment Tracking**: View students enrolled in each course section
- **Semester-Based Organization**: Organize courses by academic year and semester
- **Progress Monitoring**: Track student progress across all course sections
- **Export Center**: Single page offering Topic Completion Summary, Detailed Question Attempts, Student Completion Matrix, and ER Diagram Submissions exports, all filterable by academic year, semester, and course section
- **Instructor Code System**: Unique instructor codes for student registration

### Administrator Features

- **Comprehensive Admin Dashboard**: Complete administrative control panel with role-based statistics
- **Enhanced User Management**: View and manage all user accounts with detailed role information
- **Advanced Instructor Management**: Comprehensive instructor oversight with course section details
- **ER Diagram Review**: Review submitted ER diagrams with AI evaluation assistance
- **AI-Powered Evaluation**: Automated ER diagram analysis using OpenAI `gpt-4o` (vision)
- **Manual Review Tools**: Copy AI evaluations to admin review fields for human oversight
- **Submission Analytics**: Track submission patterns and completion rates
- **Semester-Based Reporting**: Export and analyze data by academic year, semester, and course section
- **Multi-Role User System**: Manage students, instructors, and administrators with granular permissions

### AI-Powered Features

- **🤖 Intelligent SQL Query Analysis**: AI-powered query comparison and feedback using OpenAI `gpt-4.1-nano`
- **🔍 Automated ER Diagram Evaluation**: Advanced computer vision analysis using OpenAI `gpt-4o` (vision)
- **📊 Smart Query Validation**: Real-time SQL query analysis with detailed feedback and suggestions
- **📈 Intelligent Scoring System**: Automated 0-10 scoring with comprehensive feedback
- **🔄 AI-Assisted Review Process**: Streamlined admin review with AI-generated evaluations

### Advanced Features

- **File Upload System**: Secure PNG file upload for ER diagrams with validation
- **Real-time SQL Execution**: Execute SQL queries against multiple databases
- **Responsive Design**: Mobile-friendly interface using Bootstrap 5
- **Session Management**: Secure session handling persisted to the MySQL application database via `connect-session-sequelize`
- **Password Security**: Advanced password validation with strength requirements
- **Role-Based Access Control**: Granular permissions for students, instructors, and administrators

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MySQL (all tiers)
- **Frontend**: EJS templates, Bootstrap 5, JavaScript
- **Authentication**: Session-based, with `bcryptjs` password hashing and CSRF protection
- **File Upload**: Multer for secure file handling
- **🤖 AI Integration**: OpenAI API — `gpt-4.1-nano` for SQL feedback and comparison, `gpt-4o` for data-model grading and ER-diagram vision scoring
- **ORM**: Sequelize for database operations
- **Email**: Nodemailer for password reset notifications
- **Migration System**: Umzug for database schema management

## Installation

1. **Clone the repository**:

   ```bash
   git clone <repository-url>
   cd StudentSubmissionTracker
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env` file in the root directory:

   ```
   # Server Configuration
   PORT=3000
   NODE_ENV=development
   SESSION_SECRET=your_session_secret_here
   APP_URL=http://localhost:3000

   # Database Configuration
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   DB_NAME=ClassicModels

   # Application Database
   APP_DB_HOST=localhost
   APP_DB_PORT=3306
   APP_DB_USER=your_app_db_user
   APP_DB_PASSWORD=your_app_db_password
   APP_DB_NAME=SQLPracticeApp

   # OpenAI Configuration
   OPENAI_API_KEY=your_openai_api_key_here

   # Email Configuration (for password reset)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your_email@gmail.com
   SMTP_PASS=your_app_password
   SMTP_FROM=your_email@gmail.com

   # Production Settings
   TRUST_PROXY=false
   HTTPS=off
   ```

4. **Initialize the database**:

   ```bash
   npm run init-db
   ```

5. **Start the application**:

   ```bash
   npm start
   ```

   For development with auto-reload:

   ```bash
   npm run dev
   ```

6. **Access the application**:
   Open your browser and navigate to `http://localhost:3000`

## Project Structure

```
StudentSubmissionTracker/
├── src/
│   ├── config/              # Database and application configuration
│   ├── controllers/         # Business logic controllers
│   ├── middleware/          # Authentication and session middleware
│   ├── migrations/          # Database migration files
│   ├── models/              # Sequelize models
│   ├── public/              # Uploaded files (ER diagrams)
│   ├── reference_files/     # Reference data for questions
│   ├── routes/              # Express routes
│   ├── scripts/             # Utility scripts
│   ├── services/            # External service integrations
│   ├── utils/               # Helper functions
│   ├── views/               # EJS templates
│   │   ├── pages/          # Main page templates
│   │   │   ├── admin/      # Admin-specific templates
│   │   │   └── instructor/ # Instructor-specific templates
│   │   ├── layouts/        # Layout templates
│   │   └── partials/       # Reusable template components
│   ├── app.js              # Main application setup
│   └── server.js           # Server entry point
├── public/                  # Static assets (CSS, JS, images)
└── package.json            # Project dependencies and scripts
```

## Key Features Breakdown

### Authentication System

- **Secure Registration**: Email validation, password strength requirements
- **Session Management**: Secure session handling with automatic cleanup
- **Password Reset**: Token-based password reset with email verification
- **Role-Based Access**: Student, instructor, and administrator role management
- **Instructor Code System**: Unique codes for instructor identification

### SQL Practice System

- **Interactive Query Execution**: Students can write and execute SQL queries
- **Multiple Databases**: Support for ClassicModels and Northwind databases
- **Real-time Feedback**: Immediate query results and error handling
- **Progress Tracking**: Automatic completion tracking for correct solutions
- **🤖 AI-Powered Query Analysis**: Intelligent query comparison and feedback using OpenAI `gpt-4.1-nano`
- **📊 Smart Query Validation**: Real-time analysis with detailed suggestions and improvements

### ER Diagram Submission System

- **File Upload**: Secure PNG file upload with validation
- **Student Enhancements**: Students explain modifications to base scenarios
- **AI Tool Reflection**: Students reflect on AI tool usage in their work
- **Student View**: Dedicated page for students to view their submissions
- **🔍 AI-Powered Diagram Analysis**: Advanced computer vision evaluation using OpenAI `gpt-4o` (vision)
- **📈 Automated Scoring**: Intelligent 0-10 scoring with detailed feedback

### AI Evaluation System

- **🤖 Automated Analysis**: OpenAI `gpt-4o` (vision) analyzes ER diagrams with advanced computer vision
- **📈 Intelligent Scoring System**: Automated 0-10 scoring with comprehensive feedback
- **🔄 AI-Assisted Review Process**: Streamlined admin review with AI-generated evaluations
- **📊 Detailed Feedback**: Comprehensive analysis including strengths, weaknesses, and improvement suggestions
- **🔍 Visual Understanding**: AI interprets diagram elements, relationships, and design patterns

### Admin Review System

- **Manual Evaluation**: Admins can provide human oversight and final assessment
- **🤖 AI Assistance**: Copy AI evaluations to streamline review process and ensure consistency
- **Comprehensive Dashboard**: View all submissions with filtering options and AI insights
- **Enhanced User Management**: Complete user account administration with role-based views
- **Advanced Instructor Management**: Comprehensive instructor oversight with course section details
- **🔄 Hybrid Review Process**: Combine AI automation with human expertise for optimal results

### Semester Tracking & Course Management System

- **Academic Year Management**: Automatic calculation and tracking of academic years
- **Semester Organization**: Support for Fall, Spring, Summer, and Winter semesters
- **Course Section Management**: Multi-semester course section organization and student enrollment
- **Student Registration**: Semester-based student registration and tracking
- **Progress Monitoring**: Track student progress across all course sections
- **Data Export**: Export Center with semester/section-filtered reporting (see Export Center feature above)

### AI Feedback Credit System

On-demand AI feedback is metered so OpenAI spend is bounded and attributable.

- **Per-section policy** — instructors set `defaultCredits`, `costPerRequest`, and an `unlimited`
  toggle per course section (`/instructor/course-management/course-sections/:id/credits`), and can
  grant credits to individual students.
- **Students without a course section** draw on a default per-term allowance instead of being
  unmetered.
- **Every call is logged** to `CreditTransaction` with token counts and estimated USD cost, whether
  or not it was charged — this is the authoritative record for cost analysis. Read historical cost
  from the ledger row, never by recomputing from the current `costPerRequest`.
- **Running out** returns HTTP 403 with `code: "NO_CREDITS"`; the question page then offers an
  inline "request more credits" form. Instructors resolve requests at
  `/instructor/credit-requests`.
- Balances carry over when a student switches sections within a term, so switching cannot be used
  to reset an allowance.

## Database Models

- **User**: Manages user accounts, authentication, role-based access, and semester tracking
- **Topic**: Organizes learning topics (SQL, Data Modeling)
- **Question**: Stores questions with solutions and expected outputs
- **Completion**: Tracks user progress and submissions. **Unique per `(user, question, academicYear, semester)`** — a student who retakes the course earns completions again in the new term while prior-term records are preserved
- **InteractionLog**: Append-only event log (`query_attempt`, `answer_revealed`, `ai_feedback_requested`) that powers solution-unlock scoring, the detailed-attempts export, and research analysis
- **CourseSectionChange**: Audit trail of students changing their own course section
- **InstructorCourseSection**: Manages course sections with semester and academic year tracking
- **InstructorSectionTopicSetting**: Per-section, per-topic configuration — stores `isVisible` (whether the topic is shown to students in a section), `dueDate` (optional deadline after which completions are not recorded), `gracePeriodMinutes` (grace window after the due date during which completions still count), and `assignmentType` (`assignment` or `practice` classification, default `practice`). One row per `(section, topic)` pair; rows are created on first save and upserted on subsequent changes
- **InstructorSectionCreditSetting**: Per-section AI credit policy — `defaultCredits`, `costPerRequest`, and an `unlimited` toggle
- **StudentCreditBalance**: Per-student, per-term AI credit balance
- **CreditTransaction**: Append-only credit ledger (`seed`/`spend`/`grant`/`refund`) carrying token counts and estimated USD cost — the authoritative record for AI spend analysis
- **CreditRequest**: Student requests for additional AI credits, resolved by the instructor

> Note: the `Sessions` table is created automatically by `connect-session-sequelize` and has no Sequelize model file.

## API Endpoints

### Authentication

- `GET /auth/login` - Login form
- `POST /auth/login` - User login
- `GET /auth/register` - Registration form
- `POST /auth/register` - User registration
- `GET /auth/forgot-password` - Password reset request form
- `POST /auth/forgot-password` - Request password reset
- `GET /auth/reset-password/:token` - Reset password form
- `POST /auth/reset-password/:token` - Reset password
- `GET /auth/logout` - User logout

### Questions & Topics

- `GET /topics` - List all topics
- `GET /questions/topic/:id` - Questions by topic
- `GET /questions/:id` - Question details
- `POST /questions/:id/execute` - Execute SQL queries
- `POST /questions/:id/analyze` - 🤖 Analyze queries with AI using OpenAI `gpt-4.1-nano`
- `POST /questions/:id/submit-model` - Submit data model answers

### ER Diagram Submissions

- `GET /er-diagrams/submit/:questionId` - Submission form
- `POST /er-diagrams/submit/:questionId` - Submit ER diagram
- `GET /er-diagrams/my-submission/:questionId` - Student view
- `POST /er-diagrams/admin/submissions/:id/evaluate` - 🔍 AI evaluation using OpenAI `gpt-4o` (vision)

### Admin Routes

- `GET /admin` - Admin dashboard
- `GET /admin/users` - User management with role-based views
- `GET /admin/instructors` - Instructor management with course section details
- `GET /admin/instructors/:id/course-sections` - Get instructor course sections
- `GET /admin/instructors/:instructorId/course-sections/:sectionId/students` - Get course section students
- `GET /admin/submissions` - ER diagram submissions
- `POST /admin/submissions/:id` - Update admin review
- `GET /admin/export` - Export Center page (type selector + filters)
- `GET /admin/export/run?type=...` - Generate CSV for the selected export type (`topic-summary`, `detailed-attempts`, `matrix`, `instructors`)

### Instructor Routes

- `GET /instructor/dashboard` - Instructor dashboard
- `GET /instructor/course-management` - Course section management
- `GET /instructor/course-management/course-sections` - View course sections
- `POST /instructor/course-management/course-sections` - Create course section
- `GET /instructor/course-management/course-sections/:id/topics` - Manage topic visibility and due dates for a section
- `POST /instructor/course-management/course-sections/:id/topics/settings` - Save a single topic setting (upsert)
- `GET /instructor/students` - View enrolled students
- `GET /instructor/submissions` - View student submissions
- `GET /instructor/export` - Export Center page (type selector + filters)
- `GET /instructor/export/run?type=...` - Generate CSV for the selected export type (`topic-summary`, `detailed-attempts`, `matrix`, `submissions`)

## Dependencies

### Core Dependencies

- **express**: Web framework
- **sequelize**: ORM for database operations
- **ejs**: Templating language
- **bcryptjs**: Password hashing (pure JS — the native `bcrypt` package is deliberately *not* used; it needs platform compilation and pulls in a vulnerable `node-gyp` toolchain)
- **express-session**: Session management
- **express-rate-limit**: Request throttling on auth, query-execution, and AI endpoints
- **helmet**: Security headers
- **mysql2**: MySQL database driver (the only driver — this project is MySQL-only)

### File Upload & AI

- **multer**: File upload handling
- **openai**: 🤖 OpenAI API integration (`gpt-4.1-nano` for SQL feedback, `gpt-4o` for data-model and ER-diagram grading)

### Email & Authentication

- **nodemailer**: Email sending for password reset
- **connect-flash**: Flash messaging
- **connect-session-sequelize**: Session storage

### Development & Migration

- **nodemon**: Auto-reload for development
- **jest**: Testing framework
- **supertest**: API testing
- **umzug**: Database migration management

## Usage Examples

### For Students

1. Register/login to the system with instructor code (if applicable)
2. Browse topics and select questions
3. For SQL questions: Write and execute queries with 🤖 AI-powered analysis
4. For ER diagrams: Upload PNG files with explanations and receive 🔍 AI evaluation
5. View progress and instructor feedback
6. Use password reset if needed

### For Instructors

1. Access instructor dashboard
2. Create and manage course sections for different semesters
3. View students enrolled in each course section
4. Monitor student progress and submissions
5. Export semester-based data for analysis
6. Review student ER diagram submissions

### For Administrators

1. Access admin dashboard with comprehensive statistics
2. Manage users with detailed role-based views (Student, Instructor, Admin)
3. Review instructor course sections and student enrollment
4. Review ER diagram submissions with 🤖 AI assistance and automated evaluation
5. Export comprehensive reports by semester and course section
6. Monitor system-wide progress and analytics with AI-generated insights

## Development

### Running Tests

```bash
npm test
```

### Database Operations

```bash
npm run create-db    # Create database
npm run init-db      # Initialize with sample data
```

### Migration Management

```bash
# Run migrations
node src/scripts/run-migration.js

# Run semester tracking migration
node src/scripts/run-semester-migration.js
```

### Password Reset Testing

```bash
node test-password-validation.js
```

### Operational Scripts

All of these are **dry-run by default** and require `--apply` to write. Run them with `node`.

| Script | Purpose |
|---|---|
| `src/scripts/verify-solutions.js` | Executes **every** stored reference solution against its topic's database and exits non-zero if any fail. Run after any content change — a solution that fails to execute otherwise shows students a misleading "expected 0 rows and 0 columns" instead of an error |
| `src/scripts/fix-broken-solutions.js` | Applies validated corrections to broken reference solutions; each fix is executed successfully before it is written |
| `src/scripts/regrade-attempts.js` | Replays students' logged attempts against corrected solutions and credits completions at the original attempt time, honoring the deadline in force then |
| `src/scripts/repair-retake-completions.js` | Backfills missing current-term completions for students retaking a course, from their interaction logs. `--scan` lists affected students |

Also available as npm scripts: `npm run cleanup-and-recreate`, `npm run inspect-text-db`,
`npm run test-completion`, `npm run test-analyze`, `npm run test-column-matching`.

### Environment Setup

Ensure all required environment variables are set in `.env`:

- `PORT`: Application port (default: 3000)
- `SESSION_SECRET`: Session encryption key
- `OPENAI_API_KEY`: OpenAI API key for AI evaluation
- `NODE_ENV`: Environment mode (development/production)
- `APP_URL`: Application URL for password reset links
- `SMTP_*`: Email configuration for password reset

## Security Features

- **Password Requirements**: Strong password validation with multiple criteria
- **Session Security**: Session ID regenerated on login and registration (prevents fixation); sessions revoked on account deletion, role change, and password reset. The app refuses to start without a real `SESSION_SECRET`
- **CSRF Protection**: Per-session synchronizer token enforced on every state-changing request, with a client interceptor that attaches it to forms and AJAX automatically
- **Security Headers**: `helmet` applied globally
- **Rate Limiting**: On authentication endpoints (by IP) and on query-execution and AI endpoints (by user, so a shared campus IP isn't throttled collectively)
- **Token-Based Reset**: Secure password reset with time-limited tokens, cleared after use
- **Input Validation**: Comprehensive input validation and sanitization
- **SQL Injection Protection**: Parameterized queries via Sequelize
- **Read-Only Query Sandbox**: Student SQL must be a `SELECT`/`WITH` statement; destructive keywords and file access (`OUTFILE`, `DUMPFILE`, `LOAD_FILE`) are rejected before reaching the database, and practice connections carry a statement timeout so an expensive query cannot stall the system
- **XSS Protection**: Template escaping, plus explicit escaping/sanitizing helpers for anything injected into the DOM (including AI output)
- **Protected File Access**: Uploaded ER diagrams are served through an authenticated route (owner, their instructor, or an admin only) — never as static files. Uploads are verified by PNG magic bytes, not by the client-supplied content type
- **Role-Based Access Control**: Granular permissions for different user types

## Recent Updates

- ✅ **Assignment/Practice Classification**: Instructors can classify each topic, per course section, as an Assignment (graded) or Practice (ungraded) topic from the Topic Settings page. Shown as a badge on the student topics list and question list. Label-only for now — it does not yet change due-date enforcement, credit gating, or CSV export contents
- ✅ **📤 Export Center**: Consolidated 9 scattered export routes/buttons into one Export Center page per role (`/instructor/export`, `/admin/export`). Offers four shared export types — Topic Completion Summary, Detailed Question Attempts (new: per-student-per-question attempt counts, best-match %, and scores), Student Completion Matrix, plus role-specific ER Diagram Submissions (instructor) / Instructor Directory (admin) — all filterable by academic year, semester, and course section. All completion-style CSV cells are numeric `1`/`0`, and no cell ever combines a numerator/denominator into one string (e.g. `"3/5"`) — topic/question counts are always split into separate numeric columns so the CSV imports cleanly into D2L's grade-import tool
- ✅ **Per-Section Topic Visibility**: Instructors can now hide specific topics from individual course sections via a new Topic Settings page (accessible from the Course Sections list). Hidden topics are filtered from the student topics list and blocked at the question-list URL level
- ✅ **Per-Section Due Dates**: Instructors can set a per-topic deadline per course section. After the deadline, queries still execute and results are shown, but completions are not recorded. Warning/danger badges appear on topic and question-list pages
- ✅ **Solution Unlock Threshold**: The reference solution and ChatGPT comparison are hidden until a student has ≥ 5 attempts with ≥ 75% row match, or the question is already completed. The solution is also excluded from the execute API response until unlocked
- ✅ **Fuzzy Completion**: Questions are marked complete when row count and column count both match. Column alias or ordering differences no longer block completion (they are still shown as informational differences in the UI)
- ✅ **🤖 Enhanced AI Capabilities**: Advanced OpenAI `gpt-4.1-nano` and `gpt-4o` integration for intelligent analysis
- ✅ **🔍 AI-Powered Query Analysis**: Intelligent SQL query comparison and feedback system
- ✅ **📊 Automated ER Diagram Evaluation**: Computer vision-based diagram analysis with detailed scoring
- ✅ **Enhanced Role-Based System**: Comprehensive student, instructor, and admin role management
- ✅ **Advanced Admin Dashboard**: Enhanced user management with role-specific views and course section details
- ✅ **Semester Tracking System**: Complete academic year and semester management with course sections
- ✅ **Instructor Management**: Comprehensive instructor oversight with course section and student enrollment tracking
- ✅ **Password Reset System**: Complete password reset functionality with email verification
- ✅ **Enhanced Security**: Improved password validation and session management
- ✅ **Better Error Handling**: Comprehensive error handling and user feedback
- ✅ **Frontend Improvements**: Enhanced UI with loading states and form validation

## AI Capabilities

The application leverages cutting-edge artificial intelligence to provide intelligent analysis and automated evaluation:

### 🤖 SQL Query Analysis

- **Intelligent Query Comparison**: AI analyzes student SQL queries against expected solutions
- **Context-Aware Feedback**: Provides targeted suggestions based on question requirements
- **Learning-Focused Guidance**: Offers educational feedback to help students improve
- **Real-time Analysis**: Instant feedback using OpenAI `gpt-4.1-nano` for query evaluation

### 🔍 ER Diagram Evaluation

- **Computer Vision Analysis**: Advanced image analysis using OpenAI `gpt-4o` (vision)
- **Visual Understanding**: AI interprets diagram elements, relationships, and design patterns
- **Comprehensive Feedback**: Provides strengths, weaknesses, and improvement suggestions

### 📊 AI-Assisted Review Process

- **Streamlined Evaluation**: AI-generated evaluations reduce manual review time
- **Consistent Assessment**: Ensures uniform evaluation standards across submissions
- **Hybrid Review System**: Combines AI automation with human expertise
- **Quality Assurance**: AI assists in maintaining high evaluation standards

### 🎯 Educational Benefits

- **Personalized Learning**: AI provides individualized feedback for each student
- **Immediate Feedback**: Real-time analysis helps students learn from mistakes
- **Consistent Evaluation**: Automated scoring ensures fair and uniform assessment

## Semester Tracking Implementation

The application now includes comprehensive semester tracking capabilities:

### Database Schema

- **Users Table**: Added academic_year, semester, and course_section fields
- **Completions Table**: Added academic_year, semester, and course_section fields
- **InstructorCourseSection Table**: New table for managing course sections

### Benefits

- **Multi-semester Support**: Teach the same course across multiple semesters
- **Organized Data**: Students and completions automatically organized by semester
- **Flexible Export**: Export data for specific semesters, course sections, or date ranges
- **Course Section Management**: Create and manage multiple sections per semester

## License

This project is licensed under the ISC License.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For issues and questions, please create an issue in the repository.
