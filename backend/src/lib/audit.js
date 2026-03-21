/**
 * Audit logging для admin действий
 */
import { prisma } from './prisma.js'

export async function auditLog({ adminId, action, entityId, before = null, after = null, ip = null }) {
  try {
    await prisma.auditLog.create({
      data: { adminId, action, entityId, before, after, ip }
    })
  } catch (err) {
    // Не блокируем основной поток если аудит упал
    console.error('[AuditLog] Failed to write audit entry:', err.message)
  }
}
