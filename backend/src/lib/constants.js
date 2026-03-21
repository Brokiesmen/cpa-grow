/**
 * Глобальные константы приложения
 * Все magic numbers/strings должны быть здесь
 */

// Auth
export const TOKEN_EXPIRY = {
  ACCESS: '15m',
  REFRESH_DAYS: 30
}

// Disputes
export const PUBLISHER_DISPUTE_WINDOW_DAYS = 7
export const ADVERTISER_REPLY_HOURS = 72

// Payouts
export const MIN_PAYOUT = {
  USD: 50,
  EUR: 50,
  USDT: 50,
  DEFAULT: 50
}

// Fraud
export const FRAUD_SCORE_AUTO_REJECT = 80

export const CTIT_RULES = {
  GAMBLING:  { min: 10, max: 3600 },
  CRYPTO:    { min: 10, max: 3600 },
  NUTRA:     { min: 30, max: 86400 },
  FINANCE:   { min: 30, max: 86400 },
  DATING:    { min: 5,  max: 86400 },
  MOBILE:    { min: 2,  max: 600 },
  DEFAULT:   { min: 5,  max: 86400 }
}

// Currencies
export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'USDT']

// Payout methods
export const PAYOUT_METHODS = ['USDT_TRC20', 'USDT_ERC20', 'BTC', 'ETH', 'WIRE', 'WEBMONEY', 'CAPITALIST']
