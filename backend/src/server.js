import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import websocket from '@fastify/websocket'
import { prisma } from './lib/prisma.js'
import { redis } from './lib/redis.js'

// Routes
import authRoutes from './routes/auth.js'
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

fastify.decorate('authenticate', async (request, reply) => {
  try {
    await request.jwtVerify()
  } catch {
    reply.code(401).send({ error: 'UNAUTHORIZED' })
  }
})

fastify.decorate('requireRole', (roles) => async (request, reply) => {
  await fastify.authenticate(request, reply)
  if (!roles.includes(request.user.role)) {
    reply.code(403).send({ error: 'FORBIDDEN' })
  }
})

// Routes
await fastify.register(authRoutes, { prefix: '/api/auth' })
await fastify.register(publisherRoutes, { prefix: '/api/publisher' })
await fastify.register(advertiserRoutes, { prefix: '/api/advertiser' })
await fastify.register(adminRoutes, { prefix: '/api/admin' })
await fastify.register(apiV1Routes, { prefix: '/api/v1' })
await fastify.register(trackerRoutes, { prefix: '/go' })
await fastify.register(websocketRoutes)

// Health check
fastify.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }))

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
