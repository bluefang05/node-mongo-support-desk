import session from 'express-session'

const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-only-secret-change-me'

export const sessionMiddleware = session({
  name: 'desk.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 8,
  },
})

export function requireAuth(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ message: 'Authentication required' })
  }

  return next()
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session?.user) {
      return res.status(401).json({ message: 'Authentication required' })
    }

    if (!roles.includes(req.session.user.role)) {
      return res.status(403).json({ message: 'Your role cannot perform this action' })
    }

    return next()
  }
}
