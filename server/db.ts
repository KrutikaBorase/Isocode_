import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const db = new Database(path.join(root, 'asteria.db'))

db.pragma('journal_mode = WAL')
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('faculty', 'office_admin')),
    campus TEXT NOT NULL,
    password_hash TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY,
    roll_no TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    programme TEXT NOT NULL,
    year INTEGER NOT NULL,
    attendance REAL NOT NULL,
    internal_marks INTEGER NOT NULL,
    fee_due INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id),
    subject TEXT NOT NULL,
    class_date TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late')),
    marked_by INTEGER NOT NULL REFERENCES users(id),
    UNIQUE(student_id, subject, class_date)
  );
  CREATE TABLE IF NOT EXISTS marks (
    id INTEGER PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id),
    subject TEXT NOT NULL,
    assignment INTEGER NOT NULL,
    quiz INTEGER NOT NULL,
    mid_sem INTEGER NOT NULL,
    locked_at TEXT,
    locked_by INTEGER REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY,
    actor_id INTEGER NOT NULL REFERENCES users(id),
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS fee_payments (
    id INTEGER PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id),
    amount INTEGER NOT NULL CHECK (amount > 0),
    mode TEXT NOT NULL CHECK (mode = 'test'),
    receipt_no TEXT NOT NULL UNIQUE,
    paid_by INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`)

db.exec('CREATE UNIQUE INDEX IF NOT EXISTS marks_student_subject ON marks(student_id, subject)')

const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }
if (userCount.count === 0) {
  const seed = db.transaction(() => {
    db.prepare('INSERT INTO users (email, name, role, campus, password_hash) VALUES (?, ?, ?, ?, ?)').run(
      'faculty@companya.edu', 'Riya Sharma', 'faculty', 'Engineering College', bcrypt.hashSync('demo1234', 12),
    )
    db.prepare('INSERT INTO users (email, name, role, campus, password_hash) VALUES (?, ?, ?, ?, ?)').run(
      'admin@companya.edu', 'Arjun Das', 'office_admin', 'Engineering College', bcrypt.hashSync('admin1234', 12),
    )
    const insertStudent = db.prepare('INSERT INTO students (roll_no, name, programme, year, attendance, internal_marks, fee_due) VALUES (?, ?, ?, ?, ?, ?, ?)')
    insertStudent.run('ENG-24-CSE-0412', 'Subhashree Mohanty', 'B.Tech CSE', 2, 81.5, 33, 0)
    insertStudent.run('ENG-24-ME-0177', 'Ankit Panda', 'B.Tech Mechanical', 2, 68.2, 21, 45000)
    insertStudent.run('MBA-25-0093', 'Farheen Ali', 'MBA', 1, 92, 36, 0)
  })
  seed()
}

const legacyUsers = db.prepare("SELECT id, password_hash FROM users WHERE password_hash NOT LIKE '$2%'").all() as { id: number; password_hash: string }[]
const updatePassword = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
for (const user of legacyUsers) updatePassword.run(bcrypt.hashSync(user.password_hash, 12), user.id)

export default db
