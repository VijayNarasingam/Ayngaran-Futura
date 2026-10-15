import { useCallback, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar.jsx'
import { Welcome } from './Welcome.jsx'
import { useStore } from '../context/StoreContext.jsx'
import { APP } from '../data/reference.js'

const SEEN_KEY = `${APP.storageKey}:welcome`

/** Welcome shows until the user picks a section, then only for that tab session. */
const shouldShowWelcome = () => {
  if (typeof window === 'undefined') return false
  try {
    return window.sessionStorage.getItem(SEEN_KEY) !== '1'
  } catch {
    return true
  }
}

const rememberWelcome = () => {
  try {
    window.sessionStorage.setItem(SEEN_KEY, '1')
  } catch {
    /* private mode - the overlay simply shows again next load */
  }
}

/** Dashboard shell: fixed left sidebar and the routed view area (no topbar). */
export function Layout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [welcomeOpen, setWelcomeOpen] = useState(shouldShowWelcome)
  const location = useLocation()
  const { loading, error, reload } = useStore()

  useEffect(() => {
    setMenuOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [location.pathname])

  const dismissWelcome = useCallback(() => {
    setWelcomeOpen(false)
    rememberWelcome()
  }, [])

  return (
    <div className="app">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} onNavigate={dismissWelcome} />
      {menuOpen ? <div className="scrim" onClick={() => setMenuOpen(false)} /> : null}

      <div className="main">
        <button
          type="button"
          className="icon-btn menu-btn menu-fab"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
        >
          <i className="bi bi-list" aria-hidden="true" />
        </button>

        {/* Without this the dashboard looks identical whether the API is
            serving real records or is completely unreachable. */}
        <div className="app-status" role="status" aria-live="polite">
          {error ? (
            <div className="status-bar status-error" role="alert">
              <i className="bi bi-exclamation-octagon-fill" aria-hidden="true" />
              <div className="status-text">
                <strong>Cannot reach the SQL database.</strong>
                <span>{error}</span>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={reload}>
                <i className="bi bi-arrow-clockwise" aria-hidden="true" /> Retry
              </button>
            </div>
          ) : loading ? (
            <div className="status-bar status-loading">
              <span className="spinner" aria-hidden="true" />
              <span className="status-text">Loading records from the database…</span>
            </div>
          ) : null}
        </div>

        <main className="view">
          <Outlet />
        </main>
        <footer className="app-foot">
          <span>
            {APP.name} - {APP.tagline}
          </span>
        </footer>
      </div>

      <Welcome open={welcomeOpen} onDismiss={dismissWelcome} />
    </div>
  )
}
