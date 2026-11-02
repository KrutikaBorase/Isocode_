import { useMemo, useState } from 'react'
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

type View = 'overview' | 'attendance' | 'marks' | 'fees'
type AttendanceStatus = 'present' | 'absent' | 'late'
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api'

async function apiRequest<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  })
  const body = await response.json() as T & { error?: string }
  if (!response.ok) throw new Error(body.error ?? 'Something went wrong. Please try again.')
  return body
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

function Login({ onLogin }: { onLogin: (token: string) => void }) {
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
      const result = await apiRequest<{ token: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
      onLogin(result.token)
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
  const [view, setView] = useState<View>('overview')
  const [mobileNav, setMobileNav] = useState(false)
  const [attendance, setAttendance] = useState(initialAttendance)
  const [saved, setSaved] = useState(false)
  const [syncError, setSyncError] = useState('')

  const atRisk = useMemo(() => students.filter(isAtRisk), [])

  if (!signedIn) return <Login onLogin={(nextToken) => { setToken(nextToken); setSignedIn(true) }} />

  function markAttendance(roll: string, status: AttendanceStatus) {
    setAttendance((current) => ({ ...current, [roll]: status }))
    setSaved(false)
  }

  function saveAttendance() {
    setSaved(false)
    setSyncError('')
    apiRequest('/attendance/sync', {
      method: 'POST',
      body: JSON.stringify({ subject: 'Data Structures', date: '2025-02-03', records: Object.entries(attendance).map(([roll, status]) => ({ roll, status })) }),
    }, token).then(() => setSaved(true)).catch((error: unknown) => setSyncError(error instanceof Error ? error.message : 'Attendance could not be synced.'))
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
          <button className="nav-item"><Users size={18} /><span>Students</span></button>
          <button className="nav-item"><CalendarDays size={18} /><span>Academic calendar</span></button>
          <button className="nav-item"><SlidersHorizontal size={18} /><span>Masters</span></button>
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card"><Sparkles size={17} /><strong>Need a hand?</strong><span>Ask Asteria about your campus data.</span><button>Open assistant <ArrowUpRight size={14} /></button></div>
          <button className="profile-row"><span className="avatar">RS</span><span className="profile-copy"><strong>Riya Sharma</strong><small>Faculty · CSE</small></span><MoreHorizontal size={18} /></button>
        </div>
      </aside>
      {mobileNav && <button className="mobile-backdrop" onClick={() => setMobileNav(false)} aria-label="Close menu" />}
      <main className="main-content">
        <header className="topbar"><button className="icon-button mobile-menu" onClick={() => setMobileNav(true)}><Menu size={21} /></button><div className="breadcrumb"><span>Engineering College</span><span>/</span><strong>{navItems.find((item) => item.id === view)?.label}</strong></div><div className="top-actions"><div className="search-box"><Search size={16} /><input placeholder="Search students..." aria-label="Search students" /></div><button className="icon-button"><AlertTriangle size={19} /><span className="notification-dot" /></button><button className="icon-button" onClick={() => setSignedIn(false)} title="Sign out"><LogOut size={18} /></button></div></header>
        <div className="page-content">
          {view === 'overview' && <Overview atRisk={atRisk} onNavigate={setView} />}
          {view === 'attendance' && <Attendance attendance={attendance} onMark={markAttendance} saved={saved} syncError={syncError} onSave={saveAttendance} />}
          {view === 'marks' && <Marks token={token} />}
          {view === 'fees' && <Fees token={token} />}
        </div>
      </main>
    </div>
  )
}

function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="muted">{description}</p></div>{action}</div>
}

function Overview({ atRisk, onNavigate }: { atRisk: typeof students; onNavigate: (view: View) => void }) {
  return <><PageHeader eyebrow="Monday, 03 February 2025" title="Good morning, Riya" description="Here’s what needs your attention across B.Tech CSE today." action={<button className="secondary-button"><FileText size={17} /> View reports</button>} />
    <div className="metric-grid"><Metric label="Students tracked" value="248" detail="+12 this semester" trend="up" icon={<Users />} /><Metric label="Attendance today" value="87.4%" detail="Above 75% threshold" trend="up" icon={<ClipboardCheck />} /><Metric label="Marks entered" value="76%" detail="24% remaining" trend="neutral" icon={<BookOpen />} /><Metric label="Fee dues" value="₹3.2L" detail="18 students pending" trend="down" icon={<CircleDollarSign />} /></div>
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

export default App
