# Asteria --- Deployment Guide

This guide covers the local setup, deployed application, demo accounts
and the main implementation details of Asteria.

## 1. Project links

-   **Live application:** https://isocode-green.vercel.app/
-   **GitHub repository:** https://github.com/KrutikaBorase/Isocode\_
-   **Backend API:** https://isocode-1.onrender.com
-   **API health check:** https://isocode-1.onrender.com/api/health

The backend health-check endpoint has been tested and returned:

``` json
{
  "status": "ok",
  "service": "asteria-api"
}
```

The frontend is hosted on Vercel and the Express API is hosted
separately on Render.

## 2. Local setup

### Requirements

-   Node.js 20 or later
-   npm 10 or later
-   Git

### Run the application

1.  Clone the repository:

    ``` bash
    git clone https://github.com/KrutikaBorase/Isocode_.git
    cd Isocode_
    ```

2.  Install the dependencies:

    ``` bash
    npm ci
    ```

    The repository includes a `package-lock.json`; `npm ci` installs the
    versions recorded in that lock file.

3.  Start the API in one terminal:

    ``` bash
    npm run api
    ```

    The API uses port `4000` by default.

4.  Open a second terminal in the project directory and start the
    frontend:

    ``` bash
    npm run dev
    ```

5.  Open http://localhost:5173 in your browser.

The API initializes the SQLite database and sample campus records when
it starts. Passwords for the demo accounts are stored as bcrypt hashes.
The database file is excluded from Git.

### Build and checks

``` bash
npm run build
npm run preview
npm test
npm run lint
```

## 3. Deployment overview

Asteria is deployed as two separate services:

  Part       Technology                    Hosting
  ---------- ----------------------------- ----------------------------
  Frontend   React, TypeScript and Vite    Vercel
  Backend    Express 5 and TypeScript      Render
  Database   SQLite using better-sqlite3   Local file used by the API

The frontend calls the API using the `VITE_API_URL` environment
variable. The API uses `CLIENT_ORIGIN` to allow requests from the
deployed frontend.

