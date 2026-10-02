import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageHeader, Panel } from '../components/PageHeader.jsx'
import { DataTable } from '../components/DataTable.jsx'
import { FormGrid, coerceValues, validateValues } from '../components/FormField.jsx'
import { useStore } from '../context/StoreContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { ENUMS } from '../data/reference.js'
import { formatDate, formatNumber, money } from '../lib/format.js'
import { projectStats } from '../lib/selectors.js'
import { enumOptions } from '../resources/common.jsx'

const PROJECT_FIELDS = [
  { key: 'name', label: 'Project Name', type: 'text', required: true, hint: 'Project 1 / Project 2 / Project 3 or a phase name.' },
  { key: 'siteName', label: 'Site / Layout Name', type: 'text', placeholder: 'Ayngaran Futura - Phase 1' },
  { key: 'location', label: 'Location', type: 'text', placeholder: 'Village, District, State' },
  { key: 'surveyNumber', label: 'Survey Number', type: 'text' },
  { key: 'pattaNumber', label: 'Patta Number', type: 'text' },
  { key: 'approvalNo', label: 'DTCP / Approval No', type: 'text' },
  { key: 'totalAreaAcres', label: 'Total Area (Acres)', type: 'number', step: '0.01', min: '0' },
  { key: 'totalAreaSqft', label: 'Total Area (Sq Ft)', type: 'number', min: '0' },
  { key: 'totalPlots', label: 'Total Plots', type: 'number', min: '0' },
  { key: 'pricePerSqft', label: 'Price per Sq Ft', type: 'currency' },
  { key: 'launchDate', label: 'Launch Date', type: 'date' },
  { key: 'landOwner', label: 'Land Owner / Promoter', type: 'text' },
  { key: 'status', label: 'Project Status', type: 'select', required: true, options: enumOptions(ENUMS.projectStatus) },
  { key: 'remarks', label: 'Remarks', type: 'textarea', span: 2 },
]

const bookingColumns = [
  { key: 'id', label: 'Booking No', width: '100px', mono: true },
  { key: 'customerName', label: 'Customer', width: '18%' },
  { key: 'plotNumber', label: 'Plot No', width: '80px' },
  { key: 'squareFeet', label: 'Sq Ft', type: 'number', width: '80px' },
  { key: 'totalAmount', label: 'Total Amount', type: 'currency', width: '125px' },
  { key: 'bookingAmount', label: 'Booking Amount', type: 'currency', width: '130px' },
  { key: 'pending', label: 'Pending Amount', type: 'currency', tone: 'danger', width: '125px' },
  { key: 'bookingDate', label: 'Booking Date', type: 'date', width: '110px' },
  {
    key: 'status',
    label: 'Status',
    width: '115px',
    badge: true,
    tones: { 'Advance Paid': 'warn', Booked: 'info', Registered: 'ok', Cancelled: 'danger', Enquiry: 'muted' },
  },
]

const liabilityColumns = [
  { key: 'id', label: 'Loan No', width: '95px', mono: true },
  { key: 'lenderName', label: 'Lender / Party', width: '22%' },
  { key: 'liabilityType', label: 'Type', width: '135px', badge: true },
  { key: 'principalAmount', label: 'Principal', type: 'currency', width: '125px' },
  { key: 'outstandingBalance', label: 'Outstanding', type: 'currency', tone: 'danger', width: '130px' },
  { key: 'emiAmount', label: 'EMI', type: 'currency', width: '110px' },
  { key: 'status', label: 'Status', width: '95px', badge: true, tones: { Active: 'warn', Closed: 'ok' } },
]

