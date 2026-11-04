# Asteria — Campus Operations Workspace

Asteria is an academic operations workspace designed for a single campus. It brings essential academic and administrative workflows together in one interface.

### Key Features

- Role-based sign-in for faculty and office administrators
- Student dashboard and directory
- Attendance management with offline queueing and reconnect sync
- Internal marks management with moderation lock and audit events
- Fee dues, test-mode receipts, and Tally-shaped exports
- Explainable at-risk student flags
- Read-only campus assistant
- Admissions, leave management, calendar, master data, parent access, audit trail, and exports

### Tech Stack

React 19, TypeScript, Vite, Express 5, SQLite, JWT, bcrypt, and Zod.

All sample records and demo credentials are synthetic and intended for demonstration purposes.

### Live Demo

- **Application:** https://isocode-green.vercel.app/
- **Backend API:** https://isocode-1.onrender.com
- **API Health Check:** https://isocode-1.onrender.com/api/health

### Run Locally

**Prerequisites:** Node.js 20 or later and npm.

1. Clone the repository:

```bash
git clone https://github.com/KrutikaBorase/Isocode_.git
cd Isocode_
```

2. Install dependencies:

```bash
npm ci
```

3. Start the backend API:

```bash
npm run api
```

4. Open a second terminal and start the frontend:

```bash
npm run dev
```

5. Open http://localhost:5173 in your browser.

See [deployment.md](./deployment.md) for environment variables, demo accounts, deployment instructions, and known prototype limitations.

### Validation

Run the following commands:

```bash
npm test
npm run lint
npm run build
```

### Technical Documentation

For the system architecture, design decisions, data model, API design, workflows, assumptions, and limitations, see the [Technical Design Document](./TDD.docx).

---

**Project:** Asteria  
**Repository:** https://github.com/KrutikaBorase/Isocode_
