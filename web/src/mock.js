// Backend-less demo for `npm run build:demo` (GitHub Pages). Nothing leaves the browser.

const hoursAgo = (h) => new Date(Date.now() - h * 3_600_000).toISOString()

let session = null
let nextId = 5

let tickets = [
  {
    id: '1', subject: 'Invoice total does not match the PDF',
    description: 'Customer reports a 20.00 difference on invoice INV-2026-0002.',
    status: 'open', priority: 'urgent',
    requester: { name: 'Acme Corp', email: 'billing@acme.test' },
    tags: ['billing', 'pdf'], assigneeId: null,
    messages: [
      { authorName: 'Acme Corp', body: 'We see 1462.50 in the panel and 1442.50 in the PDF.', createdAt: hoursAgo(50) },
      { authorName: 'Leo Agent', body: 'Reproduced. The discount is applied twice in the PDF template.', createdAt: hoursAgo(26) },
    ],
    createdAt: hoursAgo(52), updatedAt: hoursAgo(26),
  },
  {
    id: '2', subject: 'Cannot export the monthly report',
    description: 'The export button returns a 500 for March.',
    status: 'pending', priority: 'high',
    requester: { name: 'Northwind Traders', email: 'accounts@northwind.test' },
    tags: ['reports'], assigneeId: '2',
    messages: [{ authorName: 'Northwind Traders', body: 'Still failing after the last deploy.', createdAt: hoursAgo(70) }],
    createdAt: hoursAgo(90), updatedAt: hoursAgo(70),
  },
  {
    id: '3', subject: 'Add a second contact to our account',
    description: 'We need finance@ and ap@ to receive invoices.',
    status: 'resolved', priority: 'normal',
    requester: { name: 'Globex', email: 'ap@globex.test' },
    tags: ['account'], assigneeId: '2',
    messages: [{ authorName: 'Ana Admin', body: 'Second contact added and confirmed.', createdAt: hoursAgo(140) }],
    createdAt: hoursAgo(160), updatedAt: hoursAgo(140),
  },
  {
    id: '4', subject: 'Password reset link expired',
    description: 'The link expires before the email arrives.',
    status: 'closed', priority: 'low',
    requester: { name: 'Initech', email: 'finance@initech.test' },
    tags: [], assigneeId: '2',
    messages: [{ authorName: 'Leo Agent', body: 'SMTP queue was backed up; fixed and lifetime raised to 60 minutes.', createdAt: hoursAgo(280) }],
    createdAt: hoursAgo(300), updatedAt: hoursAgo(280),
  },
]

const delay = () => new Promise((resolve) => setTimeout(resolve, 120))
const fail = (status, message, errors) => Object.assign(new Error(message), { status, errors })

export async function handleDemoRequest(path, options = {}) {
  await delay()

  const method = (options.method || 'GET').toUpperCase()
  const body = options.body ? JSON.parse(options.body) : {}
  const [pathname, queryString] = path.split('?')
  const query = new URLSearchParams(queryString || '')

  if (pathname === '/api/login') {
    if (!body.email || !body.password) throw fail(422, 'The given data was invalid.', { email: ['Required'] })
    session = body.email.includes('admin')
      ? { id: '1', name: 'Ana Admin', email: body.email, role: 'admin' }
      : { id: '2', name: 'Leo Agent', email: body.email, role: 'agent' }
    return { user: session }
  }

  if (pathname === '/api/logout') {
    session = null
    return null
  }

  if (pathname === '/api/me') {
    if (!session) throw fail(401, 'Authentication required')
    return { user: session }
  }

  if (!session) throw fail(401, 'Authentication required')

  if (pathname === '/api/tickets' && method === 'GET') {
    const status = query.get('status')
    const term = (query.get('q') || '').toLowerCase()
    const rows = tickets
      .filter((ticket) => !status || ticket.status === status)
      .filter((ticket) => !term || ticket.subject.toLowerCase().includes(term))
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    return { data: rows, meta: { page: 1, limit: 12, total: rows.length, pages: 1 } }
  }

  if (pathname === '/api/tickets' && method === 'POST') {
    if (!body.subject || !body.description) throw fail(422, 'The given data was invalid.', { subject: ['Required'] })
    const ticket = {
      id: String(nextId++),
      subject: body.subject,
      description: body.description,
      priority: body.priority || 'normal',
      status: 'open',
      requester: body.requester || { name: 'Demo', email: 'demo@desk.test' },
      tags: body.tags || [],
      assigneeId: null,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    tickets = [ticket, ...tickets]
    return { data: ticket }
  }

  if (pathname === '/api/stats') {
    const count = (status) => tickets.filter((ticket) => ticket.status === status).length
    return {
      data: {
        status: { open: count('open'), pending: count('pending'), resolved: count('resolved'), closed: count('closed') },
        total: tickets.length,
        urgent_open: tickets.filter((ticket) => ticket.priority === 'urgent' && ['open', 'pending'].includes(ticket.status)).length,
        messages: tickets.reduce((sum, ticket) => sum + ticket.messages.length, 0),
        last_activity: tickets.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]?.updatedAt || null,
      },
    }
  }

  const match = pathname.match(/^\/api\/tickets\/(\d+)(?:\/messages)?$/)
  if (match) {
    const id = match[1]
    const index = tickets.findIndex((ticket) => ticket.id === id)
    if (index === -1) throw fail(404, 'Ticket not found')

    if (pathname.endsWith('/messages') && method === 'POST') {
      const message = { authorName: session.name, body: body.body, createdAt: new Date().toISOString() }
      tickets[index] = {
        ...tickets[index],
        messages: [...tickets[index].messages, message],
        updatedAt: new Date().toISOString(),
      }
      return { data: tickets[index] }
    }

    if (method === 'PATCH') {
      tickets[index] = { ...tickets[index], ...body, updatedAt: new Date().toISOString() }
      return { data: tickets[index] }
    }

    if (method === 'DELETE') {
      if (session.role !== 'admin') throw fail(403, 'Your role cannot perform this action')
      tickets = tickets.filter((ticket) => ticket.id !== id)
      return null
    }

    return { data: tickets[index] }
  }

  throw fail(404, `No demo handler for ${method} ${pathname}`)
}
