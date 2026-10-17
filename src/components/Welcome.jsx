import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { APP, NAV_TREE } from '../data/reference.js'
import logo from '../asserts/logo-mark.png'

const HERO = './ayngaran-futura-hero.jpg'

/**
 * Welcome screen - the branded splash shown on first load of a tab session.
 *
 * It occupies only the area to the RIGHT of the sidebar (see `.welcome` in
 * global.css), so the sidebar stays visible and usable: picking a section
 * there dismisses the splash too, via Layout's `onNavigate`.
 *
 * The five options here do the same thing and additionally navigate, so the
 * splash is a real starting point rather than a dead-end overlay.
 */
export function Welcome({ open, onDismiss }) {
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') onDismiss()
    }
    document.addEventListener('keydown', onKey)
    document.body.classList.add('welcome-open')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('welcome-open')
    }
  }, [open, onDismiss])

  if (!open) return null

  const choose = (to) => {
    onDismiss()
    navigate(to)
  }

  return (
    <div className="welcome" role="dialog" aria-modal="true" aria-label={`Welcome to ${APP.name}`}>
      <img className="welcome-hero" src={HERO} alt="" aria-hidden="true" />

      <div className="welcome-scrim" />

      <div className="welcome-body">
        <img className="welcome-logo" src={logo} alt="" aria-hidden="true" />

        <h1 className="welcome-title">{APP.name}</h1>
        <span className="welcome-rule" aria-hidden="true" />
        <p className="welcome-sub">{APP.tagline}</p>

        <p className="welcome-choose" id="welcome-choose">
          Select a section to continue
        </p>
        <ul className="welcome-sections" aria-labelledby="welcome-choose">
          {NAV_TREE.map((node) => (
            <li key={node.to}>
              <button type="button" className="welcome-chip" onClick={() => choose(node.to)}>
                <i className={`bi bi-${node.icon}`} aria-hidden="true" />
                <span>{node.label}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="welcome-cards">
          <section className="welcome-card">
            <h2 className="welcome-card-label">{APP.founder.name}</h2>
            <p className="welcome-card-role">{APP.founder.role}</p>
            <p className="welcome-card-line">
              Mobile: <a href={`tel:${APP.founder.mobile.replace(/\s+/g, '')}`}>{APP.founder.mobile}</a>
            </p>
          </section>

          <section className="welcome-card">
            <h2 className="welcome-card-label">{APP.office.label}</h2>
            {APP.office.lines.map((line) => (
              <p key={line} className="welcome-card-line">
                {line}
              </p>
            ))}
          </section>
        </div>

        <p className="welcome-hint">Pick a section above or in the sidebar, or press Escape</p>
      </div>
    </div>
  )
}