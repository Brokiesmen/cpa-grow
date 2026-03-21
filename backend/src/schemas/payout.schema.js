import { z } from 'zod'

const PAYOUT_METHODS = ['USDT_TRC20', 'USDT_ERC20', 'BTC', 'ETH', 'WIRE', 'WEBMONEY', 'CAPITALIST']
const CURRENCIES = ['USD', 'EUR', 'USDT']

export const payoutRequestSchema = z.object({
  amount: z.number().positive('Amount must be positive').max(100000, 'Amount too large'),
  currency: z.enum(CURRENCIES),
  method: z.enum(PAYOUT_METHODS),
  requisites: z.record(z.string()).refine(r => Object.keys(r).length > 0, 'Requisites cannot be empty')
})

export { validateBody } from './auth.schema.js'
