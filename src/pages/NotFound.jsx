import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader.jsx'

export default function NotFound() {
  return (
    <div className="page">
      <PageHeader
        crumb="Ayngaran Futura"
        title="Page not found"
        subtitle="That dashboard section does not exist. Use the left sidebar to open a section."
      />
      <div className="empty-state">
        <i className="bi bi-compass" aria-hidden="true" />
        <p className="empty-title">Nothing here</p>
        <Link className="btn btn-primary" to="/marketers">
          <i className="bi bi-people" aria-hidden="true" /> Back to Marketer Details
        </Link>
      </div>
    </div>
  )
}