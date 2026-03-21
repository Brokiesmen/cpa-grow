/**
 * Behavioral Scoring Service
 * Analyzes user behavior data collected via JS pixel
 * to detect bot traffic and incentivized fraud
 */

import { redis } from '../../lib/redis.js'
import { prisma } from '../../lib/prisma.js'

const BEHAVIOR_KEY_PREFIX = 'behavior:'
const BEHAVIOR_TTL_SECONDS = 7 * 24 * 3600 // 7 days

/**
 * Store a behavior event (from pixel endpoint)
 * @param {string} clickId
 * @param {object} event - { type, ...data }
 */
export async function storeBehaviorEvent(clickId, event) {
  const key = `${BEHAVIOR_KEY_PREFIX}${clickId}`
  await redis.rpush(key, JSON.stringify({ ...event, ts: Date.now() }))
  await redis.expire(key, BEHAVIOR_TTL_SECONDS)

  // Also persist to DB for analysis
  await prisma.behaviorEvent.create({
    data: {
      clickId,
      type: event.type,
      data: event
    }
  }).catch(() => {}) // non-critical, don't fail the pixel request
}

/**
 * Calculate behavioral fraud score for a click
 * @param {string} clickId
 * @returns {{ score: number, reasons: string[], metrics: object }}
 */
export async function getBehavioralScore(clickId) {
  const raw = await redis.lrange(`${BEHAVIOR_KEY_PREFIX}${clickId}`, 0, -1)

  if (raw.length === 0) {
    return { score: 20, reasons: ['NO_BEHAVIOR_DATA'], metrics: {} }
  }

  const events = raw.map(e => JSON.parse(e))

  const metrics = computeMetrics(events)
  const { score, reasons } = scoreMetrics(metrics)

  return { score: Math.min(score, 100), reasons, metrics }
}

/**
 * Compute behavioral metrics from raw events
 */
function computeMetrics(events) {
  return {
    pageViews: events.filter(e => e.type === 'pageview').length,
    scrollDepth: Math.max(0, ...events.filter(e => e.type === 'scroll').map(e => e.depth || 0)),
    timeOnSite: events.filter(e => e.type === 'exit').reduce((sum, e) => sum + (e.duration || 0), 0),
    mouseMovements: events.filter(e => e.type === 'exit').reduce((sum, e) => sum + (e.moves || 0), 0),
    formInteractions: events.filter(e => e.type === 'form').length,
    clickEvents: events.filter(e => e.type === 'click').length,
    totalEvents: events.length
  }
}

/**
 * Score behavioral metrics — returns fraud score (0-100)
 * Higher = more suspicious
 */
function scoreMetrics(metrics) {
  let score = 0
  const reasons = []

  // No mouse movement at all — likely a bot
  if (metrics.mouseMovements < 5 && metrics.timeOnSite > 0) {
    score += 60
    reasons.push('NO_MOUSE_MOVEMENT')
  }

  // Very short session — less than 15 seconds
  if (metrics.timeOnSite > 0 && metrics.timeOnSite < 15000) {
    score += 40
    reasons.push('VERY_SHORT_SESSION')
  }

  // No scroll but has form interaction — suspicious
  if (metrics.scrollDepth < 10 && metrics.formInteractions > 0) {
    score += 30
    reasons.push('NO_SCROLL_WITH_FORM')
  }

  // No events at all after pageview
  if (metrics.totalEvents <= 1) {
    score += 25
    reasons.push('NO_ENGAGEMENT')
  }

  // Perfect scroll to 100% too fast (automated)
  if (metrics.scrollDepth === 100 && metrics.timeOnSite < 5000) {
    score += 35
    reasons.push('INSTANT_FULL_SCROLL')
  }

  return { score, reasons }
}

/**
 * Generate the JS behavior tracking pixel for advertisers
 * @param {string} endpoint - Platform endpoint URL
 * @returns {string} HTML script tag
 */
export function generateBehaviorPixel(endpoint) {
  return `<script>
(function() {
  var CID = document.currentScript.getAttribute('data-cid') || new URLSearchParams(location.search).get('cid') || '';
  if (!CID) return;
  var EP = '${endpoint}/go/behavior';

  function send(data) {
    try { navigator.sendBeacon(EP, JSON.stringify(Object.assign({ cid: CID }, data))); } catch(e) {}
  }

  send({ type: 'pageview', url: location.href });

  var maxScroll = 0;
  window.addEventListener('scroll', function() {
    var d = Math.round((window.scrollY / Math.max(document.body.scrollHeight - window.innerHeight, 1)) * 100);
    if (d > maxScroll) { maxScroll = d; send({ type: 'scroll', depth: d }); }
  }, { passive: true });

  var moveCount = 0;
  document.addEventListener('mousemove', function() { moveCount++; }, { passive: true });

  document.querySelectorAll('input, select, textarea').forEach(function(el) {
    el.addEventListener('focus', function() { send({ type: 'form', field: el.name || el.id }); }, { once: true });
  });

  var t = Date.now();
  window.addEventListener('beforeunload', function() {
    send({ type: 'exit', duration: Date.now() - t, moves: moveCount, scroll: maxScroll });
  });
})();
</script>`
}
