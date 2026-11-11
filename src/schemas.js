import { z } from 'zod'

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id')

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const createTicketSchema = z.object({
  subject: z.string().trim().min(3).max(140),
  description: z.string().trim().min(5).max(4000),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  requester: z.object({
    name: z.string().trim().min(2).max(80),
    email: z.string().email(),
  }),
  tags: z.array(z.string().trim().min(1).max(24)).max(6).default([]),
})

export const updateTicketSchema = z
  .object({
    status: z.enum(['open', 'pending', 'resolved', 'closed']).optional(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
    assigneeId: objectId.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' })

export const messageSchema = z.object({
  body: z.string().trim().min(1).max(2000),
})

export const listQuerySchema = z.object({
  status: z.enum(['open', 'pending', 'resolved', 'closed']).optional(),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
})
