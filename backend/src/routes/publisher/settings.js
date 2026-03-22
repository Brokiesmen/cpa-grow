/**
 * Publisher Account Settings Routes
 */
import bcrypt from 'bcrypt'

export default async function publisherSettingsRoutes(fastify) {
  const { prisma } = fastify

  // GET /publisher/settings — get current publisher profile
  fastify.get('/settings', { onRequest: [fastify.requireRole('PUBLISHER')] }, async (req) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        telegramId: true,
        googleId: true,
        walletAddress: true,
        passwordHash: true,
        publisher: {
          select: {
            username: true,
            telegram: true,
            phone: true,
            website: true,
            trafficTypes: true,
            apiKey: true,
            referralCode: true,
          }
        }
      }
    })
    return {
      email: user.email,
      hasPassword: !!user.passwordHash,
      telegramConnected: !!user.telegramId,
      googleConnected: !!user.googleId,
      walletConnected: !!user.walletAddress,
      ...user.publisher
    }
  })

  // PATCH /publisher/settings/profile — update publisher profile fields
  fastify.patch('/settings/profile', { onRequest: [fastify.requireRole('PUBLISHER')] }, async (req, reply) => {
    const { username, telegram, phone, website, trafficTypes } = req.body

    // Check username uniqueness if changed
    if (username) {
      const existing = await prisma.publisher.findFirst({
        where: { username, userId: { not: req.user.id } }
      })
      if (existing) return reply.code(409).send({ error: 'USERNAME_TAKEN' })
    }

    const updated = await prisma.publisher.update({
      where: { userId: req.user.id },
      data: {
        ...(username !== undefined && { username }),
        ...(telegram !== undefined && { telegram }),
        ...(phone !== undefined && { phone }),
        ...(website !== undefined && { website }),
        ...(trafficTypes !== undefined && { trafficTypes }),
      },
      select: {
        username: true,
        telegram: true,
        phone: true,
        website: true,
        trafficTypes: true,
        apiKey: true,
        referralCode: true,
      }
    })

    return updated
  })

  // POST /publisher/settings/change-password
  fastify.post('/settings/change-password', { onRequest: [fastify.requireRole('PUBLISHER')] }, async (req, reply) => {
    const { currentPassword, newPassword } = req.body

    if (!newPassword || newPassword.length < 8) {
      return reply.code(422).send({ error: 'PASSWORD_TOO_SHORT', message: 'Password must be at least 8 characters' })
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } })

    if (user.passwordHash) {
      if (!currentPassword) {
        return reply.code(422).send({ error: 'CURRENT_PASSWORD_REQUIRED' })
      }
      const valid = await bcrypt.compare(currentPassword, user.passwordHash)
      if (!valid) return reply.code(401).send({ error: 'INVALID_CURRENT_PASSWORD' })
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: { passwordHash: await bcrypt.hash(newPassword, 12) }
    })

    return { success: true }
  })

  // POST /publisher/settings/regenerate-api-key
  fastify.post('/settings/regenerate-api-key', { onRequest: [fastify.requireRole('PUBLISHER')] }, async (req) => {
    const { randomUUID } = await import('crypto')
    const newKey = `pub_${randomUUID().replace(/-/g, '')}`
    const updated = await prisma.publisher.update({
      where: { userId: req.user.id },
      data: { apiKey: newKey },
      select: { apiKey: true }
    })
    return updated
  })
}
