/**
 * Publisher Dispute Routes
 */

import { openDispute, addMessage, getDisputeWithContext } from '../../services/dispute.service.js'

export default async function disputeRoutes(fastify) {
  const { prisma } = fastify

  // Open dispute on rejected conversion
  fastify.post('/conversions/:id/dispute', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['reason'],
        properties: {
          reason: { type: 'string', minLength: 10, maxLength: 2000 },
          evidence: { type: ['object', 'null'] }
        }
      }
    }
  }, async (req, reply) => {
    const publisher = await prisma.publisher.findFirst({
      where: { userId: req.user.id }
    })
    if (!publisher) return reply.code(403).send({ error: 'NOT_PUBLISHER' })

    try {
      const dispute = await openDispute({
        conversionId: req.params.id,
        publisherId: publisher.id,
        reason: req.body.reason,
        evidence: req.body.evidence ?? null
      })
      return reply.code(201).send(dispute)
    } catch (err) {
      const status = { NOT_FOUND: 404, FORBIDDEN: 403, INVALID_STATUS: 422, WINDOW_EXPIRED: 422, DUPLICATE: 409 }
      return reply.code(status[err.code] || 400).send({ error: err.code, message: err.message })
    }
  })

  // List my disputes
  fastify.get('/disputes', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const publisher = await prisma.publisher.findFirst({ where: { userId: req.user.id } })
    if (!publisher) return reply.code(403).send({ error: 'NOT_PUBLISHER' })

    const { status, page = 1, limit = 20 } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [disputes, total] = await Promise.all([
      prisma.dispute.findMany({
        where: { publisherId: publisher.id, ...(status ? { status } : {}) },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
        include: {
          conversion: { select: { id: true, payout: true, currency: true, goal: true } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 }
        }
      }),
      prisma.dispute.count({ where: { publisherId: publisher.id, ...(status ? { status } : {}) } })
    ])

    return { data: disputes, meta: { total, page: parseInt(page), per_page: parseInt(limit) } }
  })

  // Get single dispute
  fastify.get('/disputes/:id', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const publisher = await prisma.publisher.findFirst({ where: { userId: req.user.id } })
    if (!publisher) return reply.code(403).send({ error: 'NOT_PUBLISHER' })

    const dispute = await getDisputeWithContext(req.params.id)
    if (!dispute || dispute.publisherId !== publisher.id) {
      return reply.code(404).send({ error: 'NOT_FOUND' })
    }

    return dispute
  })

  // Add message to dispute
  fastify.post('/disputes/:id/messages', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['message'],
        properties: {
          message: { type: 'string', minLength: 1, maxLength: 2000 },
          attachments: { type: ['object', 'null'] }
        }
      }
    }
  }, async (req, reply) => {
    const publisher = await prisma.publisher.findFirst({ where: { userId: req.user.id } })
    if (!publisher) return reply.code(403).send({ error: 'NOT_PUBLISHER' })

    const dispute = await prisma.dispute.findUnique({ where: { id: req.params.id } })
    if (!dispute || dispute.publisherId !== publisher.id) {
      return reply.code(404).send({ error: 'NOT_FOUND' })
    }
    if (dispute.status === 'CLOSED') {
      return reply.code(422).send({ error: 'DISPUTE_CLOSED' })
    }

    const msg = await addMessage({
      disputeId: req.params.id,
      authorId: publisher.id,
      authorRole: 'PUBLISHER',
      message: req.body.message,
      attachments: req.body.attachments ?? null
    })

    return reply.code(201).send(msg)
  })
}
