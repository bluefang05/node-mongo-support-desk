import { Router } from 'express'
import { ObjectId } from 'mongodb'
import { getDb } from '../db.js'
import { requireAuth, requireRole } from '../session.js'
import { createTicketSchema, listQuerySchema, messageSchema, updateTicketSchema } from '../schemas.js'

const router = Router()
router.use(requireAuth)

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function toTicket(document) {
  return {
    id: document._id.toString(),
    subject: document.subject,
    description: document.description,
    status: document.status,
    priority: document.priority,
    requester: document.requester,
    assigneeId: document.assigneeId ? String(document.assigneeId) : null,
    tags: document.tags ?? [],
    messages: (document.messages ?? []).map((message) => ({
      ...message,
      createdAt: new Date(message.createdAt).toISOString(),
    })),
    createdAt: new Date(document.createdAt).toISOString(),
    updatedAt: new Date(document.updatedAt).toISOString(),
  }
}

async function findOr404(res, id) {
  if (!ObjectId.isValid(id)) {
    res.status(404).json({ message: 'Ticket not found' })
    return null
  }

  const ticket = await getDb().collection('tickets').findOne({ _id: new ObjectId(id) })

  if (!ticket) {
    res.status(404).json({ message: 'Ticket not found' })
    return null
  }

  return ticket
}

router.get('/', async (req, res) => {
  const { status, q, page, limit } = listQuerySchema.parse(req.query)

  const filter = {}
  if (status) filter.status = status
  if (q) filter.subject = { $regex: escapeRegex(q), $options: 'i' }

  const collection = getDb().collection('tickets')
  const [documents, total] = await Promise.all([
    collection
      .find(filter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
    collection.countDocuments(filter),
  ])

  res.json({
    data: documents.map(toTicket),
    meta: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
  })
})

router.post('/', async (req, res) => {
  const input = createTicketSchema.parse(req.body)
  const now = new Date()

  const document = {
    ...input,
    status: 'open',
    assigneeId: null,
    messages: [],
    createdBy: new ObjectId(req.session.user.id),
    createdAt: now,
    updatedAt: now,
  }

  const result = await getDb().collection('tickets').insertOne(document)

  res.status(201).json({ data: toTicket({ ...document, _id: result.insertedId }) })
})

router.get('/:id', async (req, res) => {
  const ticket = await findOr404(res, req.params.id)
  if (!ticket) return

  res.json({ data: toTicket(ticket) })
})

router.patch('/:id', async (req, res) => {
  const ticket = await findOr404(res, req.params.id)
  if (!ticket) return

  const changes = updateTicketSchema.parse(req.body)
  const $set = { ...changes, updatedAt: new Date() }

  if (typeof changes.assigneeId === 'string') {
    $set.assigneeId = new ObjectId(changes.assigneeId)
  }

  const updated = await getDb()
    .collection('tickets')
    .findOneAndUpdate({ _id: ticket._id }, { $set }, { returnDocument: 'after' })

  res.json({ data: toTicket(updated) })
})

router.post('/:id/messages', async (req, res) => {
  const ticket = await findOr404(res, req.params.id)
  if (!ticket) return

  const { body } = messageSchema.parse(req.body)

  const message = {
    authorId: req.session.user.id,
    authorName: req.session.user.name,
    body,
    createdAt: new Date(),
  }

  const updated = await getDb()
    .collection('tickets')
    .findOneAndUpdate(
      { _id: ticket._id },
      { $push: { messages: message }, $set: { updatedAt: new Date() } },
      { returnDocument: 'after' }
    )

  res.status(201).json({ data: toTicket(updated) })
})

router.delete('/:id', requireRole('admin'), async (req, res) => {
  const ticket = await findOr404(res, req.params.id)
  if (!ticket) return

  await getDb().collection('tickets').deleteOne({ _id: ticket._id })

  res.status(204).end()
})

export default router
