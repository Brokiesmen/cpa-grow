import adminDisputeRoutes from './disputes.js'
import adminAgreementRoutes from './agreements.js'
import adminStatsRoutes from './stats.js'
import adminUserRoutes from './users.js'
import adminOfferRoutes from './offers.js'
import adminPayoutRoutes from './payouts.js'

export default async function adminRoutes(fastify) {
  await fastify.register(adminStatsRoutes)
  await fastify.register(adminUserRoutes)
  await fastify.register(adminOfferRoutes)
  await fastify.register(adminPayoutRoutes)
  await fastify.register(adminDisputeRoutes)
  await fastify.register(adminAgreementRoutes)
}
