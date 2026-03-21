import disputeRoutes from './disputes.js'
import agreementRoutes from './agreement.js'
import gdprRoutes from './gdpr.js'

export default async function publisherRoutes(fastify) {
  await fastify.register(agreementRoutes)
  await fastify.register(disputeRoutes)
  await fastify.register(gdprRoutes)
}
