import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar.jsx'
import { APP } from '../data/reference.js'

/** Dashboard shell: fixed left sidebar and the routed view area (no topbar). */
export function Layout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setMenuOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [location.pathname])

  return (
    <div className="app">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
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
    </div>
  )
}
