import { z } from 'zod'
import { Errors } from '../lib/errors.js'

export const registerSchema = z.object({
  email: z.string().email('Invalid email format').toLowerCase(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  role: z.enum(['PUBLISHER', 'ADVERTISER']),
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, _ and -').optional(),
  referralCode: z.string().optional()
})

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
})

export function validateBody(schema) {
  return async (req, reply) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      const msg = result.error.errors.map(e => e.message).join(', ')
      return reply.code(422).send({ error: 'VALIDATION_ERROR', message: msg })
    }
    req.body = result.data
  }
}
