/**
 * Auth Routes — register, login, logout, refresh
 */

import { randomUUID } from 'crypto'
import { createHash } from 'crypto'

function hashPassword(password) {
  return createHash('sha256').update(password + process.env.PASSWORD_SALT || 'salt').digest('hex')
}

export default async function authRoutes(fastify) {
  const { prisma } = fastify

  // Register
  fastify.post('/register', {
    config: { rateLimit: { max: 10, timeWindow: '1m' } },
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password', 'role'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          role: { type: 'string', enum: ['PUBLISHER', 'ADVERTISER'] },
          username: { type: 'string', minLength: 3 }, // required for publisher
          referralCode: { type: 'string' }
        }
      }
    }
  }, async (req, reply) => {
    const { email, password, role, username, referralCode } = req.body

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return reply.code(409).send({ error: 'EMAIL_TAKEN' })

    if (role === 'PUBLISHER' && !username) {
      return reply.code(422).send({ error: 'USERNAME_REQUIRED' })
    }

    if (role === 'PUBLISHER') {
      const usernameExists = await prisma.publisher.findFirst({ where: { username } })
      if (usernameExists) return reply.code(409).send({ error: 'USERNAME_TAKEN' })
    }

    // Resolve referral
    let referredById = null
    if (referralCode && role === 'PUBLISHER') {
      const referrer = await prisma.publisher.findFirst({
        where: { referralCode }
      })
      if (referrer) referredById = referrer.id
    }

    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email,
          passwordHash: hashPassword(password),
          role,
          status: 'PENDING'
        }
      })

      if (role === 'PUBLISHER') {
        await tx.publisher.create({
          data: {
            userId: u.id,
            username,
            referralCode: randomUUID().slice(0, 8),
            referredById
          }
        })
      } else if (role === 'ADVERTISER') {
        await tx.advertiser.create({
          data: { userId: u.id }
        })
      }

      return u
    })

    return reply.code(201).send({
      message: 'Registration successful. Awaiting approval.',
      userId: user.id
    })
  })

  // Login
  fastify.post('/login', {
    config: { rateLimit: { max: 20, timeWindow: '1m' } },
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string' },
          password: { type: 'string' }
        }
      }
    }
  }, async (req, reply) => {
    const { email, password } = req.body

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || user.passwordHash !== hashPassword(password)) {
      return reply.code(401).send({ error: 'INVALID_CREDENTIALS' })
    }

    if (user.status === 'BANNED') return reply.code(403).send({ error: 'ACCOUNT_BANNED' })
    if (user.status === 'PENDING') return reply.code(403).send({ error: 'ACCOUNT_PENDING_APPROVAL' })

    const accessToken = fastify.jwt.sign(
      { id: user.id, role: user.role },
      { expiresIn: '15m' }
    )

    const refreshToken = randomUUID()
    const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000) // 30 days

    await prisma.session.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    })

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 900, // 15 min in seconds
      user: { id: user.id, email: user.email, role: user.role }
    }
  })

  // Refresh token
  fastify.post('/refresh', {
    schema: {
      body: {
        type: 'object',
        required: ['refresh_token'],
        properties: { refresh_token: { type: 'string' } }
      }
    }
  }, async (req, reply) => {
    const session = await prisma.session.findUnique({
      where: { token: req.body.refresh_token },
      include: { user: true }
    })

    if (!session || session.expiresAt < new Date()) {
      // Clean up expired session
      if (session) await prisma.session.delete({ where: { id: session.id } })
      return reply.code(401).send({ error: 'INVALID_REFRESH_TOKEN' })
    }

    if (session.user.status !== 'ACTIVE') {
      return reply.code(403).send({ error: 'ACCOUNT_INACTIVE' })
    }

    const accessToken = fastify.jwt.sign(
      { id: session.user.id, role: session.user.role },
      { expiresIn: '15m' }
    )

    return { access_token: accessToken, expires_in: 900 }
  })

  // Logout
  fastify.post('/logout', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const token = req.body?.refresh_token
    if (token) {
      await prisma.session.deleteMany({ where: { token } })
    }
    return { success: true }
  })

  // Get current user
  fastify.get('/me', { onRequest: [fastify.authenticate] }, async (req) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        publisher: {
          select: {
            id: true, username: true, apiKey: true,
            trafficQualityScore: true, referralCode: true
          }
        },
        advertiser: {
          select: { id: true, companyName: true, apiKey: true, balance: true }
        }
      }
    })

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      profile: user.publisher || user.advertiser
    }
  })
}
