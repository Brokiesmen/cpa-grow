import { WagmiProvider } from 'wagmi'
import { mainnet, polygon } from '@reown/appkit/networks'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'b56e18d47c72ab683b10814fe9495694'

const networks = [mainnet, polygon]

export const wagmiAdapter = new WagmiAdapter({ networks, projectId })
export const queryClient = new QueryClient()

export { WagmiProvider, QueryClientProvider }
