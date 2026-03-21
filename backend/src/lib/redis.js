import Redis from 'ioredis'

let redis

if (process.env.REDIS_MOCK === 'true') {
  // In-memory mock for local dev without Redis installed
  const { default: RedisMock } = await import('ioredis-mock')
  redis = new RedisMock()
  console.log('[Redis] Using in-memory mock (REDIS_MOCK=true)')
} else {
  redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    lazyConnect: true,
    retryStrategy: (times) => Math.min(times * 50, 2000)
  })

  redis.on('error', (err) => {
    console.error('[Redis] Error:', err.message)
  })
}

export { redis }
