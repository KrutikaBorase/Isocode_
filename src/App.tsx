import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDollarSign,
  ClipboardCheck,
  FileText,
  Home,
  LogOut,
  Menu,
  MoreHorizontal,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
} from 'lucide-react'
import './App.css'
import { isAtRisk } from './risk'

type View = 'overview' | 'attendance' | 'marks' | 'fees' | 'students' | 'audit'
type AttendanceStatus = 'present' | 'absent' | 'late'
type SessionUser = { name: string; role: 'faculty' | 'office_admin'; campus: string }
type ApiStatus = 'checking' | 'online' | 'offline'
type DashboardData = {
  summary: { students: number; average_attendance: number; average_marks: number; outstanding_fees: number; at_risk_count: number }
  atRisk: Array<{ roll: string; name: string; programme: string; year: number; attendance: number; marks: number; dues: number }>
}
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api'
const ATTENDANCE_QUEUE_KEY = 'asteria:attendance-queue'

async function apiRequest<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  })
  const body = await response.json() as T & { error?: string }
  if (!response.ok) throw new Error(body.error ?? 'Something went wrong. Please try again.')
  return body
}

function downloadCsv(filename: string, rows: Array<Record<string, string | number>>) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`
  const csv = [headers.join(','), ...rows.map((row) => headers.map((header) => escape(row[header] ?? '')).join(','))].join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const students = [
  { roll: 'ENG-24-CSE-0412', name: 'Subhashree Mohanty', programme: 'B.Tech CSE', year: 2, attendance: 81.5, marks: 33, dues: 0 },
  { roll: 'ENG-24-ME-0177', name: 'Ankit Panda', programme: 'B.Tech Mechanical', year: 2, attendance: 68.2, marks: 21, dues: 45000 },
  { roll: 'MBA-25-0093', name: 'Farheen Ali', programme: 'MBA', year: 1, attendance: 92, marks: 36, dues: 0 },
]

const navItems: { id: View; label: string; icon: typeof Home }[] = [
  { id: 'overview', label: 'Overview', icon: Home },
  { id: 'attendance', label: 'Attendance', icon: ClipboardCheck },
  { id: 'marks', label: 'Internal marks', icon: BookOpen },
  { id: 'fees', label: 'Fee dues', icon: CircleDollarSign },
]

const initialAttendance: Record<string, AttendanceStatus> = {
  'ENG-24-CSE-0412': 'present',
  'ENG-24-ME-0177': 'absent',
  'MBA-25-0093': 'present',
}

function Login({ onLogin }: { onLogin: (token: string, user: SessionUser) => void }) {
  const [email, setEmail] = useState('faculty@companya.edu')
  const [password, setPassword] = useState('demo1234')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!email || password.length < 6) {
      setError('Use the demo credentials or enter a valid password.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await apiRequest<{ token: string; user: SessionUser }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
      onLogin(result.token, result.user)
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Sign-in failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <div className="login-art">
        <div className="brand brand-light"><span className="brand-mark">A</span> Asteria</div>
        <div className="login-quote">
          <p className="eyebrow">Company A · Academic operations</p>
          <h1>One calm place for every student story.</h1>
          <p>Attendance, marks and fee health for the campus team — without the spreadsheet chase.</p>
          <div className="login-stat"><strong>95%</strong><span>same-day attendance target</span></div>
        </div>
        <div className="art-shape shape-one" />
        <div className="art-shape shape-two" />
      </div>
      <div className="login-panel">
        <div className="brand"><span className="brand-mark">A</span> Asteria</div>
        <div className="login-content">
          <p className="eyebrow">Welcome back</p>
          <h2>Sign in to your campus</h2>
          <p className="muted">Use your Company A staff account to continue.</p>
          <form onSubmit={submit} className="login-form">
            <label>Email address<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" /></label>
            <label>Password<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" /></label>
            {error && <div className="form-error"><AlertTriangle size={16} />{error}</div>}
            <button className="primary-button full-width" type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'} {!loading && <ArrowUpRight size={17} />}</button>
          </form>
          <div className="demo-hint"><ShieldCheck size={17} /><span><strong>Demo access</strong><br />faculty@companya.edu · demo1234</span></div>
        </div>
        <p className="login-footer">© 2025 Company A · Privacy & security</p>
      </div>
    </main>
  )
}

function App() {
  const [signedIn, setSignedIn] = useState(false)
  const [token, setToken] = useState('')
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null)
  const [view, setView] = useState<View>('overview')
  const [mobileNav, setMobileNav] = useState(false)
  const [attendance, setAttendance] = useState(initialAttendance)
  const [saved, setSaved] = useState(false)
  const [syncError, setSyncError] = useState('')
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ roll_no: string; name: string; programme: string }>>([])
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking')

  const atRisk = useMemo(() => students.filter(isAtRisk), [])

  useEffect(() => {
    if (!token) return
    const syncQueuedAttendance = () => {
      const queued = localStorage.getItem(ATTENDANCE_QUEUE_KEY)
      if (!queued) return
      apiRequest('/attendance/sync', { method: 'POST', body: queued }, token)
        .then(() => localStorage.removeItem(ATTENDANCE_QUEUE_KEY))
        .catch(() => undefined)
    }
    window.addEventListener('online', syncQueuedAttendance)
    syncQueuedAttendance()
    return () => window.removeEventListener('online', syncQueuedAttendance)
  }, [token])

  useEffect(() => {
    if (!token || search.trim().length < 2) {
      return
    }
    const timer = window.setTimeout(() => {
      apiRequest<{ students: Array<{ roll_no: string; name: string; programme: string }> }>(`/students?search=${encodeURIComponent(search.trim())}`, {}, token)
        .then((result) => setSearchResults(result.students))
        .catch(() => setSearchResults([]))
    }, 180)
    return () => window.clearTimeout(timer)
  }, [search, token])

  useEffect(() => {
    if (!token) return
    let active = true
    const checkApi = () => {
      apiRequest<{ status: string }>('/health')
        .then(() => { if (active) setApiStatus('online') })
        .catch(() => { if (active) setApiStatus('offline') })
    }
    checkApi()
    const interval = window.setInterval(checkApi, 30000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [token])

  if (!signedIn || !currentUser) return <Login onLogin={(nextToken, user) => { setToken(nextToken); setCurrentUser(user); setSignedIn(true) }} />

  function markAttendance(roll: string, status: AttendanceStatus) {
    setAttendance((current) => ({ ...current, [roll]: status }))
    setSaved(false)
  }

  function saveAttendance() {
    setSaved(false)
    setSyncError('')
    const body = JSON.stringify({ subject: 'Data Structures', date: '2025-02-03', records: Object.entries(attendance).map(([roll, status]) => ({ roll, status })) })
    localStorage.setItem(ATTENDANCE_QUEUE_KEY, body)
    if (!navigator.onLine) {
      setSaved(true)
      setSyncError('Saved offline. It will sync automatically when the connection returns.')
      return
    }
    apiRequest('/attendance/sync', { method: 'POST', body }, token)
      .then(() => {
        localStorage.removeItem(ATTENDANCE_QUEUE_KEY)
        setSaved(true)
      })
      .catch((error: unknown) => setSyncError(error instanceof Error ? error.message : 'Attendance is queued for retry.'))
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <div className="brand"><span className="brand-mark">A</span> Asteria</div>
        <div className="campus-switcher"><div className="campus-icon">KI</div><div><small>Campus</small><strong>Engineering College</strong></div><ChevronDown size={16} /></div>
        <nav className="main-nav" aria-label="Main navigation">
          <p className="nav-label">Workspace</p>
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${view === id ? 'active' : ''}`} onClick={() => { setView(id); setMobileNav(false) }}><Icon size={18} /><span>{label}</span>{id === 'attendance' && <span className="nav-badge">3</span>}</button>
          ))}
          <p className="nav-label nav-label-spaced">Manage</p>
          <button className={`nav-item ${view === 'students' ? 'active' : ''}`} onClick={() => { setView('students'); setMobileNav(false) }}><Users size={18} /><span>Students</span></button>
          {currentUser.role === 'office_admin' && <button className={`nav-item ${view === 'audit' ? 'active' : ''}`} onClick={() => { setView('audit'); setMobileNav(false) }}><ShieldCheck size={18} /><span>Audit trail</span></button>}
          <button className="nav-item"><CalendarDays size={18} /><span>Academic calendar</span></button>
          <button className="nav-item"><SlidersHorizontal size={18} /><span>Masters</span></button>
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card"><Sparkles size={17} /><strong>Need a hand?</strong><span>Ask Asteria about your campus data.</span><button onClick={() => setAssistantOpen(true)}>Open assistant <ArrowUpRight size={14} /></button></div>
          <button className="profile-row"><span className="avatar">RS</span><span className="profile-copy"><strong>Riya Sharma</strong><small>Faculty · CSE</small></span><MoreHorizontal size={18} /></button>
        </div>
      </aside>
      {mobileNav && <button className="mobile-backdrop" onClick={() => setMobileNav(false)} aria-label="Close menu" />}
      <main className="main-content">
        <header className="topbar"><button className="icon-button mobile-menu" onClick={() => setMobileNav(true)}><Menu size={21} /></button><div className="breadcrumb"><span>Engineering College</span><span>/</span><strong>{navItems.find((item) => item.id === view)?.label}</strong></div><div className="top-actions"><span className={`api-status ${apiStatus}`}><span className="api-status-dot" />{apiStatus === 'checking' ? 'Checking connection' : apiStatus === 'online' ? 'System online' : 'Offline mode'}</span><div className="search-wrap"><div className="search-box"><Search size={16} /><input value={search} onChange={(event) => { const value = event.target.value; setSearch(value); if (value.trim().length < 2) setSearchResults([]) }} placeholder="Search students..." aria-label="Search students" /></div>{searchResults.length > 0 && <div className="search-results">{searchResults.map((student) => <button key={student.roll_no} onClick={() => { setSearch(''); setSearchResults([]); setView('students') }}><span className="avatar avatar-small">{student.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><span><strong>{student.name}</strong><small>{student.roll_no} · {student.programme}</small></span></button>)}</div>}</div><button className="icon-button"><AlertTriangle size={19} /><span className="notification-dot" /></button><button className="icon-button" onClick={() => { setSignedIn(false); setCurrentUser(null); setToken(''); setApiStatus('checking') }} title="Sign out"><LogOut size={18} /></button></div></header>
        <div className="page-content">
          {view === 'overview' && <LiveOverview token={token} fallbackAtRisk={atRisk} onNavigate={setView} />}
          {view === 'attendance' && <LiveAttendance token={token} attendance={attendance} onLoad={setAttendance} onMark={markAttendance} saved={saved} syncError={syncError} onSave={saveAttendance} />}
          {view === 'marks' && <LiveMarks token={token} />}
          {view === 'fees' && <LiveFees token={token} canRecordPayments={currentUser.role === 'office_admin'} />}
          {view === 'students' && <LiveStudents token={token} />}
          {view === 'audit' && currentUser.role === 'office_admin' && <AuditTrail token={token} />}
        </div>
        {assistantOpen && <AssistantPanel token={token} onClose={() => setAssistantOpen(false)} />}
      </main>
    </div>
  )
}

