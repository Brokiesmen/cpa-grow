/**
 * Admin Dispute Routes
 */

import { adminResolve, getDisputeWithContext } from '../../services/dispute.service.js'
import { disputeListSelect } from '../../lib/dispute.queries.js'
import { auditLog } from '../../lib/audit.js'

export default async function adminDisputeRoutes(fastify) {
  const { prisma } = fastify

  // List all disputes
  fastify.get('/disputes', { onRequest: [fastify.requireRole('ADMIN')] }, async (req, reply) => {
    const { status, page = 1, limit = 30 } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const where = status ? { status } : {}

    const [disputes, total] = await Promise.all([
      prisma.dispute.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
        select: disputeListSelect
      }),
      prisma.dispute.count({ where })
    ])

    return { data: disputes, meta: { total, page: parseInt(page), per_page: parseInt(limit) } }
  })

  // Get dispute with full context
  fastify.get('/disputes/:id', { onRequest: [fastify.requireRole('ADMIN')] }, async (req, reply) => {
    const dispute = await getDisputeWithContext(req.params.id)
    if (!dispute) return reply.code(404).send({ error: 'NOT_FOUND' })
    return dispute
  })

  // Resolve dispute
  fastify.post('/disputes/:id/resolve', {
    onRequest: [fastify.requireRole('ADMIN')],
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
      await auditLog({
        adminId: req.user.id,
        action: 'RESOLVE_DISPUTE',
        entityId: req.params.id,
        after: { decision: req.body.decision, note: req.body.note },
        ip: req.ip
      })
      return { success: true }
    } catch (err) {
      return reply.code(err.code === 'NOT_FOUND' ? 404 : 400).send({ error: err.code, message: err.message })
    }
  })

  // Dispute stats for admin dashboard
  fastify.get('/disputes/stats', { onRequest: [fastify.requireRole('ADMIN')] }, async () => {
    const stats = await prisma.$queryRaw`
      SELECT
        status,
        COUNT(*)::int as count
      FROM disputes
      GROUP BY status
    `

    const avgResolutionTime = await prisma.$queryRaw`
      SELECT
        AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt")) / 3600)::float as avg_hours
      FROM disputes
      WHERE "resolvedAt" IS NOT NULL
    `

    return {
      byStatus: stats,
      avgResolutionHours: avgResolutionTime[0]?.avg_hours ?? null
    }
  })
}
