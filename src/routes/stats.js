import { Router } from 'express'
import { getDb } from '../db.js'
import { requireAuth } from '../session.js'

const router = Router()

router.get('/', requireAuth, async (req, res) => {
  const tickets = getDb().collection('tickets')

  const [byStatus, urgentOpen, volume, lastMessage] = await Promise.all([
    tickets.aggregate([{ $group: { _id: '$status', total: { $sum: 1 } } }]).toArray(),
    tickets.countDocuments({ priority: 'urgent', status: { $in: ['open', 'pending'] } }),
    tickets.aggregate([
      { $project: { messages: { $size: { $ifNull: ['$messages', []] } } } },
      { $group: { _id: null, messages: { $sum: '$messages' } } },
    ]).toArray(),
    tickets.find({}, { projection: { updatedAt: 1 } }).sort({ updatedAt: -1 }).limit(1).toArray(),
  ])

  const status = { open: 0, pending: 0, resolved: 0, closed: 0 }
  for (const row of byStatus) status[row._id] = row.total

  res.json({
    data: {
      status,
      total: Object.values(status).reduce((sum, value) => sum + value, 0),
      urgent_open: urgentOpen,
      messages: volume[0]?.messages ?? 0,
      last_activity: lastMessage[0] ? new Date(lastMessage[0].updatedAt).toISOString() : null,
    },
  })
})

export default router
