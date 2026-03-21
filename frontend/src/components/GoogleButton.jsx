import { Component } from 'react'
import { useGoogleLogin } from '@react-oauth/google'

function GoogleButtonInner({ onSuccess, onError, disabled, label }) {
  const handleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      onSuccess(tokenResponse.access_token)
    },
    onError: () => onError('Google login was cancelled')
  })

  return (
    <button className="auth-social-btn" onClick={() => handleLogin()} disabled={disabled}>
      <img src="https://www.svgrepo.com/show/355037/google.svg" alt="Google" />
      {label}
    </button>
  )
}

class GoogleErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return (
      <button className="auth-social-btn" disabled title="Google login not configured">
        <img src="https://www.svgrepo.com/show/355037/google.svg" alt="Google"
          style={{ opacity: 0.5 }} />
        Google (not configured)
      </button>
    )
    return this.props.children
  }
}

export default function GoogleButton(props) {
  return (
    <GoogleErrorBoundary>
      <GoogleButtonInner {...props} />
    </GoogleErrorBoundary>
  )
}
