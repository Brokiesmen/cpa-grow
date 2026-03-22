import { Component } from 'react'
import { useConnect, useAccount, useSignMessage } from 'wagmi'
import api from '../api/client'

function WalletButtonInner({ onSuccess, onError, onUsernameRequired, role, isRegister, disabled, renderAs }) {
  const { connect, connectors } = useConnect()
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()

  const handleClick = async () => {
    if (!isConnected) {
      const connector = connectors[0]
      if (connector) {
        try { connect({ connector }) } catch { onError('Could not open wallet modal') }
      } else {
        onError('No wallet connector available')
      }
      return
    }
    try {
      const { data: nonceData } = await api.get(`/auth/wallet/nonce?address=${address}`)
      const signature = await signMessageAsync({ message: nonceData.message })
      const res = await api.post('/auth/wallet', { address, signature, role })
      onSuccess(res.data.user.role)
    } catch (err) {
      if (err.response?.data?.error === 'USERNAME_REQUIRED' && onUsernameRequired) {
        onUsernameRequired(address)
        return
      }
      if (err.message?.includes('rejected') || err.message?.includes('denied')) {
        onError('Signature rejected')
      } else {
        onError(err.response?.data?.message || 'Wallet login failed')
      }
    }
  }

  const label = isConnected && address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : isRegister ? 'Register with Web3 Wallet' : 'Wallet'

  if (renderAs === 'row') {
    return (
      <button className="auth-social-row" onClick={handleClick} disabled={disabled} type="button">
        <div className="auth-social-ico wallet">
          <img src="https://avatars.githubusercontent.com/u/37784886" alt="WalletConnect"
            style={{ borderRadius: 4 }} />
        </div>
        {label}
        <span className="soc-chevron">›</span>
      </button>
    )
  }

  return (
    <button className="auth-social-btn wallet" onClick={handleClick} disabled={disabled}>
      <img src="https://avatars.githubusercontent.com/u/37784886" alt="WalletConnect"
        style={{ borderRadius: 4 }} />
      {isConnected && address
        ? `${address.slice(0, 6)}...${address.slice(-4)}`
        : isRegister ? 'Register with Web3 Wallet' : 'Connect Web3 Wallet'}
    </button>
  )
}

class WalletErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) {
      const { renderAs } = this.props.children?.props || {}
      if (renderAs === 'row') return (
        <button className="auth-social-row" disabled type="button">
          <div className="auth-social-ico wallet">
            <img src="https://avatars.githubusercontent.com/u/37784886" alt="WalletConnect"
              style={{ borderRadius: 4, opacity: 0.5 }} />
          </div>
          Wallet (unavailable)
          <span className="soc-chevron">›</span>
        </button>
      )
      return (
        <button className="auth-social-btn wallet" disabled>
          <img src="https://avatars.githubusercontent.com/u/37784886" alt="WalletConnect"
            style={{ borderRadius: 4, opacity: 0.5 }} />
          Web3 Wallet (unavailable)
        </button>
      )
    }
    return this.props.children
  }
}

export default function WalletButton(props) {
  return (
    <WalletErrorBoundary>
      <WalletButtonInner {...props} />
    </WalletErrorBoundary>
  )
}
