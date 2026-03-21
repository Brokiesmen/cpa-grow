/**
 * GDPR Data Deletion (Right to Erasure)
 * Anonymizes user data while preserving financial records for tax compliance
 */

import { randomUUID } from 'crypto'

export default async function gdprRoutes(fastify) {
  const { prisma } = fastify

  // Request account deletion
  fastify.post('/account/delete-request', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['confirmation'],
        properties: {
          confirmation: { type: 'string', const: 'DELETE MY ACCOUNT' },
          reason: { type: 'string' }
        }
      }
    }
  }, async (req, reply) => {
    const userId = req.user.id

    // Check no pending payouts
    const publisher = await prisma.publisher.findFirst({ where: { userId } })
    if (publisher) {
      const pendingPayouts = await prisma.payout.count({
        where: {
          publisherId: publisher.id,
          status: { in: ['PENDING', 'PROCESSING'] }
        }
      })
      if (pendingPayouts > 0) {
        return reply.code(409).send({
          error: 'PENDING_PAYOUTS',
          message: 'Cannot delete account with pending payouts. Please wait for them to complete.'
        })
      }
    }

    // Anonymize user data
    await prisma.$transaction(async (tx) => {
      // Anonymize user
      await tx.user.update({
        where: { id: userId },
        data: {
          email: `deleted_${randomUUID()}@deleted.invalid`,
          passwordHash: 'DELETED',
          status: 'BANNED'
        }
      })

      // Remove sessions
      await tx.session.deleteMany({ where: { userId } })

      // Remove agreement acceptances (personal data)
      await tx.agreementAcceptance.deleteMany({ where: { userId } })

      // Anonymize publisher profile (keep financial records)
      if (publisher) {
        await tx.publisher.update({
          where: { id: publisher.id },
          data: {
            telegram: null,
            phone: null,
            website: null,
            apiKey: `deleted_${randomUUID()}`
          }
        })

        // Anonymize IP addresses in clicks (GDPR)
        await tx.$executeRaw`
          UPDATE clicks
          SET ip_address = '0.0.0.0', ip_hash = 'deleted', fingerprint = NULL
          WHERE publisher_id = ${publisher.id}
        `

        // Anonymize IPs in conversions
        await tx.$executeRaw`
          UPDATE conversions SET ip_address = '0.0.0.0'
          WHERE publisher_id = ${publisher.id}
        `
      }

      // Note: PublisherTransactions, Conversions, Payouts NOT deleted
      // Required for financial/tax records (legal obligation)
    })

    return {
      success: true,
      message: 'Account has been anonymized. Financial records retained as required by law.',
      deletedAt: new Date().toISOString()
    }
  })

  // Export personal data (GDPR Article 20 - Data Portability)
  fastify.get('/account/export-data', {
    onRequest: [fastify.authenticate]
  }, async (req, reply) => {
    const userId = req.user.id
    const publisher = await prisma.publisher.findFirst({ where: { userId } })

    const [user, transactions, payouts] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, role: true, createdAt: true }
      }),
      publisher ? prisma.publisherTransaction.findMany({
        where: { publisherId: publisher.id },
        orderBy: { createdAt: 'desc' },
        take: 1000
      }) : [],
      publisher ? prisma.payout.findMany({
        where: { publisherId: publisher.id },
        select: { id: true, amount: true, currency: true, method: true, status: true, createdAt: true }
      }) : []
    ])

    const exportData = {
      exportedAt: new Date().toISOString(),
      user: { ...user },
      publisher: publisher ? {
        username: publisher.username,
        registeredAt: publisher.createdAt
      } : null,
      transactions: transactions.map(t => ({
        type: t.type,
        amount: +t.amount,
        currency: t.currency,
        date: t.createdAt
      })),
      payouts: payouts.map(p => ({
        amount: +p.amount,
        currency: p.currency,
        method: p.method,
        status: p.status,
        date: p.createdAt
      }))
    }

    reply
      .header('Content-Disposition', 'attachment; filename="my-data-export.json"')
      .type('application/json')
      .send(exportData)
  })
}
