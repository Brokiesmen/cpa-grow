/**
 * WebSocket Live Notifications
 * Users subscribe via WS — receive real-time events without polling
 *
 * Publisher events: new conversion, conversion approved, payout processed
 * Advertiser events: new application, cap 80% warning, cap reached
 */

import { prisma } from './lib/prisma.js'
import { redis } from './lib/redis.js'

// Active WS connections per userId
const connections = new Map() // userId -> Set<socket>

export default async function websocketRoutes(fastify) {
  fastify.get('/ws', { websocket: true }, async (connection, req) => {
    const token = req.query.token
    if (!token) {
      connection.socket.close(4001, 'Missing token')
      return
    }

    // Authenticate
    let userId
    try {
      const payload = fastify.jwt.verify(token)
      userId = payload.id
    } catch {
      connection.socket.close(4003, 'Invalid token')
      return
    }

    // Register connection
    if (!connections.has(userId)) {
      connections.set(userId, new Set())
    }
    connections.get(userId).add(connection.socket)

    // Subscribe to Redis pub/sub for this user
    const sub = redis.duplicate()
    await sub.subscribe(`notifications:${userId}`)

    sub.on('message', (channel, message) => {
      if (connection.socket.readyState === 1) { // OPEN
        connection.socket.send(message)
      }
    })

    // Send pending unread notifications on connect
    const pending = await prisma.notification.findMany({
      where: { userId, isRead: false },
      orderBy: { createdAt: 'desc' },
      take: 20
    })

    if (pending.length > 0) {
      connection.socket.send(JSON.stringify({
        type: 'PENDING_NOTIFICATIONS',
        data: pending
      }))
    }

    // Handle incoming messages from client
    connection.socket.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString())
        if (msg.action === 'MARK_READ' && msg.notificationId) {
          await prisma.notification.updateMany({
            where: { id: msg.notificationId, userId },
            data: { isRead: true }
          })
        }
      } catch {}
    })

    // Cleanup on disconnect
    connection.socket.on('close', () => {
      connections.get(userId)?.delete(connection.socket)
      if (connections.get(userId)?.size === 0) {
        connections.delete(userId)
      }
      sub.unsubscribe()
      sub.quit()
    })
  })
}

/**
 * Publish a notification to a user (called from services)
 * Stores in DB + pushes via Redis pub/sub
 */
export async function publishNotification(userId, type, { title, message, data = null }) {
  const notification = await prisma.notification.create({
    data: { userId, type, title, message, data }
  })

  const payload = JSON.stringify({
    type,
    notification: {
      id: notification.id,
      title,
      message,
      data,
      createdAt: notification.createdAt
    }
  })

  // Push to Redis — WebSocket handler will deliver to connected clients
  await redis.publish(`notifications:${userId}`, payload)

  return notification
}

/**
 * Check if user is currently connected via WS
 */
export function isUserOnline(userId) {
  return (connections.get(userId)?.size ?? 0) > 0
}
