/**
 * System Worker — Traffic Quality Score (TQS)
 * Calculates publisher quality score weekly
 * Also handles referral bonus processing
 */

import { Queue, Worker } from 'bullmq'
import { prisma } from '../lib/prisma.js'
import { redis } from '../lib/redis.js'
import { notifyPublisher } from '../services/notification.service.js'
import { logger } from '../lib/logger.js'

const log = logger.child({ worker: 'system' })

const QUEUE_NAME = 'system-tasks'

// ─────────────────────────────────────────────
// TQS CALCULATION
// ─────────────────────────────────────────────

/**
 * Calculate Traffic Quality Score for a publisher (0-100)
 * Higher = better quality traffic
 */
export async function calculateTrafficQualityScore(publisherId, period = '30d') {
  const result = await prisma.$queryRaw`
    SELECT
      COUNT(DISTINCT c.id)::int                                         AS total_clicks,
      COUNT(DISTINCT c.id) FILTER (WHERE c.is_unique = true)::int       AS unique_clicks,
      COUNT(DISTINCT c.id) FILTER (WHERE c.is_fraud = true)::int        AS fraud_clicks,
      AVG(c.fraud_score)::float                                          AS avg_fraud_score,
      COUNT(DISTINCT conv.id)::int                                       AS total_conversions,
      COUNT(DISTINCT conv.id) FILTER (WHERE conv.status = 'APPROVED')::int AS approved_convs,
      COUNT(DISTINCT conv.id) FILTER (WHERE conv.status = 'REJECTED')::int AS rejected_convs,
      AVG(EXTRACT(EPOCH FROM (conv.created_at - c.created_at)))::float   AS avg_ctit_seconds
    FROM clicks c
    LEFT JOIN conversions conv ON conv.click_id = c.click_id
    WHERE c.publisher_id = ${publisherId}
      AND c.created_at > NOW() - INTERVAL '30 days'
      AND c.is_sandbox = false
  `

  const s = result[0]
  if (!s || s.total_clicks === 0) {
    return { tqs: 50, details: { reason: 'INSUFFICIENT_DATA' } }
  }

  const fraudRate = s.fraud_clicks / Math.max(s.total_clicks, 1)
  const approvalRate = s.approved_convs / Math.max(s.total_conversions, 1)
  const uniqueRate = s.unique_clicks / Math.max(s.total_clicks, 1)
  const ctitNormal = s.avg_ctit_seconds != null &&
    s.avg_ctit_seconds > 60 &&
    s.avg_ctit_seconds < 86400

  // Score components (0-100, higher = better quality)
  const tqs = Math.round(
    (1 - fraudRate) * 30 +   // 30 pts for low fraud
    approvalRate * 40 +       // 40 pts for high approval
    uniqueRate * 20 +         // 20 pts for unique traffic
    (ctitNormal ? 10 : 0)     // 10 pts for normal CTIT
  )

  const details = {
    fraudRate: +fraudRate.toFixed(4),
    approvalRate: +approvalRate.toFixed(4),
    uniqueRate: +uniqueRate.toFixed(4),
    avgCtitSec: s.avg_ctit_seconds ? Math.round(s.avg_ctit_seconds) : null,
    totalClicks: s.total_clicks,
    totalConversions: s.total_conversions
  }

  const periodStr = new Date().toISOString().slice(0, 7) // "2026-03"

  // Save history snapshot
  await prisma.publisherTQS.create({
    data: {
      publisherId,
      score: tqs,
      fraudRate: details.fraudRate,
      approvalRate: details.approvalRate,
      uniqueRate: details.uniqueRate,
      avgCtitSec: details.avgCtitSec,
      details,
      period: periodStr
    }
  })

  // Update publisher profile
  await prisma.publisher.update({
    where: { id: publisherId },
    data: {
      trafficQualityScore: tqs,
      tqsUpdatedAt: new Date(),
      tqsDetails: details
    }
  })

  return { tqs, details }
}

