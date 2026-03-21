/**
 * Workers entry point
 * Run separately: node src/workers/index.js
 */

import { startFraudWorker, createFraudQueue } from './fraud.worker.js'
import { startSystemWorker, createSystemQueue } from './system.worker.js'

console.log('[Workers] Starting...')

const fraudQueue = createFraudQueue()
const systemQueue = createSystemQueue()

const fraudWorker = startFraudWorker()
const systemWorker = startSystemWorker()

console.log('[Workers] Fraud worker started')
console.log('[Workers] System worker started')

// Graceful shutdown
process.on('SIGTERM', async () => {
  await fraudWorker.close()
  await systemWorker.close()
  await fraudQueue.close()
  await systemQueue.close()
  process.exit(0)
})
