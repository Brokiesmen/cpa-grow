import Fastify from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import websocket from '@fastify/websocket'
import { prisma } from './lib/prisma.js'
import { redis } from './lib/redis.js'
import { errorHandler } from './lib/errors.js'

// Routes
import authRoutes from './routes/auth.js'
import oauthRoutes from './routes/auth.oauth.js'
import publisherRoutes from './routes/publisher/index.js'
import advertiserRoutes from './routes/advertiser/index.js'
import adminRoutes from './routes/admin/index.js'
import apiV1Routes from './routes/api/v1/index.js'
import trackerRoutes from './routes/tracker.js'
import websocketRoutes from './websocket.js'

const fastify = Fastify({
  logger: {
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined
  }
})

// Plugins
await fastify.register(cors, {
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
})

await fastify.register(cookie, {
  secret: process.env.COOKIE_SECRET || process.env.JWT_SECRET || 'cookie-secret'
})

await fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'dev-secret-change-in-prod'
})

await fastify.register(rateLimit, {
  global: false,
  redis
})

await fastify.register(websocket)

// Decorators
fastify.decorate('prisma', prisma)
fastify.decorate('redis', redis)

// Оставляем для обратной совместимости — делегируют в middleware/auth.js
fastify.decorate('authenticate', async (request, reply) => {
  try {
    await request.jwtVerify()
  } catch {
    reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Authentication required' })
  }
})

fastify.decorate('requireRole', (roles) => async (request, reply) => {
  try {
    await request.jwtVerify()
  } catch {
    return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Authentication required' })
  }
  const roleArr = Array.isArray(roles) ? roles : [roles]
  if (!roleArr.includes(request.user.role)) {
    reply.code(403).send({ error: 'FORBIDDEN', message: 'Access denied' })
  }
})

// Добавляем requestId в каждый лог
fastify.addHook('onRequest', async (req) => {
  req.log = req.log.child({ requestId: req.id })
})

// Global error handler
fastify.setErrorHandler(errorHandler)

// Routes
await fastify.register(authRoutes, { prefix: '/api/auth' })
await fastify.register(oauthRoutes, { prefix: '/api/auth' })
await fastify.register(publisherRoutes, { prefix: '/api/publisher' })
await fastify.register(advertiserRoutes, { prefix: '/api/advertiser' })
await fastify.register(adminRoutes, { prefix: '/api/admin' })
await fastify.register(apiV1Routes, { prefix: '/api/v1' })
await fastify.register(trackerRoutes, { prefix: '/go' })
await fastify.register(websocketRoutes)

// Health check
fastify.get('/health', async (req, reply) => {
  const checks = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,
    redis.ping()
  ])

  const db = checks[0].status === 'fulfilled' ? 'ok' : 'error'
  const redisStatus = checks[1].status === 'fulfilled' && checks[1].value === 'PONG' ? 'ok' : 'error'
  const healthy = db === 'ok' && redisStatus === 'ok'

  return reply.code(healthy ? 200 : 503).send({
    status: healthy ? 'ok' : 'degraded',
    db,
    redis: redisStatus,
    uptime: Math.floor(process.uptime()),
    ts: new Date().toISOString()
  })
})

// Graceful shutdown
const signals = ['SIGTERM', 'SIGINT']
for (const signal of signals) {
  process.on(signal, async () => {
    await fastify.close()
    await prisma.$disconnect()
    redis.disconnect()
    process.exit(0)
  })
}

const PORT = process.env.PORT || 3000
const HOST = process.env.HOST || '0.0.0.0'

try {
  await fastify.listen({ port: PORT, host: HOST })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
