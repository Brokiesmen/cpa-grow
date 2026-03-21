import offersRoutes from './offers.js'

export default async function apiV1Routes(fastify) {
  await fastify.register(offersRoutes)
}
