/**
 * Auth Routes — register, login, logout, refresh, me
 */

import bcrypt from 'bcrypt'
import { randomUUID } from 'crypto'
import { registerSchema, loginSchema, validateBody } from '../schemas/auth.schema.js'
import {
  hashToken, createSession, setRefreshCookie, getUserProfile, buildAuthResponse
} from '../lib/auth.service.js'

const SALT_ROUNDS = 12

export default async function authRoutes(fastify) {
  const { prisma } = fastify

  // ── Register ──────────────────────────────────
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
      const referrer = await prisma.publisher.findFirst({ where: { referralCode } })
      if (referrer) referredById = referrer.id
    }

    await prisma.$transaction(async (tx) => {
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
      } else {
        await tx.advertiser.create({ data: { userId: u.id } })
      }

      return u
    })

    return reply.code(201).send({ message: 'Registration successful. Awaiting approval.' })
  })

  // ── Login ─────────────────────────────────────
  fastify.post('/login', {
    config: { rateLimit: { max: 20, timeWindow: '1m' } },
    preHandler: [validateBody(loginSchema)]
  }, async (req, reply) => {
    const { email, password } = req.body

    const user = await prisma.user.findUnique({ where: { email } })

    // Use consistent timing to prevent user enumeration
    const passwordMatch = user
      ? await bcrypt.compare(password, user.passwordHash || '')
      : await bcrypt.hash(password, SALT_ROUNDS) // dummy work to keep timing consistent

    if (!user || !passwordMatch) {
      return reply.code(401).send({ error: 'INVALID_CREDENTIALS' })
    }

    if (user.status === 'BANNED') return reply.code(403).send({ error: 'ACCOUNT_BANNED' })
    if (user.status === 'PENDING') return reply.code(403).send({ error: 'ACCOUNT_PENDING_APPROVAL' })

    return buildAuthResponse(fastify, prisma, user, reply, req.ip, req.headers['user-agent'])
  })

  // ── Refresh token (with rotation) ────────────
  fastify.post('/refresh', async (req, reply) => {
    const rawToken = req.cookies?.refreshToken
    if (!rawToken) return reply.code(401).send({ error: 'INVALID_REFRESH_TOKEN' })

    const hashedToken = hashToken(rawToken)
    const session = await prisma.session.findUnique({
      where: { token: hashedToken },
      include: { user: true }
    })

    // Delete the used session regardless of validity (rotation + cleanup)
    if (session) {
      await prisma.session.delete({ where: { id: session.id } })
    }

    if (!session || session.expiresAt < new Date()) {
      reply.clearCookie('refreshToken', { path: '/api/auth' })
      return reply.code(401).send({ error: 'INVALID_REFRESH_TOKEN' })
    }

    if (session.user.status !== 'ACTIVE') {
      reply.clearCookie('refreshToken', { path: '/api/auth' })
      return reply.code(403).send({ error: 'ACCOUNT_INACTIVE' })
    }

    // Issue new access token + rotate refresh token
    const accessToken = fastify.jwt.sign(
      { id: session.user.id, role: session.user.role },
      { expiresIn: '15m' }
    )

    const newRawToken = await createSession(
      prisma,
      session.user.id,
      req.ip,
      req.headers['user-agent']
    )
    setRefreshCookie(reply, newRawToken)

    // Lazy cleanup of other expired sessions for this user (fire-and-forget)
    prisma.session.deleteMany({
      where: { userId: session.user.id, expiresAt: { lt: new Date() } }
    }).catch(() => {})

    const profile = await getUserProfile(prisma, session.user.id)
    return { access_token: accessToken, expires_in: 900, user: profile }
  })

  // ── Logout ────────────────────────────────────
  fastify.post('/logout', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const rawToken = req.cookies?.refreshToken
    if (rawToken) {
      await prisma.session.deleteMany({ where: { token: hashToken(rawToken) } })
    }
    reply.clearCookie('refreshToken', { path: '/api/auth' })
    return { success: true }
  })

  // ── Get current user ──────────────────────────
  fastify.get('/me', { onRequest: [fastify.authenticate] }, async (req) => {
    return getUserProfile(prisma, req.user.id)
  })
}