// ─────────────────────────────────────────────
// REFERRAL BONUS PROCESSING
// ─────────────────────────────────────────────

export async function processReferralBonus(conversionId) {
  const conversion = await prisma.conversion.findUnique({
    where: { id: conversionId },
    include: {
      publisher: { include: { referredBy: true } }
    }
  })

  if (!conversion || conversion.status !== 'APPROVED') return
  if (!conversion.publisher?.referredById) return

  const referrer = conversion.publisher.referredBy
  const referralPercent = Number(referrer.referralPercent)
  const bonus = Number(conversion.payout) * referralPercent / 100

  if (bonus <= 0) return

  // Credit referral bonus to referrer's USD balance
  await prisma.$transaction([
    prisma.publisherBalance.upsert({
      where: { publisherId_currency: { publisherId: referrer.id, currency: 'USD' } },
      update: { available: { increment: bonus } },
      create: { publisherId: referrer.id, currency: 'USD', available: bonus }
    }),
    prisma.publisherTransaction.create({
      data: {
        publisherId: referrer.id,
        type: 'REFERRAL_BONUS',
        amount: bonus,
        currency: 'USD',
        description: `Referral bonus from ${conversion.publisherId}: conv ${conversion.id}`,
        refId: conversion.id
      }
    })
  ])

  await notifyPublisher(referrer.userId, 'REFERRAL_BONUS', {
    amount: bonus,
    currency: 'USD',
    from: conversion.publisherId
  })
}

// ─────────────────────────────────────────────
// BATCH TQS UPDATE
// ─────────────────────────────────────────────

async function runTQSUpdate() {
  const publishers = await prisma.publisher.findMany({
    select: { id: true },
    where: {
      clicks: {
        some: {
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) }
        }
      }
    }
  })

  let updated = 0
  for (const { id } of publishers) {
    try {
      await calculateTrafficQualityScore(id)
      updated++
    } catch (err) {
      log.error({ publisherId: id, err: err.message }, 'TQS calculation failed')
    }
  }

  return { updated }
}

// ─────────────────────────────────────────────
// DISPUTE AUTO-ESCALATION
// ─────────────────────────────────────────────

async function runDisputeEscalation() {
  // Escalate disputes where advertiser didn't reply within 72h
  const overdue = await prisma.dispute.findMany({
    where: {
      status: 'OPEN',
      advertiserDeadline: { lt: new Date() }
    }
  })

  for (const dispute of overdue) {
    await prisma.dispute.update({
      where: { id: dispute.id },
      data: { status: 'ESCALATED' }
    })
  }

  return { escalated: overdue.length }
}

// ─────────────────────────────────────────────
// BULLMQ WORKER
// ─────────────────────────────────────────────

export function startSystemWorker() {
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      switch (job.name) {
        case 'tqs-update':
          return await runTQSUpdate()

        case 'dispute-escalation':
          return await runDisputeEscalation()

        case 'referral-bonus':
          return await processReferralBonus(job.data.conversionId)

        default:
          throw new Error(`Unknown job: ${job.name}`)
      }
    },
    { connection: redis, concurrency: 2 }
  )

  worker.on('completed', (job, result) => {
    log.info({ job: job.name, result }, 'Job completed')
  })

  worker.on('failed', (job, err) => {
    log.error({ job: job.name, err: err.message }, 'Job failed')
  })

  return worker
}

export function createSystemQueue() {
  const queue = new Queue(QUEUE_NAME, { connection: redis })

  // TQS recalculation — every Sunday at 03:00
  queue.add('tqs-update', {}, {
    repeat: { pattern: '0 3 * * 0' },
    jobId: 'tqs-update-cron'
  })

  // Dispute escalation — every hour
  queue.add('dispute-escalation', {}, {
    repeat: { pattern: '0 * * * *' },
    jobId: 'dispute-escalation-cron'
  })

  return queue
}