function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="muted">{description}</p></div>{action}</div>
}

function LiveOverview({ token, fallbackAtRisk, onNavigate }: { token: string; fallbackAtRisk: typeof students; onNavigate: (view: View) => void }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    apiRequest<DashboardData>('/dashboard', {}, token)
      .then(setData)
      .catch((requestError: unknown) => setError(requestError instanceof Error ? requestError.message : 'Dashboard data could not be loaded.'))
  }, [token])

  if (error) return <div className="panel error-card"><AlertTriangle size={18} /><div><strong>Dashboard unavailable</strong><span>{error}</span></div><button className="secondary-button" onClick={() => window.location.reload()}>Retry</button></div>
  if (!data) return <div className="panel loading-card"><div className="loading-pulse" /><strong>Loading campus overview…</strong><span>Refreshing today’s academic signals.</span></div>
  return <Overview atRisk={data.atRisk.length ? data.atRisk : fallbackAtRisk} onNavigate={onNavigate} summary={data.summary} />
}

function Overview({ atRisk, onNavigate, summary }: { atRisk: Array<{ roll: string; name: string; programme: string; year: number; attendance: number; marks: number; dues: number }>; onNavigate: (view: View) => void; summary: DashboardData['summary'] }) {
  return <><PageHeader eyebrow="Monday, 03 February 2025" title="Good morning, Riya" description="Here’s what needs your attention across B.Tech CSE today." action={<button className="secondary-button"><FileText size={17} /> View reports</button>} />
    <div className="metric-grid"><Metric label="Students tracked" value={String(summary.students)} detail={`${summary.at_risk_count} need attention`} trend="up" icon={<Users />} /><Metric label="Average attendance" value={`${summary.average_attendance}%`} detail="75% fixed threshold" trend={summary.average_attendance >= 75 ? 'up' : 'down'} icon={<ClipboardCheck />} /><Metric label="Average internal marks" value={`${summary.average_marks}/40`} detail="24/40 benchmark" trend={summary.average_marks >= 24 ? 'up' : 'neutral'} icon={<BookOpen />} /><Metric label="Fee dues" value={`₹${summary.outstanding_fees.toLocaleString('en-IN')}`} detail="Outstanding balance" trend={summary.outstanding_fees ? 'down' : 'up'} icon={<CircleDollarSign />} /></div>
    <div className="content-grid"><section className="panel attention-panel"><div className="panel-heading"><div><p className="eyebrow">Needs attention</p><h2>At-risk students</h2></div><span className="ai-chip"><Sparkles size={14} /> AI assisted</span></div><p className="panel-intro">Students below 75% attendance or trending below the internal marks benchmark.</p><div className="risk-list">{atRisk.map((student) => <div className="risk-row" key={student.roll}><span className="avatar avatar-soft">{student.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><div className="student-copy"><strong>{student.name}</strong><small>{student.roll} · {student.programme}</small></div><div className="risk-values"><span className={student.attendance < 75 ? 'risk-number' : ''}>{student.attendance}% <small>attendance</small></span><span className={student.marks < 24 ? 'risk-number' : ''}>{student.marks}/40 <small>marks</small></span></div><button className="row-action" title="Create mentor task"><ArrowUpRight size={17} /></button></div>)}</div><button className="text-button" onClick={() => onNavigate('attendance')}>Review attendance <ArrowUpRight size={15} /></button></section>
      <section className="panel schedule-panel"><div className="panel-heading"><div><p className="eyebrow">Today · 03 Feb</p><h2>Teaching schedule</h2></div><button className="icon-button"><MoreHorizontal size={18} /></button></div><div className="schedule-list"><Schedule time="09:00" subject="Data Structures" group="B.Tech CSE · Year 2" room="Room 204" active /><Schedule time="11:00" subject="Operating Systems" group="B.Tech CSE · Year 2" room="Lab 3" /><Schedule time="14:00" subject="Elective: Cloud" group="B.Tech CSE · Year 2" room="Room 112" /></div><button className="secondary-button schedule-button" onClick={() => onNavigate('attendance')}>Take attendance <ClipboardCheck size={16} /></button></section></div>
    <section className="panel students-panel"><div className="panel-heading"><div><p className="eyebrow">Sample cohort · B.Tech CSE Year 2</p><h2>Student snapshot</h2></div><button className="text-button">View all <ArrowUpRight size={15} /></button></div><StudentTable /></section>
  </>
}

function Metric({ label, value, detail, trend, icon }: { label: string; value: string; detail: string; trend: 'up' | 'down' | 'neutral'; icon: React.ReactNode }) {
  return <div className="metric-card"><div className="metric-top"><span className="metric-icon">{icon}</span><MoreHorizontal size={17} className="muted-icon" /></div><p>{label}</p><strong>{value}</strong><small className={`trend ${trend}`}>{trend === 'up' ? '↗' : trend === 'down' ? '↘' : '—'} {detail}</small></div>
}

function Schedule({ time, subject, group, room, active }: { time: string; subject: string; group: string; room: string; active?: boolean }) {
  return <div className={`schedule-row ${active ? 'schedule-active' : ''}`}><time>{time}</time><div className="schedule-line" /><div className="schedule-copy"><strong>{subject}</strong><span>{group}</span><small>{room}</small></div>{active && <span className="live-pill">Now</span>}</div>
}

function StudentTable() {
  return <div className="table-wrap"><table><thead><tr><th>Student</th><th>Programme</th><th>Attendance</th><th>Internal marks</th><th>Fee due</th><th /></tr></thead><tbody>{students.map((student) => <tr key={student.roll}><td><div className="table-student"><span className="avatar avatar-small">{student.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><span><strong>{student.name}</strong><small>{student.roll}</small></span></div></td><td>{student.programme}<small>Year {student.year}</small></td><td><span className={student.attendance < 75 ? 'table-risk' : ''}>{student.attendance}%</span></td><td>{student.marks}/40</td><td><span className={student.dues ? 'table-risk' : 'paid'}>{student.dues ? `₹${student.dues.toLocaleString('en-IN')}` : 'Paid'}</span></td><td><button className="row-action"><MoreHorizontal size={17} /></button></td></tr>)}</tbody></table></div>
}

function LiveAttendance({ token, attendance, onLoad, onMark, saved, syncError, onSave }: { token: string; attendance: Record<string, AttendanceStatus>; onLoad: (attendance: Record<string, AttendanceStatus>) => void; onMark: (roll: string, status: AttendanceStatus) => void; saved: boolean; syncError: string; onSave: () => void }) {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    apiRequest<{ attendance: Array<{ roll: string; status: AttendanceStatus | null }> }>('/attendance?subject=Data%20Structures&date=2025-02-03', {}, token)
      .then((result) => {
        const next = { ...initialAttendance }
        for (const record of result.attendance) if (record.status) next[record.roll] = record.status
        onLoad(next)
      })
      .catch((error: unknown) => setLoadError(error instanceof Error ? error.message : 'Latest attendance could not be loaded.'))
      .finally(() => setLoading(false))
  }, [token, onLoad])

  if (loading) return <div className="panel loading-card"><div className="loading-pulse" /><strong>Loading the class register…</strong><span>Checking the latest synced attendance.</span></div>
  return <Attendance attendance={attendance} onMark={onMark} saved={saved} syncError={loadError || syncError} onSave={onSave} />
}

