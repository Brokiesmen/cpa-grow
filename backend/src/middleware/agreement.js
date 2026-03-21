/**
 * Affiliate Agreement Acceptance Middleware
 * Blocks API access if user hasn't accepted the current ToS version
 */

import { prisma } from '../lib/prisma.js'

/**
 * Fastify preHandler — require current ToS acceptance
 * Add to routes that require active acceptance
 */
export async function requireAgreementAcceptance(req, reply) {
  const currentAgreement = await prisma.affiliateAgreement.findFirst({
    where: { isCurrent: true }
  })

  if (!currentAgreement) return // No active agreement — skip check

  const accepted = await prisma.agreementAcceptance.findFirst({
    where: {
      userId: req.user.id,
      agreementId: currentAgreement.id
    }
  })

  if (!accepted) {
    reply.code(403).send({
      error: 'AGREEMENT_REQUIRED',
      message: 'Please accept the updated Terms of Service to continue',
      agreement: {
        id: currentAgreement.id,
        version: currentAgreement.version,
        title: currentAgreement.title,
        effectiveAt: currentAgreement.effectiveAt
      }
    })
  }
}
