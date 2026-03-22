/**
 * Auth Service — shared utilities for session management
 */

import { randomUUID, createHash, createHmac } from 'crypto'

export { createHmac }

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Create a new session and return the raw refresh token
 */
export async function createSession(prisma, userId, ip, userAgent) {
  const rawRefreshToken = randomUUID()
  const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000) // 30 days
  await prisma.session.create({
    data: {
      userId,
      token: hashToken(rawRefreshToken),
      expiresAt,
      lastUsedAt: new Date(),
      ipAddress: ip,
      userAgent
    }
  })
  return rawRefreshToken
}

/**
 * Set refreshToken httpOnly cookie
 */
export function setRefreshCookie(reply, token) {
  const isSecure = process.env.NODE_ENV === 'production'
  reply.setCookie('refreshToken', token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: 30 * 24 * 3600
  })
}

/**
 * Build full user profile object (same shape as GET /auth/me)
 */
export async function getUserProfile(prisma, userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
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
}

/**
 * Build auth response: create session, sign JWT, set cookie, return tokens + user
 */
export async function buildAuthResponse(fastify, prisma, user, reply, ip, userAgent) {
  const rawRefreshToken = await createSession(prisma, user.id, ip, userAgent)

  const accessToken = fastify.jwt.sign(
    { id: user.id, role: user.role },
    { expiresIn: '15m' }
  )

  setRefreshCookie(reply, rawRefreshToken)

  const profile = await getUserProfile(prisma, user.id)

  return {
    access_token: accessToken,
    refresh_token: rawRefreshToken, // returned in body for Telegram CloudStorage
    expires_in: 900,
    user: profile
  }
}
