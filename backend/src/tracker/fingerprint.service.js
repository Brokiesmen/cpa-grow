/**
 * Cookieless Tracking Service
 * Methods: Server-side fingerprint + Email hash
 * Used as fallback when click_id is unavailable
 */

import { createHash } from 'crypto'
import { prisma } from '../lib/prisma.js'

// ─────────────────────────────────────────────
// FINGERPRINT TRACKING
// ─────────────────────────────────────────────

/**
 * Generate fingerprint hash from request headers
 * Stable across page loads for the same user/device
 */
export function getFingerprintHash(req) {
  const components = [
    req.ip,
    req.headers['user-agent'] || '',
    req.headers['accept-language'] || '',
    req.headers['accept-encoding'] || '',
    req.headers['sec-ch-ua'] || '',
    req.headers['sec-ch-ua-platform'] || '',
    req.headers['sec-ch-ua-mobile'] || ''
  ]

  return createHash('sha256')
    .update(components.filter(Boolean).join('|'))
    .digest('hex')
}

/**
 * Try to match a conversion to a click using fingerprint
 * Used when postback doesn't include click_id
 */
export async function matchByFingerprint({ req, offerId, publisherId, cookieLifetimeDays = 30 }) {
  const fpHash = getFingerprintHash(req)

  const since = new Date(Date.now() - cookieLifetimeDays * 24 * 3600 * 1000)

  const click = await prisma.click.findFirst({
    where: {
      fingerprint: fpHash,
      offerId,
      publisherId,
      createdAt: { gte: since },
      conversion: null // not yet converted
    },
    orderBy: { createdAt: 'desc' }
  })

  return { click, fingerprint: fpHash }
}

// ─────────────────────────────────────────────
// EMAIL HASH TRACKING
// ─────────────────────────────────────────────

/**
 * Hash an email address for privacy-safe tracking
 * @param {string} email
 */
export function hashEmail(email) {
  return createHash('sha256')
    .update(email.toLowerCase().trim())
    .digest('hex')
}

/**
 * Try to match a conversion to a click by email hash
 * Advertiser sends email_hash in postback:
 *   /postback?secret=xxx&email_hash={sha256(email)}&goal=lead
 */
export async function matchByEmailHash({ emailHash, offerId, publisherId, cookieLifetimeDays = 30 }) {
  const since = new Date(Date.now() - cookieLifetimeDays * 24 * 3600 * 1000)

  const click = await prisma.click.findFirst({
    where: {
      emailHash,
      offerId,
      publisherId,
      createdAt: { gte: since },
      conversion: null
    },
    orderBy: { createdAt: 'desc' }
  })

  return click
}

// ─────────────────────────────────────────────
// MULTI-METHOD MATCHING
// ─────────────────────────────────────────────

/**
 * Try all available matching methods in priority order:
 * 1. click_id (direct)
 * 2. email_hash
 * 3. fingerprint
 *
 * Returns { click, method } or { click: null, method: null }
 */
export async function resolveClick({ clickId, emailHash, req, offerId, publisherId, cookieLifetimeDays }) {
  // Method 1: Direct click_id match (standard S2S)
  if (clickId) {
    const click = await prisma.click.findUnique({
      where: { clickId },
      include: { offer: { select: { cookieLifetime: true } } }
    })
    if (click) return { click, method: 'click_id' }
  }

  // Method 2: Email hash match
  if (emailHash && offerId && publisherId) {
    const click = await matchByEmailHash({
      emailHash,
      offerId,
      publisherId,
      cookieLifetimeDays
    })
    if (click) return { click, method: 'email_hash' }
  }

  // Method 3: Fingerprint (least reliable, last resort)
  if (req && offerId && publisherId) {
    const { click } = await matchByFingerprint({
      req,
      offerId,
      publisherId,
      cookieLifetimeDays
    })
    if (click) return { click, method: 'fingerprint' }
  }

  return { click: null, method: null }
}
