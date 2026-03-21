/**
 * Multi-Currency Balance Service
 * Handles balance operations: credit, debit, transfer between currencies
 */

import { prisma } from '../lib/prisma.js'
import { SUPPORTED_CURRENCIES, MIN_PAYOUT } from '../lib/constants.js'

/**
 * Get all balances for a publisher
 */
export async function getPublisherBalances(publisherId) {
  const balances = await prisma.publisherBalance.findMany({
    where: { publisherId }
  })

  return SUPPORTED_CURRENCIES.map(currency => {
    const found = balances.find(b => b.currency === currency)
    return {
      currency,
      available: found ? +found.available : 0,
      hold: found ? +found.hold : 0,
      total: found ? +(+found.available + +found.hold).toFixed(8) : 0
    }
  })
}

/**
 * Credit publisher balance (on conversion approval)
 */
export async function creditPublisher({ publisherId, amount, currency = 'USD', type, refId, description }) {
  if (!SUPPORTED_CURRENCIES.includes(currency)) currency = 'USD'

  await prisma.$transaction([
    prisma.publisherBalance.upsert({
      where: { publisherId_currency: { publisherId, currency } },
      update: { available: { increment: amount } },
      create: { publisherId, currency, available: amount }
    }),
    prisma.publisherTransaction.create({
      data: { publisherId, type, amount, currency, description, refId }
    })
  ])
}

/**
 * Move funds to hold (when conversion enters PENDING)
 * Атомарно: нельзя уйти в минус по hold
 */
export async function holdFunds({ publisherId, amount, currency = 'USD' }) {
  await prisma.publisherBalance.upsert({
    where: { publisherId_currency: { publisherId, currency } },
    update: { hold: { increment: amount } },
    create: { publisherId, currency, hold: amount }
  })
}

/**
 * Release hold and credit available (conversion APPROVED)
 * Атомарно проверяем что hold >= amount перед release
 */
export async function releaseHoldToAvailable({ publisherId, amount, currency = 'USD', refId }) {
  await prisma.$transaction(async (tx) => {
    const balance = await tx.publisherBalance.findUnique({
      where: { publisherId_currency: { publisherId, currency } }
    })

    if (!balance || +balance.hold < amount) {
      throw Object.assign(
        new Error(`Hold balance insufficient. Hold: ${balance ? +balance.hold : 0}, requested: ${amount}`),
        { code: 'INSUFFICIENT_HOLD' }
      )
    }

    await tx.publisherBalance.update({
      where: { publisherId_currency: { publisherId, currency } },
      data: {
        hold: { decrement: amount },
        available: { increment: amount }
      }
    })

    await tx.publisherTransaction.create({
      data: {
        publisherId,
        type: 'CONVERSION',
        amount,
        currency,
        description: 'Conversion approved',
        refId
      }
    })
  })
}

/**
 * Debit for payout
 * Атомарно проверяем available >= amount внутри транзакции
 */
export async function debitForPayout({ publisherId, amount, currency, payoutId }) {
  await prisma.$transaction(async (tx) => {
    const balance = await tx.publisherBalance.findUnique({
      where: { publisherId_currency: { publisherId, currency } }
    })

    if (!balance || +balance.available < amount) {
      throw Object.assign(
        new Error(`Insufficient balance. Available: ${balance ? +balance.available : 0}`),
        { code: 'INSUFFICIENT_BALANCE' }
      )
    }

    await tx.publisherBalance.update({
      where: { publisherId_currency: { publisherId, currency } },
      data: { available: { decrement: amount } }
    })

    await tx.publisherTransaction.create({
      data: {
        publisherId,
        type: 'PAYOUT',
        amount: -amount,
        currency,
        description: 'Payout withdrawal',
        refId: payoutId
      }
    })
  })
}

/**
 * Validate payout request (read-only check перед debit)
 */
export async function validatePayoutRequest({ publisherId, amount, currency }) {
  const balance = await prisma.publisherBalance.findUnique({
    where: { publisherId_currency: { publisherId, currency } }
  })

  if (!balance || +balance.available < amount) {
    throw Object.assign(
      new Error(`Insufficient ${currency} balance. Available: ${balance ? +balance.available : 0}`),
      { code: 'INSUFFICIENT_BALANCE' }
    )
  }

  const min = getMinPayout(currency)
  if (amount < min) {
    throw Object.assign(
      new Error(`Minimum payout for ${currency} is ${min}`),
      { code: 'BELOW_MINIMUM' }
    )
  }
}

export function getMinPayout(currency) {
  return MIN_PAYOUT[currency] ?? MIN_PAYOUT.DEFAULT
}

/**
 * Get transaction history for publisher
 */
export async function getTransactionHistory({ publisherId, currency, page = 1, limit = 50 }) {
  const skip = (page - 1) * limit
  const where = { publisherId, ...(currency ? { currency } : {}) }

  const [transactions, total] = await Promise.all([
    prisma.publisherTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.publisherTransaction.count({ where })
  ])

  return {
    data: transactions.map(t => ({ ...t, amount: +t.amount })),
    meta: { total, page, per_page: limit }
  }
}
