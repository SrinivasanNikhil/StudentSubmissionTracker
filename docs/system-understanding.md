# Student Submission Tracker - Working Notes

_Last updated: 2026-06-02_

These notes capture my current understanding of the Student Submission Tracker codebase. I will keep this document up to date and reference it when implementing future changes.

## High-Level Overview

- Express + EJS web application for SQL practice, ER diagram submissions, and semester-based progress tracking (`src/app.js`, `README.md`).
- Multi-role access for students, instructors, and admins backed by session-based authentication and Sequelize models (`src/middleware/auth.js`, `src/models/User.js`).
- Integrates multiple OpenAI models for SQL feedback and ER diagram evaluation via a shared client at `src/services/openai.js`.
- `helmet` and `express-rate-limit` provide baseline HTTP security on all responses and auth endpoints.

## Core Architecture

- **Entry point**: `src/server.js` loads environment variables and launches the Express app.
- **App setup**: `src/app.js` configures `helmet` (global), layouts, static assets, session store (`connect-session-sequelize`), route mounting, and reference-data bootstrap.
- **Database layer**: `src/config/database.js` establishes Sequelize connections for ClassicModels, Northwind, Text (SQL practice) and the application database, and runs Umzug migrations at startup.
- **Reference data**: JSON files in `src/reference_files/` are ingested on boot via `src/utils/referenceLoader.js` to sync topics and questions.

## Data Model Snapshot

- `src/models/User.js`: Users with roles (`admin`, `instructor`, `student`), instructor codes, password reset tokens, and semester metadata. Instance helpers are named `isAdminRole()`, `isInstructorRole()`, `isStudentRole()` — the `Role` suffix avoids shadowing the `isAdmin` boolean column.
- `src/models/Topic.js`: Logical topic grouping with associated database selection.
- `src/models/Question.js`: Supports both SQL (solution query) and data-model questions (expected outputs, base entities/relationships).
- `src/models/Completion.js`: Per-user, per-question records, also tracking ER diagram metadata, AI/admin evaluations, and semester context.
- `src/models/InstructorCourseSection.js`: Associates instructors with semester-specific course sections, provides helpers for current academic period.
- `src/models/InstructorSectionTopicSetting.js` _(added 2026-06-02)_: One row per `(instructorCourseSectionId, topicId)` pair (unique index). Fields: `isVisible` BOOLEAN DEFAULT true, `dueDate` DATETIME nullable. `ON DELETE CASCADE` on both FKs. Migration: `src/migrations/20260601000001-add-instructor-section-topic-settings.js`.
- Associations declared in `src/models/index.js` (topics↔questions, users↔completions, instructor-student relationships, instructor course sections, section topic settings).

## Authentication & Session Flow

- Routes in `src/routes/auth.js` handle login, registration, and password reset, using `src/utils/passwordValidator.js` for strength checks and `src/utils/emailService.js` (Nodemailer) for reset emails.
- Both login and registration wrap their redirect inside `req.session.save()` to guarantee the session is persisted before the browser follows the redirect.
- After a profile update (`POST /profile/update`), the route re-fetches the user with `User.findByPk` before writing `req.session.user`, so the session always reflects the persisted state.
- Password reset tokens are cleared to `null` on use (not just marked `resetTokenUsed: true`) to prevent replay. The check for an existing valid token is done in-memory against the already-fetched user object — no second DB query needed.
- Middleware in `src/app.js` exposes `res.locals.user` and flash messages to all views. It no longer logs session state or exposes `sessionID`/`sessionCookie` to templates.
- Access control helpers live in `src/middleware/auth.js` and gate routers by role.
- **Login session fields _(updated 2026-06-02)_**: The login handler now includes `courseSection`, `academicYear`, and `semester` in `req.session.user`. Previously these were only set during registration, so students who logged out and back in would bypass topic visibility filtering. Always include these fields when building the session object for any new auth flow.

## Security Measures

