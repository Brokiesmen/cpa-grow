/**
 * Public Offer Feed API v1
 * Authenticated via API key — for tech publishers (aggregators, bots)
 */

export default async function offersApiV1(fastify) {
  const { prisma } = fastify

  // API key auth decorator
  async function apiKeyAuth(req, reply) {
    const apiKey = req.headers['authorization']?.replace('Bearer ', '') ||
      req.query.api_key

    if (!apiKey) return reply.code(401).send({ error: 'API_KEY_REQUIRED' })

    const publisher = await prisma.publisher.findFirst({
      where: { apiKey },
      include: { user: { select: { status: true } } }
    })

    if (!publisher || publisher.user.status !== 'ACTIVE') {
      return reply.code(401).send({ error: 'INVALID_API_KEY' })
    }

    req.publisher = publisher
  }

  // GET /api/v1/offers
  fastify.get('/offers', { onRequest: [apiKeyAuth] }, async (req, reply) => {
    const {
      vertical,
      payout_min,
      payout_max,
      geo,
      payment_model,
      sort = 'newest',
      page = 1,
      limit = 50
    } = req.query

    const take = Math.min(parseInt(limit), 200)
    const skip = (parseInt(page) - 1) * take

    const where = {
      status: 'ACTIVE',
      applications: {
        some: {
          publisherId: req.publisher.id,
          status: 'APPROVED'
        }
      }
    }

    if (vertical) where.vertical = vertical.toUpperCase()
    if (payment_model) where.paymentModel = payment_model.toUpperCase()
    if (payout_min) where.payout = { ...where.payout, gte: parseFloat(payout_min) }
    if (payout_max) where.payout = { ...where.payout, lte: parseFloat(payout_max) }
    if (geo) {
      const geos = geo.split(',').map(g => g.trim().toUpperCase())
      where.allowedGeos = { hasSome: geos }
    }

    const sortMap = {
      payout_desc: { payout: 'desc' },
      newest: { createdAt: 'desc' },
      // epc_desc and cr_desc require denormalized fields or subqueries
    }

    const [offers, total] = await Promise.all([
      prisma.offer.findMany({
        where,
        take,
        skip,
        orderBy: sortMap[sort] || { createdAt: 'desc' },
        include: {
          goals: true,
          _count: { select: { conversions: true } }
        }
      }),
      prisma.offer.count({ where })
    ])

    // Get application status for this publisher
    const offerIds = offers.map(o => o.id)
    const applications = await prisma.application.findMany({
      where: { publisherId: req.publisher.id, offerId: { in: offerIds } },
      select: { offerId: true, status: true }
    })
    const appMap = Object.fromEntries(applications.map(a => [a.offerId, a.status]))

    const data = offers.map(offer => ({
      id: offer.id,
      name: offer.name,
      vertical: offer.vertical,
      payment_model: offer.paymentModel,
      payout: +offer.payout,
      currency: offer.currency,
      allowed_geos: offer.allowedGeos,
      traffic_types: offer.allowedTraffic,
      preview_url: offer.previewUrl,
      cookie_lifetime: offer.cookieLifetime,
      daily_cap: offer.dailyCap,
      goals: offer.goals.map(g => ({ name: g.name, payout: +g.payout })),
      status: offer.status.toLowerCase(),
      applied: !!appMap[offer.id],
      application_status: appMap[offer.id] ?? null
    }))

    return {
      data,
      meta: { total, page: parseInt(page), per_page: take }
    }
  })

  // GET /api/v1/offers/:id
  fastify.get('/offers/:id', { onRequest: [apiKeyAuth] }, async (req, reply) => {
    const offer = await prisma.offer.findUnique({
      where: { id: req.params.id, status: 'ACTIVE' },
      include: { goals: true, creatives: true }
    })

    if (!offer) return reply.code(404).send({ error: 'NOT_FOUND' })

    return {
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
      cookie_lifetime: offer.cookieLifetime,
      daily_cap: offer.dailyCap,
      goals: offer.goals.map(g => ({ name: g.name, payout: +g.payout, is_default: g.isDefault })),
      creatives: offer.creatives.map(c => ({ id: c.id, name: c.name, type: c.type, url: c.url, size: c.size }))
    }
  })

  // GET /api/v1/offers/:id/creatives
  fastify.get('/offers/:id/creatives', { onRequest: [apiKeyAuth] }, async (req, reply) => {
    const creatives = await prisma.creative.findMany({
      where: { offerId: req.params.id }
    })
    return creatives
  })

  // POST /api/v1/applications — apply for an offer
  fastify.post('/applications', {
    onRequest: [apiKeyAuth],
    schema: {
      body: {
        type: 'object',
        required: ['offer_id'],
        properties: { offer_id: { type: 'string' } }
      }
    }
  }, async (req, reply) => {
    const offer = await prisma.offer.findUnique({
      where: { id: req.body.offer_id, status: 'ACTIVE' }
    })
    if (!offer) return reply.code(404).send({ error: 'OFFER_NOT_FOUND' })

    const existing = await prisma.application.findUnique({
      where: {
        publisherId_offerId: { publisherId: req.publisher.id, offerId: offer.id }
      }
    })
    if (existing) return reply.code(409).send({ error: 'ALREADY_APPLIED', status: existing.status })

    const app = await prisma.application.create({
      data: { publisherId: req.publisher.id, offerId: offer.id }
    })

    return reply.code(201).send({ id: app.id, status: app.status })
  })

  // GET /api/v1/stats — publisher's aggregated stats
  fastify.get('/stats', { onRequest: [apiKeyAuth] }, async (req) => {
    const { date_from, date_to } = req.query
    const from = date_from ? new Date(date_from) : new Date(Date.now() - 30 * 24 * 3600 * 1000)
    const to = date_to ? new Date(date_to) : new Date()

    const stats = await prisma.$queryRaw`
      SELECT
        DATE(c.created_at) as date,
        COUNT(DISTINCT c.id)::int as clicks,
        COUNT(DISTINCT c.id) FILTER (WHERE c.is_unique)::int as unique_clicks,
        COUNT(DISTINCT conv.id)::int as conversions,
        SUM(conv.payout) FILTER (WHERE conv.status = 'APPROVED') as revenue
      FROM clicks c
      LEFT JOIN conversions conv ON conv.click_id = c.click_id
      WHERE c.publisher_id = ${req.publisher.id}
        AND c.created_at BETWEEN ${from} AND ${to}
        AND c.is_sandbox = false
      GROUP BY DATE(c.created_at)
      ORDER BY date DESC
    `

    return stats.map(row => ({
      date: row.date,
      clicks: row.clicks,
      unique_clicks: row.unique_clicks,
      conversions: row.conversions,
      revenue: row.revenue ? +row.revenue : 0
    }))
  })

  // GET /api/v1/balance
  fastify.get('/balance', { onRequest: [apiKeyAuth] }, async (req) => {
    const balances = await prisma.publisherBalance.findMany({
      where: { publisherId: req.publisher.id }
    })

    return balances.map(b => ({
      currency: b.currency,
      available: +b.available,
      hold: +b.hold
    }))
  })

  // POST /api/v1/links — create tracking link
  fastify.post('/links', {
    onRequest: [apiKeyAuth],
    schema: {
      body: {
        type: 'object',
        required: ['offer_id'],
        properties: {
          offer_id: { type: 'string' },
          subid1: { type: 'string' },
          subid2: { type: 'string' },
          subid3: { type: 'string' }
        }
      }
    }
  }, async (req, reply) => {
    const { offer_id, subid1, subid2, subid3 } = req.body

    // Verify publisher has approved access to this offer
    const app = await prisma.application.findUnique({
      where: {
        publisherId_offerId: { publisherId: req.publisher.id, offerId: offer_id }
      }
    })
    if (!app || app.status !== 'APPROVED') {
      return reply.code(403).send({ error: 'NOT_APPROVED_FOR_OFFER' })
    }

    const { nanoid } = await import('nanoid')
    const shortCode = nanoid(10)

    const link = await prisma.trackingLink.create({
      data: { publisherId: req.publisher.id, offerId: offer_id, shortCode, subid1, subid2, subid3 }
    })

    const trackingUrl = `${process.env.TRACKER_BASE_URL}/go/${link.shortCode}`
    return reply.code(201).send({ id: link.id, tracking_url: trackingUrl, short_code: link.shortCode })
  })

  // RSS Feed for offers
  fastify.get('/offers/rss', { onRequest: [apiKeyAuth] }, async (req, reply) => {
    const { vertical } = req.query

    const offers = await prisma.offer.findMany({
      where: {
        status: 'ACTIVE',
        ...(vertical ? { vertical: vertical.toUpperCase() } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    })

    const items = offers.map(o => `
    <item>
      <title>[${o.vertical}] ${o.name} — $${o.payout} ${o.paymentModel} — ${o.allowedGeos.join(',')}</title>
      <link>${process.env.FRONTEND_URL}/publisher/offers/${o.id}</link>
      <description>${o.paymentModel} $${o.payout} | Geo: ${o.allowedGeos.join(', ')} | Traffic: ${o.allowedTraffic.join(', ')}</description>
      <pubDate>${new Date(o.createdAt).toUTCString()}</pubDate>
      <category>${o.vertical}</category>
      <guid>${o.id}</guid>
    </item>`).join('\n')

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>CPA Platform — New Offers</title>
    <link>${process.env.FRONTEND_URL}/publisher/offers</link>
    <description>Latest CPA offers</description>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${items}
  </channel>
</rss>`

    reply.type('application/rss+xml').send(rss)
  })
}
