import { after, before, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { MongoMemoryServer } from 'mongodb-memory-server'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { connect, disconnect, getDb } from '../src/db.js'
import { hashPassword } from '../src/passwords.js'

let mongo
let app
let agent

before(async () => {
  mongo = await MongoMemoryServer.create()
  await connect(mongo.getUri(), 'support_desk_test')
  app = createApp()
})

after(async () => {
  await disconnect()
  await mongo.stop()
})

beforeEach(async () => {
  const db = getDb()
  await db.collection('users').deleteMany({})
  await db.collection('tickets').deleteMany({})

  await db.collection('users').insertMany([
    { name: 'Ana Admin', email: 'admin@desk.test', role: 'admin', passwordHash: hashPassword('password') },
    { name: 'Leo Agent', email: 'agent@desk.test', role: 'agent', passwordHash: hashPassword('password') },
  ])

  agent = request.agent(app)
})

const login = (email = 'agent@desk.test') => agent.post('/api/login').send({ email, password: 'password' })

async function createTicket(overrides = {}) {
  const response = await agent.post('/api/tickets').send({
    subject: 'Printer on fire',
    description: 'It is literally on fire',
    priority: 'urgent',
    requester: { name: 'Acme', email: 'acme@test.dev' },
    ...overrides,
  })

  return response
}

test('health endpoint is public', async () => {
  const response = await request(app).get('/api/health')

  assert.equal(response.status, 200)
  assert.deepEqual(response.body, { status: 'ok' })
})

test('tickets reject anonymous requests', async () => {
  const response = await request(app).get('/api/tickets')

  assert.equal(response.status, 401)
})

test('login rejects a bad password', async () => {
  const response = await request(app).post('/api/login').send({ email: 'agent@desk.test', password: 'nope' })

  assert.equal(response.status, 422)
  assert.ok(response.body.errors.email)
})

test('login sets a session and /me returns the user', async () => {
  await login().expect(200)

  const me = await agent.get('/api/me').expect(200)

  assert.equal(me.body.user.email, 'agent@desk.test')
  assert.equal(me.body.user.role, 'agent')
  assert.equal(me.body.user.passwordHash, undefined)
})

test('creating a ticket returns 201 with server-owned fields', async () => {
  await login()
  const response = await createTicket()

  assert.equal(response.status, 201)
  assert.equal(response.body.data.status, 'open')
  assert.equal(response.body.data.priority, 'urgent')
  assert.equal(response.body.data.messages.length, 0)
  assert.ok(response.body.data.id)
})

test('validation errors come back as 422 with field errors', async () => {
  await login()
  const response = await agent.post('/api/tickets').send({ subject: 'x' })

  assert.equal(response.status, 422)
  assert.ok(response.body.errors.subject)
  assert.ok(response.body.errors.requester)
})

test('list filters by status and searches the subject', async () => {
  await login()
  await createTicket({ subject: 'Printer on fire', priority: 'normal' })
  await createTicket({ subject: 'Invoice mismatch', priority: 'low' })

  const second = await agent.get('/api/tickets')
  const id = second.body.data.find((ticket) => ticket.subject === 'Invoice mismatch').id
  await agent.patch(`/api/tickets/${id}`).send({ status: 'resolved' }).expect(200)

  const all = await agent.get('/api/tickets').expect(200)
  assert.equal(all.body.data.length, 2)

  const resolved = await agent.get('/api/tickets?status=resolved').expect(200)
  assert.equal(resolved.body.data.length, 1)
  assert.equal(resolved.body.data[0].subject, 'Invoice mismatch')

  const search = await agent.get('/api/tickets?q=printer').expect(200)
  assert.equal(search.body.data.length, 1)
})

test('unknown ticket ids return 404, invalid ids too', async () => {
  await login()

  await agent.get('/api/tickets/64b7f0c2f1a2b3c4d5e6f7a8').expect(404)
  await agent.get('/api/tickets/not-an-id').expect(404)
})

test('messages are appended and bump updated_at', async () => {
  await login()
  const created = await createTicket()
  const id = created.body.data.id

  const response = await agent
    .post(`/api/tickets/${id}/messages`)
    .send({ body: 'Firefighters are on the way' })
    .expect(201)

  assert.equal(response.body.data.messages.length, 1)
  assert.equal(response.body.data.messages[0].authorName, 'Leo Agent')
  assert.equal(response.body.data.messages[0].body, 'Firefighters are on the way')
})

test('only admins can delete tickets', async () => {
  await login()
  const created = await createTicket()
  const id = created.body.data.id

  await agent.delete(`/api/tickets/${id}`).expect(403)

  const admin = request.agent(app)
  await admin.post('/api/login').send({ email: 'admin@desk.test', password: 'password' }).expect(200)
  await admin.delete(`/api/tickets/${id}`).expect(204)

  await agent.get(`/api/tickets/${id}`).expect(404)
})

test('stats aggregate status counts and urgent open tickets', async () => {
  await login()
  await createTicket({ priority: 'urgent' })
  await createTicket({ subject: 'Low one', priority: 'low' })
  const closed = await createTicket({ subject: 'Closed one', priority: 'normal' })
  await agent.patch(`/api/tickets/${closed.body.data.id}`).send({ status: 'closed' })

  const response = await agent.get('/api/stats').expect(200)

  assert.equal(response.body.data.total, 3)
  assert.equal(response.body.data.status.open, 2)
  assert.equal(response.body.data.status.closed, 1)
  assert.equal(response.body.data.urgent_open, 1)
})

test('logout clears the session', async () => {
  await login()
  await agent.post('/api/logout').expect(204)
  await agent.get('/api/tickets').expect(401)
})
