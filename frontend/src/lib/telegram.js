/**
 * Telegram Mini App utilities
 * Docs: https://core.telegram.org/bots/webapps
 */

/** Telegram WebApp объект (или null если открыт не в Telegram) */
export const tg = window.Telegram?.WebApp ?? null

/** Приложение запущено внутри Telegram */
export const isTelegramApp = !!(tg?.initData && tg.initData.length > 0)

/** Инициализировать Mini App */
export function initTelegramApp() {
  if (!tg) return
  tg.ready()
  tg.expand()
  // Применить цвет шапки Telegram под наш тёмный дизайн
  tg.setHeaderColor('#0e1621')
  tg.setBackgroundColor('#17212b')
}

/** Данные пользователя из Telegram */
export function getTelegramUser() {
  if (!tg?.initDataUnsafe?.user) return null
  return tg.initDataUnsafe.user
}

/** Raw initData строка для верификации на бэкенде */
export function getInitData() {
  return tg?.initData ?? ''
}

/** Показать главную кнопку Telegram */
export function showMainButton(text, onClick) {
  if (!tg?.MainButton) return
  tg.MainButton.setText(text)
  tg.MainButton.show()
  tg.MainButton.onClick(onClick)
}

/** Скрыть главную кнопку */
export function hideMainButton() {
  if (!tg?.MainButton) return
  tg.MainButton.hide()
}

/** Показать кнопку "Назад" */
export function showBackButton(onClick) {
  if (!tg?.BackButton) return
  tg.BackButton.show()
  tg.BackButton.onClick(onClick)
}

/** Скрыть кнопку "Назад" */
export function hideBackButton() {
  if (!tg?.BackButton) return
  tg.BackButton.hide()
}

/** Тактильный отклик */
export function haptic(type = 'light') {
  tg?.HapticFeedback?.impactOccurred?.(type)
}

/** Закрыть Mini App */
export function closeTelegramApp() {
  tg?.close()
}

/** Открыть внешнюю ссылку */
export function openTelegramLink(url) {
  if (tg) tg.openLink(url)
  else window.open(url, '_blank')
}
