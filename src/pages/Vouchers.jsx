import { useMemo } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ResourcePage } from '../components/ResourcePage.jsx'
import { PageHeader, Panel } from '../components/PageHeader.jsx'
import { SITE_VOUCHER_TYPES, VOUCHER_TYPES } from '../data/reference.js'
import { siteSpendResource, voucherResource } from '../resources/vouchers.jsx'
import { useStore } from '../context/StoreContext.jsx'

/** The four Daily Voucher sections shown as buttons on the /vouchers hub. */
const SECTION_CARDS = [
  { to: '/vouchers/office', label: 'Office', hint: 'Daily office running expenses', icon: 'receipt' },
  { to: '/vouchers/promotion', label: 'Promotion', hint: 'Marketing and promotional spending', icon: 'megaphone' },
  {
    to: '/vouchers/registration',
    label: 'Registration',
    hint: 'Registration, stamp duty and documentation costs',
    icon: 'file-earmark-text',
  },
  { to: '/vouchers/site', label: 'Site', hint: 'All 11 Site Spend heads as buttons', icon: 'cone-striped' },
]

/**
 * Daily Vouchers hub - /vouchers shows the four sections as buttons and
 * only the selected section opens (as its own page).
 */
function VoucherHub() {
  const navigate = useNavigate()
  return (
    <div className="page">
      <PageHeader
        crumb="Daily Vouchers"
        title="Daily Vouchers"
        subtitle="Choose a section - only that view opens."
      />
      <Panel title="Voucher sections" subtitle="Office, Promotion, Registration or Site Spend.">
        <div className="menu-cards">
          {SECTION_CARDS.map((card) => (
            <button
              key={card.to}
              type="button"
              className="menu-card"
              onClick={() => navigate(card.to)}
            >
              <i className={`bi bi-${card.icon}`} aria-hidden="true" />
              <span className="menu-card-label">{card.label}</span>
              <span className="muted-sm">{card.hint}</span>
            </button>
          ))}
        </div>
      </Panel>
    </div>
  )
}

/**
 * Daily Vouchers router:
 *   /vouchers                          -> section hub (Office/Promotion/Registration/Site)
 *   /vouchers/office | promotion | registration  -> single voucher book
 *   /vouchers/site                               -> all 11 site heads as buttons
 *   /vouchers/site/:head                         -> one site spend head
 *
 * NOTE: App.jsx registers these as static routes (no :type param), so the
 * office/promotion/registration section must be derived from the pathname.
 */
export default function Vouchers() {
  const { head } = useParams()
  const location = useLocation()
  const { data } = useStore()

  const resource = useMemo(() => {
    if (head) {
      const siteType = SITE_VOUCHER_TYPES.find((item) => item.slug === head)
      return siteType ? voucherResource(data, siteType) : null
    }
    const segment = location.pathname.split('/').filter(Boolean).pop() || ''
    if (segment === 'vouchers') return 'hub'
    if (segment === 'site') return siteSpendResource(data)
    const type = VOUCHER_TYPES[segment]
    if (type && type.group === 'office') return voucherResource(data, type)
    return null
  }, [data, head, location.pathname])

  if (resource === 'hub') return <VoucherHub />

  if (!resource) {
    return (
      <div className="page">
        <PageHeader
          crumb="Daily Vouchers"
          title="Voucher section not found"
          subtitle="That Daily Vouchers section does not exist."
        />
        <Link className="btn btn-primary" to="/vouchers/site">
          <i className="bi bi-arrow-left" aria-hidden="true" /> Back to Site Spend
        </Link>
      </div>
    )
  }

  return <ResourcePage resource={resource} />
}
