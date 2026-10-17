import { useEffect } from 'react'
import { APP } from '../data/reference.js'

const HERO = './ayngaran-futura-hero.jpg'

/**
 * Welcome screen - the branded splash shown on first load of a tab session.
 *
 * The hero artwork ALREADY carries the whole design: the logo, the
 * "AYNGARAN FUTURA" wordmark with its gold flourish, the tagline and both
 * contact cards. So this renders the artwork and nothing else - an earlier
 * version also drew that content in HTML, which stacked a second logo,
 * title and pair of cards on top of the ones baked into the image and
 * darkened the whole thing with a scrim.
 *
 * It occupies only the area to the RIGHT of the sidebar (see `.welcome` in
 * global.css), which stays visible and usable: picking a section there
 * dismisses the splash via Layout's `onNavigate`. Escape also skips.
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
      <img className="welcome-hero" src={HERO} alt={`${APP.name} - Plot Booking, Project & Daily Voucher Tracker`} />
    </div>
  )
}