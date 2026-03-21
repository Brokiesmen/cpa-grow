/**
 * Fraud Worker — Anomaly Detection
 * Runs every 15 minutes via BullMQ cron
 * Checks for suspicious patterns across publisher/offer combinations
 */

import { Queue, Worker } from 'bullmq'
import { prisma } from '../lib/prisma.js'
import { redis } from '../lib/redis.js'
import { notifyAdmin } from '../services/notification.service.js'
import { logger } from '../lib/logger.js'

const log = logger.child({ worker: 'fraud' })

const QUEUE_NAME = 'fraud-detection'

// ─────────────────────────────────────────────
// ANOMALY RULES
// ─────────────────────────────────────────────

const ANOMALY_RULES = [
  {
    name: 'CR_SPIKE',
    check: async (publisherId, offerId) => {
      const [recent, baseline] = await Promise.all([
        getStats(publisherId, offerId, '1h'),
        getBaselineStats(publisherId, offerId, '7d')
      ])

      if (
        baseline.avgCr > 0 &&
        recent.cr > baseline.avgCr * 3 &&
        recent.conversions >= 10
      ) {
        return {
          triggered: true,
          severity: 'HIGH',
          message: `CR spike: ${recent.cr.toFixed(1)}% vs baseline ${baseline.avgCr.toFixed(1)}%`
        }
      }
      return { triggered: false }
    }
  },

  {
    name: 'CLICK_SPIKE',
    check: async (publisherId, offerId) => {
      const [recent, baseline] = await Promise.all([
        getStats(publisherId, offerId, '1h'),
        getBaselineStats(publisherId, offerId, '7d')
      ])

      if (
        baseline.avgHourlyClicks > 0 &&
        recent.clicks > baseline.avgHourlyClicks * 5
      ) {
        return {
          triggered: true,
          severity: 'MEDIUM',
          message: `Click spike: ${recent.clicks} vs hourly avg ${baseline.avgHourlyClicks.toFixed(0)}`
        }
      }
      return { triggered: false }
    }
  },

  {
    name: 'HIGH_REJECT_RATE',
    check: async (publisherId, offerId) => {
      const stats = await getStats(publisherId, offerId, '24h')

      if (stats.rejectRate > 0.5 && stats.conversions >= 20) {
        return {
          triggered: true,
          severity: 'HIGH',
          message: `High reject rate: ${(stats.rejectRate * 100).toFixed(0)}% (${stats.conversions} conversions)`
        }
      }
      return { triggered: false }
    }
  },

  {
    name: 'SINGLE_IP_CONVERSIONS',
    check: async (publisherId, offerId) => {
      const result = await prisma.$queryRaw`
        SELECT conv.ip_address, COUNT(*) as cnt
        FROM conversions conv
        JOIN clicks c ON c.click_id = conv.click_id
        WHERE c.publisher_id = ${publisherId}
          AND conv.offer_id = ${offerId}
          AND conv.created_at > NOW() - INTERVAL '24 hours'
          AND conv.is_sandbox = false
        GROUP BY conv.ip_address
        HAVING COUNT(*) > 3
      `

      if (result.length > 0) {
        return {
          triggered: true,
          severity: 'CRITICAL',
          message: `${result.length} IPs with 3+ conversions. Top: ${result[0].ip_address}`
        }
      }
      return { triggered: false }
    }
  },

  {
    name: 'ZERO_UNIQUE_RATE',
    check: async (publisherId, offerId) => {
      const stats = await getStats(publisherId, offerId, '6h')

      if (stats.clicks >= 50 && stats.uniqueRate < 0.1) {
        return {
          triggered: true,
          severity: 'HIGH',
          message: `Very low unique click rate: ${(stats.uniqueRate * 100).toFixed(1)}% (${stats.clicks} clicks)`
        }
      }
      return { triggered: false }
    }
  }
]

// ─────────────────────────────────────────────
// STATS HELPERS
// ─────────────────────────────────────────────

