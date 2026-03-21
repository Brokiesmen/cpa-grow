/**
 * Notification Service
 * Centralized notification dispatch: WebSocket + (future: Email, Telegram)
 */

import { publishNotification } from '../websocket.js'
import { prisma } from '../lib/prisma.js'

const TEMPLATES = {
  NEW_CONVERSION: (data) => ({
    title: 'New conversion',
    message: `New ${data.status || 'pending'} conversion for offer ${data.offerName || ''}. Payout: $${data.payout}`
  }),
  CONVERSION_APPROVED: (data) => ({
    title: 'Conversion approved',
    message: `Conversion approved. $${data.payout} ${data.currency || 'USD'} added to balance.`
  }),
  CONVERSION_REJECTED: (data) => ({
    title: 'Conversion rejected',
    message: `Conversion rejected. Reason: ${data.reason || 'N/A'}`
  }),
  DISPUTE_OPENED: (data) => ({
    title: 'New dispute',
    message: `Publisher opened a dispute on conversion ${data.conversionId?.slice(0, 8)}...`
  }),
  DISPUTE_REPLIED: (data) => ({
    title: 'Dispute update',
    message: `Dispute ${data.action === 'ACCEPT' ? 'resolved in your favor' : 'received a reply'}.`
  }),
  DISPUTE_RESOLVED: (data) => ({
    title: 'Dispute resolved',
    message: `Dispute resolved: ${data.decision}`
  }),
  REFERRAL_BONUS: (data) => ({
    title: 'Referral bonus',
    message: `You earned $${data.amount} referral bonus!`
  }),
  PAYOUT_PROCESSED: (data) => ({
    title: 'Payout processed',
    message: `Your payout of ${data.amount} ${data.currency} has been sent. TX: ${data.txHash || 'N/A'}`
  }),
  CAP_WARNING: (data) => ({
    title: 'Cap warning',
    message: `Offer "${data.offerName}" has reached ${data.percent}% of its daily cap.`
  }),
  CAP_REACHED: (data) => ({
    title: 'Cap reached',
    message: `Offer "${data.offerName}" daily cap is reached. Traffic paused.`
  }),
  NEW_APPLICATION: (data) => ({
    title: 'New application',
    message: `Publisher ${data.publisherId} applied to your offer.`
  }),
  FRAUD_ALERT: (data) => ({
    title: `Fraud alert [${data.severity}]`,
    message: `Rule: ${data.rule} — ${data.message}`
  })
}

async function getUserIdForPublisher(publisherId) {
  const pub = await prisma.publisher.findUnique({
    where: { id: publisherId },
    select: { userId: true }
  })
  return pub?.userId
}

async function getUserIdForAdvertiser(advertiserId) {
  const adv = await prisma.advertiser.findUnique({
    where: { id: advertiserId },
    select: { userId: true }
  })
  return adv?.userId
}

export async function notifyPublisher(publisherIdOrUserId, type, data = {}) {
  // If it looks like a publisher ID (not user ID), resolve
  let userId = publisherIdOrUserId
  if (!publisherIdOrUserId.startsWith('u')) {
    const resolved = await getUserIdForPublisher(publisherIdOrUserId)
    if (resolved) userId = resolved
  }

  const template = TEMPLATES[type]
  if (!template) return

  const { title, message } = template(data)
  await publishNotification(userId, type, { title, message, data }).catch(console.error)
}

export async function notifyAdvertiser(advertiserIdOrUserId, type, data = {}) {
  let userId = advertiserIdOrUserId
  if (!advertiserIdOrUserId.startsWith('u')) {
    const resolved = await getUserIdForAdvertiser(advertiserIdOrUserId)
    if (resolved) userId = resolved
  }

  const template = TEMPLATES[type]
  if (!template) return

  const { title, message } = template(data)
  await publishNotification(userId, type, { title, message, data }).catch(console.error)
}

export async function notifyAdmin(type, data = {}) {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', status: 'ACTIVE' },
    select: { id: true }
  })

  const template = TEMPLATES[type]
  const { title, message } = template ? template(data) : { title: type, message: JSON.stringify(data) }

  await Promise.all(
    admins.map(admin =>
      publishNotification(admin.id, type, { title, message, data }).catch(console.error)
    )
  )
}
