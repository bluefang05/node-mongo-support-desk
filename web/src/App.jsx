import { useCallback, useEffect, useState } from 'react'
import { api, formatDate, isDemo } from './api.js'

function Login({ onLogin }) {
  const [email, setEmail] = useState(isDemo() ? 'admin@desk.test' : '')
  const [password, setPassword] = useState(isDemo() ? 'password' : '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')

    try {
      const { user } = await api('/api/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      onLogin(user)
    } catch (requestError) {
      setError(requestError.errors?.email?.[0] || requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <form className="panel" onSubmit={submit}>
        <div className="panel-body">
          <h1>Support desk</h1>
          <p className="subtitle">Express + MongoDB · session auth · role-based access</p>

          <div className="field" style={{ marginBottom: 12 }}>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>

          <div className="field" style={{ marginBottom: 12 }}>
            <label htmlFor="password">Password</label>
            <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </div>

          {error && <div className="error">{error}</div>}

          <button type="submit" disabled={busy} style={{ width: '100%' }}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="hint">
            Seeded accounts: <strong>admin@desk.test</strong> (admin) or <strong>agent@desk.test</strong> (agent), password <strong>password</strong>.
          </p>
        </div>
      </form>
    </div>
  )
}

function TicketDetail({ ticket, user, onChanged, onClose }) {
  const [body, setBody] = useState('')
  const [error, setError] = useState('')

  async function sendMessage(event) {
    event.preventDefault()
    if (!body.trim()) return

    try {
      const response = await api(`/api/tickets/${ticket.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      })
      setBody('')
      onChanged(response.data)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function changeStatus(event) {
    try {
      const response = await api(`/api/tickets/${ticket.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: event.target.value }),
      })
      onChanged(response.data)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function removeTicket() {
    if (!window.confirm(`Delete ${ticket.subject}?`)) return

    try {
      await api(`/api/tickets/${ticket.id}`, { method: 'DELETE' })
      onClose()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  return (
    <aside className="panel">
      <div className="panel-header">
        <strong style={{ flex: 1 }}>{ticket.subject}</strong>
        <button className="ghost small" onClick={onClose}>Close</button>
      </div>
      <div className="panel-body">
        {error && <div className="error">{error}</div>}

        <p className="meta">
          {ticket.requester.name} · {ticket.requester.email}
        </p>
        <p className="meta">
          Created {formatDate(ticket.createdAt)} · updated {formatDate(ticket.updatedAt)}
        </p>

        <p style={{ marginTop: 12 }}>{ticket.description}</p>

        <div className="field" style={{ marginTop: 12 }}>
          <label>Status</label>
          <select value={ticket.status} onChange={changeStatus}>
            <option value="open">Open</option>
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        <div className="messages">
          {ticket.messages.length === 0 && <p className="meta">No replies yet.</p>}
          {ticket.messages.map((message, index) => (
            <div className="message" key={index}>
              <header>{message.authorName} · {formatDate(message.createdAt)}</header>
              <p>{message.body}</p>
            </div>
          ))}
        </div>

        <form onSubmit={sendMessage}>
          <div className="field">
            <label htmlFor="reply">Reply</label>
            <textarea id="reply" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Type a reply…" />
          </div>
          <button type="submit" disabled={!body.trim()}>Send reply</button>
        </form>

        {user.role === 'admin' && (
          <button className="ghost small" style={{ marginTop: 12 }} onClick={removeTicket}>
            Delete ticket
          </button>
        )}
      </div>
    </aside>
  )
}

function Desk({ user, onLogout }) {
  const [tickets, setTickets] = useState([])
  const [stats, setStats] = useState(null)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ subject: '', description: '', priority: 'normal', requesterName: '', requesterEmail: '' })

  const load = useCallback(async () => {
    setError('')
    try {
      const query = new URLSearchParams()
      if (status) query.set('status', status)
      if (search.trim()) query.set('q', search.trim())

      const [ticketsResponse, statsResponse] = await Promise.all([
        api(`/api/tickets?${query.toString()}`),
        api('/api/stats'),
      ])

      setTickets(ticketsResponse.data)
      setStats(statsResponse.data)
    } catch (requestError) {
      setError(requestError.message)
    }
  }, [status, search])

  useEffect(() => {
    load()
  }, [load])

  async function createTicket(event) {
    event.preventDefault()

    try {
      const response = await api('/api/tickets', {
        method: 'POST',
        body: JSON.stringify({
          subject: form.subject,
          description: form.description,
          priority: form.priority,
          requester: { name: form.requesterName || 'Walk-in', email: form.requesterEmail || 'walkin@desk.test' },
        }),
      })
      setForm({ subject: '', description: '', priority: 'normal', requesterName: '', requesterEmail: '' })
      setShowForm(false)
      await load()
      setSelected(response.data)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  function applyTicket(updated) {
    setSelected(updated)
    setTickets((current) => current.map((ticket) => (ticket.id === updated.id ? updated : ticket)))
    api('/api/stats').then((response) => setStats(response.data)).catch(() => {})
  }

  return (
    <>
      <header className="topbar">
        <div className="brand">Support<span>Desk</span></div>
        <div className="spacer" />
        <span className="who">{user.name} · {user.role}</span>
        <button className="ghost small" onClick={onLogout}>Sign out</button>
      </header>

      <main className="shell">
        <h1>Tickets</h1>
        <p className="subtitle">MongoDB documents with embedded messages, indexed by status and subject.</p>

        {error && <div className="error">{error}</div>}

        {stats && (
          <div className="stats">
            <div className="stat"><h2>Open</h2><div className="value">{stats.status.open}</div></div>
            <div className="stat"><h2>Pending</h2><div className="value">{stats.status.pending}</div></div>
            <div className="stat"><h2>Urgent open</h2><div className="value">{stats.urgent_open}</div></div>
            <div className="stat"><h2>Messages</h2><div className="value">{stats.messages}</div></div>
          </div>
        )}

        <div className="layout">
          <section>
            <div className="toolbar">
              <div className="field grow">
                <label>Search</label>
                <input value={search} placeholder="Subject contains…" onChange={(event) => setSearch(event.target.value)} />
              </div>
              <div className="field">
                <label>Status</label>
                <select value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="">All</option>
                  <option value="open">Open</option>
                  <option value="pending">Pending</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <button onClick={() => setShowForm((value) => !value)}>{showForm ? 'Cancel' : 'New ticket'}</button>
            </div>

            {showForm && (
              <form className="panel" style={{ marginBottom: 14 }} onSubmit={createTicket}>
                <div className="panel-body">
                  <div className="field"><label>Subject</label><input value={form.subject} required onChange={(event) => setForm({ ...form, subject: event.target.value })} /></div>
                  <div className="field"><label>Description</label><textarea value={form.description} required onChange={(event) => setForm({ ...form, description: event.target.value })} /></div>
                  <div className="toolbar" style={{ marginBottom: 0 }}>
                    <div className="field grow"><label>Requester name</label><input value={form.requesterName} onChange={(event) => setForm({ ...form, requesterName: event.target.value })} /></div>
                    <div className="field grow"><label>Requester email</label><input type="email" value={form.requesterEmail} onChange={(event) => setForm({ ...form, requesterEmail: event.target.value })} /></div>
                    <div className="field"><label>Priority</label>
                      <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
                        <option value="low">Low</option>
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>
                  <button type="submit" style={{ marginTop: 12 }}>Create ticket</button>
                </div>
              </form>
            )}

            <div className="panel">
              <div className="panel-header">
                <strong style={{ flex: 1 }}>{tickets.length} ticket(s)</strong>
                <button className="ghost small" onClick={load}>Refresh</button>
              </div>
              <table>
                <thead>
                  <tr><th>Subject</th><th>Requester</th><th>Priority</th><th>Status</th><th>Updated</th></tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr
                      key={ticket.id}
                      className={selected?.id === ticket.id ? 'active' : ''}
                      onClick={() => setSelected(ticket)}
                    >
                      <td><strong>{ticket.subject}</strong><div className="meta">{ticket.messages.length} message(s)</div></td>
                      <td>{ticket.requester.name}</td>
                      <td><span className={`priority ${ticket.priority}`}>{ticket.priority}</span></td>
                      <td><span className={`badge ${ticket.status}`}>{ticket.status}</span></td>
                      <td className="meta">{formatDate(ticket.updatedAt)}</td>
                    </tr>
                  ))}
                  {tickets.length === 0 && (
                    <tr><td colSpan="5" className="empty">No tickets match those filters.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {selected ? (
            <TicketDetail ticket={selected} user={user} onChanged={applyTicket} onClose={() => setSelected(null)} />
          ) : (
            <aside className="panel"><div className="empty">Select a ticket to read it.</div></aside>
          )}
        </div>
      </main>
    </>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [booting, setBooting] = useState(true)

  useEffect(() => {
    api('/api/me')
      .then((response) => setUser(response.user))
      .catch(() => setUser(null))
      .finally(() => setBooting(false))
  }, [])

  async function logout() {
    try {
      await api('/api/logout', { method: 'POST' })
    } catch {
      /* the session is gone either way */
    }
    setUser(null)
  }

  return (
    <>
      {isDemo() && (
        <div className="demo-banner">
          Static demo — data lives in memory and resets on reload. No MongoDB attached.
        </div>
      )}
      {booting ? <div className="empty">Loading…</div> : user ? <Desk user={user} onLogout={logout} /> : <Login onLogin={setUser} />}
    </>
  )
}
