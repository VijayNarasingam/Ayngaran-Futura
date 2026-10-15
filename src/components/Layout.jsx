import { useCallback, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar.jsx'
import { Welcome } from './Welcome.jsx'
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
