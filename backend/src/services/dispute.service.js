/**
 * Dispute Service
 * Handles the full dispute lifecycle: open → reply → escalate → resolve
 */

import { prisma } from '../lib/prisma.js'
import { notifyPublisher, notifyAdvertiser, notifyAdmin } from './notification.service.js'
import { ADVERTISER_REPLY_HOURS, PUBLISHER_DISPUTE_WINDOW_DAYS } from '../lib/constants.js'

/**
 * Open a dispute for a rejected conversion
 */
export async function openDispute({ conversionId, publisherId, reason, evidence = null }) {
  const conversion = await prisma.conversion.findUnique({
    where: { id: conversionId },
    include: { offer: { select: { advertiserId: true } } }
  })

  if (!conversion) throw Object.assign(new Error('Conversion not found'), { code: 'NOT_FOUND' })
  if (conversion.publisherId !== publisherId) throw Object.assign(new Error('Forbidden'), { code: 'FORBIDDEN' })
  if (conversion.status !== 'REJECTED') {
    throw Object.assign(new Error('Only rejected conversions can be disputed'), { code: 'INVALID_STATUS' })
  }

  // Check dispute window (7 days after rejection)
  const windowEnd = new Date(conversion.updatedAt)
  windowEnd.setDate(windowEnd.getDate() + PUBLISHER_DISPUTE_WINDOW_DAYS)
  if (new Date() > windowEnd) {
    throw Object.assign(new Error('Dispute window expired'), { code: 'WINDOW_EXPIRED' })
  }

  // Check for existing dispute
  const existing = await prisma.dispute.findUnique({ where: { conversionId } })
  if (existing) throw Object.assign(new Error('Dispute already exists'), { code: 'DUPLICATE' })

  const advertiserDeadline = new Date()
  advertiserDeadline.setHours(advertiserDeadline.getHours() + ADVERTISER_REPLY_HOURS)

  const dispute = await prisma.dispute.create({
    data: {
      conversionId,
      publisherId,
      advertiserId: conversion.offer.advertiserId,
      publisherReason: reason,
      publisherEvidence: evidence,
      advertiserDeadline,
      messages: {
        create: {
          authorId: publisherId,
          authorRole: 'PUBLISHER',
          message: reason,
          attachments: evidence
        }
      }
    },
    include: { messages: true }
  })

  // Notify advertiser
  await notifyAdvertiser(conversion.offer.advertiserId, 'DISPUTE_OPENED', {
    disputeId: dispute.id,
    conversionId,
    deadline: advertiserDeadline
  })

  return dispute
}

/**
 * Advertiser replies to a dispute
 */
export async function advertiserReply({ disputeId, advertiserId, reply, evidence = null, action }) {
  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: { conversion: { include: { offer: true } } }
  })

  if (!dispute) throw Object.assign(new Error('Dispute not found'), { code: 'NOT_FOUND' })
  if (dispute.advertiserId !== advertiserId) throw Object.assign(new Error('Forbidden'), { code: 'FORBIDDEN' })
  if (!['OPEN', 'ESCALATED'].includes(dispute.status)) {
    throw Object.assign(new Error('Cannot reply to this dispute'), { code: 'INVALID_STATUS' })
  }

  let newStatus = 'ADVERTISER_REPLIED'
  let conversionUpdate = null

  if (action === 'ACCEPT') {
    newStatus = 'RESOLVED_FOR_PUBLISHER'
    conversionUpdate = {
      status: 'APPROVED',
      approvedAt: new Date(),
      rejectedReason: null
    }
  } else if (action === 'REJECT') {
    newStatus = 'RESOLVED_FOR_ADVERTISER'
  }

  const [updatedDispute] = await prisma.$transaction([
    prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: newStatus,
        advertiserReply: reply,
        advertiserEvidence: evidence,
        ...(newStatus.startsWith('RESOLVED') ? { resolvedAt: new Date() } : {}),
        messages: {
          create: {
            authorId: advertiserId,
            authorRole: 'ADVERTISER',
            message: reply,
            attachments: evidence
          }
        }
      }
    }),
    ...(conversionUpdate
      ? [prisma.conversion.update({
          where: { id: dispute.conversionId },
          data: conversionUpdate
        })]
      : [])
  ])

  await notifyPublisher(dispute.publisherId, 'DISPUTE_REPLIED', {
    disputeId,
    action,
    status: newStatus
  })

  return updatedDispute
}

/**
 * Admin resolves a dispute
 */
export async function adminResolve({ disputeId, adminId, decision, note }) {
  const dispute = await prisma.dispute.findUnique({ where: { id: disputeId } })
  if (!dispute) throw Object.assign(new Error('Dispute not found'), { code: 'NOT_FOUND' })

  const isForPublisher = decision === 'PUBLISHER'
  const newStatus = isForPublisher ? 'RESOLVED_FOR_PUBLISHER' : 'RESOLVED_FOR_ADVERTISER'

  const conversionUpdate = isForPublisher
    ? { status: 'APPROVED', approvedAt: new Date() }
    : {}

  await prisma.$transaction([
    prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: newStatus,
        adminNote: note,
        resolvedById: adminId,
        resolvedAt: new Date(),
        messages: {
          create: {
            authorId: adminId,
            authorRole: 'ADMIN',
            message: note
          }
        }
      }
    }),
    ...(Object.keys(conversionUpdate).length
      ? [prisma.conversion.update({ where: { id: dispute.conversionId }, data: conversionUpdate })]
      : [])
  ])

  // Notify both parties
  await Promise.all([
    notifyPublisher(dispute.publisherId, 'DISPUTE_RESOLVED', { disputeId, decision: newStatus }),
    notifyAdvertiser(dispute.advertiserId, 'DISPUTE_RESOLVED', { disputeId, decision: newStatus })
  ])
}

/**
 * Add a message to a dispute thread
 */
export async function addMessage({ disputeId, authorId, authorRole, message, attachments = null }) {
  return prisma.disputeMessage.create({
    data: { disputeId, authorId, authorRole, message, attachments }
  })
}

/**
 * Get dispute with full context for admin review
 */
export async function getDisputeWithContext(disputeId) {
  return prisma.dispute.findUnique({
    where: { id: disputeId },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      conversion: {
        include: {
          click: {
            select: {
              clickId: true, ipAddress: true, country: true,
              userAgent: true, createdAt: true, fraudScore: true
            }
          }
        }
      }
    }
  })
}
