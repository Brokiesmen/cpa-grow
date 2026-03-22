/**
 * Admin Payout Management Routes
 */

import { auditLog } from '../../lib/audit.js'

export default async function adminPayoutRoutes(fastify) {
  const { prisma } = fastify

  // List payouts with filters
  fastify.get('/payouts', { onRequest: [fastify.authenticate] }, async (req) => {
    const { status, method, page = 1, limit = 30 } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const where = {}
    if (status) where.status = status
    if (method) where.method = method

    const [payouts, total] = await Promise.all([
      prisma.payout.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
        select: {
          id: true,
          amount: true,
          currency: true,
          method: true,
          status: true,
          requisites: true,
          createdAt: true,
          processedAt: true,
          publisher: {
            select: {
              username: true,
              user: { select: { email: true } }
            }
          }
        }
      }),
      prisma.payout.count({ where })
    ])

    return { data: payouts, meta: { total, page: parseInt(page), per_page: parseInt(limit) } }
  })

  // Update payout status
  fastify.patch('/payouts/:id/status', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'] },
          note: { type: 'string', maxLength: 500 },
          txHash: { type: 'string', maxLength: 100 }
        }
      }
    }
  }, async (req, reply) => {
    const { id } = req.params
    const { status, note, txHash } = req.body

    const before = await prisma.payout.findUnique({
      where: { id },
      select: { status: true, amount: true, currency: true, publisherId: true }
    })
    if (!before) return reply.code(404).send({ error: 'NOT_FOUND' })
    if (before.status === 'COMPLETED') return reply.code(400).send({ error: 'ALREADY_COMPLETED' })

    const updateData = {
      status,
      ...(status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED'
        ? { processedAt: new Date() }
        : {})
    }

    const payout = await prisma.$transaction(async (tx) => {
      const updated = await tx.payout.update({
        where: { id },
        data: updateData,
        select: { id: true, amount: true, currency: true, status: true }
      })

      // If cancelled or failed — return funds to publisher balance
      if ((status === 'CANCELLED' || status === 'FAILED') && before.status === 'PROCESSING') {
        await tx.publisherBalance.updateMany({
          where: { publisherId: before.publisherId, currency: before.currency },
          data: { available: { increment: before.amount }, onHold: { decrement: before.amount } }
        })
      }

      return updated
    })

    await auditLog({
      adminId: req.user.id,
      action: 'UPDATE_PAYOUT_STATUS',
      entityId: id,
      before: { status: before.status },
      after: { status, note, txHash },
      ip: req.ip
    })

    return payout
  })
}
