# SST: Interaction Logging + AI Feedback Toggle — Implementation Spec

## Overview

Three interconnected changes to implement together:

1. Add an `InteractionLog` table to capture all student interaction events for research
2. Add a global AI feedback opt-out toggle (stored in the database, shown on question page and profile)
3. Wire up logging for query attempts, answer reveals, and AI feedback requests

---

## CHANGE 1: User Model — Add `aiFeedbackEnabled` Field

**File: `src/models/User.js`**

Add this field to the `User.init()` fields object, alongside the existing semester tracking fields:

```js
aiFeedbackEnabled: {
  type: DataTypes.BOOLEAN,
  allowNull: false,
  defaultValue: true,
  field: 'ai_feedback_enabled',
  comment: 'Whether the student has enabled real-time AI feedback'
}
```

Also add `aiFeedbackEnabled` to the `userData` object in `src/routes/profile.js` GET route so the view has access to it:

```js
aiFeedbackEnabled: user.aiFeedbackEnabled !== false ? true : false,
```

---

## CHANGE 2: Migration — `ai_feedback_enabled` Column + `interaction_logs` Table

**File: `src/migrations/20260221000001-add-interaction-logging.js`**

Follow the exact naming and structure pattern of existing migration files.

**`up` method must do two things:**

Part A — Add column to `users` table:
```sql
ALTER TABLE users ADD COLUMN ai_feedback_enabled TINYINT(1) NOT NULL DEFAULT 1;
```

Part B — Create `interaction_logs` table:
```sql
CREATE TABLE interaction_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  question_id INT NOT NULL,
  event_type ENUM('query_attempt', 'answer_revealed', 'ai_feedback_requested') NOT NULL,
  event_data JSON,
  occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  academic_year VARCHAR(20),
  semester ENUM('Fall','Spring','Summer','Winter'),
  course_section VARCHAR(50),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_question_id (question_id),
  INDEX idx_event_type (event_type),
  INDEX idx_occurred_at (occurred_at)
);
```

**`down` method must:**
- Drop the `interaction_logs` table
- Remove the `ai_feedback_enabled` column from `users`

---

## CHANGE 3: New Sequelize Model — `InteractionLog`

**File: `src/models/InteractionLog.js`**

Model fields:

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `userId` | INTEGER | No | FK to users |
| `questionId` | INTEGER | No | FK to questions |
| `eventType` | ENUM('query_attempt', 'answer_revealed', 'ai_feedback_requested') | No | |
| `eventData` | JSON | Yes | Flexible payload per event type |
| `occurredAt` | DATE | No | Default NOW |
| `academicYear` | STRING(20) | Yes | field: 'academic_year' |
| `semester` | ENUM('Fall','Spring','Summer','Winter') | Yes | |
| `courseSection` | STRING(50) | Yes | field: 'course_section' |

- Table name: `interaction_logs`
- Timestamps: true, underscored: true

Associations:
```js
InteractionLog.belongsTo(models.User, { foreignKey: 'userId' });
InteractionLog.belongsTo(models.Question, { foreignKey: 'questionId' });
```

**Register this model in `src/models/index.js`** following the exact same import and association pattern used for existing models.

---

## CHANGE 4: New Route — AI Feedback Toggle

**File: `src/routes/profile.js`**

Add this new route:

```js
router.post('/toggle-ai-feedback', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findByPk(req.session.userId);
    if (!user) return res.status(404).json({ success: false });
    await user.update({ aiFeedbackEnabled: !user.aiFeedbackEnabled });
    return res.json({ success: true, aiFeedbackEnabled: user.aiFeedbackEnabled });
  } catch (error) {
    console.error('Error toggling AI feedback:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});
```

---

## CHANGE 5: Logging in `src/routes/questions.js`

### 5a — Add import

Add `InteractionLog` to the model imports at the top:

```js
const { Question, Topic, Completion, User, InteractionLog } = require('../models');
```

### 5b — Add reusable helper function

Add this function at the bottom of the file, before `module.exports`. It must be non-blocking — if logging fails, it must never interrupt the student's experience:

