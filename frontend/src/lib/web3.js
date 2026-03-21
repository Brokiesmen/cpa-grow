import { createAppKit } from '@reown/appkit/react'
import { WagmiProvider } from 'wagmi'
import { mainnet, polygon, arbitrum } from '@reown/appkit/networks'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Получи projectId на https://cloud.reown.com (бесплатно)
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'demo_project_id'

const networks = [mainnet, polygon, arbitrum]

export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId
})

export const queryClient = new QueryClient()

createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId,
  metadata: {
    name: 'Grow Network',
    description: 'CPA Platform',
    url: window.location.origin,
    icons: []
  },
  features: {
    analytics: false,
    email: false,
    socials: []
  }
})

export { WagmiProvider, QueryClientProvider }