type DirectoryStudent = { id: number; roll_no: string; name: string; programme: string; year: number; attendance: number; internal_marks: number; fee_due: number }

function LiveStudents({ token }: { token: string }) {
  const [records, setRecords] = useState<DirectoryStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')

  useEffect(() => {
    apiRequest<{ students: DirectoryStudent[] }>('/students', {}, token)
      .then((result) => setRecords(result.students))
      .catch((requestError: unknown) => setError(requestError instanceof Error ? requestError.message : 'Students could not be loaded.'))
      .finally(() => setLoading(false))
  }, [token])

  const filtered = records.filter((student) => `${student.name} ${student.roll_no} ${student.programme}`.toLowerCase().includes(filter.toLowerCase()))
  return <><PageHeader eyebrow="Directory · Engineering College" title="Students" description="Searchable student records for the current campus" action={<button className="secondary-button"><FileText size={17} /> Export list</button>} /><section className="panel students-panel"><div className="directory-toolbar"><div><p className="eyebrow">Campus directory</p><h2>{records.length} students in sample data</h2></div><div className="search-box directory-search"><Search size={16} /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter this list..." aria-label="Filter student directory" /></div></div>{error && <div className="form-error"><AlertTriangle size={15} /> {error}</div>}{loading ? <div className="empty-note">Loading students…</div> : <div className="table-wrap directory-table"><table><thead><tr><th>Student</th><th>Programme</th><th>Year</th><th>Attendance</th><th>Internal marks</th><th>Fee due</th></tr></thead><tbody>{filtered.map((student) => <tr key={student.roll_no}><td><div className="table-student"><span className="avatar avatar-small">{student.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><span><strong>{student.name}</strong><small>{student.roll_no}</small></span></div></td><td>{student.programme}</td><td>{student.year}</td><td><span className={student.attendance < 75 ? 'table-risk' : ''}>{student.attendance}%</span></td><td><span className={student.internal_marks < 24 ? 'table-risk' : ''}>{student.internal_marks}/40</span></td><td><span className={student.fee_due ? 'table-risk' : 'paid'}>{student.fee_due ? `₹${student.fee_due.toLocaleString('en-IN')}` : 'Paid'}</span></td></tr>)}</tbody></table></div>}{!loading && filtered.length === 0 && <div className="empty-note">No students match “{filter}”.</div>}</section></>
}

