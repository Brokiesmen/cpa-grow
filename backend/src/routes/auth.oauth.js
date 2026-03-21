/**
 * OAuth Routes — Google, Telegram, Web3 Wallet
 */

import { randomUUID, createHash } from 'crypto'
import { OAuth2Client } from 'google-auth-library'
import { ethers } from 'ethers'

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

async function createSession(prisma, userId, ip, userAgent) {
  const rawRefreshToken = randomUUID()
  const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000)
  await prisma.session.create({
    data: {
      userId,
      token: hashToken(rawRefreshToken),
      expiresAt,
      ipAddress: ip,
      userAgent
    }
  })
  return rawRefreshToken
}

async function buildAuthResponse(fastify, prisma, user, reply, ip, userAgent) {
  const rawRefreshToken = await createSession(prisma, user.id, ip, userAgent)
  const accessToken = fastify.jwt.sign(
    { id: user.id, role: user.role },
    { expiresIn: '15m' }
  )
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
}

async function findOrCreateOAuthUser(prisma, { field, value, email, name }) {
  // Найти существующего пользователя
  let user = await prisma.user.findFirst({
    where: { [field]: value }
  })

  // Если есть email — попробовать найти по email
  if (!user && email) {
    user = await prisma.user.findUnique({ where: { email } })
    if (user) {
      // Привязать OAuth id к существующему аккаунту
      user = await prisma.user.update({
        where: { id: user.id },
        data: { [field]: value }
      })
    }
  }

  return user
}