- **`helmet`** applied globally in `src/app.js` (CSP disabled; Bootstrap and other CDN assets referenced directly in templates would require nonce support to enable CSP).
- **Rate limiting** on auth POST endpoints in `src/routes/auth.js`: 20/15min (login), 10/hour (register), 5/hour (forgot-password).
- **SELECT-only guard**: `isSelectOnly()` in `src/services/sqlExecutor.js` validates student queries before they hit the practice databases. Any query that is not a pure SELECT (or CTE starting with WITH) is rejected with an error response.
- **`bcryptjs`** is the single password-hashing library across all files. The native `bcrypt` package was removed to avoid platform-compilation issues and inconsistency.

## Student Experience

- `/topics` (`src/routes/topics.js`) lists available topics. For students with a `courseSection` in their session, topics with `isVisible: false` for their section are filtered out. Topics with a `dueDate` receive a warning (upcoming) or danger (past) badge. Students with no section see all topics unfiltered.
- `/questions/topic/:topicId` shows question lists. The route first checks visibility — if the topic is hidden for the student's section, it redirects to `/topics` with a flash error. A deadline banner is shown at the top of the page when a due date exists.
- `/questions/:id` renders details and includes solution-unlock state. The solution and ChatGPT compare button are only rendered in the HTML when `solutionUnlocked` is true (computed server-side).
- `/questions/:id/execute` runs user SQL and records a completion when row count AND column count match (column aliases no longer block completion). If the topic's deadline has passed, the query executes normally but no completion is recorded; `pastDeadline: true` is included in the response. The `solution` field is omitted from the response until the solution is unlocked.
- `/questions/:id/analyze` requires the solution to be unlocked (returns 403 otherwise).
- `/questions/:id/analyze-syntax` calls OpenAI (`gpt-4.1-nano`) for on-demand HTML-formatted SQL syntax feedback. Triggered by the "Get AI Feedback" button; input is validated with `isSelectOnly()` and capped at 2000 characters before reaching the API.
- `/questions/:id/submit-model` obtains structured JSON analysis from GPT-4 for data-model prompts.
- `/completions/user/progress` builds a per-topic progress dashboard (`src/routes/completions.js`).

## ER Diagram Workflow

- Students upload PNG diagrams for data-model questions via `/er-diagrams/submit/:questionId`, with required enhancement and AI-reflection fields. Uploads land in `src/public/uploads/diagrams` managed by Multer (`src/routes/er-diagrams.js`).
- Admins/instructors view submissions (`/er-diagrams/admin/submissions`), trigger GPT-4o Vision scoring, and add manual feedback. AI responses are stored in `Completion.evaluation` and `Completion.aiScore`.
- Students can view their submission and AI feedback at `/er-diagrams/my-submission/:questionId`.

## Instructor Features

- Dashboard at `/instructor/dashboard` summarises students, completions, and ER submissions (`src/routes/instructor.js`).
- `/instructor/students` and `/instructor/students/:studentId` provide roster and per-student progress views.
- **Export Center** (`GET /instructor/export`): single page offering Topic Completion Summary, Detailed Question Attempts, Student Completion Matrix, and ER Diagram Submissions as selectable export types, each filterable by academic year/semester/course section. CSV generation happens via `GET /instructor/export/run?type=...`. This replaced 9 previously separate export routes/pages — see the "Export Center" section in `CLAUDE.md` for the full breakdown of types, columns, and the shared helpers (`src/utils/exportHelpers.js`, `src/utils/exportRunners.js`) used by both the instructor and admin routes.
- Course management module (`/instructor/course-management/*`) lets instructors create/toggle sections and view enrolled students. The section-specific export link now opens the Export Center pre-filtered to that section's year/semester/section rather than generating a CSV directly (`src/routes/instructor-course-management.js`).
- **Topic Settings _(added 2026-06-02)_** (`GET /instructor/course-management/course-sections/:id/topics`): Per-section topic settings page rendered by `src/views/pages/instructor/section-topics.ejs`. Each row shows a visibility toggle (auto-saves on change) and a `datetime-local` due date input (auto-saves on change). The "Manage Topics" button (list-task icon) in the Course Sections table Actions column links here. Settings are stored in `InstructorSectionTopicSetting` via `POST /instructor/course-management/course-sections/:id/topics/settings`. Exports are NOT affected by visibility — they show actual student completions regardless of current topic visibility.

