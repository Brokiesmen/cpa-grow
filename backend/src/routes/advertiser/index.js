import advertiserDisputeRoutes from './disputes.js'
import sandboxRoutes from './sandbox.js'

export default async function advertiserRoutes(fastify) {
  await fastify.register(advertiserDisputeRoutes)
  await fastify.register(sandboxRoutes)
}