The API uses SQLite, so its database file must be stored on persistent
storage if data is expected to survive service restarts and
redeployments. Render's default service filesystem is ephemeral; only
files under a configured persistent disk's mount path are preserved. See
the [Render Persistent Disks
documentation](https://render.com/docs/disks).

## 4. Backend deployment on Render

The deployed API is:

https://isocode-1.onrender.com

### Service settings

The Render service should use the following settings:

  Setting             Value
  ------------------- --------------------------
  Repository          `KrutikaBorase/Isocode_`
  Branch              `main`
  Build command       `npm ci`
  Start command       `npm run api`
  Health-check path   `/api/health`

### Environment variables

Set the following environment variables in the Render service:

  Variable          Value / purpose
  ----------------- -----------------------------------------
  `NODE_ENV`        `production`
  `PORT`            Use the port provided by Render
  `JWT_SECRET`      A long, random secret used to sign JWTs
  `CLIENT_ORIGIN`   `https://isocode-green.vercel.app`

Do not add a trailing slash to `CLIENT_ORIGIN`. Do not commit secret
values to GitHub.

### SQLite storage --- important

The current code in `server/db.ts` creates the database at a fixed path
named `asteria.db` in the repository root. It does not currently read a
configurable database-path environment variable.

Because Render only preserves files under a persistent disk's mount
path, attaching a disk at an unrelated directory will **not** preserve
the database file at its current location. The application code and disk
configuration must be aligned before relying on persistent storage.

For a persistent Render setup, the recommended follow-up is:

1.  Update `server/db.ts` to read a database path from an environment
    variable, for example `DB_PATH`, with a local default for
    development.
2.  Configure the Render service to use a path under its persistent
    disk, for example `/var/data/asteria.db`.
3.  Attach a Render persistent disk mounted at `/var/data`.
4.  Set `DB_PATH=/var/data/asteria.db` in the Render environment.
5.  Redeploy the API and verify that records remain after a restart.

The deployed health endpoint responding successfully confirms that the
API is reachable. It does not confirm that the SQLite file is on
persistent storage. Until the code and disk are configured as described
above and tested, demo data entered into the deployed application may be
lost after a restart or redeploy.

**Plan note:** Render persistent disks are available on eligible paid
services; check the current Render plan and disk requirements before
relying on this setup.

### Check the API

Open:

https://isocode-1.onrender.com/api/health

The expected response is:

``` json
{
  "status": "ok",
  "service": "asteria-api"
}
```

## 5. Frontend deployment on Vercel

The live frontend is:

https://isocode-green.vercel.app/

### Project settings

  Setting            Value
  ------------------ --------------------------
  Repository         `KrutikaBorase/Isocode_`
  Branch             `main`
  Framework preset   Vite
  Root directory     `.`
  Install command    `npm ci`
  Build command      `npm run build`
  Output directory   `dist`

### Environment variable

In Vercel project settings, add:

  Variable         Value
  ---------------- --------------------------------------
  `VITE_API_URL`   `https://isocode-1.onrender.com/api`

The value must include `/api`. After changing a Vercel environment
variable, redeploy the frontend so the updated value is included in the
build.

### CORS configuration

In the Render service, set:

``` text
CLIENT_ORIGIN=https://isocode-green.vercel.app
```

This must match the deployed frontend origin exactly and should not have
a trailing slash. Restart or redeploy the API after changing it.

Vercel preview deployments use different URLs. A preview origin must be
added to the API's allowed origins before the preview frontend can call
the production API. The current API uses the configured `CLIENT_ORIGIN`
in production; localhost origins are allowed only in development.

## 6. Environment variable reference

  -----------------------------------------------------------------------
  Variable                Used by                 Purpose
  ----------------------- ----------------------- -----------------------
  `VITE_API_URL`          Frontend                Public API base URL,
                                                  including `/api`

  `PORT`                  Backend                 API listening port;
                                                  Render supplies this

  `CLIENT_ORIGIN`         Backend                 Frontend origin allowed
                                                  by CORS

  `JWT_SECRET`            Backend                 Secret used to sign
                                                  authentication tokens

  `NODE_ENV`              Backend                 Set to `production` on
                                                  the deployed API

  `DB_PATH`               Backend                 Suggested future
                                                  setting for persistent
                                                  SQLite storage; not
                                                  currently implemented
  -----------------------------------------------------------------------

In production, the API refuses to start if `JWT_SECRET` is missing.
Never commit secret values or private keys. Do not put secrets in
`VITE_` variables because frontend variables are included in the client
build.

## 7. Demo accounts

All accounts and records are synthetic and intended only for
demonstration.

  Role           Email                              Password
  -------------- ---------------------------------- --------------
  Faculty        `faculty@companya.edu`             `demo1234`
  Office admin   `admin@companya.edu`               `admin1234`
  Parent         `parent.subhashree@companya.edu`   `parent1234`

The parent account is linked to Subhashree Mohanty and provides
read-only access to that student's academic information. These shared
demo credentials are not suitable for real institutional use.

## 8. Application modules

Asteria currently includes:

-   **Dashboard:** Student count, average attendance, average marks,
    outstanding fees and at-risk indicators from `/api/dashboard`.
-   **Student Directory:** Searchable student records and academic
    information.
-   **Attendance:** Attendance marking, browser-side offline queueing
    and reconnect synchronization.
-   **Internal Marks:** Assignment, quiz and mid-semester marks, with a
    moderation lock.
-   **Fees:** Outstanding dues and simulated payment receipts.
-   **Admissions:** Applicant records and document-completion status.
-   **Parent Access:** Read-only attendance, marks and fee information
    for the linked student.
-   **Staff Leave:** Leave requests and office-admin approval.
-   **Academic Calendar:** Academic events and dates.
-   **Masters:** Programme and subject reference data.
-   **Audit Trail:** Records of important actions.
-   **Exports:** University-style internal marks and Tally-shaped fee
    export data.
-   **Campus Assistant:** Restricted, read-only queries for approved
    academic and fee information.

The API seeds 20 synthetic students, three applicants and reference
programme, subject, calendar and leave data. Some seed operations use
insert-if-not-present logic, so existing records are not necessarily
reset on every API start.

## 9. Roles and permissions

The API checks permissions on protected routes. Hiding a screen or
control in the frontend is not treated as the security boundary.

  Feature                   Faculty   Office admin                Parent
  ----------------------- --------- -------------- ---------------------
  Dashboard                     Yes            Yes                    No
  Student directory             Yes            Yes                    No
  Attendance                    Yes            Yes                    No
  Internal marks                Yes            Yes                    No
  View fee dues                 Yes            Yes   Linked student only
  Record fee payment             No            Yes                    No
  Admissions management          No            Yes                    No
  Submit leave request          Yes            Yes                    No
  Approve leave                  No            Yes                    No
  Audit trail                    No            Yes                    No
  Calendar and masters          Yes            Yes                    No
  Parent academic view           No             No     Yes --- read-only

The faculty account can work with attendance and marks but cannot record
fee payments or access the audit trail. The office-admin account has the
additional administrative permissions listed above.

## 10. Important implementation details

### Dashboard metrics

The dashboard reads its summary from `/api/dashboard`. Student count,
average attendance, average marks, outstanding fees and at-risk counts
are calculated from the campus records rather than being fixed display
values.

### Attendance and offline synchronization

Attendance edits are stored in a browser-side queue before
synchronization. If the device is offline, the screen indicates that the
batch has been saved locally. When the browser emits an `online` event,
Asteria retries the queued batch.

The API upserts attendance by student, subject and class date. Retrying
the same batch therefore updates the existing record instead of creating
a duplicate. Present and late count as attended; absent does not. After
synchronization, the API recalculates the affected students' attendance
percentages from the attendance ledger.

The current browser queue uses localStorage. IndexedDB and per-session
idempotency keys would be stronger choices for a production system.

### Internal marks

Internal marks have three components:

-   Assignment: 10 marks
-   Quiz: 10 marks
-   Mid-semester: 20 marks

The API validates component ranges and rejects edits after a marks
record has been locked.

### Fee payments

Payments are simulated. An office-admin user can record a test payment.
The API validates the student and amount, rejects overpayments, updates
the outstanding balance in a transaction, creates a `TEST-...` receipt
and records an audit event. No bank or payment provider is contacted.

### Read-only assistant

The assistant supports approved question patterns about:

-   Attendance below 75%
-   Outstanding fee dues
-   Internal marks below 24/40

It returns the filters used, matching row count and relevant records. It
does not accept SQL from the browser or modify application data.
Unsupported questions are rejected instead of answered with guesses.

## 11. Exports

Asteria provides two prototype export types:

  --------------------------------------------------------------------------------
  Export                  Format identifier                Purpose
  ----------------------- -------------------------------- -----------------------
  University marks        `university-internal-marks-v1`   Internal marks and
                                                           component scores

  Tally fee dues          `tally-fee-dues-v1`              Student fee balance
                                                           information
  --------------------------------------------------------------------------------

The backend provides export data in JSON responses with these format
identifiers. The frontend creates the downloadable CSV files:

-   `asteria-data-structures-marks.csv`
-   `asteria-fee-dues.csv`

These are prototype formats for review. They are not claimed to be
officially compatible with a university portal or Tally installation.
The final field mapping should follow specifications supplied by the
institution.

## 12. Scope and known limitations

The current implementation focuses on one Engineering College campus and
synthetic data. The following are outside the current prototype scope:

-   Actual payment-gateway integration.
-   Official university marks-upload integration.
-   Official Tally integration.
-   Full multi-campus reporting.
-   Production-grade managed identity.
-   Parent messaging and localization.
-   Admissions conversion into full student records.
-   Leave and payroll integration.
-   Production database migrations and operational monitoring.
-   Persistent SQLite storage until the database path and Render disk
    are configured and verified.

Before using real student or staff data, additional security and privacy
controls are needed, including managed identity, encryption at rest,
appropriate consent handling, retention and deletion policies, rate
limiting, secret rotation, backups and a formal security review.

Asteria is a functional prototype for demonstration, not a
production-ready college ERP.

------------------------------------------------------------------------

**Project:** Asteria --- Academic Operations Workspace\
**Repository:** https://github.com/KrutikaBorase/Isocode\_\
**Live application:** https://isocode-green.vercel.app/\
**Backend API:** https://isocode-1.onrender.com\
**API health check:** https://isocode-1.onrender.com/api/health
