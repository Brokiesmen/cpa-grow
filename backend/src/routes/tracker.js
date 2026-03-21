/**
 * Tracker Routes
 * GET /go/:shortCode       — click handler (redirect)
 * GET /go/postback         — S2S postback from advertiser
 * POST /go/behavior        — JS pixel behavior events
 */

import { randomUUID } from 'crypto'
import { createHash } from 'crypto'
import { analyzeCTIT } from '../services/fraud/ctit.service.js'
import { storeBehaviorEvent } from '../services/fraud/behavioral.service.js'
import { getFingerprintHash } from '../tracker/fingerprint.service.js'
import { resolveClick } from '../tracker/fingerprint.service.js'
import { releaseHoldToAvailable } from '../services/balance.service.js'
import { notifyPublisher, notifyAdvertiser } from '../services/notification.service.js'
import { createSystemQueue } from '../workers/system.worker.js'

export default async function trackerRoutes(fastify) {
  const { prisma, redis } = fastify

  let systemQueue
  fastify.addHook('onReady', async () => {
    systemQueue = createSystemQueue()
  })

  // ─── CLICK HANDLER ───────────────────────────────────────────────

  fastify.get('/:shortCode', {
    config: { rateLimit: { max: 200, timeWindow: '1m' } }
  }, async (req, reply) => {
    const { shortCode } = req.params

    // Sandbox passthrough
    if (shortCode === 'sandbox') {
      const clickId = req.query.click_id || randomUUID()
      return reply.redirect(`${process.env.FRONTEND_URL || '/'}?cid=${clickId}&sandbox=1`)
    }

    const link = await prisma.trackingLink.findUnique({ where: { shortCode } })
    if (!link) return reply.code(404).send('Not found')

    const offer = await prisma.offer.findUnique({
      where: { id: link.offerId },
      include: { goals: true }
    })

    if (!offer || offer.status !== 'ACTIVE') {
      return reply.redirect(process.env.FALLBACK_URL || '/')
    }

    // Cap check
    if (offer.dailyCap) {
      const todayCount = await getDailyConversionCount(offer.id)
      if (todayCount >= offer.dailyCap) {
        return reply.redirect(process.env.FALLBACK_URL || '/')
      }
    }

    // Geo check (basic — extend with GeoIP library)
    const country = req.headers['cf-ipcountry'] || req.headers['x-country'] || null

    // Dedup check: same publisher + offer + IP in last 24h
    const ipHash = createHash('md5').update(req.ip || '').digest('hex')
    const dedupKey = `dedup:${link.publisherId}:${link.offerId}:${ipHash}`
    const isUnique = !(await redis.get(dedupKey))
    if (isUnique) await redis.setex(dedupKey, 24 * 3600, '1')

    const fingerprint = getFingerprintHash(req)

    const clickId = randomUUID()
    await prisma.click.create({
      data: {
        clickId,
        publisherId: link.publisherId,
        offerId: link.offerId,
        subid1: link.subid1,
        subid2: link.subid2,
        subid3: link.subid3,
        ipAddress: req.ip,
        ipHash,
        userAgent: req.headers['user-agent'],
        referer: req.headers['referer'],
        country,
        fingerprint,
        isUnique,
        isSandbox: false
      }
    })

    // Build redirect URL with click_id injected
    const separator = offer.landingUrl.includes('?') ? '&' : '?'
    const redirectUrl = `${offer.landingUrl}${separator}cid=${clickId}`

    return reply.redirect(302, redirectUrl)
  })

  // ─── S2S POSTBACK ────────────────────────────────────────────────

  fastify.get('/postback', {
    config: { rateLimit: { max: 1000, timeWindow: '1m' } }
  }, async (req, reply) => {
    const {
      secret,
      click_id,
      goal = 'default',
      status = 'approved',
      revenue,
      email_hash
    } = req.query

    if (!secret) return reply.code(400).send({ error: 'MISSING_SECRET' })

    // Find offer by postback secret
    const offer = await prisma.offer.findFirst({
      where: { postbackSecret: secret }
    })
    if (!offer) {
      await logPostback({ clickId: click_id, raw: req.query, ip: req.ip, status: 'INVALID', error: 'SECRET_NOT_FOUND' }, prisma)
      return reply.code(400).send({ error: 'INVALID_SECRET' })
    }

    // Resolve click via multi-method matching
    const { click, method } = await resolveClick({
      clickId: click_id,
      emailHash: email_hash,
      req,
      offerId: offer.id,
      publisherId: null, // any publisher
      cookieLifetimeDays: offer.cookieLifetime
    })

    if (!click) {
      await logPostback({ clickId: click_id, offerId: offer.id, raw: req.query, ip: req.ip, status: 'INVALID', error: 'CLICK_NOT_FOUND' }, prisma)
      return reply.code(200).send('INVALID_CLICK_ID') // 200 to prevent advertiser retry loops
    }

    // Duplicate check
    const existing = await prisma.conversion.findFirst({
      where: { clickId: click.clickId, goal }
    })
    if (existing) {
      await logPostback({ clickId: click.clickId, offerId: offer.id, raw: req.query, ip: req.ip, status: 'DUPLICATE' }, prisma)
      return reply.code(200).send('DUPLICATE')
    }

    // CTIT analysis
    const ctitResult = analyzeCTIT(
      { ...click, offer },
      { createdAt: new Date(), offer }
    )

    // Find goal payout
    const goalRecord = await prisma.offerGoal.findFirst({
      where: { offerId: offer.id, name: goal }
    })
    const payout = goalRecord?.payout ?? offer.payout

    // Map status
    const conversionStatus = status === 'approved' ? 'APPROVED'
      : status === 'rejected' ? 'REJECTED'
      : 'PENDING'

    const conversion = await prisma.conversion.create({
      data: {
        clickId: click.clickId,
        publisherId: click.publisherId,
        offerId: offer.id,
        advertiserId: offer.advertiserId,
        goal,
        payout,
        revenue: revenue ? parseFloat(revenue) : null,
        status: conversionStatus,
        ipAddress: req.ip,
        country: click.country,
        fraudScore: ctitResult.score,
        ctitSeconds: ctitResult.ctitSeconds,
        approvedAt: conversionStatus === 'APPROVED' ? new Date() : null,
        isSandbox: click.isSandbox
      }
    })

    // Credit publisher balance if approved
    if (conversionStatus === 'APPROVED' && !click.isSandbox) {
      await releaseHoldToAvailable({
        publisherId: click.publisherId,
        amount: +payout,
        currency: offer.currency || 'USD',
        refId: conversion.id
      })

      // Trigger referral bonus
      await systemQueue?.add('referral-bonus', { conversionId: conversion.id })

      await notifyPublisher(click.publisherId, 'CONVERSION_APPROVED', {
        payout: +payout,
        currency: offer.currency || 'USD'
      })
    }

    await logPostback({ clickId: click.clickId, offerId: offer.id, raw: req.query, ip: req.ip, status: 'PROCESSED' }, prisma)

    return reply.code(200).send('OK')
  })

  // ─── BEHAVIOR PIXEL ──────────────────────────────────────────────

  fastify.post('/behavior', {
    config: { rateLimit: { max: 500, timeWindow: '1m' } }
  }, async (req, reply) => {
    const { cid, type, ...data } = req.body || {}

    if (!cid || !type) return reply.code(400).send({ error: 'MISSING_FIELDS' })

    // Validate cid exists
    const clickExists = await redis.get(`click_exists:${cid}`) ||
      await prisma.click.findUnique({ where: { clickId: cid }, select: { clickId: true } })

    if (!clickExists) return reply.code(404).send({ error: 'CLICK_NOT_FOUND' })

    // Cache the validation
    await redis.setex(`click_exists:${cid}`, 3600, '1')

    await storeBehaviorEvent(cid, { type, ...data })

    // sendBeacon doesn't care about response body
    reply.code(204).send()
  })
}

// ─── HELPERS ─────────────────────────────────────────────────────

async function getDailyConversionCount(offerId) {
  const count = await prisma.conversion.count({
    where: {
      offerId,
      createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      status: { in: ['PENDING', 'APPROVED'] },
      isSandbox: false
    }
  })
  return count
}

async function logPostback({ clickId, offerId, raw, ip, status, error }, prisma) {
  await prisma.postbackLog.create({
    data: { clickId, offerId, raw, ip, status, errorMsg: error }
  }).catch(() => {})
}
