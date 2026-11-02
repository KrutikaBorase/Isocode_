import cors from 'cors'
import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import db from './db.js'

const app = express()
const port = Number(process.env.PORT ?? 4000)
const configuredJwtSecret = process.env.JWT_SECRET
if (process.env.NODE_ENV === 'production' && !configuredJwtSecret) {
  throw new Error('JWT_SECRET must be configured in production.')
}
const jwtSecret = configuredJwtSecret ?? 'development-only-secret-change-me'

app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' }))
app.use(express.json({ limit: '100kb' }))

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', service: 'asteria-api' })
})

type AuthUser = { id: number; email: string; name: string; role: 'faculty' | 'office_admin' | 'parent'; campus: string; student_id?: number }
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
  const staff = db.prepare('SELECT id, email, name, role, campus, password_hash FROM users WHERE email = ?').get(parsed.data.email) as (AuthUser & { password_hash: string }) | undefined
  const parent = db.prepare('SELECT id, email, name, student_id, password_hash FROM parent_users WHERE email = ?').get(parsed.data.email) as (AuthUser & { password_hash: string }) | undefined
  const user = staff ?? (parent ? { ...parent, role: 'parent' as const, campus: 'Engineering College' } : undefined)
  if (!user || !bcrypt.compareSync(parsed.data.password, user.password_hash)) return response.status(401).json({ error: 'Email or password is incorrect.' })
  const { password_hash: _password, ...safeUser } = user
  const token = jwt.sign(safeUser, jwtSecret, { expiresIn: '8h' })
  response.json({ token, user: safeUser })
})

app.get('/api/students', auth, requireRole('faculty', 'office_admin'), (request: RequestWithUser, response) => {
  const query = z.object({ search: z.string().max(80).optional() }).safeParse(request.query)
  if (!query.success) return response.status(400).json({ error: 'Invalid search.' })
  const search = query.data.search?.trim()
  const parentFilter = request.user?.role === 'parent' ? ' AND id = ?' : ''
  const parentParams = request.user?.role === 'parent' ? [request.user.student_id] : []
  const rows = search
    ? db.prepare(`SELECT * FROM students WHERE (name LIKE ? OR roll_no LIKE ?)${parentFilter} ORDER BY name`).all(`%${search}%`, `%${search}%`, ...parentParams)
    : db.prepare(`SELECT * FROM students${parentFilter} ORDER BY name`).all(...parentParams)
  response.json({ students: rows })
})

app.get('/api/dashboard', auth, requireRole('faculty', 'office_admin'), (_request, response) => {
  const summary = db.prepare(`
    SELECT
      COUNT(*) as students,
      ROUND(AVG(attendance), 1) as average_attendance,
      ROUND(AVG(internal_marks), 0) as average_marks,
      SUM(fee_due) as outstanding_fees,
      SUM(CASE WHEN attendance < 75 OR internal_marks < 24 THEN 1 ELSE 0 END) as at_risk_count
    FROM students
  `).get()
  const atRisk = db.prepare(`
    SELECT roll_no as roll, name, programme, year, attendance, internal_marks as marks, fee_due as dues
    FROM students
    WHERE attendance < 75 OR internal_marks < 24
    ORDER BY attendance ASC, internal_marks ASC
  `).all()
  response.json({ summary, atRisk })
})

app.get('/api/modules/admissions', auth, requireRole('office_admin'), (_request, response) => {
  response.json({ applicants: db.prepare('SELECT * FROM applicants ORDER BY created_at DESC, id DESC').all() })
})

const applicantSchema = z.object({ applicationNo: z.string().min(3).max(40), name: z.string().min(2).max(100), programme: z.string().min(2).max(100) })
app.post('/api/modules/admissions', auth, requireRole('office_admin'), (request, response) => {
  const parsed = applicantSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: 'Applicant details are invalid.' })
  try {
    db.prepare('INSERT INTO applicants (application_no, name, programme, status, documents_complete) VALUES (?, ?, ?, ?, 0)').run(parsed.data.applicationNo, parsed.data.name, parsed.data.programme, 'new')
    response.status(201).json({ created: true })
  } catch {
    response.status(409).json({ error: 'Application number already exists.' })
  }
})

app.patch('/api/modules/admissions/:id', auth, requireRole('office_admin'), (request, response) => {
  const status = z.enum(['new', 'documents_pending', 'confirmed']).safeParse(request.body.status)
  const id = Number(request.params.id)
  if (!status.success || !Number.isInteger(id)) return response.status(400).json({ error: 'Applicant status is invalid.' })
  const result = db.prepare('UPDATE applicants SET status = ?, documents_complete = ? WHERE id = ?').run(status.data, status.data === 'confirmed' ? 1 : 0, id)
  if (!result.changes) return response.status(404).json({ error: 'Applicant not found.' })
  response.json({ updated: true })
})

app.get('/api/modules/leave', auth, requireRole('faculty', 'office_admin'), (_request, response) => {
  response.json({ requests: db.prepare('SELECT * FROM leave_requests ORDER BY from_date DESC').all() })
})

