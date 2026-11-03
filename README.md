# Asteria campus operations

Asteria is a focused academic operations workspace for one Company A campus. It brings the core daily workflows into one calm interface:

- faculty and office-admin sign-in with role-protected API routes
- live student dashboard and directory
- mobile-first attendance with offline queueing and reconnect sync
- component-level internal marks with moderation lock and audit events
- fee dues, test-mode receipts, and Tally-shaped export
- explainable at-risk flags and a read-only campus assistant
- seeded admissions, leave, calendar, masters, parent, audit, and export modules

The app uses React, TypeScript, Vite, Express, SQLite, JWT, bcrypt, and Zod. All sample records and demo credentials are synthetic.

## Run locally

See [deployment.md](./deployment.md) for setup, environment variable names, demo accounts, and known prototype boundaries.

```bash
npm install
npm run api
# in a second terminal
npm run dev
```

Open `http://localhost:5173`.

## Validate

```bash
npm test
npm run lint
npm run build
```

The submission design decisions, data model, workflow notes, and assumptions are in [TDD.docx](./TDD.docx).
