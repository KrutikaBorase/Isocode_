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

The API creates a local SQLite database (`asteria.db`) and seeds the sample campus data on first start. The database is intentionally ignored by Git.

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

Do not commit values for these variables.

## Demo accounts

- Faculty: `faculty@companya.edu` / `demo1234`
- Office admin: `admin@companya.edu` / `admin1234`

These are synthetic demo accounts only. Replace them with managed identity before production use.

## Scope and known limits

This submission focuses on one Engineering College campus and the core build: sign-in, student snapshot, attendance marking/sync, marks moderation lock, fee dues, and the fixed-rule at-risk flag. Payment links, Tally export, university upload formats, multilingual parent messages, and the natural-language read-only assistant are represented as next-phase integration points rather than connected to outside systems.
