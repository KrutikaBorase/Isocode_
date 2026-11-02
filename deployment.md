# Asteria deployment

## Local setup

Requirements: Node.js 20+ and npm 10+.

1. Clone the repository:
   ```bash
   git clone https://github.com/KrutikaBorase/Isocode.git
   cd Isocode
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the API:
   ```bash
   npm run api
   ```
4. In a second terminal, start the web app:
   ```bash
   npm run dev
   ```
5. Open `http://localhost:5173`.

The API creates a local SQLite database (`asteria.db`) and seeds the sample campus data on first start. Demo passwords are stored as bcrypt hashes. The database is intentionally ignored by Git.

For a production build:

```bash
npm run build
npm run preview
```

## Deployment

The frontend is a Vite static build and can be deployed to any static host. The API is a Node.js process and should be deployed separately with a persistent volume for SQLite. Configure the frontend's `VITE_API_URL` to the public API URL.

Required environment variable names:

- `VITE_API_URL` — frontend API base URL
- `PORT` — API listening port
- `CLIENT_ORIGIN` — allowed frontend origin for CORS
- `JWT_SECRET` — production signing secret

The API exposes `GET /api/health` for deployment health checks. In production, the server refuses to start unless `JWT_SECRET` is provided. — production signing secret

Do not commit values for these variables.

## Demo accounts

- Faculty: `faculty@companya.edu` / `demo1234`
- Office admin: `admin@companya.edu` / `admin1234`

These are synthetic demo accounts only. Replace them with managed identity before production use.

## Scope and known limits

This submission focuses on one Engineering College campus and the core build: sign-in, student snapshot and directory, attendance marking/reload/sync, marks moderation lock, fee dues with a test-mode receipt transaction, the fixed-rule at-risk flag, and a constrained read-only assistant. Tally export, university upload formats, and multilingual parent messages remain next-phase integration points rather than connected outside systems.

The overview metrics are now read from `/api/dashboard`, so the displayed student count, average attendance, marks average, outstanding fees and at-risk count are derived from the persisted campus records rather than hardcoded UI values.

Attendance sync also recalculates each affected student’s aggregate percentage from the attendance ledger. Present and late count as attended; absent does not. This keeps the dashboard, student directory and at-risk rule consistent with the class records.

## Exports

The marks screen downloads `asteria-data-structures-marks.csv` with roll number, student, component scores and total. The fee screen downloads `asteria-fee-dues.csv` with roll number, student, programme, year and amount due. These are clean prototype exports for review; the university upload and Tally layouts should be mapped to the institution’s supplied specifications before production.

## Roles and audit trail

The faculty demo can view and update attendance and marks but cannot record fee payments or open the audit trail. The office-admin demo can record test payments and review the last 50 attendance, marks and fee events. The API enforces these permissions; hiding the controls in the UI is only a usability layer.

## Test-mode fee payments

The fee screen is intentionally explicit that payments are simulated. An office-admin account can record the full outstanding amount; the API validates the roll number and amount, atomically reduces the due, creates a `TEST-...` receipt, and writes an audit event. It does not contact a bank or payment provider. The endpoint is role-protected and rejects overpayments.

## Offline attendance

Attendance edits are stored in the browser queue before sync. If the device is offline, the screen confirms that the batch is saved locally; when the browser emits an `online` event, Asteria retries the queued batch. The API upserts by student, subject and class date, so retrying the same batch is safe. For production, replace the localStorage queue with IndexedDB and add an idempotency key per class session.

## Read-only assistant

The assistant accepts only approved question shapes: attendance below 75%, outstanding fee dues, and internal marks below 24/40. It never accepts SQL from the browser, only returns data visible to the authenticated campus user, and returns the answer, filters used, row count and matching rows. Unsupported questions are rejected with examples instead of a guessed answer.
