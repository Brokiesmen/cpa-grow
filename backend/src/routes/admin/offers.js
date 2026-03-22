/**
 * Admin Offer Moderation Routes
 */

import { auditLog } from '../../lib/audit.js'

export default async function adminOfferRoutes(fastify) {
  const { prisma } = fastify

  // List all offers with filters
  fastify.get('/offers', { onRequest: [fastify.requireRole('ADMIN')] }, async (req) => {
    const { status, vertical, search, page = 1, limit = 30 } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const where = {}
    if (status) where.status = status
    if (vertical) where.vertical = vertical
    if (search) where.name = { contains: search, mode: 'insensitive' }

    const [offers, total] = await Promise.all([
      prisma.offer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
        select: {
          id: true,
          name: true,
          status: true,
          vertical: true,
          paymentModel: true,
          payout: true,
          allowedGeos: true,
          createdAt: true,
          advertiser: {
            select: { companyName: true, user: { select: { email: true } } }
          },
          _count: { select: { applications: true, conversions: true } }
        }
      }),
      prisma.offer.count({ where })
    ])

    return { data: offers, meta: { total, page: parseInt(page), per_page: parseInt(limit) } }
  })

  // Change offer status (approve/reject/pause/archive)
  fastify.patch('/offers/:id/status', {
    onRequest: [fastify.requireRole('ADMIN')],
    schema: {
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['ACTIVE', 'DRAFT', 'PAUSED', 'ARCHIVED'] },
          note: { type: 'string', maxLength: 500 }
        }
      }
    }
  }, async (req, reply) => {
    const { id } = req.params
    const { status, note } = req.body

    const before = await prisma.offer.findUnique({ where: { id }, select: { status: true, name: true } })
    if (!before) return reply.code(404).send({ error: 'NOT_FOUND' })

    const offer = await prisma.offer.update({
      where: { id },
      data: { status },
      select: { id: true, name: true, status: true }
    })

    await auditLog({
      adminId: req.user.id,
      action: 'CHANGE_OFFER_STATUS',
      entityId: id,
      before: { status: before.status },
      after: { status, note },
      ip: req.ip
    })

    return offer
  })
}
