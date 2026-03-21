/**
 * Стандартизированные ошибки приложения
 */

export class AppError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message)
    this.code = code
    this.statusCode = statusCode
  }
}

export const Errors = {
  // Auth
  EMAIL_TAKEN:              () => new AppError('EMAIL_TAKEN', 'Email already registered', 409),
  USERNAME_TAKEN:           () => new AppError('USERNAME_TAKEN', 'Username already taken', 409),
  USERNAME_REQUIRED:        () => new AppError('USERNAME_REQUIRED', 'Username is required for publishers', 422),
  INVALID_CREDENTIALS:      () => new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401),
  ACCOUNT_BANNED:           () => new AppError('ACCOUNT_BANNED', 'Account is banned', 403),
  ACCOUNT_PENDING:          () => new AppError('ACCOUNT_PENDING_APPROVAL', 'Account is pending approval', 403),
  ACCOUNT_INACTIVE:         () => new AppError('ACCOUNT_INACTIVE', 'Account is not active', 403),
  UNAUTHORIZED:             () => new AppError('UNAUTHORIZED', 'Authentication required', 401),
  FORBIDDEN:                () => new AppError('FORBIDDEN', 'Access denied', 403),
  INVALID_REFRESH_TOKEN:    () => new AppError('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token', 401),

  // Resources
  NOT_FOUND:                (resource = 'Resource') => new AppError('NOT_FOUND', `${resource} not found`, 404),

  // Balance
  INSUFFICIENT_BALANCE:     (available = 0) => new AppError('INSUFFICIENT_BALANCE', `Insufficient balance. Available: ${available}`, 400),
  INSUFFICIENT_HOLD:        (hold = 0) => new AppError('INSUFFICIENT_HOLD', `Hold balance insufficient. Hold: ${hold}`, 400),
  BELOW_MINIMUM:            (min, currency) => new AppError('BELOW_MINIMUM', `Minimum payout for ${currency} is ${min}`, 400),

  // Disputes
  DISPUTE_WINDOW_EXPIRED:   () => new AppError('DISPUTE_WINDOW_EXPIRED', 'Dispute window has expired', 400),
  DISPUTE_EXISTS:           () => new AppError('DISPUTE_EXISTS', 'Dispute already exists for this conversion', 409),

  // Generic
  VALIDATION_ERROR:         (msg) => new AppError('VALIDATION_ERROR', msg, 422),
  INTERNAL:                 () => new AppError('INTERNAL_ERROR', 'Internal server error', 500),
}

/**
 * Fastify error handler — подключается в server.js
 */
export function errorHandler(error, req, reply) {
  // Наша кастомная ошибка
  if (error instanceof AppError) {
    return reply.code(error.statusCode).send({
      error: error.code,
      message: error.message
    })
  }

  // Fastify validation error (JSON Schema)
  if (error.validation) {
    return reply.code(422).send({
      error: 'VALIDATION_ERROR',
      message: error.message
    })
  }

  // JWT errors
  if (error.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER' ||
      error.code === 'FST_JWT_AUTHORIZATION_TOKEN_INVALID') {
    return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Authentication required' })
  }

  // Prisma not found
  if (error.code === 'P2025') {
    return reply.code(404).send({ error: 'NOT_FOUND', message: 'Resource not found' })
  }

  req.log.error(error)
  return reply.code(500).send({ error: 'INTERNAL_ERROR', message: 'Internal server error' })
}
