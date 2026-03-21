/**
 * Auth middleware — централизованные проверки аутентификации и ролей
 */

/**
 * Требует JWT аутентификацию
 */
export async function requireAuth(req, reply) {
  try {
    await req.jwtVerify()
  } catch {
    return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Authentication required' })
  }
}

/**
 * Требует конкретную роль (или одну из ролей)
 * Использование: preHandler: [requireRole('ADMIN')] или requireRole(['ADMIN', 'PUBLISHER'])
 */
export function requireRole(role) {
  const roles = Array.isArray(role) ? role : [role]
  return async function checkRole(req, reply) {
    try {
      await req.jwtVerify()
    } catch {
      return reply.code(401).send({ error: 'UNAUTHORIZED', message: 'Authentication required' })
    }
    if (!roles.includes(req.user.role)) {
      return reply.code(403).send({ error: 'FORBIDDEN', message: 'Access denied' })
    }
  }
}