```js
async function logInteraction(userId, questionId, eventType, eventData, user) {
  try {
    await InteractionLog.create({
      userId,
      questionId,
      eventType,
      eventData,
      occurredAt: new Date(),
      academicYear: user?.academicYear || null,
      semester: user?.semester || null,
      courseSection: user?.courseSection || null
    });
  } catch (err) {
    console.error('InteractionLog write failed (non-blocking):', err.message);
  }
}
```

### 5c — Log query attempts in `POST /:id/execute`

After the existing `Completion.create` / `existingCompletion` logic and after `isCompleted` is determined, add:

```js
const userForLog = await User.findByPk(userId);
await logInteraction(userId, id, 'query_attempt', {
  queryText: query,
  isCorrect: isCompleted,
  rowsMatch: comparison?.rowsMatch || false,
  columnsMatch: comparison?.columnsMatch || false,
  columnNamesMatch: comparison?.columnNamesMatch || false
}, userForLog);
```

> **Note:** If `user` is already fetched earlier in this route, reuse that variable. Do not fetch twice.

### 5d — Modify `POST /:id/analyze-realtime`

At the start of the try block, fetch the user and check their preference. If AI feedback is disabled, return early **without** calling OpenAI:

```js
const userId = req.session.userId;
const user = await User.findByPk(userId);

if (!user.aiFeedbackEnabled) {
  return res.json({ success: true, disabled: true, analysis: null });
}
```

After the successful OpenAI call where `analysis` is set, and **before** the return statement, log the event. Only log when a real analysis was returned — do NOT log when `skipped: true`:

```js
await logInteraction(userId, id, 'ai_feedback_requested', {
  queryLength: query.length,
  analysisLength: analysis.length
}, user);
```

### 5e — Add new route `POST /:id/log-reveal`

```js
router.post('/:id/log-reveal', isAuthenticated, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.userId;
    const user = await User.findByPk(userId);
    await logInteraction(userId, id, 'answer_revealed', {}, user);
    return res.json({ success: true });
  } catch (error) {
    console.error('Error logging reveal:', error);
    return res.status(500).json({ success: false });
  }
});
```

---

## CHANGE 6: Question Detail View — AI Toggle Panel

**File: `src/routes/questions.js` — GET `/:id` route**

Fetch the user and pass `aiFeedbackEnabled` to the render call:

```js
const user = await User.findByPk(req.session.userId);
res.render('pages/question-detail', {
  title: `Question #${question.id}`,
  question,
  completed: !!completion,
  aiFeedbackEnabled: user ? user.aiFeedbackEnabled : true
});
```

**File: `src/views/pages/question-detail.ejs`**

Add this toggle panel **above** wherever the real-time AI feedback panel currently renders:

```html
<div class="card mb-3 shadow-sm" id="ai-toggle-card">
  <div class="card-body py-2 d-flex align-items-center justify-content-between">
    <div>
      <i class="bi bi-robot me-2"></i>
      <strong>Real-time AI Feedback</strong>
      <span class="text-muted ms-2" style="font-size:0.875rem;">
        Toggle whether AI provides hints as you write your query
      </span>
    </div>
    <div class="form-check form-switch mb-0">
      <input class="form-check-input" type="checkbox" id="aiFeedbackToggle"
             <%= aiFeedbackEnabled ? 'checked' : '' %>
             style="width:3em; height:1.5em; cursor:pointer;">
      <label class="form-check-label ms-2" for="aiFeedbackToggle" id="aiFeedbackToggleLabel">
        <%= aiFeedbackEnabled ? 'Enabled' : 'Disabled' %>
      </label>
    </div>
  </div>
</div>
```

Add this script block at the bottom of the question-detail view:

```js
const toggle = document.getElementById('aiFeedbackToggle');
const label = document.getElementById('aiFeedbackToggleLabel');

