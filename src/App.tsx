import { useEffect, useRef, useState } from 'react'
import { LayoutDashboard, Wallet, ChartNoAxesCombined, Settings, Plus, ArrowUpRight, ArrowDownLeft, Search, X, Trash2, Pencil, Download, ChevronLeft, ChevronRight, LogOut } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { defaults, localDate, sum, shiftMonth, csvCell } from './model'
import type { Data, Expense } from './model'
import './App.css'

const supabase = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY) : null
const storageKey = 'ab-expenses-v1'
function initialData(): Data { try { const saved = localStorage.getItem(storageKey); return saved ? JSON.parse(saved) : structuredClone(defaults) } catch { return structuredClone(defaults) } }
function App() {
  const [data, setData] = useState<Data>(initialData)
  const [page, setPage] = useState('Dashboard')
  const [month, setMonth] = useState(localDate().slice(0, 7))
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('')
  const [editor, setEditor] = useState<Expense | null>(null)
  const [error, setError] = useState('')
  const [user, setUser] = useState<string | null>(null)
  const [ready, setReady] = useState(!supabase)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const revision = useRef<string | null>(null)
  const saving = useRef(false)
  useEffect(() => {
    if (!supabase) return
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { setUser(session?.user.id ?? null); if (!session) { setReady(false); setData(structuredClone(defaults)) } })
    return () => listener.subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!supabase || !user) return
    let active = true
    void supabase.from('tracker_data').select('data,updated_at').eq('user_id', user).maybeSingle().then(({ data: row, error: issue }) => {
      if (!active) return
      if (issue) { setError(issue.message); return }
      revision.current = row?.updated_at ?? null
      setData(row?.data ?? structuredClone(defaults)); setReady(true)
    })
    return () => { active = false }
  }, [user])
  async function commit(next: Data) {
    if (saving.current) return false
    saving.current = true
    setError(''); setBusy(true)
    try {
      if (supabase) {
        if (!user || !ready) throw new Error('Please sign in and wait for your data to load.')
        const record = { user_id: user, data: next, updated_at: new Date().toISOString() }
        const result = revision.current
          ? await supabase.from('tracker_data').update(record).eq('user_id', user).eq('updated_at', revision.current).select('updated_at').maybeSingle()
          : await supabase.from('tracker_data').insert(record).select('updated_at').single()
        if (result.error && result.error.code !== '23505') throw result.error
        if (!result.data || result.error) {
          const latest = await supabase.from('tracker_data').select('data,updated_at').eq('user_id', user).single()
          if (latest.error) throw latest.error
          revision.current = latest.data.updated_at; setData(latest.data.data)
          throw new Error('Newer data was saved on another device. Your view has been refreshed. Review your change and save again.')
        }
        revision.current = result.data.updated_at
      } else localStorage.setItem(storageKey, JSON.stringify(next))
      setData(next); return true
    } catch (issue) { setError(issue instanceof Error ? issue.message : 'Unable to save. Please try again.'); return false }
    finally { saving.current = false; setBusy(false) }
  }
  const money = (n: number) => new Intl.NumberFormat('en-LK', { style: 'currency', currency: data.currency, maximumFractionDigits: 2 }).format(n)
  const items = data.expenses.filter(e => e.date.startsWith(month))
  const total = sum(items)
  const budget = data.budgets[month] ?? 0
  const monthName = new Date(`${month}-01T12:00:00`).toLocaleDateString('en', { month: 'long', year: 'numeric' })
  const category = (id: string) => data.categories.find(c => c.id === id)
  const visible = items.filter(e => (!filter || e.category === filter) && `${e.note} ${category(e.category)?.name}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => b.date.localeCompare(a.date))
  function add() { setEditor({ id: crypto.randomUUID(), amount: 0, category: data.categories.find(c => !c.archived)?.id ?? '', date: localDate(), note: '' }) }
  function exportCsv() {
    const csv = [['Date', 'Category', 'Note', `Amount (${data.currency})`], ...visible.map(e => [e.date, category(e.category)?.name ?? 'Other', e.note, e.amount])].map(row => row.map(csvCell).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = `expenses-${month}.csv`; a.click(); URL.revokeObjectURL(url)
  }
  async function auth(signup: boolean) {
    if (!supabase) return
    setBusy(true); setError(''); setMessage('')
    try {
      const result = signup ? await supabase.auth.signUp({ email, password }) : await supabase.auth.signInWithPassword({ email, password })
      if (result.error) setError(result.error.message)
      else if (signup) setMessage('Check your email to confirm your account, then sign in.')
    } catch { setError('Unable to connect. Check your internet connection.') }
    finally { setBusy(false) }
  }
  if (supabase && !user) return <div className="auth"><div className="brand"><span className="brand-icon"><Wallet size={23}/></span> pocket<span className="brand-dot">.</span></div><h1>A little clarity.<br/>Every single month.</h1><p>Sign in to keep your expenses together across devices.</p><form onSubmit={e => { e.preventDefault(); void auth(false) }}><label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label><label>Password<input type="password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required /></label>{error && <p className="error" role="alert">{error}</p>}{message && <p role="status">{message}</p>}<button className="primary" disabled={busy}>Sign in</button><button type="button" disabled={busy || !email || password.length < 8} onClick={() => void auth(true)}>Create account</button></form></div>
  if (!ready) return <div className="auth"><h1>Loading your pocket…</h1>{error && <p role="alert">{error}</p>}<button onClick={() => location.reload()}>Retry</button></div>
  const breakdown = data.categories.map(c => ({ ...c, total: sum(items.filter(e => e.category === c.id)) })).filter(c => c.total > 0).sort((a, b) => b.total - a.total)
  const chartValues = Array.from({ length: page === 'Reports' ? 6 : new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate() }, (_, i) => {
    const key = page === 'Reports' ? shiftMonth(month, i - 5) : `${month}-${String(i + 1).padStart(2, '0')}`
    return { key, value: sum(data.expenses.filter(e => page === 'Reports' ? e.date.startsWith(key) : e.date === key)), label: page === 'Reports' ? new Date(`${key}-01T12:00:00`).toLocaleDateString('en', { month: 'short' }) : i === 0 || (i + 1) % 5 === 0 ? String(i + 1) : '' }
  })
  const chartMax = Math.max(1, ...chartValues.map(v => v.value))
  const currentMonth = localDate().slice(0, 7) === month
  const previousTotal = sum(data.expenses.filter(e => e.date.startsWith(shiftMonth(month, -1)) && (!currentMonth || Number(e.date.slice(8)) <= Number(localDate().slice(8)))))
  return <div className="app-shell">
    <aside className="sidebar"><a className="brand" href="#" onClick={e => { e.preventDefault(); setPage('Dashboard') }}><span className="brand-icon"><Wallet size={22}/></span>pocket<span className="brand-dot">.</span></a><div className="workspace-label">PERSONAL WORKSPACE</div><nav>{[{ icon: LayoutDashboard, name: 'Dashboard' }, { icon: Wallet, name: 'Expenses' }, { icon: ChartNoAxesCombined, name: 'Reports' }, { icon: Settings, name: 'Settings' }].map(({ icon: Icon, name }) => <button key={name} className={page === name ? 'nav-item active' : 'nav-item'} aria-current={page === name ? 'page' : undefined} onClick={() => setPage(name)}><Icon size={19}/>{name}{page === name && <span className="nav-dot"/>}</button>)}</nav><div className="sidebar-note"><span>Small habits.<br/>A clearer picture.</span><p>Your everyday spending,<br/>a little more intentional.</p><div className="plant">✳</div></div><div className="profile"><div className="avatar">ME</div><div><strong>My pocket</strong><small>{supabase ? 'Cloud account' : 'Personal · This device'}</small></div>{supabase && <button aria-label="Sign out" onClick={() => void supabase.auth.signOut()}><LogOut size={17}/></button>}</div></aside>
    <main><header className="topbar"><span>My workspace <span className="slash">/</span> <strong>{page}</strong></span><span className="status"><i/>{supabase ? 'Cloud connected' : 'Saved on this device'}</span></header><div className="content"><div className="page-heading"><div><div className="eyebrow">YOUR MONEY, AT A GLANCE</div><h1>{page === 'Dashboard' ? 'A little more in control.' : page === 'Expenses' ? 'The everyday details.' : page === 'Reports' ? 'See the bigger picture.' : 'Make it your own.'}</h1><p>{page === 'Dashboard' ? 'Know where your money goes. Make room for what matters.' : page === 'Expenses' ? 'All your spending, neatly in one place.' : page === 'Reports' ? 'A clearer view of your spending habits.' : 'Your categories, preferences, and monthly plan.'}</p></div><button className="primary" onClick={add} disabled={busy}><Plus size={18}/> Add expense</button></div>
    {!supabase && <div className="local-banner">Your private pocket, on this device. <span>Connect Supabase to enable login and sync between devices.</span></div>}
    {error && <div className="error" role="alert">{error}</div>}
    <div className="period-row"><div className="month-picker"><button aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft size={16}/></button><label><span>{monthName}</span><input aria-label="Select month" type="month" value={month} onChange={e => e.target.value && setMonth(e.target.value)}/></label><button aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight size={16}/></button></div><span className="period-caption">A fresh perspective, every month</span></div>
    {page === 'Settings' ? <div className="settings-grid"><section className="panel"><h2>Monthly budget</h2><p>Set your spending limit for {monthName}.</p><form onSubmit={e => { e.preventDefault(); const value = Number(new FormData(e.currentTarget).get('budget')); void commit({ ...data, budgets: { ...data.budgets, [month]: value } }) }}><label>Budget ({data.currency})<input key={month + budget} name="budget" type="number" min="0" max="999999999" step="0.01" defaultValue={budget} required/></label><button className="primary" disabled={busy}>Save budget</button></form><label className="currency">Currency<select value={data.currency} disabled={busy || data.expenses.length > 0} onChange={e => void commit({ ...data, currency: e.target.value })}>{['LKR', 'USD', 'EUR', 'GBP', 'INR', 'AUD'].map(c => <option key={c}>{c}</option>)}</select></label><p className="muted">Set currency before adding expenses. Existing amounts are never converted.</p></section><section className="panel"><h2>Expense categories</h2><p>Organize spending in a way that makes sense to you.</p><div className="category-settings">{data.categories.filter(c => !c.archived).map(c => <div key={c.id}><span><i style={{ background: c.color }}/>{c.name}</span><button title={`Archive ${c.name}`} aria-label={`Archive ${c.name}`} disabled={busy || data.categories.filter(c => !c.archived).length < 2} onClick={() => void commit({ ...data, categories: data.categories.map(item => item.id === c.id ? { ...item, archived: true } : item) })}><X size={16}/></button></div>)}</div><form onSubmit={e => { e.preventDefault(); const form = e.currentTarget; const name = String(new FormData(form).get('name')).trim(); if (!name) return; if (data.categories.some(c => c.name.toLowerCase() === name.toLowerCase() && !c.archived)) { setError('That category already exists.'); return } void commit({ ...data, categories: [...data.categories, { id: crypto.randomUUID(), name, color: '#698fbb' }] }).then(ok => { if (ok) form.reset() }) }}><label>New category<input name="name" maxLength={40} required placeholder="e.g. Travel"/></label><button disabled={busy}>Add category</button></form></section></div> : <>
    <div className="stats"><section className="stat main-stat"><div className="stat-label">TOTAL SPENT <ArrowUpRight size={18}/></div><div className="stat-value">{money(total)}</div><div className="stat-foot"><span className="light-dot"/>Across {items.length} {items.length === 1 ? 'expense' : 'expenses'} this month</div></section><section className="stat"><div className="stat-label">MONTHLY BUDGET <Wallet size={18}/></div><div className="stat-value">{budget ? money(budget) : 'Not set yet'}</div><button className="text-link" onClick={() => setPage('Settings')}>{budget ? 'Adjust your monthly plan' : 'Set a budget to stay on track'} <ArrowUpRight size={14}/></button></section><section className="stat"><div className="stat-label">{total > budget && budget ? 'OVER BUDGET' : 'BUDGET REMAINING'} <ArrowDownLeft size={18}/></div><div className="stat-value">{budget ? money(Math.abs(budget - total)) : '—'}</div><div className="budget-track"><span style={{ width: `${budget ? Math.min(100, total / budget * 100) : 0}%`, background: total > budget ? '#bd7063' : undefined }}/></div><small>{budget ? `${Math.round(total / budget * 100)}% of your budget used` : 'Your next good habit starts here'}</small></section></div>
    {page !== 'Expenses' && <div className="charts-grid"><section className="panel"><div className="panel-heading"><div><h2>Spending by category</h2><p>A home for every expense</p></div><span className="tag">{monthName.split(' ')[0]}</span></div><div className="category-chart"><div role="img" aria-label={breakdown.length ? breakdown.map(c => `${c.name}: ${money(c.total)}`).join(', ') : 'No category spending yet'} className="donut" style={{ background: total ? `conic-gradient(${breakdown.map((c, i) => `${c.color} ${breakdown.slice(0, i).reduce((n, v) => n + v.total, 0) / total * 100}% ${breakdown.slice(0, i + 1).reduce((n, v) => n + v.total, 0) / total * 100}%`).join(',')})` : '#edf0eb' }}><div><small>{total ? 'TOTAL SPENT' : 'A CLEAN SLATE'}</small><strong>{total ? money(total) : 'Let’s begin'}</strong><span>{breakdown.length} categories</span></div></div><div className="legend">{breakdown.length ? breakdown.map(c => <div key={c.id}><span><i style={{ background: c.color }}/>{c.name}</span><strong>{Math.round(c.total / total * 100)}%<small>{money(c.total)}</small></strong></div>) : <div className="chart-empty"><strong>Your story starts here</strong><p>Add your first expense to see where your money goes.</p><button className="text-link" onClick={add}>Add an expense <ArrowUpRight size={14}/></button></div>}</div></div></section><section className="panel"><div className="panel-heading"><div><h2>{page === 'Reports' ? 'Six-month overview' : 'Daily spending'}</h2><p>{page === 'Reports' ? 'See how your habits evolve' : 'The rhythm of your month'}</p></div><span className="chart-key"><i/>Expenses</span></div><div className="bar-chart">{chartValues.map(({ key, value, label }) => <div className="bar-column" key={key}><div className="bar-slot"><span tabIndex={value ? 0 : -1} aria-label={`${key}: ${money(value)}`} title={`${key}: ${money(value)}`} style={{ height: `${value ? Math.max(3, value / chartMax * 100) : 2}%`, opacity: value ? 1 : 0.25 }}/></div><small>{label}</small></div>)}</div><div className="chart-bottom"><span>{items.length ? `Highest ${page === 'Reports' ? 'month' : 'day'}: ${money(chartMax)}` : 'Your chart will grow with every expense.'}</span><span>{data.currency}</span></div></section></div>}
    {page === 'Reports' && <section className="comparison"><ArrowUpRight size={20}/><div><strong>{previousTotal ? `${money(Math.abs(total - previousTotal))} ${total >= previousTotal ? 'more' : 'less'} than last month (${Math.abs((total - previousTotal) / previousTotal * 100).toFixed(1)}%)` : 'No spending recorded for the previous comparison period'}</strong><p>{currentMonth ? 'Comparing the same number of days in each month.' : 'Comparing full calendar months.'}</p></div></section>}
    <section className="panel transactions"><div className="panel-heading"><div><h2>{page === 'Dashboard' ? 'Recent expenses' : 'Expense history'}</h2><p>{page === 'Dashboard' ? 'Little things, all accounted for' : `${visible.length} expenses in this view`}</p></div><button className="export" onClick={exportCsv}><Download size={16}/>Export CSV</button></div><div className="table-tools"><label className="search"><Search size={17}/><input aria-label="Search expenses" placeholder="Search your expenses…" value={query} onChange={e => setQuery(e.target.value)}/></label><select aria-label="Filter category" value={filter} onChange={e => setFilter(e.target.value)}><option value="">All categories</option>{data.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>{page === 'Reports' && <button onClick={() => window.print()}>Print report</button>}</div><div className="table-scroll"><table><thead><tr><th>EXPENSE</th><th>CATEGORY</th><th>DATE</th><th className="amount">AMOUNT</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{visible.slice(0, page === 'Dashboard' ? 5 : undefined).map(e => <tr key={e.id}><td><span className="expense-icon" style={{ background: `${category(e.category)?.color}18`, color: category(e.category)?.color }}><Wallet size={17}/></span><strong>{e.note || category(e.category)?.name || 'Expense'}</strong></td><td><span className="category-pill"><i style={{ background: category(e.category)?.color }}/>{category(e.category)?.name}</span></td><td>{new Date(`${e.date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td><td className="amount"><strong>{money(e.amount)}</strong></td><td className="actions"><button disabled={busy} aria-label={`Edit ${e.note || 'expense'}`} onClick={() => setEditor({ ...e })}><Pencil size={15}/></button><button disabled={busy} aria-label={`Delete ${e.note || 'expense'}`} onClick={() => { if (confirm('Delete this expense?')) void commit({ ...data, expenses: data.expenses.filter(v => v.id !== e.id) }) }}><Trash2 size={15}/></button></td></tr>)}</tbody></table></div>{!visible.length && <div className="empty-state"><span className="empty-icon"><Wallet size={25}/></span><h3>{items.length ? 'No matching expenses' : 'A fresh start for your finances'}</h3><p>{items.length ? 'Try a different search or category.' : 'Coffee, groceries, or your next adventure. Add your first expense.'}</p>{!items.length && <button className="text-link" onClick={add}>Record your first expense <Plus size={15}/></button>}</div>}{page === 'Dashboard' && visible.length > 5 && <button className="view-all" onClick={() => setPage('Expenses')}>View all expenses <ArrowUpRight size={15}/></button>}</section></>}
    <footer><span>Made for a more mindful month.</span><span>One expense at a time <span className="footer-star">✳</span></span></footer></div></main>
    {editor && <ExpenseDialog editor={editor} setEditor={setEditor} data={data} busy={busy} error={error} onSave={async expense => { if (await commit({ ...data, expenses: [...data.expenses.filter(v => v.id !== expense.id), expense] })) { setMonth(expense.date.slice(0, 7)); setEditor(null) } }}/>} 
  </div>
}
function ExpenseDialog({ editor, setEditor, data, busy, error, onSave }: { editor: Expense; setEditor: (e: Expense | null) => void; data: Data; busy: boolean; error: string; onSave: (e: Expense) => Promise<void> }) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement
    function keydown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) setEditor(null)
      if (e.key !== 'Tab') return
      const elements = ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,select')
      if (!elements?.length) return
      const first = elements[0], last = elements[elements.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', keydown)
    return () => { document.removeEventListener('keydown', keydown); previous?.focus() }
  }, [busy, setEditor])
  return <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget && !busy) setEditor(null) }}><section ref={ref} className="modal" role="dialog" aria-modal="true" aria-labelledby="expense-title"><div className="panel-heading"><div><div className="eyebrow">THE LITTLE DETAILS</div><h2 id="expense-title">{data.expenses.some(e => e.id === editor.id) ? 'Edit expense' : 'Add an expense'}</h2></div><button aria-label="Close" disabled={busy} onClick={() => setEditor(null)}><X size={20}/></button></div><form onSubmit={async e => { e.preventDefault(); if (!Number.isFinite(editor.amount) || editor.amount <= 0 || !editor.category) return; await onSave({ ...editor, amount: Math.round(editor.amount * 100) / 100, note: editor.note.trim() }) }}><label>Amount ({data.currency})<input autoFocus type="number" min="0.01" max="999999999" step="0.01" required value={editor.amount || ''} placeholder="0.00" onChange={e => setEditor({ ...editor, amount: Number(e.target.value) })}/></label><div className="form-row"><label>Category<select value={editor.category} onChange={e => setEditor({ ...editor, category: e.target.value })} required>{data.categories.filter(c => !c.archived || c.id === editor.category).map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label><label>Date<input type="date" required value={editor.date} onChange={e => setEditor({ ...editor, date: e.target.value })}/></label></div><label>Note <span className="muted">(optional)</span><input maxLength={180} value={editor.note} placeholder="What was it for?" onChange={e => setEditor({ ...editor, note: e.target.value })}/></label>{error && <p role="alert" className="error">{error}</p>}<div className="modal-footer"><button type="button" disabled={busy} onClick={() => setEditor(null)}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Save expense'}</button></div></form></section></div>
}
export default App
