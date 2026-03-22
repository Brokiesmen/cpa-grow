import { Component } from 'react'
import { useGoogleLogin } from '@react-oauth/google'

function GoogleButtonInner({ onSuccess, onError, disabled, label, renderAs }) {
  const handleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      onSuccess(tokenResponse.access_token)
    },
    onError: () => onError('Google login was cancelled')
  })

  if (renderAs === 'row') {
    return (
      <button className="auth-social-row" onClick={() => handleLogin()} disabled={disabled} type="button">
        <div className="auth-social-ico google">
          <img src="https://www.svgrepo.com/show/355037/google.svg" alt="Google" />
        </div>
        {label || 'Google'}
        <span className="soc-chevron">›</span>
      </button>
    )
  }

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
    if (this.state.failed) {
      const { renderAs, label } = this.props.children?.props || {}
      if (renderAs === 'row') return (
        <button className="auth-social-row" disabled title="Google login not configured" type="button">
          <div className="auth-social-ico google">
            <img src="https://www.svgrepo.com/show/355037/google.svg" alt="Google" style={{ opacity: 0.5 }} />
          </div>
          {label || 'Google'} (not configured)
          <span className="soc-chevron">›</span>
        </button>
      )
      return (
        <button className="auth-social-btn" disabled title="Google login not configured">
          <img src="https://www.svgrepo.com/show/355037/google.svg" alt="Google" style={{ opacity: 0.5 }} />
          Google (not configured)
        </button>
      )
    }
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
