/**
 * Общие Prisma include/select для Dispute — используется во всех dispute routes
 */

export const disputeInclude = {
  conversion: {
    select: {
      id: true, status: true, payout: true, currency: true,
      createdAt: true, clickId: true, fraudScore: true
    }
  },
  messages: {
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, authorId: true, authorRole: true,
      message: true, attachments: true, createdAt: true
    }
  }
}

export const disputeListSelect = {
  id: true,
  status: true,
  publisherReason: true,
  advertiserDeadline: true,
  createdAt: true,
  updatedAt: true,
  conversion: {
    select: { id: true, payout: true, currency: true, status: true }
  }
}
