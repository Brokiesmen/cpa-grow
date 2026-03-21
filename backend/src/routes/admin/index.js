import adminDisputeRoutes from './disputes.js'
import adminAgreementRoutes from './agreements.js'

export default async function adminRoutes(fastify) {
  await fastify.register(adminDisputeRoutes)
  await fastify.register(adminAgreementRoutes)
}
