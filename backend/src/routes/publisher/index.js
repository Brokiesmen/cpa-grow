import disputeRoutes from './disputes.js'
import agreementRoutes from './agreement.js'
import gdprRoutes from './gdpr.js'
import offersRoutes from './offers.js'
import settingsRoutes from './settings.js'

export default async function publisherRoutes(fastify) {
  await fastify.register(agreementRoutes)
  await fastify.register(disputeRoutes)
  await fastify.register(gdprRoutes)
  await fastify.register(offersRoutes)
  await fastify.register(settingsRoutes)
}
