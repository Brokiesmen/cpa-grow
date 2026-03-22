/**
 * OAuth Routes — Google, Telegram, Web3 Wallet
 */

import { randomUUID, createHash, createHmac } from 'crypto'
import { ethers } from 'ethers'
import { buildAuthResponse, getUserProfile } from '../lib/auth.service.js'

async function verifyGoogleToken(accessToken) {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  if (!res.ok) throw new Error('INVALID_GOOGLE_TOKEN')
  const data = await res.json()
  if (!data.sub) throw new Error('INVALID_GOOGLE_TOKEN')
  return data // { sub, email, name, ... }
}

/**
 * Find existing user by OAuth field, or link by email if found
 */
async function findOrLinkOAuthUser(prisma, { field, value, email }) {
  let user = await prisma.user.findFirst({ where: { [field]: value } })

  if (!user && email) {
    user = await prisma.user.findUnique({ where: { email } })
    if (user) {
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

  // ── Google OAuth ──────────────────────────────
  fastify.post('/google', async (req, reply) => {
    const { idToken, role = 'PUBLISHER', username } = req.body
    if (!idToken) return reply.code(400).send({ error: 'ID_TOKEN_REQUIRED' })

    let payload
    try {
      payload = await verifyGoogleToken(idToken)
    } catch {
      return reply.code(401).send({ error: 'INVALID_GOOGLE_TOKEN' })
    }

    const { sub: googleId, email, name } = payload

    let user = await findOrLinkOAuthUser(prisma, { field: 'googleId', value: googleId, email })

    if (!user) {
      if (role === 'PUBLISHER' && !username) {
        return reply.code(422).send({ error: 'USERNAME_REQUIRED', message: 'Choose a username to complete registration' })
      }
      user = await prisma.$transaction(async (tx) => {
        const u = await tx.user.create({
          data: { email, googleId, role, status: 'ACTIVE', passwordHash: null }
        })
        if (role === 'PUBLISHER') {
          await tx.publisher.create({
            data: {
              userId: u.id,
              username: username || name?.replace(/\s+/g, '_').toLowerCase() || `user_${u.id.slice(0, 6)}`,
              referralCode: randomUUID().slice(0, 8)
            }
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

  // ── Telegram OAuth Widget ─────────────────────
  fastify.post('/telegram', async (req, reply) => {
    const data = req.body
    if (!data?.id || !data?.hash) return reply.code(400).send({ error: 'INVALID_TELEGRAM_DATA' })

    if (!process.env.TELEGRAM_BOT_TOKEN) {
      return reply.code(503).send({ error: 'TELEGRAM_AUTH_NOT_CONFIGURED' })
    }

    // Verify HMAC-SHA256 hash (Telegram widget spec: secret = SHA256(bot_token))
    const { hash, role = 'PUBLISHER', username: chosenUsername, ...tgData } = data
    const checkString = Object.keys(tgData).sort().map(k => `${k}=${tgData[k]}`).join('\n')
    const secretKey = createHash('sha256').update(process.env.TELEGRAM_BOT_TOKEN).digest()
    const hmac = createHmac('sha256', secretKey).update(checkString).digest('hex')

    if (hmac !== hash) {
      return reply.code(401).send({ error: 'INVALID_TELEGRAM_HASH' })
    }

    // Reject stale data (5 min)
    if (Date.now() / 1000 - tgData.auth_date > 300) {
      return reply.code(401).send({ error: 'TELEGRAM_AUTH_EXPIRED' })
    }

    const telegramId = String(tgData.id)
    let user = await findOrLinkOAuthUser(prisma, { field: 'telegramId', value: telegramId })

    if (!user) {
      const username = chosenUsername || tgData.username || `tg_${telegramId}`
      user = await prisma.$transaction(async (tx) => {
        const u = await tx.user.create({
          data: { telegramId, role, status: 'ACTIVE', email: null, passwordHash: null }
        })
        if (role === 'PUBLISHER') {
          await tx.publisher.create({
            data: {
              userId: u.id,
              username,
              referralCode: randomUUID().slice(0, 8),
              telegram: tgData.username ? `@${tgData.username}` : null
            }
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

  // ── Telegram Mini App (initData) ──────────────
  fastify.post('/telegram-webapp', async (req, reply) => {
    const { initData, role = 'PUBLISHER', username } = req.body
    if (!initData) return reply.code(400).send({ error: 'INIT_DATA_REQUIRED' })

    if (!process.env.TELEGRAM_BOT_TOKEN) {
      return reply.code(503).send({ error: 'TELEGRAM_AUTH_NOT_CONFIGURED' })
    }

    // Verify HMAC-SHA256 per Telegram Mini App spec
    const params = new URLSearchParams(initData)
    const hash = params.get('hash')
    if (!hash) return reply.code(400).send({ error: 'INVALID_INIT_DATA' })

    params.delete('hash')
    const checkString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n')

    const secretKey = createHmac('sha256', 'WebAppData')
      .update(process.env.TELEGRAM_BOT_TOKEN)
      .digest()

    const expectedHash = createHmac('sha256', secretKey)
      .update(checkString)
      .digest('hex')

    if (expectedHash !== hash) {
      return reply.code(401).send({ error: 'INVALID_TELEGRAM_HASH' })
    }

    // Reject stale data (1 hour)
    const authDate = parseInt(params.get('auth_date') || '0')
    if (Date.now() / 1000 - authDate > 3600) {
      return reply.code(401).send({ error: 'TELEGRAM_AUTH_EXPIRED' })
    }

    let tgUser
    try {
      tgUser = JSON.parse(params.get('user') || '{}')
    } catch {
      return reply.code(400).send({ error: 'INVALID_USER_DATA' })
    }

    if (!tgUser.id) return reply.code(400).send({ error: 'INVALID_USER_DATA' })

    const telegramId = String(tgUser.id)
    let user = await prisma.user.findFirst({ where: { telegramId } })

    if (!user) {
      // New user — ask frontend to show role/username picker
      if (!role || !['PUBLISHER', 'ADVERTISER'].includes(role)) {
        return reply.code(200).send({
          is_new_user: true,
          tg_user: {
            id: tgUser.id,
            first_name: tgUser.first_name,
            last_name: tgUser.last_name,
            username: tgUser.username,
            photo_url: tgUser.photo_url,
          }
        })
      }

      const uname = username || tgUser.username || `tg_${telegramId}`
      user = await prisma.$transaction(async (tx) => {
        const u = await tx.user.create({
          data: { telegramId, role, status: 'ACTIVE', email: null, passwordHash: null }
        })
        if (role === 'PUBLISHER') {
          await tx.publisher.create({
            data: {
              userId: u.id,
              username: uname,
              referralCode: randomUUID().slice(0, 8),
              telegram: tgUser.username ? `@${tgUser.username}` : null
            }
          })
        } else {
          await tx.advertiser.create({
            data: { userId: u.id, companyName: tgUser.first_name || uname }
          })
        }
        return u
      })
    }

    if (user.status === 'BANNED') return reply.code(403).send({ error: 'ACCOUNT_BANNED' })

    const response = await buildAuthResponse(fastify, prisma, user, reply, req.ip, req.headers['user-agent'])
    return { ...response, is_new_user: false }
  })

  // ── Web3 Wallet — get nonce ───────────────────
  fastify.get('/wallet/nonce', async (req, reply) => {
    const { address } = req.query
    if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
      return reply.code(400).send({ error: 'INVALID_ADDRESS' })
    }

    const nonce = randomUUID()
    await redis.setex(`wallet_nonce:${address.toLowerCase()}`, 300, nonce)

    return {
      nonce,
      message: `Sign in to Grow Network\n\nWallet: ${address}\nNonce: ${nonce}`
    }
  })

  // ── Web3 Wallet — verify signature ────────────
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

    // Delete nonce — one-time use
    await redis.del(`wallet_nonce:${normalizedAddress}`)

    let user = await prisma.user.findFirst({ where: { walletAddress: normalizedAddress } })

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
            data: {
              userId: u.id,
              username: username || `wallet_${normalizedAddress.slice(2, 8)}`,
              referralCode: randomUUID().slice(0, 8)
            }
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
