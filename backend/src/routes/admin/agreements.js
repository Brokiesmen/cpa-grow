/**
 * Admin Agreement Management Routes
 */

export default async function adminAgreementRoutes(fastify) {
  const { prisma } = fastify

  // List all agreement versions
  fastify.get('/agreements', { onRequest: [fastify.authenticate] }, async () => {
    return prisma.affiliateAgreement.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { acceptances: true } }
      }
    })
  })

  // Create new agreement version
  fastify.post('/agreements', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['version', 'title', 'content', 'effectiveAt'],
        properties: {
          version: { type: 'string' },
          title: { type: 'string' },
          content: { type: 'string' },
          effectiveAt: { type: 'string', format: 'date-time' },
          setAsCurrent: { type: 'boolean', default: false }
        }
      }
    }
  }, async (req, reply) => {
    const { version, title, content, effectiveAt, setAsCurrent } = req.body

    const agreement = await prisma.$transaction(async (tx) => {
      if (setAsCurrent) {
        await tx.affiliateAgreement.updateMany({
          where: { isCurrent: true },
          data: { isCurrent: false }
        })
      }

      return tx.affiliateAgreement.create({
        data: { version, title, content, effectiveAt: new Date(effectiveAt), isCurrent: setAsCurrent ?? false }
      })
    })

    return reply.code(201).send(agreement)
  })

  // Set agreement as current
  fastify.patch('/agreements/:id/set-current', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    await prisma.$transaction([
      prisma.affiliateAgreement.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } }),
      prisma.affiliateAgreement.update({ where: { id: req.params.id }, data: { isCurrent: true } })
    ])

    return { success: true }
  })

  // Get acceptance stats for current agreement
  fastify.get('/agreements/acceptance-stats', { onRequest: [fastify.authenticate] }, async () => {
    const current = await prisma.affiliateAgreement.findFirst({ where: { isCurrent: true } })
    if (!current) return { required: false }

    const [total, accepted] = await Promise.all([
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.agreementAcceptance.count({ where: { agreementId: current.id } })
    ])

    return {
      agreement: { id: current.id, version: current.version },
      totalActiveUsers: total,
      acceptedCount: accepted,
      pendingCount: total - accepted,
      acceptanceRate: total > 0 ? +(accepted / total * 100).toFixed(1) : 0
    }
  })
}
