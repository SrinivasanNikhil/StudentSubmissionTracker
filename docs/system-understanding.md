# Student Submission Tracker - Working Notes

_Last updated: 2026-01-20_

These notes capture my current understanding of the Student Submission Tracker codebase. I will keep this document up to date and reference it when implementing future changes.

## High-Level Overview

- Express + EJS web application for SQL practice, ER diagram submissions, and semester-based progress tracking (`src/app.js`, `README.md`).
- Multi-role access for students, instructors, and admins backed by session-based authentication and Sequelize models (`src/middleware/auth.js`, `src/models/User.js`).
- Integrates multiple OpenAI models for SQL feedback and ER diagram evaluation (`src/routes/questions.js`, `src/routes/er-diagrams.js`).

## Core Architecture

- **Entry point**: `src/server.js` loads environment variables and launches the Express app.
- **App setup**: `src/app.js` configures layouts, static assets, session store (`connect-session-sequelize`), route mounting, and reference-data bootstrap.
- **Database layer**: `src/config/database.js` establishes Sequelize connections for ClassicModels, Northwind, Text (SQL practice) and the application database, and runs Umzug migrations at startup.
- **Reference data**: JSON files in `src/reference_files/` are ingested on boot via `src/utils/referenceLoader.js` to sync topics and questions.

## Data Model Snapshot

- `src/models/User.js`: Users with roles (`admin`, `instructor`, `student`), instructor codes, password reset tokens, and semester metadata.
- `src/models/Topic.js`: Logical topic grouping with associated database selection.
- `src/models/Question.js`: Supports both SQL (solution query) and data-model questions (expected outputs, base entities/relationships).
- `src/models/Completion.js`: Per-user, per-question records, also tracking ER diagram metadata, AI/admin evaluations, and semester context.
- `src/models/InstructorCourseSection.js`: Associates instructors with semester-specific course sections, provides helpers for current academic period.
- Associations declared in `src/models/index.js` (topics↔questions, users↔completions, instructor-student relationships, instructor course sections).

## Authentication & Session Flow

- Routes in `src/routes/auth.js` handle login, registration, and password reset, using `src/utils/passwordValidator.js` for strength checks and `src/utils/emailService.js` (Nodemailer) for reset emails.
- Middleware in `src/app.js` exposes `res.locals.user` and flash messages to all views, ensuring templates know the active role.
- Access control helpers live in `src/middleware/auth.js` and gate routers by role.

## Student Experience

- `/topics` (`src/routes/topics.js`) lists available topics; `/questions/topic/:topicId` shows question lists with completion state.
- `/questions/:id` renders details; `/questions/:id/execute` runs user SQL against the configured database and records completions when row count, column count, and column names all match (`src/routes/questions.js`, `src/services/sqlExecutor.js`).
- `/questions/:id/analyze` and `/questions/:id/analyze-realtime` call OpenAI for HTML-formatted feedback with rate limiting and change detection.
- `/questions/:id/submit-model` obtains structured JSON analysis from GPT-4 for data-model prompts.
- `/completions/user/progress` builds a per-topic progress dashboard (`src/routes/completions.js`).

## ER Diagram Workflow

- Students upload PNG diagrams for data-model questions via `/er-diagrams/submit/:questionId`, with required enhancement and AI-reflection fields. Uploads land in `src/public/uploads/diagrams` managed by Multer (`src/routes/er-diagrams.js`).
- Admins/instructors view submissions (`/er-diagrams/admin/submissions`), trigger GPT-4o Vision scoring, and add manual feedback. AI responses are stored in `Completion.evaluation` and `Completion.aiScore`.
- Students can view their submission and AI feedback at `/er-diagrams/my-submission/:questionId`.

## Instructor Features

- Dashboard at `/instructor/dashboard` summarises students, completions, and ER submissions (`src/routes/instructor.js`).
- `/instructor/students` and `/instructor/students/:studentId` provide roster and per-student progress views.
- CSV exports for completions and submissions live under `/instructor/export/*` routes.
- **Export by Topic** (`/instructor/export/by-topic/form` and `/instructor/export/by-topic`): Customizable topic-based export allowing instructors to select specific topics via checkboxes and generate CSV with completion counts per topic in "completed/total" format (e.g., "3/5"). Includes a Total column aggregating all selected topics (`src/routes/instructor.js:771-991`, `src/views/pages/instructor/export-by-topic.ejs`).
- Course management module (`/instructor/course-management/*`) lets instructors create/toggle sections, view enrolled students, and export semester-filtered data (`src/routes/instructor-course-management.js`).

## Admin Features

- Admin dashboard aggregates user counts, completions, and topics (`src/routes/admin.js`).
- User management routes support filtering, deletion (with cascading completions), instructor creation/promotion, and CSV exports.
- Admin course-section and student views reuse the instructor course metadata for oversight.

## AI Integration Summary

- SQL feedback: OpenAI `gpt-4.1-nano` (chat completions) for comparison and realtime hints (`src/routes/questions.js:210` onward).
- Data-model evaluation: GPT-4 producing structured JSON for scenario analysis (`src/routes/questions.js:320`).
- ER diagram scoring: GPT-4o Vision with base64 image payloads, parsing score heuristically (`src/routes/er-diagrams.js:360`).
- Column comparison logic handles calculated columns via normalized expressions (`src/services/sqlExecutor.js`).

## Semester Tracking

- Semester-aware fields exist on users and completions; new registrations default to current academic year/semester when not provided (`src/routes/auth.js:260`).
- Instructor course sections drive student associations and semester-filtered exports (`src/routes/instructor-course-management.js`, `src/routes/questions.js:194`).
- Design documented further in `SEMESTER_TRACKING_IMPLEMENTATION.md`.

## Tooling & Operations

- Scripts in `src/scripts/` cover DB initialization, reference refresh, completion/column matching tests, and migration runners.
- Deployment guides: `deployment-lightsail.md`, `deployment-railway.md`, `deployment-modifications.md`, `ssl-setup-manual.md`.

## Open Questions / Follow-ups

- Confirm current production deployment target (Lightsail vs Railway) when making infra changes.
- Watch for large console logging in production (`src/app.js`, `src/routes/questions.js`) if performance or log noise becomes an issue.
- Evaluate need for additional rate limiting on AI endpoints beyond realtime analyzer if usage grows.

---

I will reference this document before implementing future modifications and update sections when the architecture or behavior changes.
