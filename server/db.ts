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
  CREATE TABLE IF NOT EXISTS applicants (
    id INTEGER PRIMARY KEY,
    application_no TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    programme TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('new', 'documents_pending', 'confirmed')),
    documents_complete INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS leave_requests (
    id INTEGER PRIMARY KEY,
    staff_name TEXT NOT NULL,
    leave_type TEXT NOT NULL,
    from_date TEXT NOT NULL,
    to_date TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS academic_calendar (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    event_date TEXT NOT NULL,
    kind TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS programmes (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    department TEXT NOT NULL,
    duration_years INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    programme TEXT NOT NULL,
    semester INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS parent_users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    student_id INTEGER NOT NULL REFERENCES students(id),
    password_hash TEXT NOT NULL
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

const insertStudent = db.prepare('INSERT OR IGNORE INTO students (roll_no, name, programme, year, attendance, internal_marks, fee_due) VALUES (?, ?, ?, ?, ?, ?, ?)')
const extraStudents = [
  ['ENG-24-CSE-0413', 'Aarav Patnaik', 'B.Tech CSE', 2, 88.4, 31, 12000],
  ['ENG-24-CSE-0414', 'Priyanka Sahu', 'B.Tech CSE', 2, 76.8, 28, 0],
  ['ENG-24-CSE-0415', 'Rohan Behera', 'B.Tech CSE', 2, 72.1, 23, 18000],
  ['ENG-24-CSE-0416', 'Meera Rout', 'B.Tech CSE', 2, 94.2, 37, 0],
  ['ENG-24-CSE-0417', 'Siddharth Nayak', 'B.Tech CSE', 2, 83.6, 30, 0],
  ['ENG-24-CSE-0418', 'Ishita Das', 'B.Tech CSE', 2, 69.5, 26, 22000],
  ['ENG-24-ME-0178', 'Sourav Jena', 'B.Tech Mechanical', 2, 79.4, 27, 15000],
  ['ENG-24-ME-0179', 'Nandini Mishra', 'B.Tech Mechanical', 2, 91.3, 35, 0],
  ['ENG-24-ME-0180', 'Debashis Mohapatra', 'B.Tech Mechanical', 2, 73.2, 22, 30000],
  ['ENG-24-EE-0221', 'Tanvi Singh', 'B.Tech Electrical', 2, 86.8, 32, 0],
  ['ENG-24-EE-0222', 'Kunal Pradhan', 'B.Tech Electrical', 2, 67.9, 20, 25000],
  ['ENG-24-CE-0111', 'Ananya Lenka', 'B.Tech Civil', 2, 89.1, 34, 0],
  ['ENG-24-CE-0112', 'Vivek Panda', 'B.Tech Civil', 2, 78.6, 29, 10000],
  ['ENG-24-IT-0301', 'Sanjana Behera', 'B.Tech IT', 2, 93.5, 38, 0],
  ['ENG-24-IT-0302', 'Aditya Mohanty', 'B.Tech IT', 2, 71.4, 24, 16000],
  ['ENG-24-IT-0303', 'Kritika Das', 'B.Tech IT', 2, 84.9, 31, 0],
  ['MBA-25-0094', 'Neha Kulkarni', 'MBA', 1, 80.2, 30, 14000],
]
for (const student of extraStudents) insertStudent.run(...student)

const seedReferenceData = db.transaction(() => {
  const programme = db.prepare('INSERT OR IGNORE INTO programmes (name, department, duration_years) VALUES (?, ?, ?)')
  programme.run('B.Tech CSE', 'Computer Science & Engineering', 4)
  programme.run('B.Tech Mechanical', 'Mechanical Engineering', 4)
  programme.run('B.Tech Electrical', 'Electrical Engineering', 4)
  programme.run('B.Tech Civil', 'Civil Engineering', 4)
  programme.run('B.Tech IT', 'Information Technology', 4)
  programme.run('MBA', 'Management Studies', 2)
  const subject = db.prepare('INSERT OR IGNORE INTO subjects (name, programme, semester) VALUES (?, ?, ?)')
  subject.run('Data Structures', 'B.Tech CSE', 4)
  subject.run('Operating Systems', 'B.Tech CSE', 4)
  subject.run('Database Management', 'B.Tech CSE', 4)
  const applicant = db.prepare('INSERT OR IGNORE INTO applicants (application_no, name, programme, status, documents_complete) VALUES (?, ?, ?, ?, ?)')
  applicant.run('APP-2026-001', 'Ritika Mohanty', 'B.Tech CSE', 'documents_pending', 0)
  applicant.run('APP-2026-002', 'Yash Agarwal', 'B.Tech Mechanical', 'new', 0)
  applicant.run('APP-2026-003', 'Sohini Das', 'B.Tech IT', 'confirmed', 1)
  const leave = db.prepare('INSERT OR IGNORE INTO leave_requests (id, staff_name, leave_type, from_date, to_date, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
  leave.run(1, 'Riya Sharma', 'Casual leave', '2026-11-06', '2026-11-07', 'Family commitment', 'pending')
  leave.run(2, 'Arjun Das', 'Earned leave', '2026-11-10', '2026-11-12', 'Personal work', 'approved')
  const event = db.prepare('INSERT OR IGNORE INTO academic_calendar (id, title, event_date, kind) VALUES (?, ?, ?, ?)')
  event.run(1, 'Internal marks moderation', '2026-11-08', 'assessment')
  event.run(2, 'Parent interaction day', '2026-11-15', 'engagement')
})
seedReferenceData()

const parentStudent = db.prepare('SELECT id FROM students WHERE roll_no = ?').get('ENG-24-CSE-0412') as { id: number }
db.prepare('INSERT OR IGNORE INTO parent_users (email, name, student_id, password_hash) VALUES (?, ?, ?, ?)').run(
  'parent.subhashree@companya.edu', 'Subhashree Mohanty parent', parentStudent.id, bcrypt.hashSync('parent1234', 12),
)

const legacyUsers = db.prepare("SELECT id, password_hash FROM users WHERE password_hash NOT LIKE '$2%'").all() as { id: number; password_hash: string }[]
const updatePassword = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
for (const user of legacyUsers) updatePassword.run(bcrypt.hashSync(user.password_hash, 12), user.id)

export default db
