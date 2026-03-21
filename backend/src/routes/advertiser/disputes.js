/**
 * Advertiser Dispute Routes
 */

import { advertiserReply, addMessage } from '../../services/dispute.service.js'
import { disputeListSelect } from '../../lib/dispute.queries.js'

export default async function advertiserDisputeRoutes(fastify) {
  const { prisma } = fastify

  // List disputes for my offers
  fastify.get('/disputes', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const advertiser = await prisma.advertiser.findFirst({ where: { userId: req.user.id } })
    if (!advertiser) return reply.code(403).send({ error: 'NOT_ADVERTISER' })

    const { status, page = 1, limit = 20 } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [disputes, total] = await Promise.all([
      prisma.dispute.findMany({
        where: { advertiserId: advertiser.id, ...(status ? { status } : {}) },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
        select: disputeListSelect
      }),
      prisma.dispute.count({ where: { advertiserId: advertiser.id } })
    ])

    return { data: disputes, meta: { total, page: parseInt(page), per_page: parseInt(limit) } }
  })

  // Reply to dispute
  fastify.post('/disputes/:id/reply', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['reply'],
        properties: {
          reply: { type: 'string', minLength: 1, maxLength: 2000 },
          evidence: { type: ['object', 'null'] }
        }
      }
    }
  }, async (req, reply) => {
    const advertiser = await prisma.advertiser.findFirst({ where: { userId: req.user.id } })
    if (!advertiser) return reply.code(403).send({ error: 'NOT_ADVERTISER' })

    try {
      const dispute = await advertiserReply({
        disputeId: req.params.id,
        advertiserId: advertiser.id,
        reply: req.body.reply,
        evidence: req.body.evidence ?? null,
        action: 'REPLY'
      })
      return dispute
    } catch (err) {
      const status = { NOT_FOUND: 404, FORBIDDEN: 403, INVALID_STATUS: 422 }
      return reply.code(status[err.code] || 400).send({ error: err.code, message: err.message })
    }
  })

  // Accept dispute (approve conversion)
  fastify.post('/disputes/:id/accept', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['reply'],
        properties: { reply: { type: 'string', minLength: 1 } }
      }
    }
  }, async (req, reply) => {
    const advertiser = await prisma.advertiser.findFirst({ where: { userId: req.user.id } })
    if (!advertiser) return reply.code(403).send({ error: 'NOT_ADVERTISER' })

    try {
      return await advertiserReply({
        disputeId: req.params.id,
        advertiserId: advertiser.id,
        reply: req.body.reply,
        action: 'ACCEPT'
      })
    } catch (err) {
      const status = { NOT_FOUND: 404, FORBIDDEN: 403, INVALID_STATUS: 422 }
      return reply.code(status[err.code] || 400).send({ error: err.code, message: err.message })
    }
  })

  // Reject dispute
  fastify.post('/disputes/:id/reject', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['reply'],
        properties: {
          reply: { type: 'string', minLength: 1 },
          evidence: { type: ['object', 'null'] }
        }
      }
    }
  }, async (req, reply) => {
    const advertiser = await prisma.advertiser.findFirst({ where: { userId: req.user.id } })
    if (!advertiser) return reply.code(403).send({ error: 'NOT_ADVERTISER' })

    try {
      return await advertiserReply({
        disputeId: req.params.id,
        advertiserId: advertiser.id,
        reply: req.body.reply,
        evidence: req.body.evidence ?? null,
        action: 'REJECT'
      })
    } catch (err) {
      const status = { NOT_FOUND: 404, FORBIDDEN: 403, INVALID_STATUS: 422 }
      return reply.code(status[err.code] || 400).send({ error: err.code, message: err.message })
    }
  })
}