## Admin Features

- Admin dashboard aggregates user counts, completions, and topics (`src/routes/admin.js`).
- User management routes support filtering, deletion (with cascading completions), and instructor creation/promotion.
- **Export Center** (`GET /admin/export`): admin counterpart to the instructor Export Center, with the same four shared export types plus an admin-only Instructor Directory export, and additional domain/code filters layered onto the Student Completion Matrix type. CSV generation via `GET /admin/export/run?type=...`.
- Admin course-section and student views reuse the instructor course metadata for oversight.

## AI Integration Summary

- All routes import the OpenAI client from `src/services/openai.js` — do not instantiate `new OpenAI()` directly in route files.
- SQL feedback: OpenAI `gpt-4.1-nano` (chat completions) for comparison and realtime hints (`src/routes/questions.js`).
- Data-model evaluation: GPT-4 producing structured JSON for scenario analysis (`src/routes/questions.js`).
- ER diagram scoring: GPT-4o Vision with base64 image payloads, parsing score heuristically (`src/routes/er-diagrams.js`).
- Column comparison logic handles calculated columns via normalized expressions (`src/services/sqlExecutor.js`).
- **Solution-unlock gate _(added 2026-06-02)_**: `POST /questions/:id/analyze` returns HTTP 403 when `getSolutionUnlockStatus()` returns `solutionUnlocked: false`. The `solution` field is also excluded from `POST /questions/:id/execute` responses until unlocked, preventing network-tab exposure of the reference query.

## Course Section Parsing

Course sections are stored as `${courseCode}-${sectionCode}` (produced by `getFullSectionIdentifier()`). When parsing user input, split on the **first dash only** using `indexOf` — not `.split("-")` — because section codes can themselves contain dashes. Both `src/routes/auth.js` (registration) and `src/routes/profile.js` (profile update) use the same pattern:

```js
const dashIndex = courseSection.indexOf("-");
const parsedCourseCode = dashIndex !== -1 ? courseSection.slice(0, dashIndex) : courseSection;
const parsedSectionCode = dashIndex !== -1 ? courseSection.slice(dashIndex + 1) : "";
```

## Semester Tracking

- Semester-aware fields exist on users and completions; new registrations default to current academic year/semester when not provided (`src/routes/auth.js`).
- Instructor course sections drive student associations; semester/section filtering for exports is centralized in `buildStudentScopeFilter()` (`src/utils/exportHelpers.js`), used by both `src/routes/instructor.js` and `src/routes/admin.js`.
- Design documented further in `SEMESTER_TRACKING_IMPLEMENTATION.md`.

## Tooling & Operations

- Scripts in `src/scripts/` cover DB initialization, reference refresh, completion/column matching tests, and migration runners.
- Deployment guides: `deployment-lightsail.md`, `deployment-railway.md`, `deployment-modifications.md`.

## Feature Implementation Notes (2026-06-02)

Four features were added in one batch. This section records the key decisions and invariants to keep in mind when touching the affected code.

### Phase 1 — InstructorSectionTopicSetting table

- New migration: `src/migrations/20260601000001-add-instructor-section-topic-settings.js`
- New model: `src/models/InstructorSectionTopicSetting.js` — factory-function pattern, `underscored: true`, timestamps on.
- `src/models/index.js` declares four associations: `InstructorCourseSection hasMany`, `InstructorSectionTopicSetting belongsTo InstructorCourseSection` (as `"section"`), `Topic hasMany` (as `"sectionSettings"`), `InstructorSectionTopicSetting belongsTo Topic` (as `"topic"`).

### Phase 2 — Fuzzy completion

