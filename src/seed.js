import { connect, disconnect, getDb } from './db.js'
import { hashPassword } from './passwords.js'

const users = [
  { name: 'Ana Admin', email: 'admin@desk.test', role: 'admin', password: 'password' },
  { name: 'Leo Agent', email: 'agent@desk.test', role: 'agent', password: 'password' },
]

const daysAgo = (days) => new Date(Date.now() - days * 86_400_000)

const tickets = [
  {
    subject: 'Invoice total does not match the PDF',
    description: 'Customer reports a 20.00 difference on invoice INV-2026-0002.',
    status: 'open',
    priority: 'urgent',
    requester: { name: 'Acme Corp', email: 'billing@acme.test' },
    tags: ['billing', 'pdf'],
    messages: [
      { authorName: 'Acme Corp', body: 'We see 1462.50 in the panel and 1442.50 in the PDF.', createdAt: daysAgo(2) },
      { authorName: 'Leo Agent', body: 'Reproduced. The discount is applied twice in the PDF template.', createdAt: daysAgo(1) },
    ],
  },
  {
    subject: 'Cannot export the monthly report',
    description: 'The export button returns a 500 for March.',
    status: 'pending',
    priority: 'high',
    requester: { name: 'Northwind Traders', email: 'accounts@northwind.test' },
    tags: ['reports'],
    messages: [{ authorName: 'Northwind Traders', body: 'Still failing after the last deploy.', createdAt: daysAgo(3) }],
  },
  {
    subject: 'Add a second contact to our account',
    description: 'We need finance@ and ap@ to receive invoices.',
    status: 'resolved',
    priority: 'normal',
    requester: { name: 'Globex', email: 'ap@globex.test' },
    tags: ['account'],
    messages: [{ authorName: 'Ana Admin', body: 'Second contact added and confirmed.', createdAt: daysAgo(6) }],
  },
  {
    subject: 'Password reset link expired',
    description: 'The link expires before the email arrives.',
    status: 'closed',
    priority: 'low',
    requester: { name: 'Initech', email: 'finance@initech.test' },
    tags: [],
    messages: [{ authorName: 'Leo Agent', body: 'SMTP queue was backed up; fixed and link lifetime raised to 60 minutes.', createdAt: daysAgo(12) }],
  },
]

await connect()

const db = getDb()
await db.collection('users').deleteMany({})
await db.collection('tickets').deleteMany({})

const insertedUsers = await db.collection('users').insertMany(
  users.map((user) => ({
    name: user.name,
    email: user.email,
    role: user.role,
    passwordHash: hashPassword(user.password),
    createdAt: new Date(),
  }))
)

const agentId = insertedUsers.insertedIds[1]

await db.collection('tickets').insertMany(
  tickets.map((ticket, index) => ({
    ...ticket,
    assigneeId: ticket.status === 'open' ? null : agentId,
    createdBy: insertedUsers.insertedIds[0],
    createdAt: daysAgo(10 - index * 2),
    updatedAt: daysAgo(index),
  }))
)

console.log(`Seeded ${users.length} users and ${tickets.length} tickets.`)
console.log('Login: admin@desk.test / password (admin) · agent@desk.test / password (agent)')

await disconnect()