async function getStats(publisherId, offerId, period) {
  const intervals = { '1h': '1 hour', '6h': '6 hours', '24h': '24 hours' }
  const interval = intervals[period] || '1 hour'

  const [clickStats, convStats] = await Promise.all([
    prisma.$queryRaw`
      SELECT
        COUNT(*) as total_clicks,
        COUNT(*) FILTER (WHERE is_unique = true) as unique_clicks
      FROM clicks
      WHERE publisher_id = ${publisherId}
        AND offer_id = ${offerId}
        AND created_at > NOW() - CAST(${interval} AS INTERVAL)
        AND is_sandbox = false
    `,
    prisma.$queryRaw`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'APPROVED') as approved,
        COUNT(*) FILTER (WHERE status = 'REJECTED') as rejected
      FROM conversions
      WHERE publisher_id = ${publisherId}
        AND offer_id = ${offerId}
        AND created_at > NOW() - CAST(${interval} AS INTERVAL)
        AND is_sandbox = false
    `
  ])

  const clicks = Number(clickStats[0]?.total_clicks || 0)
  const uniqueClicks = Number(clickStats[0]?.unique_clicks || 0)
  const conversions = Number(convStats[0]?.total || 0)
  const approved = Number(convStats[0]?.approved || 0)
  const rejected = Number(convStats[0]?.rejected || 0)

  return {
    clicks,
    uniqueClicks,
    conversions,
    approved,
    rejected,
    cr: clicks > 0 ? (conversions / clicks) * 100 : 0,
    rejectRate: conversions > 0 ? rejected / conversions : 0,
    uniqueRate: clicks > 0 ? uniqueClicks / clicks : 1
  }
}

async function getBaselineStats(publisherId, offerId, period) {
  const result = await prisma.$queryRaw`
    SELECT
      AVG(daily_clicks) as avg_daily_clicks,
      AVG(daily_cr) as avg_cr
    FROM (
      SELECT
        DATE(c.created_at) as day,
        COUNT(DISTINCT c.id) as daily_clicks,
        CASE WHEN COUNT(DISTINCT c.id) > 0
          THEN COUNT(DISTINCT conv.id)::float / COUNT(DISTINCT c.id) * 100
          ELSE 0
        END as daily_cr
      FROM clicks c
      LEFT JOIN conversions conv ON conv.click_id = c.click_id
      WHERE c.publisher_id = ${publisherId}
        AND c.offer_id = ${offerId}
        AND c.created_at BETWEEN NOW() - INTERVAL '7 days' AND NOW() - INTERVAL '1 hour'
        AND c.is_sandbox = false
      GROUP BY DATE(c.created_at)
    ) daily_stats
  `

  const avgDailyClicks = Number(result[0]?.avg_daily_clicks || 0)

  return {
    avgCr: Number(result[0]?.avg_cr || 0),
    avgDailyClicks,
    avgHourlyClicks: avgDailyClicks / 24
  }
}

// ─────────────────────────────────────────────
// MAIN DETECTION LOGIC
// ─────────────────────────────────────────────

async function runAnomalyDetection() {
  const activePairs = await prisma.$queryRaw`
    SELECT DISTINCT c.publisher_id, c.offer_id
    FROM clicks c
    WHERE c.created_at > NOW() - INTERVAL '1 hour'
      AND c.is_sandbox = false
    LIMIT 500
  `

  let alertCount = 0

  for (const { publisher_id: publisherId, offer_id: offerId } of activePairs) {
    for (const rule of ANOMALY_RULES) {
      try {
        const result = await rule.check(publisherId, offerId)

        if (result.triggered) {
          // Avoid duplicate alerts (same rule, same pair within 4 hours)
          const alertKey = `fraud_alert:${rule.name}:${publisherId}:${offerId}`
          const existing = await redis.get(alertKey)
          if (existing) continue

          await redis.setex(alertKey, 4 * 3600, '1')

          await prisma.fraudAlert.create({
            data: {
              publisherId,
              offerId,
              rule: rule.name,
              severity: result.severity,
              message: result.message
            }
          })

          await notifyAdmin('FRAUD_ALERT', {
            rule: rule.name,
            severity: result.severity,
            publisherId,
            offerId,
            message: result.message
          })

          alertCount++
        }
      } catch (err) {
        log.error({ rule, publisherId, offerId }, `Rule ${rule.name} failed for ${publisherId}/${offerId}:`, err.message)
      }
    }
  }

  return { checked: activePairs.length, alerts: alertCount }
}

// ─────────────────────────────────────────────
// BULLMQ WORKER
// ─────────────────────────────────────────────

export function startFraudWorker() {
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      if (job.name === 'anomaly-detection') {
        return await runAnomalyDetection()
      }
    },
    {
      connection: redis,
      concurrency: 1
    }
  )

  worker.on('completed', (job, result) => {
    log.info({ result }, `FraudWorker completed: checked=${result?.checked}, alerts=${result?.alerts}`)
  })

  worker.on('failed', (job, err) => {
    log.error({ err: err.message }, `FraudWorker failed:`, err.message)
  })

  return worker
}

// Schedule: every 15 minutes
export function createFraudQueue() {
  const queue = new Queue(QUEUE_NAME, { connection: redis })

  queue.add(
    'anomaly-detection',
    {},
    {
      repeat: { pattern: '*/15 * * * *' },
      jobId: 'anomaly-detection-cron'
    }
  )

  return queue
}
