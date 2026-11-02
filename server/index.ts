import cors from 'cors'
import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import db from './db.js'

const app = express()
const port = Number(process.env.PORT ?? 4000)
const jwtSecret = process.env.JWT_SECRET ?? 'development-only-secret-change-me'

app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' }))
app.use(express.json({ limit: '100kb' }))

type AuthUser = { id: number; email: string; name: string; role: 'faculty' | 'office_admin'; campus: string }
type RequestWithUser = express.Request & { user?: AuthUser }

function auth(request: RequestWithUser, response: express.Response, next: express.NextFunction) {
  const header = request.header('authorization')
  if (!header?.startsWith('Bearer ')) return response.status(401).json({ error: 'Sign-in required.' })
  try {
    request.user = jwt.verify(header.slice(7), jwtSecret) as AuthUser
    next()
  } catch {
    return response.status(401).json({ error: 'Your session has expired. Sign in again.' })
  }
}

function requireRole(...roles: AuthUser['role'][]) {
  return (request: RequestWithUser, response: express.Response, next: express.NextFunction) => {
    if (!request.user || !roles.includes(request.user.role)) return response.status(403).json({ error: 'You do not have access to this action.' })
    next()
  }
}

const credentialsSchema = z.object({ email: z.string().email(), password: z.string().min(6).max(100) })
app.post('/api/auth/login', (request, response) => {
  const parsed = credentialsSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: 'Enter a valid email and password.' })
  const user = db.prepare('SELECT id, email, name, role, campus, password_hash FROM users WHERE email = ?').get(parsed.data.email) as (AuthUser & { password_hash: string }) | undefined
  if (!user || !bcrypt.compareSync(parsed.data.password, user.password_hash)) return response.status(401).json({ error: 'Email or password is incorrect.' })
  const { password_hash: _password, ...safeUser } = user
  const token = jwt.sign(safeUser, jwtSecret, { expiresIn: '8h' })
  response.json({ token, user: safeUser })
})

app.get('/api/students', auth, (request: RequestWithUser, response) => {
  const query = z.object({ search: z.string().max(80).optional() }).safeParse(request.query)
  if (!query.success) return response.status(400).json({ error: 'Invalid search.' })
  const search = query.data.search?.trim()
  const rows = search
    ? db.prepare('SELECT * FROM students WHERE name LIKE ? OR roll_no LIKE ? ORDER BY name').all(`%${search}%`, `%${search}%`)
    : db.prepare('SELECT * FROM students ORDER BY name').all()
  response.json({ students: rows })
})

app.get('/api/attendance', auth, (request: RequestWithUser, response) => {
  const query = z.object({ subject: z.string().min(1).max(100), date: z.string().date() }).safeParse(request.query)
  if (!query.success) return response.status(400).json({ error: 'Subject and a valid date are required.' })
  const rows = db.prepare(`
    SELECT s.roll_no as roll, s.name, s.attendance, a.status
    FROM students s LEFT JOIN attendance a ON a.student_id = s.id AND a.subject = ? AND a.class_date = ?
    ORDER BY s.name
  `).all(query.data.subject, query.data.date)
  response.json({ attendance: rows })
})

const attendanceSchema = z.object({
  subject: z.string().min(1).max(100),
  date: z.string().date(),
  records: z.array(z.object({ roll: z.string().min(1).max(40), status: z.enum(['present', 'absent', 'late']) })).min(1).max(500),
})
app.post('/api/attendance/sync', auth, (request: RequestWithUser, response) => {
  const parsed = attendanceSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: 'Attendance payload is invalid.' })
  const findStudent = db.prepare('SELECT id FROM students WHERE roll_no = ?')
  const save = db.prepare(`
    INSERT INTO attendance (student_id, subject, class_date, status, marked_by) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(student_id, subject, class_date) DO UPDATE SET status = excluded.status, marked_by = excluded.marked_by
  `)
  const transaction = db.transaction(() => {
    for (const record of parsed.data.records) {
      const student = findStudent.get(record.roll) as { id: number } | undefined
      if (!student) throw new Error(`Unknown student roll number: ${record.roll}`)
      save.run(student.id, parsed.data.subject, parsed.data.date, record.status, request.user!.id)
      db.prepare('INSERT INTO audit_log (actor_id, action, entity, entity_id) VALUES (?, ?, ?, ?)').run(request.user!.id, 'attendance.synced', 'attendance', student.id)
    }
  })
  try {
    transaction()
    response.json({ synced: parsed.data.records.length })
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Attendance could not be saved.' })
  }
})

app.get('/api/marks', auth, (request: RequestWithUser, response) => {
  const query = z.object({ subject: z.string().min(1).max(100) }).safeParse(request.query)
  if (!query.success) return response.status(400).json({ error: 'Subject is required.' })
  const rows = db.prepare(`
    SELECT s.roll_no as roll, s.name, m.assignment, m.quiz, m.mid_sem,
      (m.assignment + m.quiz + m.mid_sem) as total, m.locked_at
    FROM students s LEFT JOIN marks m ON m.student_id = s.id AND m.subject = ? ORDER BY s.name
  `).all(query.data.subject)
  response.json({ marks: rows })
})

const marksSchema = z.object({
  subject: z.string().min(1).max(100),
  records: z.array(z.object({ roll: z.string().min(1).max(40), assignment: z.number().int().min(0).max(10), quiz: z.number().int().min(0).max(10), midSem: z.number().int().min(0).max(20) })).min(1).max(500),
})
app.post('/api/marks/lock', auth, requireRole('office_admin', 'faculty'), (request: RequestWithUser, response) => {
  const parsed = marksSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: 'Marks payload is invalid.' })
  const findStudent = db.prepare('SELECT id FROM students WHERE roll_no = ?')
  const existing = db.prepare('SELECT locked_at FROM marks WHERE student_id = ? AND subject = ?')
  const save = db.prepare(`
    INSERT INTO marks (student_id, subject, assignment, quiz, mid_sem, locked_at, locked_by) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
    ON CONFLICT(student_id, subject) DO UPDATE SET
      assignment = excluded.assignment,
      quiz = excluded.quiz,
      mid_sem = excluded.mid_sem,
      locked_at = excluded.locked_at,
      locked_by = excluded.locked_by
  `)
  const transaction = db.transaction(() => {
    for (const record of parsed.data.records) {
      const student = findStudent.get(record.roll) as { id: number } | undefined
      if (!student) throw new Error(`Unknown student roll number: ${record.roll}`)
      const locked = existing.get(student.id, parsed.data.subject) as { locked_at: string | null } | undefined
      if (locked?.locked_at) throw new Error('Some marks are already locked and cannot be changed.')
      save.run(student.id, parsed.data.subject, record.assignment, record.quiz, record.midSem, request.user!.id)
      db.prepare('INSERT INTO audit_log (actor_id, action, entity, entity_id) VALUES (?, ?, ?, ?)').run(request.user!.id, 'marks.locked', 'marks', student.id)
    }
  })
  try {
    transaction()
    response.json({ locked: parsed.data.records.length })
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Marks could not be locked.' })
  }
})

app.get('/api/fees/dues', auth, (_request, response) => {
  response.json({ dues: db.prepare('SELECT roll_no as roll, name, programme, year, fee_due FROM students WHERE fee_due > 0 ORDER BY fee_due DESC').all() })
})

app.use((_request, response) => response.status(404).json({ error: 'Not found.' }))
app.listen(port, () => console.log(`Asteria API listening on http://localhost:${port}`))
