/**
 * Admin User Management Routes
 */

import { auditLog } from '../../lib/audit.js'

export default async function adminUserRoutes(fastify) {
  const { prisma } = fastify

  // List users with filters & pagination
  fastify.get('/users', { onRequest: [fastify.authenticate] }, async (req) => {
    const { role, status, search, page = 1, limit = 30 } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const where = {}
    if (role) where.role = role
    if (status) where.status = status
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { publisher: { username: { contains: search, mode: 'insensitive' } } },
        { advertiser: { companyName: { contains: search, mode: 'insensitive' } } },
      ]
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
          lastLoginAt: true,
          publisher: {
            select: { username: true, tqs: true, apiKey: true }
          },
          advertiser: {
            select: { companyName: true, balance: true, apiKey: true }
          },
          _count: {
            select: { sessions: true }
          }
        }
      }),
      prisma.user.count({ where })
    ])

    return { data: users, meta: { total, page: parseInt(page), per_page: parseInt(limit) } }
  })

  // Get single user with full details
  fastify.get('/users/:id', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        googleId: true,
        telegramId: true,
        walletAddress: true,
        publisher: {
          select: {
            username: true,
            telegram: true,
            website: true,
            trafficTypes: true,
            tqs: true,
            apiKey: true,
            referralCode: true,
            _count: { select: { trackingLinks: true, applications: true, conversions: true, payouts: true } }
          }
        },
        advertiser: {
          select: {
            companyName: true,
            website: true,
            balance: true,
            holdAmount: true,
            apiKey: true,
            _count: { select: { offers: true } }
          }
        },
        _count: {
          select: { sessions: true, notifications: true }
        }
      }
    })

    if (!user) return reply.code(404).send({ error: 'NOT_FOUND' })
    return user
  })

  // Change user status
  fastify.patch('/users/:id/status', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['ACTIVE', 'PENDING', 'BANNED', 'SUSPENDED'] },
          reason: { type: 'string', maxLength: 500 }
        }
      }
    }
  }, async (req, reply) => {
    const { id } = req.params
    const { status, reason } = req.body

    const before = await prisma.user.findUnique({ where: { id }, select: { status: true, email: true } })
    if (!before) return reply.code(404).send({ error: 'NOT_FOUND' })

    const user = await prisma.user.update({
      where: { id },
      data: { status },
      select: { id: true, email: true, role: true, status: true }
    })

    await auditLog({
      adminId: req.user.id,
      action: 'CHANGE_USER_STATUS',
      entityId: id,
      before: { status: before.status },
      after: { status, reason },
      ip: req.ip
    })

    return user
  })

  // Change user role
  fastify.patch('/users/:id/role', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['role'],
        properties: {
          role: { type: 'string', enum: ['ADMIN', 'ADVERTISER', 'PUBLISHER'] }
        }
      }
    }
  }, async (req, reply) => {
    const { id } = req.params
    const { role } = req.body

    if (id === req.user.id) return reply.code(400).send({ error: 'CANNOT_CHANGE_OWN_ROLE' })

    const before = await prisma.user.findUnique({ where: { id }, select: { role: true } })
    if (!before) return reply.code(404).send({ error: 'NOT_FOUND' })

    const user = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, email: true, role: true, status: true }
    })

    await auditLog({
      adminId: req.user.id,
      action: 'CHANGE_USER_ROLE',
      entityId: id,
      before: { role: before.role },
      after: { role },
      ip: req.ip
    })

    return user
  })

  // Delete all user sessions (force logout)
  fastify.post('/users/:id/logout-all', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const { id } = req.params
    const user = await prisma.user.findUnique({ where: { id }, select: { id: true } })
    if (!user) return reply.code(404).send({ error: 'NOT_FOUND' })

    await prisma.session.deleteMany({ where: { userId: id } })

    await auditLog({
      adminId: req.user.id,
      action: 'FORCE_LOGOUT_USER',
      entityId: id,
      ip: req.ip
    })

    return { success: true }
  })

  // Get user audit log
  fastify.get('/users/:id/audit', { onRequest: [fastify.authenticate] }, async (req) => {
    const { page = 1, limit = 20 } = req.query
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { entityId: req.params.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.auditLog.count({ where: { entityId: req.params.id } })
    ])

    return { data: logs, meta: { total, page: parseInt(page), per_page: parseInt(limit) } }
  })
}
