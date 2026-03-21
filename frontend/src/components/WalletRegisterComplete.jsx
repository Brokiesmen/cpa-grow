import { useState, Component } from 'react'
import { useSignMessage } from 'wagmi'
import api from '../api/client'

function WalletRegisterCompleteInner({ address, username, role, onSuccess, onError, onCancel }) {
  const { signMessageAsync } = useSignMessage()
  const [loading, setLoading] = useState(false)

  const handleComplete = async () => {
    if (!username || username.length < 3) {
      onError('Username must be at least 3 characters')
      return
    }
    setLoading(true)
    try {
      const { data: nonceData } = await api.get(`/auth/wallet/nonce?address=${address}`)
      const signature = await signMessageAsync({ message: nonceData.message })
      const res = await api.post('/auth/wallet', { address, signature, role, username })
      onSuccess(res.data.user.role)
    } catch (err) {
      if (err.message?.includes('rejected') || err.message?.includes('denied')) {
        onError('Signature rejected')
      } else {
        onError(err.response?.data?.message || 'Registration failed')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <button className="auth-social-btn" onClick={onCancel} style={{ flex: 1 }}>Cancel</button>
      <button className="auth-submit" onClick={handleComplete} disabled={loading} style={{ flex: 2 }}>
        {loading ? <span className="spinner" /> : 'Complete registration'}
      </button>
    </div>
  )
}

class Boundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return (
      <button className="auth-social-btn" onClick={this.props.onCancel}>Cancel (wallet error)</button>
    )
    return this.props.children
  }
}

export default function WalletRegisterComplete(props) {
  return (
    <Boundary onCancel={props.onCancel}>
      <WalletRegisterCompleteInner {...props} />
    </Boundary>
  )
}
