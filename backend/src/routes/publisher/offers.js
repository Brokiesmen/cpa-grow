/**
 * Publisher Offers — JWT-authenticated web UI route
 */
export default async function publisherOffersRoutes(fastify) {
  const { prisma } = fastify

  // GET /api/publisher/offers — browse all active offers + application status
  fastify.get('/offers', { onRequest: [fastify.authenticate] }, async (req) => {
    const {
      vertical,
      payment_model,
      payout_min,
      page = 1,
      limit = 50,
    } = req.query

    const publisher = await prisma.publisher.findUnique({ where: { userId: req.user.id } })
    if (!publisher) return { data: [], meta: { total: 0 } }

    const take = Math.min(parseInt(limit), 200)
    const skip = (parseInt(page) - 1) * take

    const where = { status: 'ACTIVE' }
    if (vertical) where.vertical = vertical.toUpperCase()
    if (payment_model) where.paymentModel = payment_model.toUpperCase()
    if (payout_min) where.payout = { gte: parseFloat(payout_min) }

    const [offers, total] = await Promise.all([
      prisma.offer.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.offer.count({ where }),
    ])

    const offerIds = offers.map(o => o.id)
    const applications = await prisma.application.findMany({
      where: { publisherId: publisher.id, offerId: { in: offerIds } },
      select: { offerId: true, status: true },
    })
    const appMap = Object.fromEntries(applications.map(a => [a.offerId, a.status]))

    const data = offers.map(offer => ({
      id: offer.id,
      name: offer.name,
      description: offer.description,
      vertical: offer.vertical,
      payment_model: offer.paymentModel,
      payout: +offer.payout,
      currency: offer.currency,
      allowed_geos: offer.allowedGeos,
      traffic_types: offer.allowedTraffic,
      preview_url: offer.previewUrl,
      landing_url: offer.landingUrl,
      cookie_lifetime: offer.cookieLifetime,
      daily_cap: offer.dailyCap,
      status: offer.status,
      applied: !!appMap[offer.id],
      application_status: appMap[offer.id] ?? null,
    }))

    return { data, meta: { total, page: parseInt(page), per_page: take } }
  })

  // POST /api/publisher/applications — apply for an offer
  fastify.post('/applications', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['offer_id'],
        properties: { offer_id: { type: 'string' } },
      },
    },
  }, async (req, reply) => {
    const publisher = await prisma.publisher.findUnique({ where: { userId: req.user.id } })
    if (!publisher) return reply.code(403).send({ error: 'NOT_A_PUBLISHER' })

    const offer = await prisma.offer.findUnique({ where: { id: req.body.offer_id, status: 'ACTIVE' } })
    if (!offer) return reply.code(404).send({ error: 'OFFER_NOT_FOUND' })

    const existing = await prisma.application.findUnique({
      where: { publisherId_offerId: { publisherId: publisher.id, offerId: offer.id } },
    })
    if (existing) return reply.code(409).send({ error: 'ALREADY_APPLIED', status: existing.status })

    const app = await prisma.application.create({
      data: { publisherId: publisher.id, offerId: offer.id },
    })
    return reply.code(201).send({ id: app.id, status: app.status })
  })
}
