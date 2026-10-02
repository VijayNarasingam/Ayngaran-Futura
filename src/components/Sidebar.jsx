import { NavLink } from 'react-router-dom'
import { APP, NAV_TREE } from '../data/reference.js'
import logo from '../asserts/logo.png'

/**
 * Flat sidebar - one link per section, no dropdowns. Daily Vouchers opens
 * the /vouchers hub page; without `end` it stays highlighted across all
 * /vouchers/* section pages.
 */
export function Sidebar({ open, onClose }) {
  return (
    <aside className={`sidebar ${open ? 'is-open' : ''}`.trim()}>
      <div className="brand">
        <img src={logo} alt={`${APP.name} logo`} className="brand-logo" />
        <span className="brand-text">
          <strong>{APP.name}</strong>
        </span>
      </div>

      <nav className="nav" aria-label="Sections">
        <ul>
          {NAV_TREE.map((node) => (
            <li key={node.to}>
              <NavLink
                to={node.to}
                onClick={onClose}
                className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`.trim()}
              >
                {node.icon ? <i className={`bi bi-${node.icon}`} aria-hidden="true" /> : null}
                <span>{node.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}
