/**
 * Sandbox Mode — advertiser integration testing
 * Sandbox clicks/conversions don't affect real balance
 */

import { randomUUID } from 'crypto'

export default async function sandboxRoutes(fastify) {
  const { prisma } = fastify

  async function getAdvertiser(req, reply) {
    const adv = await prisma.advertiser.findFirst({ where: { userId: req.user.id } })
    if (!adv) { reply.code(403).send({ error: 'NOT_ADVERTISER' }); return null }
    return adv
  }

  // Generate a fake click for testing postback integration
  fastify.post('/sandbox/generate-click', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['offer_id'],
        properties: {
          offer_id: { type: 'string' },
          subid1: { type: 'string' }
        }
      }
    }
  }, async (req, reply) => {
    const advertiser = await getAdvertiser(req, reply)
    if (!advertiser) return

    const offer = await prisma.offer.findFirst({
      where: { id: req.body.offer_id, advertiserId: advertiser.id }
    })
    if (!offer) return reply.code(404).send({ error: 'OFFER_NOT_FOUND' })

    // Use or create a sandbox publisher
    let sandboxPublisher = await prisma.publisher.findFirst({
      where: { username: '_sandbox_' }
    })

    if (!sandboxPublisher) {
      const sandboxUser = await prisma.user.upsert({
        where: { email: '_sandbox_@platform.internal' },
        update: {},
        create: {
          email: '_sandbox_@platform.internal',
          passwordHash: 'N/A',
          role: 'PUBLISHER',
          status: 'ACTIVE'
        }
      })
      sandboxPublisher = await prisma.publisher.create({
        data: {
          userId: sandboxUser.id,
          username: '_sandbox_',
          referralCode: '_sandbox_'
        }
      })
    }

    const clickId = randomUUID()

    const click = await prisma.click.create({
      data: {
        clickId,
        publisherId: sandboxPublisher.id,
        offerId: offer.id,
        subid1: req.body.subid1 || 'sandbox-test',
        ipAddress: '127.0.0.1',
        country: 'US',
        isSandbox: true
      }
    })

    const trackingLink = `${process.env.TRACKER_BASE_URL}/go/sandbox?click_id=${clickId}`
    const postbackUrl = `${process.env.TRACKER_BASE_URL}/go/postback?secret=${offer.postbackSecret}&click_id=${clickId}&goal={GOAL}&status=approved`

    return {
      click_id: clickId,
      tracking_link: trackingLink,
      postback_url: postbackUrl,
      instructions: {
        test: `Call: GET ${postbackUrl.replace('{GOAL}', 'ftd')}`,
        note: 'Sandbox conversions do not affect real balance'
      }
    }
  })

  // Manually send a test postback (simulate advertiser calling postback)
  fastify.post('/sandbox/send-postback', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['click_id', 'goal'],
        properties: {
          click_id: { type: 'string' },
          goal: { type: 'string' },
          revenue: { type: 'number' }
        }
      }
    }
  }, async (req, reply) => {
    const advertiser = await getAdvertiser(req, reply)
    if (!advertiser) return

    const { click_id, goal, revenue } = req.body

    const click = await prisma.click.findUnique({
      where: { clickId: click_id },
      include: { offer: true }
    })

    if (!click || !click.isSandbox) {
      return reply.code(404).send({ error: 'SANDBOX_CLICK_NOT_FOUND' })
    }
    if (click.offer.advertiserId !== advertiser.id) {
      return reply.code(403).send({ error: 'FORBIDDEN' })
    }

    const goalRecord = await prisma.offerGoal.findFirst({
      where: { offerId: click.offerId, name: goal }
    })

    const payout = goalRecord?.payout ?? click.offer.payout

    const conversion = await prisma.conversion.create({
      data: {
        clickId: click_id,
        publisherId: click.publisherId,
        offerId: click.offerId,
        advertiserId: advertiser.id,
        goal,
        payout,
        revenue: revenue ? revenue : null,
        status: 'SANDBOX',
        isSandbox: true
      }
    })

    return {
      conversion_id: conversion.id,
      click_id,
      goal,
      payout: +payout,
      status: 'SANDBOX',
      message: 'Test conversion created successfully'
    }
  })

  // List sandbox conversions
  fastify.get('/sandbox/conversions', {
    onRequest: [fastify.authenticate]
  }, async (req, reply) => {
    const advertiser = await getAdvertiser(req, reply)
    if (!advertiser) return

    const conversions = await prisma.conversion.findMany({
      where: { advertiserId: advertiser.id, isSandbox: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        click: { select: { clickId: true, subid1: true } },
        offer: { select: { name: true } }
      }
    })

    return conversions.map(c => ({
      id: c.id,
      click_id: c.clickId,
      offer: c.offer?.name,
      goal: c.goal,
      payout: +c.payout,
      status: c.status,
      created_at: c.createdAt
    }))
  })
}