/** Project Details - pick Project 1 / 2 / 3 and see that project's details. */
export default function Projects() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const { data, add, update } = useStore()
  const toast = useToast()

  const [form, setForm] = useState(null) // null | { mode:'add' } | { mode:'edit' }
  const [values, setValues] = useState({})
  const [errors, setErrors] = useState({})

  const projects = data.projects
  const selected = useMemo(
    () => (projectId ? projects.find((project) => project.id === projectId) || null : null),
    [projects, projectId],
  )
  const stats = useMemo(() => (selected ? projectStats(selected, data) : null), [selected, data])

  const openEdit = () => {
    setValues({ ...selected })
    setErrors({})
    setForm({ mode: 'edit' })
  }

  const handleSave = () => {
    const problems = validateValues(values, PROJECT_FIELDS)
    if (Object.keys(problems).length) {
      setErrors(problems)
      toast.error('Please fix the highlighted fields.')
      return
    }
    if (form?.mode === 'add') {
      const created = add('projects', coerceValues(values, PROJECT_FIELDS))
      toast.success(`${values.name} added as ${created.id}.`)
      setForm(null)
      navigate(`/projects/${created.id}`)
      return
    }
    update('projects', selected.id, coerceValues(values, PROJECT_FIELDS))
    toast.success(`${values.name} details updated.`)
    setForm(null)
  }

  const openAdd = () => {
    setValues({})
    setErrors({})
    setForm({ mode: 'add' })
  }

  const closeForm = () => setForm(null)

  const detailRows = selected && stats
    ? [
        ['Site / Layout Name', selected.siteName],
        ['Location', selected.location],
        ['Survey No', selected.surveyNumber],
        ['Patta No', selected.pattaNumber],
        ['DTCP / Approval No', selected.approvalNo],
        ['Total Area', `${formatNumber(selected.totalAreaAcres)} acres (${formatNumber(selected.totalAreaSqft)} sq ft)`],
        ['Total Plots', formatNumber(selected.totalPlots)],
        ['Price per Sq Ft', money(selected.pricePerSqft)],
        ['Launch Date', formatDate(selected.launchDate)],
        ['Land Owner / Promoter', selected.landOwner],
        ['Remarks', selected.remarks],
      ]
    : []

  // Full-page Add form (no popup) with Back - same pattern as other sections.
  if (!projectId && form?.mode === 'add') {
    return (
      <div className="page">
        <PageHeader
          crumb="Ayngaran Futura / Add"
          title="Add Project"
          subtitle="Create a new project - it appears as a button on the Projects hub."
          actions={
            <button type="button" className="btn btn-ghost" onClick={closeForm}>
              <i className="bi bi-arrow-left" aria-hidden="true" /> Back to Projects
            </button>
          }
        />
        <Panel
          title="New project details"
          subtitle="Fill the form and save."
          action={
            <div className="toolbar">
              <button type="button" className="btn btn-ghost" onClick={closeForm}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSave}>
                <i className="bi bi-check2" aria-hidden="true" /> Save project
              </button>
            </div>
          }
        >
          <FormGrid
            fields={PROJECT_FIELDS}
            values={values}
            errors={errors}
            onChange={(key, value) => {
              setValues((current) => ({ ...current, [key]: value }))
              setErrors((current) => ({ ...current, [key]: undefined }))
            }}
          />
        </Panel>
      </div>
    )
  }

  // Hub: /projects shows only project buttons (same pattern as Daily
  // Vouchers) - clicking one opens that project's details page.
  if (!projectId) {
    return (
      <div className="page">
        <PageHeader
          crumb="Ayngaran Futura"
          title="Project Details"
          subtitle="Choose a project - only that project opens."
        />
        <div className="page-head-actions">
          <button type="button" className="btn btn-primary" onClick={openAdd}>
            <i className="bi bi-plus-lg" aria-hidden="true" /> Add Project
          </button>
        </div>
        <Panel
          title="Projects"
          subtitle={
            projects.length
              ? `${projects.length} project(s) - click one to open its details.`
              : 'No projects yet - add the first one above.'
          }
        >
          <div className="menu-cards">
            {projects.map((project) => (
              <button
                key={project.id}
                type="button"
                className="menu-card"
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                <i className="bi bi-buildings" aria-hidden="true" />
                <span className="menu-card-label">{project.name}</span>
                <span className="muted-sm">
                  {[project.siteName, project.location, project.status].filter(Boolean).join(' · ')}
                </span>
              </button>
            ))}
          </div>
        </Panel>
      </div>
    )
  }

  // Full-page Edit form (no popup) with Back - same as Add.
  if (projectId && form?.mode === 'edit' && selected) {
    return (
      <div className="page">
        <PageHeader
          crumb={`Ayngaran Futura / Edit`}
          title={`Edit ${selected.name}`}
          subtitle={selected.id}
          actions={
            <button type="button" className="btn btn-ghost" onClick={closeForm}>
              <i className="bi bi-arrow-left" aria-hidden="true" /> Back to {selected.name}
            </button>
          }
        />
        <Panel
          title={`${selected.name} - layout details`}
          subtitle="Update the fields and save."
          action={
            <div className="toolbar">
              <button type="button" className="btn btn-ghost" onClick={closeForm}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSave}>
                <i className="bi bi-check2" aria-hidden="true" /> Save details
              </button>
            </div>
          }
        >
          <FormGrid
            fields={PROJECT_FIELDS}
            values={values}
            errors={errors}
            onChange={(key, value) => {
              setValues((current) => ({ ...current, [key]: value }))
              setErrors((current) => ({ ...current, [key]: undefined }))
            }}
          />
        </Panel>
      </div>
    )
  }

  if (!selected || !stats) {
    return (
      <div className="page">
        <PageHeader
          crumb="Ayngaran Futura"
          title="Project Details"
          subtitle="That project does not exist."
        />
        <Link className="btn btn-primary" to="/projects">
          <i className="bi bi-arrow-left" aria-hidden="true" /> Back to Projects
        </Link>
      </div>
    )
  }

  return (
    <div className="page">
      <PageHeader
        crumb="Ayngaran Futura"
        title="Project Details"
        subtitle={`${selected.name} workspace - details, bookings, liabilities and site spend.`}
        actions={
          <Link className="btn btn-ghost" to="/projects">
            <i className="bi bi-arrow-left" aria-hidden="true" /> Back
          </Link>
        }
      />

      <div className="grid-2">
        <Panel
          title={`${selected.name} - layout details`}
          subtitle={selected.siteName}
          action={
            <button type="button" className="btn btn-secondary btn-sm" onClick={openEdit}>
              <i className="bi bi-pencil-square" aria-hidden="true" /> Edit {selected.name}
            </button>
          }
        >
          <dl className="detail-list">
            {detailRows
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <div key={label} className="detail-row">
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
          </dl>
        </Panel>

        <Panel title="Progress" subtitle="Plots sold, amount collected and area booked">
          <div className="progress-block">
            <div className="progress-head">
              <span>Plots booked</span>
              <strong>{stats.soldPercent.toFixed(1)}%</strong>
            </div>
            <div className="progress-track">
              <span className="progress-fill" style={{ width: `${stats.soldPercent}%` }} />
            </div>
            <p className="muted-sm">
              {formatNumber(stats.plotsBooked)} booked - {formatNumber(stats.plotsAvailable)} available
            </p>
          </div>

          <div className="progress-block">
            <div className="progress-head">
              <span>Area booked</span>
              <strong>{formatNumber(stats.areaBooked)} sq ft</strong>
            </div>
            <div className="progress-track progress-warn">
              <span
                className="progress-fill"
                style={{
                  width: `${
                    selected.totalAreaSqft
                      ? Math.min((stats.areaBooked / selected.totalAreaSqft) * 100, 100)
                      : 0
                  }%`,
                }}
              />
            </div>
            <p className="muted-sm">Of {formatNumber(selected.totalAreaSqft)} sq ft total extent</p>
          </div>
        </Panel>
      </div>

      <Panel
        title={`${selected.name} - plot bookings`}
        subtitle={`${stats.bookings.length} booking(s) in this project - pending ${money(stats.pending)}`}
      >
        <DataTable
          columns={bookingColumns}
          rows={stats.bookings}
          defaultSort={{ key: 'bookingDate', direction: 'desc' }}
          emptyTitle="No bookings in this project"
          emptyMessage="Plot bookings mapped to this project will be listed here."
        />
      </Panel>

      <Panel
        title={`${selected.name} - loans & liabilities`}
        subtitle={`Outstanding ${money(stats.outstanding)} - monthly EMI ${money(stats.monthlyEmi)}`}
      >
        <DataTable
          columns={liabilityColumns}
          rows={stats.liabilities}
          defaultSort={{ key: 'sanctionDate', direction: 'desc' }}
          emptyTitle="No liabilities linked to this project"
          emptyMessage="Link a loan or liability to this project from the Loan and Liabilities section."
        />
      </Panel>

    </div>
  )
}
