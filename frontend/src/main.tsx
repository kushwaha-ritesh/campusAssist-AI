import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '100vh', padding: '2rem',
          fontFamily: 'system-ui, sans-serif', background: '#f4f4f4',
        }}>
          <div style={{
            background: 'white', border: '1px solid #e0e0e0', borderLeft: '4px solid #da1e28',
            borderRadius: 6, padding: '2rem', maxWidth: 600, width: '100%',
          }}>
            <h1 style={{ color: '#da1e28', fontSize: '1.25rem', marginBottom: '0.5rem' }}>
              Application Error
            </h1>
            <p style={{ color: '#393939', fontSize: '0.875rem', marginBottom: '1rem' }}>
              CampusAssist AI encountered an error. Please check the console for details.
            </p>
            <pre style={{
              background: '#161616', color: '#42be65', padding: '1rem',
              borderRadius: 4, fontSize: '0.75rem', overflow: 'auto',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {this.state.error.message}
              {'\n\n'}
              {this.state.error.stack}
            </pre>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: '1rem', padding: '0.625rem 1.25rem',
                background: '#0f62fe', color: 'white', border: 'none',
                borderRadius: 4, cursor: 'pointer', fontSize: '0.875rem',
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

const rootEl = document.getElementById('root')

if (!rootEl) {
  document.body.innerHTML = '<div style="padding:2rem;font-family:sans-serif;color:#da1e28">Error: #root element not found in index.html</div>'
} else {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  )
}