toggle.addEventListener('change', async function () {
  label.textContent = this.checked ? 'Enabled' : 'Disabled';
  try {
    await fetch('/profile/toggle-ai-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    console.error('Failed to save AI feedback preference:', e);
  }
});
```

**Guard the existing `analyze-realtime` call:**

Locate the existing JavaScript in this view or in `public/js/main.js` that calls `POST /:id/analyze-realtime`. Add this guard at the very start of that function — if the toggle is off, skip the API call entirely:

```js
if (!document.getElementById('aiFeedbackToggle')?.checked) return;
```

---

## CHANGE 7: Profile View — Toggle Panel

**File: `src/views/pages/profile.ejs`**

Add this section after the existing personal information fields and before the submit button:

```html
<div class="mb-4">
  <label class="form-label"><strong>Learning Preferences</strong></label>
  <div class="card">
    <div class="card-body py-2 d-flex align-items-center justify-content-between">
      <div>
        <i class="bi bi-robot me-2"></i>Real-time AI Feedback
        <div class="text-muted" style="font-size:0.875rem;">
          When enabled, AI provides syntax hints as you write SQL queries
        </div>
      </div>
      <div class="form-check form-switch mb-0">
        <input class="form-check-input" type="checkbox" id="aiFeedbackToggleProfile"
               <%= user.aiFeedbackEnabled ? 'checked' : '' %>
               style="width:3em; height:1.5em; cursor:pointer;">
        <label class="form-check-label ms-2" for="aiFeedbackToggleProfile" id="profileToggleLabel">
          <%= user.aiFeedbackEnabled ? 'Enabled' : 'Disabled' %>
        </label>
      </div>
    </div>
  </div>
</div>
```

Add this script block at the bottom of the profile view:

```js
const profileToggle = document.getElementById('aiFeedbackToggleProfile');
const profileLabel = document.getElementById('profileToggleLabel');

profileToggle.addEventListener('change', async function () {
  profileLabel.textContent = this.checked ? 'Enabled' : 'Disabled';
  try {
    await fetch('/profile/toggle-ai-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    console.error('Failed to save AI feedback preference:', e);
  }
});
```

---

## CHANGE 8: Answer Reveal Logging — Frontend

**File: `public/js/main.js` or `src/views/pages/question-detail.ejs`**

Locate the existing checkbox or button that reveals the answer/solution query to the student. Add an event listener so that when it is first checked/clicked, it fires the log-reveal route exactly once:

```js
const revealCheckbox = document.getElementById('ACTUAL_REVEAL_ELEMENT_ID');
let revealLogged = false;

if (revealCheckbox) {
  revealCheckbox.addEventListener('change', async function () {
    if (this.checked && !revealLogged) {
      revealLogged = true;
      const questionId = window.location.pathname.split('/').pop();
      try {
        await fetch(`/questions/${questionId}/log-reveal`, { method: 'POST' });
      } catch (e) {
        console.error('Failed to log reveal:', e);
      }
    }
  });
}
```

> **Important:** Find the actual ID or selector for the answer reveal element in `question-detail.ejs` or `main.js` and replace `ACTUAL_REVEAL_ELEMENT_ID` with it. Do not leave the placeholder.

---

## Files to Create or Modify

| File | Action |
|---|---|
| `src/models/User.js` | Modify — add `aiFeedbackEnabled` field |
| `src/models/InteractionLog.js` | Create new |
| `src/models/index.js` | Modify — register `InteractionLog` |
| `src/migrations/20260221000001-add-interaction-logging.js` | Create new |
| `src/routes/questions.js` | Modify — add logging helper, log attempts, guard analyze-realtime, add log-reveal route |
| `src/routes/profile.js` | Modify — add `aiFeedbackEnabled` to userData, add toggle route |
| `src/views/pages/question-detail.ejs` | Modify — add toggle panel, add reveal logging |
| `src/views/pages/profile.ejs` | Modify — add toggle panel |

---

## Verification Checklist

After implementation, confirm:

- [ ] Migration runs without error: `node src/scripts/run-migration.js`
- [ ] `interaction_logs` table exists in the database with correct schema
- [ ] `users` table has `ai_feedback_enabled` column defaulting to 1
- [ ] Toggling on question page saves to database (check via profile page — toggle state should persist after page reload)
- [ ] Toggling on profile page saves to database (check via question page)
- [ ] Submitting a SQL query writes a record to `interaction_logs` with `event_type = 'query_attempt'`
- [ ] Revealing the answer writes a record with `event_type = 'answer_revealed'`
- [ ] AI feedback request writes a record with `event_type = 'ai_feedback_requested'` when enabled
- [ ] When AI feedback is disabled, `analyze-realtime` route returns `{ disabled: true }` without calling OpenAI
- [ ] If any logging call fails, the student's query execution response is unaffected
