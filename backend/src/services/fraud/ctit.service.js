/**
 * CTIT Analysis — Click-To-Install/Conversion Time
 * Detect fraud based on suspicious timing between click and conversion
 */

const CTIT_RULES = {
  GAMBLING_REGISTRATION: {
    minSeconds: 10,
    fastThreshold: 30,
    label: 'registration'
  },
  MOBILE_INSTALL: {
    minSeconds: 2,
    fastThreshold: 10,
    label: 'mobile install'
  },
  DEFAULT: {
    minSeconds: 5,
    fastThreshold: 30,
    label: 'conversion'
  }
}

/**
 * @param {object} click - Click record from DB
 * @param {object} conversion - Conversion record (with offer)
 * @returns {{ suspicious: boolean, reason: string|null, score: number, ctitSeconds: number }}
 */
export function analyzeCTIT(click, conversion) {
  const ctitSeconds = Math.round(
    (new Date(conversion.createdAt) - new Date(click.createdAt)) / 1000
  )

  // Negative CTIT — impossible, hard fraud
  if (ctitSeconds < 0) {
    return { suspicious: true, reason: 'CTIT_NEGATIVE', score: 100, ctitSeconds }
  }

  const rules = getVerticalRules(conversion.offer?.vertical, conversion.goal)

  // Too fast — impossible to complete the action
  if (ctitSeconds < rules.minSeconds) {
    return { suspicious: true, reason: 'CTIT_TOO_FAST', score: 85, ctitSeconds }
  }

  if (ctitSeconds < rules.fastThreshold) {
    return { suspicious: true, reason: 'CTIT_VERY_FAST', score: 50, ctitSeconds }
  }

  // Conversion right before cookie expiry — click flooding pattern
  const cookieLifetimeSec = (click.offer?.cookieLifetime || 30) * 24 * 3600
  if (ctitSeconds > cookieLifetimeSec * 0.95) {
    return { suspicious: true, reason: 'CTIT_NEAR_EXPIRY', score: 40, ctitSeconds }
  }

  return { suspicious: false, reason: null, score: 0, ctitSeconds }
}

/**
 * @param {string} vertical - Offer vertical
 * @param {string} goal - Conversion goal name
 */
function getVerticalRules(vertical, goal) {
  const goalLower = (goal || '').toLowerCase()

  if (vertical === 'GAMBLING' || vertical === 'CRYPTO') {
    if (goalLower.includes('install') || goalLower.includes('app')) {
      return CTIT_RULES.MOBILE_INSTALL
    }
    return CTIT_RULES.GAMBLING_REGISTRATION
  }

  return CTIT_RULES.DEFAULT
}

/**
 * Check click injection: CTIT < 2 seconds = Android malware pattern
 * @param {number} ctitSeconds
 */
export function isClickInjection(ctitSeconds) {
  return ctitSeconds < 2
}

/**
 * Batch analyze multiple conversions for reporting
 * @param {Array} pairs - Array of { click, conversion } objects
 */
export function batchAnalyzeCTIT(pairs) {
  return pairs.map(({ click, conversion }) => ({
    conversionId: conversion.id,
    ...analyzeCTIT(click, conversion)
  }))
}
