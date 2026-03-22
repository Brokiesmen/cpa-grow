/**
 * Admin Platform Stats
 */

export default async function adminStatsRoutes(fastify) {
  const { prisma } = fastify

  // Platform overview stats
  fastify.get('/stats', { onRequest: [fastify.authenticate] }, async () => {
    const now = new Date()
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000)

    const [
      totalUsers,
      newUsersThisMonth,
      usersByRole,
      usersByStatus,
      totalOffers,
      activeOffers,
      pendingOffers,
      totalClicks,
      totalConversions,
      pendingConversions,
      totalRevenue,
      pendingPayouts,
      pendingPayoutsAmount,
      openDisputes,
      fraudAlerts,
      recentRegistrations,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.user.groupBy({ by: ['role'], _count: true }),
      prisma.user.groupBy({ by: ['status'], _count: true }),
      prisma.offer.count(),
      prisma.offer.count({ where: { status: 'ACTIVE' } }),
      prisma.offer.count({ where: { status: 'PENDING_REVIEW' } }),
      prisma.click.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.conversion.count({ where: { status: 'APPROVED', createdAt: { gte: thirtyDaysAgo } } }),
      prisma.conversion.count({ where: { status: 'PENDING' } }),
      prisma.conversion.aggregate({
        where: { status: 'APPROVED', createdAt: { gte: thirtyDaysAgo } },
        _sum: { payout: true }
      }),
      prisma.payout.count({ where: { status: 'PENDING' } }),
      prisma.payout.aggregate({
        where: { status: 'PENDING' },
        _sum: { amount: true }
      }),
      prisma.dispute.count({ where: { status: { in: ['OPEN', 'ESCALATED'] } } }),
      prisma.fraudAlert.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.user.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, email: true, role: true, status: true, createdAt: true }
      }),
    ])

    return {
      users: {
        total: totalUsers,
        newThisMonth: newUsersThisMonth,
        byRole: Object.fromEntries(usersByRole.map(r => [r.role, r._count])),
        byStatus: Object.fromEntries(usersByStatus.map(r => [r.status, r._count])),
      },
      offers: {
        total: totalOffers,
        active: activeOffers,
        pendingReview: pendingOffers,
      },
      traffic: {
        clicksThisMonth: totalClicks,
        conversionsThisMonth: totalConversions,
        pendingConversions,
        revenueThisMonth: totalRevenue._sum.payout ?? 0,
      },
      finance: {
        pendingPayouts,
        pendingPayoutsAmount: pendingPayoutsAmount._sum.amount ?? 0,
      },
      moderation: {
        openDisputes,
        fraudAlertsThisWeek: fraudAlerts,
      },
      recentRegistrations,
    }
  })
}
