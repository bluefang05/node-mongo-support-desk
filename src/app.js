import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ZodError } from 'zod'
import authRoutes from './routes/auth.js'
import ticketRoutes from './routes/tickets.js'
import statsRoutes from './routes/stats.js'
import { sessionMiddleware } from './session.js'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

export function createApp() {
  const app = express()

  app.disable('x-powered-by')
  app.use(express.json({ limit: '100kb' }))
  app.use(sessionMiddleware)

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }))
  app.use('/api', authRoutes)
  app.use('/api/tickets', ticketRoutes)
  app.use('/api/stats', statsRoutes)

  app.use(express.static(path.join(root, 'public')))

  // Unknown API paths must not fall through to the SPA.
  app.use('/api', (req, res) => res.status(404).json({ message: 'Not found' }))

  app.use((err, req, res, next) => {
    if (err instanceof ZodError) {
      return res.status(422).json({
        message: 'The given data was invalid.',
        errors: err.flatten().fieldErrors,
      })
    }

    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({ message: 'Malformed JSON body' })
    }

    console.error(err)
    return res.status(500).json({ message: 'Server error' })
  })

  return app
}
