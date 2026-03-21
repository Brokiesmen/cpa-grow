/**
 * Admin Dispute Routes
 */

import { adminResolve, getDisputeWithContext } from '../../services/dispute.service.js'

export default async function adminDisputeRoutes(fastify) {
  const { prisma } = fastify

  // List all disputes
  fastify.get('/disputes', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const { status, page = 1, limit = 30 } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const where = status ? { status } : {}

    const [disputes, total] = await Promise.all([
      prisma.dispute.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
        include: {
          conversion: { select: { id: true, payout: true, currency: true, goal: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 }
        }
      }),
      prisma.dispute.count({ where })
    ])

    return { data: disputes, meta: { total, page: parseInt(page), per_page: parseInt(limit) } }
  })

  // Get dispute with full context
  fastify.get('/disputes/:id', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const dispute = await getDisputeWithContext(req.params.id)
    if (!dispute) return reply.code(404).send({ error: 'NOT_FOUND' })
    return dispute
  })

  // Resolve dispute
  fastify.post('/disputes/:id/resolve', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['decision', 'note'],
        properties: {
          decision: { type: 'string', enum: ['PUBLISHER', 'ADVERTISER'] },
          note: { type: 'string', minLength: 10, maxLength: 2000 }
        }
      }
    }
  }, async (req, reply) => {
    try {
      await adminResolve({
        disputeId: req.params.id,
        adminId: req.user.id,
        decision: req.body.decision,
        note: req.body.note
      })
      return { success: true }
    } catch (err) {
      return reply.code(err.code === 'NOT_FOUND' ? 404 : 400).send({ error: err.code, message: err.message })
    }
  })

  // Dispute stats for admin dashboard
  fastify.get('/disputes/stats', { onRequest: [fastify.authenticate] }, async () => {
    const stats = await prisma.$queryRaw`
      SELECT
        status,
        COUNT(*)::int as count
      FROM disputes
      GROUP BY status
    `

    const avgResolutionTime = await prisma.$queryRaw`
      SELECT
        AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)::float as avg_hours
      FROM disputes
      WHERE resolved_at IS NOT NULL
    `

    return {
      byStatus: stats,
      avgResolutionHours: avgResolutionTime[0]?.avg_hours ?? null
    }
  })
}
