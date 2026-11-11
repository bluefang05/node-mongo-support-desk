import { Router } from 'express'
import { getDb } from '../db.js'
import { verifyPassword } from '../passwords.js'
import { loginSchema } from '../schemas.js'

const router = Router()

router.post('/login', async (req, res) => {
  const { email, password } = loginSchema.parse(req.body)

  const user = await getDb().collection('users').findOne({ email: email.toLowerCase() })

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(422).json({
      message: 'The given data was invalid.',
      errors: { email: ['The provided credentials are incorrect.'] },
    })
  }

  req.session.user = {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
  }

  return res.json({ user: req.session.user })
})

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.status(204).end())
})

router.get('/me', (req, res) => {
  if (!req.session?.user) {
    return res.status(401).json({ message: 'Authentication required' })
  }

  return res.json({ user: req.session.user })
})

export default router