const leaveSchema = z.object({ staffName: z.string().min(2).max(100), leaveType: z.string().min(2).max(40), fromDate: z.string().date(), toDate: z.string().date(), reason: z.string().min(3).max(240) })
app.post('/api/modules/leave', auth, requireRole('faculty', 'office_admin'), (request, response) => {
  const parsed = leaveSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: 'Leave request is invalid.' })
  db.prepare('INSERT INTO leave_requests (staff_name, leave_type, from_date, to_date, reason) VALUES (?, ?, ?, ?, ?)').run(parsed.data.staffName, parsed.data.leaveType, parsed.data.fromDate, parsed.data.toDate, parsed.data.reason)
  response.status(201).json({ created: true })
})

app.patch('/api/modules/leave/:id', auth, requireRole('office_admin'), (request, response) => {
  const status = z.enum(['pending', 'approved', 'rejected']).safeParse(request.body.status)
  const id = Number(request.params.id)
  if (!status.success || !Number.isInteger(id)) return response.status(400).json({ error: 'Leave status is invalid.' })
  const result = db.prepare('UPDATE leave_requests SET status = ? WHERE id = ?').run(status.data, id)
  if (!result.changes) return response.status(404).json({ error: 'Leave request not found.' })
  response.json({ updated: true })
})

app.get('/api/modules/calendar', auth, requireRole('faculty', 'office_admin'), (_request, response) => {
  response.json({ events: db.prepare('SELECT * FROM academic_calendar ORDER BY event_date').all() })
})

app.get('/api/modules/masters', auth, requireRole('faculty', 'office_admin'), (_request, response) => {
  response.json({
    programmes: db.prepare('SELECT * FROM programmes ORDER BY name').all(),
    subjects: db.prepare('SELECT * FROM subjects ORDER BY programme, semester, name').all(),
  })
})

app.get('/api/modules/parent', auth, requireRole('parent'), (request: RequestWithUser, response) => {
  const student = db.prepare('SELECT roll_no as roll, name, programme, year, attendance, internal_marks, fee_due FROM students WHERE id = ?').get(request.user?.student_id)
  response.json({ student })
})

app.get('/api/exports/marks', auth, requireRole('faculty', 'office_admin'), (request, response) => {
  const subject = z.string().min(1).max(100).parse(request.query.subject ?? 'Data Structures')
  response.json({ format: 'university-internal-marks-v1', subject, rows: db.prepare(`SELECT s.roll_no as roll_number, s.name, s.programme, s.year, COALESCE(m.assignment, 0) as assignment_10, COALESCE(m.quiz, 0) as quiz_10, COALESCE(m.mid_sem, 0) as mid_sem_20, COALESCE(m.assignment + m.quiz + m.mid_sem, 0) as total_40 FROM students s LEFT JOIN marks m ON m.student_id = s.id AND m.subject = ? ORDER BY s.roll_no`).all(subject) })
})

app.get('/api/exports/tally', auth, requireRole('office_admin'), (_request, response) => {
  response.json({ format: 'tally-fee-dues-v1', rows: db.prepare("SELECT roll_no as student_roll, name as student_name, programme, fee_due as outstanding_amount FROM students WHERE fee_due > 0 ORDER BY roll_no").all() })
})

