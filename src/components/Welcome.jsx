import { useEffect } from 'react'
import { APP } from '../data/reference.js'
import logo from '../asserts/logo-mark.png'

const HERO = './ayngaran-futura-hero.jpg'
const SECTIONS = [
  { icon: 'people', label: 'Marketer Details' },
  { icon: 'buildings', label: 'Project Details' },
  { icon: 'bookmark-check', label: 'Plot Booking' },
  { icon: 'cash-coin', label: 'Loan and Liabilities' },
  { icon: 'journal-text', label: 'Daily Vouchers' },
]

/**
 * Welcome screen - shown on first load, before the user has selected a
 * section. Dismissed by "Enter Dashboard", Escape, or any sidebar click.
 * sessionStorage keeps it to once per tab session so it never nags.
 */
export function Welcome({ open, onDismiss }) {
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

  return (
    <div className="welcome" role="dialog" aria-modal="true" aria-label={`Welcome to ${APP.name}`}>
      <img className="welcome-hero" src={HERO} alt="" aria-hidden="true" />

      <div className="welcome-scrim" />

      <div className="welcome-body">
        <img className="welcome-logo" src={logo} alt="" aria-hidden="true" />

        <p className="welcome-kicker">Welcome to</p>
        <h1 className="welcome-title">{APP.name}</h1>
        <p className="welcome-sub">{APP.tagline}</p>

        <ul className="welcome-sections">
          {SECTIONS.map((section) => (
            <li key={section.icon} className="welcome-chip">
              <i className={`bi bi-${section.icon}`} aria-hidden="true" />
              <span>{section.label}</span>
            </li>
          ))}
        </ul>

        <button type="button" className="btn btn-primary welcome-enter" onClick={onDismiss} autoFocus>
          Enter Dashboard <i className="bi bi-arrow-right" aria-hidden="true" />
        </button>

        <p className="welcome-hint muted-sm">Press Escape to skip</p>
      </div>
    </div>
  )
}