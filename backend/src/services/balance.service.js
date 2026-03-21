/**
 * Multi-Currency Balance Service
 * Handles balance operations: credit, debit, transfer between currencies
 */

import { prisma } from '../lib/prisma.js'

const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'USDT']

/**
 * Get all balances for a publisher
 */
export async function getPublisherBalances(publisherId) {
  const balances = await prisma.publisherBalance.findMany({
    where: { publisherId }
  })

  // Return map with zeros for missing currencies
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
 * @param {object} params
 */
export async function creditPublisher({ publisherId, amount, currency = 'USD', type, refId, description }) {
  if (!SUPPORTED_CURRENCIES.includes(currency)) {
    currency = 'USD' // fallback
  }

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
 */
export async function holdFunds({ publisherId, amount, currency = 'USD' }) {
  // hold doesn't reduce available until approval — just tracks reserved amount
  await prisma.publisherBalance.upsert({
    where: { publisherId_currency: { publisherId, currency } },
    update: { hold: { increment: amount } },
    create: { publisherId, currency, hold: amount }
  })
}

/**
 * Release hold and credit available (conversion APPROVED)
 */
export async function releaseHoldToAvailable({ publisherId, amount, currency = 'USD', refId }) {
  await prisma.$transaction([
    prisma.publisherBalance.update({
      where: { publisherId_currency: { publisherId, currency } },
      data: {
        hold: { decrement: amount },
        available: { increment: amount }
      }
    }),
    prisma.publisherTransaction.create({
      data: {
        publisherId,
        type: 'CONVERSION',
        amount,
        currency,
        description: 'Conversion approved',
        refId
      }
    })
  ])
}

/**
 * Debit for payout
 */
export async function debitForPayout({ publisherId, amount, currency, payoutId }) {
  const balance = await prisma.publisherBalance.findUnique({
    where: { publisherId_currency: { publisherId, currency } }
  })

  if (!balance || +balance.available < amount) {
    throw Object.assign(new Error('Insufficient balance'), { code: 'INSUFFICIENT_BALANCE' })
  }

  await prisma.$transaction([
    prisma.publisherBalance.update({
      where: { publisherId_currency: { publisherId, currency } },
      data: { available: { decrement: amount } }
    }),
    prisma.publisherTransaction.create({
      data: {
        publisherId,
        type: 'PAYOUT',
        amount: -amount,
        currency,
        description: 'Payout withdrawal',
        refId: payoutId
      }
    })
  ])
}

/**
 * Validate payout request
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

  if (amount < getMinPayout(currency)) {
    throw Object.assign(
      new Error(`Minimum payout for ${currency} is ${getMinPayout(currency)}`),
      { code: 'BELOW_MINIMUM' }
    )
  }
}

function getMinPayout(currency) {
  const minimums = { USD: 50, EUR: 50, USDT: 50 }
  return minimums[currency] ?? 50
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
    data: transactions.map(t => ({
      ...t,
      amount: +t.amount
    })),
    meta: { total, page, per_page: limit }
  }
}