function Attendance({ attendance, onMark, saved, syncError, onSave }: { attendance: Record<string, AttendanceStatus>; onMark: (roll: string, status: AttendanceStatus) => void; saved: boolean; syncError: string; onSave: () => void }) {
  return <><PageHeader eyebrow="Attendance · Period 1" title="Data Structures" description="B.Tech CSE · Year 2 · 03 February 2025 · Room 204" action={<div className="offline-status"><span className="online-dot" /> Offline ready</div>} />
    <div className="attendance-toolbar"><div><strong>24 students</strong><span>{saved ? 'Synced just now' : 'Changes are held locally until saved'}</span></div><div className="toolbar-actions"><button className="secondary-button"><Search size={16} /> Find student</button><button className="secondary-button"><MoreHorizontal size={17} /></button></div></div>
    <section className="panel attendance-panel"><div className="attendance-summary"><div><p className="eyebrow">Quick mark</p><h2>Tap a status for each student</h2></div><div className="attendance-counts"><span><i className="present-dot" /> Present <strong>{Object.values(attendance).filter((value) => value === 'present').length}</strong></span><span><i className="absent-dot" /> Absent <strong>{Object.values(attendance).filter((value) => value === 'absent').length}</strong></span><span><i className="late-dot" /> Late <strong>{Object.values(attendance).filter((value) => value === 'late').length}</strong></span></div></div><div className="attendance-list">{students.map((student, index) => <div className="attendance-row" key={student.roll}><span className="student-index">{String(index + 1).padStart(2, '0')}</span><span className="avatar avatar-small">{student.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><div className="student-copy"><strong>{student.name}</strong><small>{student.roll}</small></div><span className={`attendance-warning ${student.attendance < 75 ? '' : 'hidden'}`}><AlertTriangle size={15} /> Below 75%</span><div className="status-toggle">{(['present', 'absent', 'late'] as AttendanceStatus[]).map((status) => <button key={status} className={`${status} ${attendance[student.roll] === status ? 'selected' : ''}`} onClick={() => onMark(student.roll, status)}>{attendance[student.roll] === status && <Check size={14} />}{status}</button>)}</div></div>)}</div><div className="attendance-footer"><span>{syncError ? <><AlertTriangle size={16} /> {syncError}</> : <><ShieldCheck size={16} /> Changes are saved on this device when offline.</>}</span><button className="primary-button" onClick={onSave}>{saved ? 'Saved for sync' : 'Save attendance'} <Check size={16} /></button></div></section>
  </>
}

function Marks(_props: { token: string }) {
  const [locked, setLocked] = useState(false)
  const [moderated, setModerated] = useState(false)
  return <><PageHeader eyebrow="Internal marks · Semester 4" title="Data Structures" description="B.Tech CSE · Year 2 · Total marks: 40" action={<span className={`lock-status ${locked ? 'is-locked' : ''}`}>{locked ? <ShieldCheck size={16} /> : <FileText size={16} />}{locked ? 'Moderation locked' : 'Draft'}</span>} /><div className="marks-toolbar"><div className="component-tabs"><button className="active">Internal assessment 1</button><button>Internal assessment 2</button><button>Practical</button></div><button className="secondary-button"><FileText size={16} /> Export marksheet</button></div><section className="panel marks-panel"><div className="marks-notice"><Sparkles size={17} /><span><strong>Moderation check</strong> Review the highlighted scores before locking this assessment. Locked marks are audit-trailed and cannot be edited.</span></div><div className="table-wrap"><table><thead><tr><th>Student</th><th>Assignment <small>/ 10</small></th><th>Quiz <small>/ 10</small></th><th>Mid-sem <small>/ 20</small></th><th>Total <small>/ 40</small></th><th /></tr></thead><tbody>{students.map((student) => <tr key={student.roll}><td><div className="table-student"><span className="avatar avatar-small">{student.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><span><strong>{student.name}</strong><small>{student.roll}</small></span></div></td><td><input className="mark-input" disabled={locked} defaultValue={Math.round(student.marks * .25)} /></td><td><input className="mark-input" disabled={locked} defaultValue={Math.round(student.marks * .2)} /></td><td><input className="mark-input" disabled={locked} defaultValue={Math.round(student.marks * .55)} /></td><td><strong className={student.marks < 24 ? 'table-risk' : ''}>{student.marks}</strong></td><td>{student.marks < 24 && <span className="flag-pill">Review</span>}</td></tr>)}</tbody></table></div><div className="marks-footer"><label className="check-label"><input type="checkbox" checked={moderated} onChange={(event) => setModerated(event.target.checked)} disabled={locked} /><span>I have reviewed the moderation flags and totals</span></label><button className="primary-button" disabled={!moderated || locked} onClick={() => setLocked(true)}>{locked ? 'Locked for moderation' : 'Lock marks'} <ShieldCheck size={16} /></button></div></section></>
}

function Fees(_props: { token: string }) {
  return <><PageHeader eyebrow="Accounts · February 2025" title="Fee dues" description="B.Tech CSE · Year 2 · 3 students in sample view" action={<button className="secondary-button"><FileText size={17} /> Export for Tally</button>} /><div className="metric-grid fee-metrics"><Metric label="Outstanding" value="₹45,000" detail="1 student pending" trend="down" icon={<CircleDollarSign />} /><Metric label="Collected this month" value="₹1.8L" detail="+8.2% vs January" trend="up" icon={<ArrowUpRight />} /><Metric label="Collection rate" value="91.4%" detail="Target 90%" trend="up" icon={<Check />} /></div><section className="panel fees-panel"><div className="panel-heading"><div><p className="eyebrow">Action required</p><h2>Pending payments</h2></div><button className="secondary-button"><SlidersHorizontal size={16} /> Filter</button></div><p className="panel-intro">Payment links are in test mode. Receipts are generated after a successful mock payment.</p><div className="due-card"><span className="avatar avatar-soft">AP</span><div className="student-copy"><strong>Ankit Panda</strong><small>ENG-24-ME-0177 · B.Tech Mechanical · Year 2</small></div><div className="due-amount"><small>Total due</small><strong>₹45,000</strong></div><button className="secondary-button">Send reminder</button><button className="row-action"><MoreHorizontal size={17} /></button></div><div className="empty-note"><Check size={18} /> 2 students have no outstanding dues.</div></section></>
}

type LiveMark = { roll: string; name: string; assignment: number | null; quiz: number | null; mid_sem: number | null; total: number | null; locked_at: string | null }

function LiveMarks({ token }: { token: string }) {
  const [records, setRecords] = useState<LiveMark[]>([])
  const [locked, setLocked] = useState(false)
  const [moderated, setModerated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    apiRequest<{ marks: LiveMark[] }>('/marks?subject=Data%20Structures', {}, token)
      .then((result) => setRecords(result.marks))
      .catch((requestError: unknown) => setError(requestError instanceof Error ? requestError.message : 'Marks could not be loaded.'))
      .finally(() => setLoading(false))
  }, [token])

  function updateRecord(roll: string, field: 'assignment' | 'quiz' | 'mid_sem', value: string) {
    const numericValue = Number(value)
    if (!Number.isInteger(numericValue)) return
    setRecords((current) => current.map((record) => record.roll === roll ? { ...record, [field]: numericValue, total: (field === 'assignment' ? numericValue : record.assignment ?? 0) + (field === 'quiz' ? numericValue : record.quiz ?? 0) + (field === 'mid_sem' ? numericValue : record.mid_sem ?? 0) } : record))
  }

  async function lockRecords() {
    setSaving(true)
    setError('')
    try {
      await apiRequest('/marks/lock', {
        method: 'POST',
        body: JSON.stringify({ subject: 'Data Structures', records: records.map((record) => ({ roll: record.roll, assignment: record.assignment ?? 0, quiz: record.quiz ?? 0, midSem: record.mid_sem ?? 0 })) }),
      }, token)
      setLocked(true)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Marks could not be locked.')
    } finally {
      setSaving(false)
    }
  }

  return <><PageHeader eyebrow="Internal marks · Semester 4" title="Data Structures" description="B.Tech CSE · Year 2 · Total marks: 40" action={<span className={`lock-status ${locked ? 'is-locked' : ''}`}>{locked ? <ShieldCheck size={16} /> : <FileText size={16} />}{locked ? 'Moderation locked' : 'Draft'}</span>} /><div className="marks-toolbar"><div className="component-tabs"><button className="active">Internal assessment 1</button><button>Internal assessment 2</button><button>Practical</button></div><button className="secondary-button" disabled={loading || records.length === 0} onClick={() => downloadCsv('asteria-data-structures-marks.csv', records.map((record) => ({ roll_no: record.roll, student: record.name, assignment: record.assignment ?? '', quiz: record.quiz ?? '', mid_sem: record.mid_sem ?? '', total: record.total ?? '' })))}><FileText size={16} /> Export marksheet</button></div><section className="panel marks-panel"><div className="marks-notice"><Sparkles size={17} /><span><strong>Moderation check</strong> Review the highlighted scores before locking this assessment. Locked marks are audit-trailed and cannot be edited.</span></div>{loading ? <div className="empty-note">Loading marks…</div> : <div className="table-wrap"><table><thead><tr><th>Student</th><th>Assignment <small>/ 10</small></th><th>Quiz <small>/ 10</small></th><th>Mid-sem <small>/ 20</small></th><th>Total <small>/ 40</small></th><th /></tr></thead><tbody>{records.map((record) => <tr key={record.roll}><td><div className="table-student"><span className="avatar avatar-small">{record.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><span><strong>{record.name}</strong><small>{record.roll}</small></span></div></td><td><input className="mark-input" type="number" min="0" max="10" disabled={locked || Boolean(record.locked_at)} value={record.assignment ?? ''} onChange={(event) => updateRecord(record.roll, 'assignment', event.target.value)} /></td><td><input className="mark-input" type="number" min="0" max="10" disabled={locked || Boolean(record.locked_at)} value={record.quiz ?? ''} onChange={(event) => updateRecord(record.roll, 'quiz', event.target.value)} /></td><td><input className="mark-input" type="number" min="0" max="20" disabled={locked || Boolean(record.locked_at)} value={record.mid_sem ?? ''} onChange={(event) => updateRecord(record.roll, 'mid_sem', event.target.value)} /></td><td><strong className={(record.total ?? 0) < 24 ? 'table-risk' : ''}>{record.total ?? '—'}</strong></td><td>{(record.total ?? 0) < 24 && <span className="flag-pill">Review</span>}</td></tr>)}</tbody></table></div>}<div className="marks-footer"><div>{error && <span className="form-error"><AlertTriangle size={15} /> {error}</span>}<label className="check-label"><input type="checkbox" checked={moderated} onChange={(event) => setModerated(event.target.checked)} disabled={locked} /><span>I have reviewed the moderation flags and totals</span></label></div><button className="primary-button" disabled={!moderated || locked || saving || loading} onClick={lockRecords}>{saving ? 'Locking…' : locked ? 'Locked for moderation' : 'Lock marks'} <ShieldCheck size={16} /></button></div></section></>
}

type Due = { roll: string; name: string; programme: string; year: number; fee_due: number }

function LiveFees({ token, canRecordPayments }: { token: string; canRecordPayments: boolean }) {
  const [dues, setDues] = useState<Due[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [paymentMessage, setPaymentMessage] = useState('')
  const [paying, setPaying] = useState('')

  const loadDues = useCallback(async () => {
    await apiRequest<{ dues: Due[] }>('/fees/dues', {}, token)
      .then((result) => setDues(result.dues))
      .catch((requestError: unknown) => setError(requestError instanceof Error ? requestError.message : 'Fee dues could not be loaded.'))
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => {
    void loadDues()
  }, [loadDues])

  async function recordTestPayment(due: Due) {
    setPaying(due.roll)
    setPaymentMessage('')
    setError('')
    try {
      const result = await apiRequest<{ receiptNo: string; remainingDue: number }>('/fees/payments', { method: 'POST', body: JSON.stringify({ roll: due.roll, amount: due.fee_due }) }, token)
      setPaymentMessage(`Test payment recorded. Receipt ${result.receiptNo}. Remaining due: ₹${result.remainingDue.toLocaleString('en-IN')}.`)
      await loadDues()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Payment could not be recorded.')
    } finally {
      setPaying('')
    }
  }

  return <><PageHeader eyebrow="Accounts · February 2025" title="Fee dues" description="Live outstanding balances from the campus ledger" action={<button className="secondary-button" disabled={loading || dues.length === 0} onClick={() => downloadCsv('asteria-fee-dues.csv', dues.map((due) => ({ roll_no: due.roll, student: due.name, programme: due.programme, year: due.year, fee_due: due.fee_due })))}><FileText size={17} /> Export for Tally</button>} /><div className="metric-grid fee-metrics"><Metric label="Outstanding" value={`₹${dues.reduce((sum, due) => sum + due.fee_due, 0).toLocaleString('en-IN')}`} detail={`${dues.length} student${dues.length === 1 ? '' : 's'} pending`} trend="down" icon={<CircleDollarSign />} /><Metric label="Collected this month" value="₹1.8L" detail="+8.2% vs January" trend="up" icon={<ArrowUpRight />} /><Metric label="Collection rate" value="91.4%" detail="Target 90%" trend="up" icon={<Check />} /></div><section className="panel fees-panel"><div className="panel-heading"><div><p className="eyebrow">Action required</p><h2>Pending payments</h2></div><button className="secondary-button"><SlidersHorizontal size={16} /> Filter</button></div><p className="panel-intro">{canRecordPayments ? 'Test mode only: record a full mock payment to generate a receipt and clear this due.' : 'You can view dues, but only office admins can record payments.'}</p>{error && <div className="form-error"><AlertTriangle size={15} /> {error}</div>}{loading ? <div className="empty-note">Loading dues…</div> : dues.map((due) => <div className="due-card" key={due.roll}><span className="avatar avatar-soft">{due.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><div className="student-copy"><strong>{due.name}</strong><small>{due.roll} · {due.programme} · Year {due.year}</small></div><div className="due-amount"><small>Total due</small><strong>₹{due.fee_due.toLocaleString('en-IN')}</strong></div>{canRecordPayments && <button className="secondary-button" disabled={paying === due.roll} onClick={() => recordTestPayment(due)}>{paying === due.roll ? 'Recording…' : 'Record test payment'}</button>}<button className="row-action"><MoreHorizontal size={17} /></button></div>)}{paymentMessage && <div className="empty-note"><Check size={18} /> {paymentMessage}</div>}{!loading && !error && dues.length === 0 && <div className="empty-note"><Check size={18} /> No outstanding dues.</div>}</section></>
}

type AuditEntry = { action: string; entity: string; entity_id: number; created_at: string; actor: string }

function AuditTrail({ token }: { token: string }) {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    apiRequest<{ entries: AuditEntry[] }>('/audit', {}, token)
      .then((result) => setEntries(result.entries))
      .catch((requestError: unknown) => setError(requestError instanceof Error ? requestError.message : 'Audit entries could not be loaded.'))
      .finally(() => setLoading(false))
  }, [token])

  return <><PageHeader eyebrow="Office controls · Exam audit" title="Audit trail" description="Recent attendance, marks and fee actions for this campus" action={<span className="lock-status is-locked"><ShieldCheck size={16} /> Office admin only</span>} /><section className="panel students-panel"><div className="panel-heading"><div><p className="eyebrow">Last 50 events</p><h2>Record history</h2></div></div>{error && <div className="form-error"><AlertTriangle size={15} /> {error}</div>}{loading ? <div className="empty-note">Loading audit history…</div> : entries.length === 0 ? <div className="empty-note">No audit activity yet.</div> : <div className="table-wrap directory-table"><table><thead><tr><th>Action</th><th>Area</th><th>Actor</th><th>Record</th><th>Time</th></tr></thead><tbody>{entries.map((entry, index) => <tr key={`${entry.created_at}-${entry.entity_id}-${index}`}><td><strong>{entry.action.replaceAll('.', ' ')}</strong></td><td>{entry.entity}</td><td>{entry.actor}</td><td>#{entry.entity_id}</td><td>{entry.created_at}</td></tr>)}</tbody></table></div>}</section></>
}

type AssistantResponse = { answer: string; filters: string[]; rowCount: number; rows: Array<Record<string, string | number>>; readOnly: boolean }

function AssistantPanel({ token, onClose }: { token: string; onClose: () => void }) {
  const [question, setQuestion] = useState('How many second-year students are below 75% attendance?')
  const [result, setResult] = useState<AssistantResponse | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function ask(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const response = await apiRequest<AssistantResponse>('/assistant/ask', { method: 'POST', body: JSON.stringify({ question }) }, token)
      setResult(response)
    } catch (requestError) {
      setResult(null)
      setError(requestError instanceof Error ? requestError.message : 'The assistant could not answer that.')
    } finally {
      setLoading(false)
    }
  }

  return <div className="assistant-backdrop" role="presentation" onClick={onClose}><section className="assistant-panel" role="dialog" aria-modal="true" aria-labelledby="assistant-title" onClick={(event) => event.stopPropagation()}><div className="assistant-heading"><div><span className="ai-chip"><Sparkles size={14} /> Read-only assistant</span><h2 id="assistant-title">Ask about your campus data</h2></div><button className="icon-button" onClick={onClose} aria-label="Close assistant">×</button></div><p className="panel-intro">Asteria only runs approved read-only questions. It shows the filters and row count used.</p><form className="assistant-form" onSubmit={ask}><input value={question} onChange={(event) => setQuestion(event.target.value)} aria-label="Campus question" placeholder="Ask a campus question..." /><button className="primary-button" disabled={loading || question.trim().length < 3}>{loading ? 'Checking…' : 'Ask'} <ArrowUpRight size={16} /></button></form>{error && <div className="assistant-error"><AlertTriangle size={16} /> {error}</div>}{result && <div className="assistant-result"><div className="assistant-answer"><strong>{result.answer}</strong><span><ShieldCheck size={14} /> Read-only · {result.rowCount} row{result.rowCount === 1 ? '' : 's'}</span></div><div className="assistant-filters"><p className="eyebrow">Filters used</p>{result.filters.map((filter) => <span key={filter}>{filter}</span>)}</div>{result.rows.length > 0 && <div className="assistant-rows">{result.rows.map((row) => <div key={String(row.roll)}><strong>{String(row.name)}</strong><small>{String(row.roll)} · {row.attendance !== undefined ? `${row.attendance}% attendance` : row.fee_due !== undefined ? `₹${Number(row.fee_due).toLocaleString('en-IN')} due` : `${row.internal_marks}/40 marks`}</small></div>)}</div>}</div>}<div className="assistant-examples"><span>Try:</span><button type="button" onClick={() => setQuestion('Who has fee dues?')}>Who has fee dues?</button><button type="button" onClick={() => setQuestion('Which students have low marks?')}>Which students have low marks?</button></div></section></div>
}

void Marks
void Fees

export default App