export default async function oauthRoutes(fastify) {
  const { prisma, redis } = fastify

  // ─── Google OAuth ─────────────────────────────
  fastify.post('/google', async (req, reply) => {
    const { idToken, role = 'PUBLISHER', username } = req.body
    if (!idToken) return reply.code(400).send({ error: 'ID_TOKEN_REQUIRED' })

    if (!process.env.GOOGLE_CLIENT_ID) {
      return reply.code(503).send({ error: 'GOOGLE_AUTH_NOT_CONFIGURED' })
    }

    let payload
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID
      })
      payload = ticket.getPayload()
    } catch {
      return reply.code(401).send({ error: 'INVALID_GOOGLE_TOKEN' })
    }

    const { sub: googleId, email, name } = payload

    let user = await findOrCreateOAuthUser(prisma, { field: 'googleId', value: googleId, email, name })

    if (!user) {
      // Новый пользователь
      if (role === 'PUBLISHER' && !username) {
        return reply.code(422).send({ error: 'USERNAME_REQUIRED', message: 'Choose a username to complete registration' })
      }
      user = await prisma.$transaction(async (tx) => {
        const u = await tx.user.create({
          data: { email, googleId, role, status: 'ACTIVE', passwordHash: null }
        })
        if (role === 'PUBLISHER') {
          await tx.publisher.create({
            data: { userId: u.id, username: username || name?.replace(/\s+/g, '_').toLowerCase() || `user_${u.id.slice(0, 6)}`, referralCode: randomUUID().slice(0, 8) }
          })
        } else {
          await tx.advertiser.create({ data: { userId: u.id } })
        }
        return u
      })
    }

    if (user.status === 'BANNED') return reply.code(403).send({ error: 'ACCOUNT_BANNED' })

    return buildAuthResponse(fastify, prisma, user, reply, req.ip, req.headers['user-agent'])
  })

  // ─── Telegram OAuth ───────────────────────────
  fastify.post('/telegram', async (req, reply) => {
    const data = req.body
    if (!data?.id || !data?.hash) return reply.code(400).send({ error: 'INVALID_TELEGRAM_DATA' })

    if (!process.env.TELEGRAM_BOT_TOKEN) {
      return reply.code(503).send({ error: 'TELEGRAM_AUTH_NOT_CONFIGURED' })
    }

    // Verify Telegram hash
    const { hash, ...rest } = data
    const checkString = Object.keys(rest).sort().map(k => `${k}=${rest[k]}`).join('\n')
    const secretKey = createHash('sha256').update(process.env.TELEGRAM_BOT_TOKEN).digest()
    const expectedHash = createHash('sha256').update(checkString).digest('hex')
    // HMAC-SHA256
    const { createHmac } = await import('crypto')
    const hmac = createHmac('sha256', secretKey).update(checkString).digest('hex')

    if (hmac !== hash) {
      return reply.code(401).send({ error: 'INVALID_TELEGRAM_HASH' })
    }

    // Check auth_date not too old (5 min)
    if (Date.now() / 1000 - data.auth_date > 300) {
      return reply.code(401).send({ error: 'TELEGRAM_AUTH_EXPIRED' })
    }

    const telegramId = String(data.id)
    const { role = 'PUBLISHER', username: chosenUsername } = req.body

    let user = await findOrCreateOAuthUser(prisma, {
      field: 'telegramId',
      value: telegramId,
      email: null
    })

    if (!user) {
      const username = chosenUsername || data.username || `tg_${telegramId}`
      user = await prisma.$transaction(async (tx) => {
        const u = await tx.user.create({
          data: { telegramId, role, status: 'ACTIVE', email: null, passwordHash: null }
        })
        if (role === 'PUBLISHER') {
          await tx.publisher.create({
            data: { userId: u.id, username, referralCode: randomUUID().slice(0, 8), telegram: data.username ? `@${data.username}` : null }
          })
        } else {
          await tx.advertiser.create({ data: { userId: u.id } })
        }
        return u
      })
    }

    if (user.status === 'BANNED') return reply.code(403).send({ error: 'ACCOUNT_BANNED' })

    return buildAuthResponse(fastify, prisma, user, reply, req.ip, req.headers['user-agent'])
  })

  // ─── Web3 Wallet — get nonce ──────────────────
  fastify.get('/wallet/nonce', async (req, reply) => {
    const { address } = req.query
    if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
      return reply.code(400).send({ error: 'INVALID_ADDRESS' })
    }

    const nonce = randomUUID()
    await redis.setex(`wallet_nonce:${address.toLowerCase()}`, 300, nonce) // 5 min TTL

    return {
      nonce,
      message: `Sign in to Grow Network\n\nWallet: ${address}\nNonce: ${nonce}`
    }
  })

  // ─── Web3 Wallet — verify signature ──────────
  fastify.post('/wallet', async (req, reply) => {
    const { address, signature, role = 'PUBLISHER', username } = req.body
    if (!address || !signature) {
      return reply.code(400).send({ error: 'ADDRESS_AND_SIGNATURE_REQUIRED' })
    }

    const normalizedAddress = address.toLowerCase()
    const nonce = await redis.get(`wallet_nonce:${normalizedAddress}`)
    if (!nonce) return reply.code(401).send({ error: 'NONCE_EXPIRED', message: 'Request a new nonce' })

    const message = `Sign in to Grow Network\n\nWallet: ${address}\nNonce: ${nonce}`

    let recoveredAddress
    try {
      recoveredAddress = ethers.verifyMessage(message, signature)
    } catch {
      return reply.code(401).send({ error: 'INVALID_SIGNATURE' })
    }

    if (recoveredAddress.toLowerCase() !== normalizedAddress) {
      return reply.code(401).send({ error: 'SIGNATURE_MISMATCH' })
    }

    // Delete nonce (one-time use)
    await redis.del(`wallet_nonce:${normalizedAddress}`)

    let user = await prisma.user.findFirst({
      where: { walletAddress: normalizedAddress }
    })

    if (!user) {
      if (role === 'PUBLISHER' && !username) {
        return reply.code(422).send({ error: 'USERNAME_REQUIRED', message: 'Choose a username to complete registration' })
      }
      user = await prisma.$transaction(async (tx) => {
        const u = await tx.user.create({
          data: { walletAddress: normalizedAddress, role, status: 'ACTIVE', email: null, passwordHash: null }
        })
        if (role === 'PUBLISHER') {
          await tx.publisher.create({
            data: { userId: u.id, username: username || `wallet_${normalizedAddress.slice(2, 8)}`, referralCode: randomUUID().slice(0, 8) }
          })
        } else {
          await tx.advertiser.create({ data: { userId: u.id } })
        }
        return u
      })
    }

    if (user.status === 'BANNED') return reply.code(403).send({ error: 'ACCOUNT_BANNED' })

    return buildAuthResponse(fastify, prisma, user, reply, req.ip, req.headers['user-agent'])
  })
}