- `POST /questions/:id/execute` in `src/routes/questions.js`: completion guard now checks `rowsMatch && columnsMatch` only (not `columnNamesMatch`).
- `InteractionLog.eventData` now includes `studentRows` and `solutionRows` (integer row counts from `compareQueries` return value) on every `query_attempt` event. These feed the Phase 4 unlock ratio calculation.
- The JS comparison summary badge in `question-detail.ejs` still checks `columnsMatch && columnNamesMatch` for the display icon — that is intentional (informational only).

### Phase 3 — Per-section topic visibility

Key helpers in `src/routes/questions.js`:
- `getStudentSection(user)` — resolves a session user's `InstructorCourseSection` row using the `indexOf`-based course-section parse. Returns `null` if the user has no section or no match. Called in `GET /topic/:topicId` and `POST /:id/execute`.
- Both the topics list (`src/routes/topics.js`) and the question-list route (`GET /questions/topic/:topicId`) perform independent visibility lookups rather than sharing state — this is intentional since they run in separate requests.

Flash messages use `req.flash("error", ...)` (connect-flash) — not `req.session.error`. The topics page receives the flash via `res.locals.error` set in `src/app.js` template middleware.

### Phase 4 — Due dates and solution unlock

Key helper in `src/routes/questions.js`:
- `getSolutionUnlockStatus(userId, questionId)` — two DB queries (completion check + interaction log count/find). Returns `{ solutionUnlocked, attemptCount, bestRatio, existingCompletion }`. Called in `GET /:id` (page render), `POST /:id/execute` (after the interaction log is written, so newly-completed questions are immediately unlocked), and `POST /:id/analyze` (403 gate).
- The `solution` field in `POST /:id/execute` responses is set to `null` when locked, preventing clients from reading it via network inspection.
- Due date enforcement skips completion creation but still executes the query and returns results — students can practice after the deadline, just not earn credit.
- `datetime-local` input values in `section-topics.ejs` are formatted using local-time components (`getFullYear/getMonth/getDate/getHours/getMinutes`), not `toISOString().slice(0,16)` (which would show UTC time in the input).

### Bug fixes applied during review

| # | File | Bug | Fix |
|---|---|---|---|
| 1 | `src/routes/auth.js` | Login session missing `courseSection`, `academicYear`, `semester` — students re-logging in bypassed topic filtering | Added three fields to login `req.session.user` |
| 2 | `src/routes/questions.js` | Visibility redirect used `req.session.error` instead of `req.flash("error")` — message was silently dropped | Changed to `req.flash("error", ...)` |
| 3 | `src/views/pages/question-detail.ejs` | `feedbackBox.innerHTML +=` prepended `<br>` even when box was empty, creating orphan break element | Guard: `const sep = feedbackBox.innerHTML ? '<br>' : ''` before each append |
| 4 | `src/views/pages/instructor/section-topics.ejs` | Client sent `isVisible` as string `"true"/"false"`; server coercion worked but was fragile | Client now sends `Boolean(isVisible)`; server uses `Boolean(isVisible)` |
| 5 | `src/views/pages/instructor/section-topics.ejs` | `datetime-local` value used `toISOString().slice(0,16)` (UTC) — wrong time shown in non-UTC browsers | Changed to local-time formatting using `getFullYear/getMonth/getDate/getHours/getMinutes` |
| 6 | `src/routes/questions.js` | `POST /:id/execute` always included `solution: question.solution` in response — lockable via network tab | `solution` is now `null` in the response until `getSolutionUnlockStatus` returns `solutionUnlocked: true` |

## Open Questions / Follow-ups

- Confirm current production deployment target (Lightsail vs Railway) when making infra changes.
- CSP is currently disabled in `helmet` config — evaluate enabling it when templates are updated to avoid inline CDN links.
- Evaluate additional rate limiting on OpenAI endpoints (`/analyze`, `/analyze-syntax`, `/submit-model`, `/evaluate`) if usage grows significantly.

---

I will reference this document before implementing future modifications and update sections when the architecture or behavior changes.
