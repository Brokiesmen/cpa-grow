import { createContext, useContext, useEffect, useState } from 'react'
import { tg, isTelegramApp, initTelegramApp, getTelegramUser } from '../lib/telegram'

const TelegramCtx = createContext(null)

export function TelegramProvider({ children }) {
  const [tgUser, setTgUser] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (isTelegramApp) {
      initTelegramApp()
      setTgUser(getTelegramUser())
    }
    setReady(true)
  }, [])

  return (
    <TelegramCtx.Provider value={{ tg, isTelegramApp, tgUser, ready }}>
      {children}
    </TelegramCtx.Provider>
  )
}

export const useTelegram = () => useContext(TelegramCtx)
