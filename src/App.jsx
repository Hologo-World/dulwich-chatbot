import { useEffect, useState } from 'react'

// Change this before sharing with your testers
const TEST_PASSWORD = 'akema-beta-2026'

function loadAkemaWidget() {
  if (document.getElementById('akema-widget')) return

  const script = document.createElement('script')
  script.id = 'akema-widget'
  script.src = 'https://akema.ai/embed/widget.js'
  script.async = true
  script.dataset.chatbotKey = import.meta.env.VITE_AKEMA_KEY
  script.dataset.chatbotApi = import.meta.env.VITE_AKEMA_API
  script.dataset.chatbotWs = import.meta.env.VITE_AKEMA_WS
  script.dataset.chatbotAppKey = import.meta.env.VITE_AKEMA_APP_KEY
  document.body.appendChild(script)
}

function App() {
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem('akema-unlocked') === 'yes'
  )
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  // Only load the widget after the password is accepted
  useEffect(() => {
    if (unlocked) loadAkemaWidget()
  }, [unlocked])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (password === TEST_PASSWORD) {
      sessionStorage.setItem('akema-unlocked', 'yes')
      setUnlocked(true)
    } else {
      setError('Incorrect password. Please try again.')
      setPassword('')
    }
  }

  const handleLock = () => {
    sessionStorage.removeItem('akema-unlocked')
    window.location.reload() // reload removes the widget from the page
  }

  if (!unlocked) {
    return (
      <div style={styles.overlay}>
        <form style={styles.card} onSubmit={handleSubmit}>
          <div style={styles.icon}>🔒</div>
          <h2 style={styles.title}>Restricted Access</h2>
          <p style={styles.text}>
            This chat is in closed testing. Enter the access password to continue.
          </p>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setError('')
            }}
            placeholder="Password"
            autoFocus
            style={styles.input}
          />
          {error && <p style={styles.error}>{error}</p>}
          <button type="submit" style={styles.button}>
            Unlock
          </button>
        </form>
      </div>
    )
  }

  return (
    <main style={styles.page}>
      <h1 style={styles.title}>Akema Chat – Closed Testing</h1>
      <p style={styles.text}>
        Access granted. Open the chat bubble in the bottom-right corner to start testing.
      </p>
      <button onClick={handleLock} style={styles.secondaryButton}>
        Lock session
      </button>
    </main>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    zIndex: 9999,
    fontFamily: 'system-ui, sans-serif',
  },
  card: {
    background: '#ffffff',
    color: '#0f172a',
    width: '100%',
    maxWidth: '380px',
    padding: '2rem',
    borderRadius: '12px',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.3)',
    textAlign: 'center',
  },
  icon: { fontSize: '2.5rem', marginBottom: '0.5rem' },
  title: { margin: '0 0 0.5rem', fontSize: '1.4rem' },
  text: { margin: '0 0 1.25rem', color: '#475569', lineHeight: 1.5 },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '0.75rem',
    fontSize: '1rem',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    marginBottom: '0.75rem',
  },
  error: { color: '#dc2626', fontSize: '0.9rem', margin: '0 0 0.75rem' },
  button: {
    width: '100%',
    padding: '0.75rem',
    fontSize: '1rem',
    fontWeight: 600,
    background: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  page: {
    maxWidth: '600px',
    margin: '4rem auto',
    padding: '0 1rem',
    textAlign: 'center',
    fontFamily: 'system-ui, sans-serif',
  },
  secondaryButton: {
    padding: '0.6rem 1.2rem',
    fontSize: '0.95rem',
    background: 'transparent',
    color: '#2563eb',
    border: '1px solid #2563eb',
    borderRadius: '8px',
    cursor: 'pointer',
  },
}

export default App