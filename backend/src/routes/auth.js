/**
 * Auth Routes — register, login, logout, refresh
 */

import { randomUUID, createHash } from 'crypto'
import bcrypt from 'bcrypt'
import { registerSchema, loginSchema, validateBody } from '../schemas/auth.schema.js'

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

const SALT_ROUNDS = 12

export default async function authRoutes(fastify) {
  const { prisma } = fastify

  // Register
  fastify.post('/register', {
    config: { rateLimit: { max: 10, timeWindow: '1m' } },
    preHandler: [validateBody(registerSchema)]
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
          passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
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
    preHandler: [validateBody(loginSchema)]
  }, async (req, reply) => {
    const { email, password } = req.body

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return reply.code(401).send({ error: 'INVALID_CREDENTIALS' })
    }

    if (user.status === 'BANNED') return reply.code(403).send({ error: 'ACCOUNT_BANNED' })
    if (user.status === 'PENDING') return reply.code(403).send({ error: 'ACCOUNT_PENDING_APPROVAL' })

    const accessToken = fastify.jwt.sign(
      { id: user.id, role: user.role },
      { expiresIn: '15m' }
    )

    const rawRefreshToken = randomUUID()
    const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000) // 30 days

    await prisma.session.create({
      data: {
        userId: user.id,
        token: hashToken(rawRefreshToken),
        expiresAt,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    })

    const isSecure = process.env.NODE_ENV === 'production'
    reply.setCookie('refreshToken', rawRefreshToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'strict',
      path: '/api/auth',
      maxAge: 30 * 24 * 3600
    })

    return {
      access_token: accessToken,
      expires_in: 900,
      user: { id: user.id, email: user.email, role: user.role }
    }
  })

  // Refresh token
  fastify.post('/refresh', async (req, reply) => {
    const rawToken = req.cookies?.refreshToken
    if (!rawToken) return reply.code(401).send({ error: 'INVALID_REFRESH_TOKEN' })

    const session = await prisma.session.findUnique({
      where: { token: hashToken(rawToken) },
      include: { user: true }
    })

    if (!session || session.expiresAt < new Date()) {
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
    const rawToken = req.cookies?.refreshToken
    if (rawToken) {
      await prisma.session.deleteMany({ where: { token: hashToken(rawToken) } })
    }
    reply.clearCookie('refreshToken', { path: '/api/auth' })
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