app.get('/api/attendance', auth, requireRole('faculty', 'office_admin'), (request: RequestWithUser, response) => {
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
app.post('/api/attendance/sync', auth, requireRole('faculty', 'office_admin'), (request: RequestWithUser, response) => {
  const parsed = attendanceSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: 'Attendance payload is invalid.' })
  const findStudent = db.prepare('SELECT id FROM students WHERE roll_no = ?')
  const save = db.prepare(`
    INSERT INTO attendance (student_id, subject, class_date, status, marked_by) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(student_id, subject, class_date) DO UPDATE SET status = excluded.status, marked_by = excluded.marked_by
  `)
  const recalculateAttendance = db.prepare(`
    UPDATE students
    SET attendance = (
      SELECT ROUND(100.0 * SUM(CASE WHEN status IN ('present', 'late') THEN 1 ELSE 0 END) / COUNT(*), 1)
      FROM attendance
      WHERE student_id = ?
    )
    WHERE id = ?
  `)
  const transaction = db.transaction(() => {
    for (const record of parsed.data.records) {
      const student = findStudent.get(record.roll) as { id: number } | undefined
      if (!student) throw new Error(`Unknown student roll number: ${record.roll}`)
      save.run(student.id, parsed.data.subject, parsed.data.date, record.status, request.user!.id)
      recalculateAttendance.run(student.id, student.id)
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

app.get('/api/marks', auth, requireRole('faculty', 'office_admin'), (request: RequestWithUser, response) => {
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

app.get('/api/fees/dues', auth, requireRole('faculty', 'office_admin'), (_request, response) => {
  response.json({ dues: db.prepare('SELECT roll_no as roll, name, programme, year, fee_due FROM students WHERE fee_due > 0 ORDER BY fee_due DESC').all() })
})

app.get('/api/audit', auth, requireRole('office_admin'), (_request, response) => {
  const rows = db.prepare(`
    SELECT a.action, a.entity, a.entity_id, a.created_at, u.name as actor
    FROM audit_log a JOIN users u ON u.id = a.actor_id
    ORDER BY a.created_at DESC, a.id DESC LIMIT 50
  `).all()
  response.json({ entries: rows })
})

const paymentSchema = z.object({
  roll: z.string().min(1).max(40),
  amount: z.number().int().positive().max(10000000),
})
app.post('/api/fees/payments', auth, requireRole('office_admin'), (request: RequestWithUser, response) => {
  const parsed = paymentSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: 'Enter a valid payment amount.' })
  const student = db.prepare('SELECT id, name, fee_due FROM students WHERE roll_no = ?').get(parsed.data.roll) as { id: number; name: string; fee_due: number } | undefined
  if (!student) return response.status(404).json({ error: 'Student was not found.' })
  if (parsed.data.amount > student.fee_due) return response.status(400).json({ error: 'Payment cannot be greater than the outstanding due.' })

  const receiptNo = `TEST-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${String(Date.now()).slice(-6)}`
  const transaction = db.transaction(() => {
    db.prepare('UPDATE students SET fee_due = fee_due - ? WHERE id = ?').run(parsed.data.amount, student.id)
    db.prepare('INSERT INTO fee_payments (student_id, amount, mode, receipt_no, paid_by) VALUES (?, ?, ?, ?, ?)').run(student.id, parsed.data.amount, 'test', receiptNo, request.user!.id)
    db.prepare('INSERT INTO audit_log (actor_id, action, entity, entity_id) VALUES (?, ?, ?, ?)').run(request.user!.id, 'fee_payment.recorded', 'student', student.id)
  })
  try {
    transaction()
    response.status(201).json({ receiptNo, student: student.name, amount: parsed.data.amount, remainingDue: student.fee_due - parsed.data.amount, mode: 'test' })
  } catch {
    response.status(500).json({ error: 'Payment could not be recorded. No balance was changed.' })
  }
})

const assistantSchema = z.object({ question: z.string().trim().min(3).max(240) })
app.post('/api/assistant/ask', auth, requireRole('faculty', 'office_admin'), (request: RequestWithUser, response) => {
  const parsed = assistantSchema.safeParse(request.body)
  if (!parsed.success) return response.status(400).json({ error: 'Ask a question with at least three characters.' })

  const question = parsed.data.question.toLowerCase()
  const filters: string[] = ['Campus: Engineering College']
  let rows: unknown[]
  let answer: string

  if (question.includes('below 75') && (question.includes('attendance') || question.includes('present'))) {
    const yearTwoOnly = question.includes('second-year') || question.includes('second year') || question.includes('year 2')
    if (yearTwoOnly) filters.push('Year: 2')
    filters.push('Attendance: below 75%')
    rows = yearTwoOnly
      ? db.prepare('SELECT roll_no as roll, name, programme, year, attendance FROM students WHERE year = ? AND attendance < ? ORDER BY attendance ASC').all(2, 75)
      : db.prepare('SELECT roll_no as roll, name, programme, year, attendance FROM students WHERE attendance < ? ORDER BY attendance ASC').all(75)
    answer = `${rows.length} ${yearTwoOnly ? 'second-year ' : ''}student${rows.length === 1 ? '' : 's'} ${rows.length === 1 ? 'is' : 'are'} below 75% attendance.`
  } else if (question.includes('fee') || question.includes('due')) {
    filters.push('Fee due: greater than ₹0')
    rows = db.prepare('SELECT roll_no as roll, name, programme, year, fee_due FROM students WHERE fee_due > 0 ORDER BY fee_due DESC').all()
    answer = `${rows.length} student${rows.length === 1 ? ' has' : 's have'} an outstanding fee due.`
  } else if (question.includes('marks') && (question.includes('below') || question.includes('low'))) {
    filters.push('Internal marks: below 24/40')
    rows = db.prepare('SELECT roll_no as roll, name, programme, year, internal_marks FROM students WHERE internal_marks < ? ORDER BY internal_marks ASC').all(24)
    answer = `${rows.length} student${rows.length === 1 ? ' is' : 's are'} below the internal marks benchmark.`
  } else {
    return response.status(422).json({
      error: 'I can answer attendance below 75%, outstanding fee dues, or internal marks below 24/40.',
      supportedQuestions: ['How many second-year students are below 75% attendance?', 'Who has fee dues?', 'Which students have low marks?'],
    })
  }

  response.json({ answer, filters, rowCount: rows.length, rows, readOnly: true })
})

app.use((_request, response) => response.status(404).json({ error: 'Not found.' }))
app.listen(port, () => console.log(`Asteria API listening on http://localhost:${port}`))
