import advertiserDisputeRoutes from './disputes.js'
import sandboxRoutes from './sandbox.js'
import settingsRoutes from './settings.js'

export default async function advertiserRoutes(fastify) {
  await fastify.register(advertiserDisputeRoutes)
  await fastify.register(sandboxRoutes)
  await fastify.register(settingsRoutes)
}
