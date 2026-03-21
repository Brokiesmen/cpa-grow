/**
 * Agreement Routes (Publisher)
 */

export default async function agreementRoutes(fastify) {
  const { prisma } = fastify

  // Get current agreement (for display before acceptance)
  fastify.get('/agreement/current', async (req, reply) => {
    const agreement = await prisma.affiliateAgreement.findFirst({
      where: { isCurrent: true },
      select: { id: true, version: true, title: true, content: true, effectiveAt: true }
    })

    if (!agreement) return reply.code(404).send({ error: 'NO_ACTIVE_AGREEMENT' })

    return agreement
  })

  // Accept current agreement
  fastify.post('/agreement/accept', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const agreement = await prisma.affiliateAgreement.findFirst({
      where: { isCurrent: true }
    })

    if (!agreement) return reply.code(404).send({ error: 'NO_ACTIVE_AGREEMENT' })

    const existing = await prisma.agreementAcceptance.findFirst({
      where: { userId: req.user.id, agreementId: agreement.id }
    })

    if (existing) return { alreadyAccepted: true, acceptedAt: existing.acceptedAt }

    const acceptance = await prisma.agreementAcceptance.create({
      data: {
        userId: req.user.id,
        agreementId: agreement.id,
        ipAddress: req.ip
      }
    })

    return { success: true, acceptedAt: acceptance.acceptedAt, version: agreement.version }
  })

  // Check if user has accepted current agreement
  fastify.get('/agreement/status', { onRequest: [fastify.authenticate] }, async (req) => {
    const agreement = await prisma.affiliateAgreement.findFirst({
      where: { isCurrent: true }
    })

    if (!agreement) return { required: false }

    const accepted = await prisma.agreementAcceptance.findFirst({
      where: { userId: req.user.id, agreementId: agreement.id }
    })

    return {
      required: !accepted,
      agreement: accepted ? null : {
        id: agreement.id,
        version: agreement.version,
        title: agreement.title,
        effectiveAt: agreement.effectiveAt
      },
      acceptedAt: accepted?.acceptedAt ?? null
    }
  })
}
