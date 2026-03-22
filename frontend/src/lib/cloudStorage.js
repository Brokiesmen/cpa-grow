/**
 * Telegram CloudStorage — Promise wrappers
 * https://core.telegram.org/bots/webapps#cloudstorage
 *
 * CloudStorage persists data server-side per (user, bot) pair.
 * It survives Mini App closes, reinstalls, and WebView cache clears.
 * Falls back to sessionStorage if not in Telegram.
 */

const cs = window.Telegram?.WebApp?.CloudStorage

export function csGet(key) {
  return new Promise(resolve => {
    if (cs) {
      cs.getItem(key, (err, value) => resolve(err ? null : value || null))
    } else {
      resolve(sessionStorage.getItem(key))
    }
  })
}

export function csSet(key, value) {
  return new Promise(resolve => {
    if (cs) {
      cs.setItem(key, value, () => resolve())
    } else {
      sessionStorage.setItem(key, value)
      resolve()
    }
  })
}

export function csRemove(key) {
  return new Promise(resolve => {
    if (cs) {
      cs.removeItem(key, () => resolve())
    } else {
      sessionStorage.removeItem(key)
      resolve()
    }
  })
}
