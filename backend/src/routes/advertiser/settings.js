/**
 * Advertiser Account Settings Routes
 */
import bcrypt from 'bcrypt'

export default async function advertiserSettingsRoutes(fastify) {
  const { prisma } = fastify

  // GET /advertiser/settings
  fastify.get('/settings', { onRequest: [fastify.requireRole('ADVERTISER')] }, async (req) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        telegramId: true,
        googleId: true,
        walletAddress: true,
        passwordHash: true,
        advertiser: {
          select: {
            companyName: true,
            website: true,
            apiKey: true,
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
      ...user.advertiser
    }
  })

  // PATCH /advertiser/settings/profile
  fastify.patch('/settings/profile', { onRequest: [fastify.requireRole('ADVERTISER')] }, async (req) => {
    const { companyName, website } = req.body

    const updated = await prisma.advertiser.update({
      where: { userId: req.user.id },
      data: {
        ...(companyName !== undefined && { companyName }),
        ...(website !== undefined && { website }),
      },
      select: { companyName: true, website: true, apiKey: true }
    })

    return updated
  })

  // POST /advertiser/settings/change-password
  fastify.post('/settings/change-password', { onRequest: [fastify.requireRole('ADVERTISER')] }, async (req, reply) => {
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

  // POST /advertiser/settings/regenerate-api-key
  fastify.post('/settings/regenerate-api-key', { onRequest: [fastify.requireRole('ADVERTISER')] }, async (req) => {
    const { randomUUID } = await import('crypto')
    const newKey = `adv_${randomUUID().replace(/-/g, '')}`
    const updated = await prisma.advertiser.update({
      where: { userId: req.user.id },
      data: { apiKey: newKey },
      select: { apiKey: true }
    })
    return updated
  })
}
