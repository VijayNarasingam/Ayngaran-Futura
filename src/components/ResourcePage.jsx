import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DataTable } from './DataTable.jsx'
import { FormField, FormGrid, coerceValues, normaliseOptions, validateValues } from './FormField.jsx'
import { PageHeader, Panel } from './PageHeader.jsx'
import { ConfirmDialog } from './ConfirmDialog.jsx'
import { useStore } from '../context/StoreContext.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { downloadCSV } from '../lib/csv.js'

/**
 * ResourcePage - the schema driven section behind Marketer Details,
 * Plot Booking, Loan and Liabilities and every Daily Vouchers page.
 *
 * Add/Edit opens as a FULL PAGE view (view='form') with Back navigation,
 * not a popup modal.
 *
 * resource = {
 *   collection, title, crumb, subtitle, singular, csvName,
 *   columns: [...], fields: [...] | fieldsFor(typeKey),
 *   typeField: { key, label, options }, searchKeys, filters, baseFilter,
 *   decorate, kpis, createDefaults, sanitize, panelTitle, panelRender,
 *   emptyTitle, emptyMessage, formHint, backTo: { to, label }
 * }
 */
export function ResourcePage({ resource }) {
  const { records, add, update, remove, data } = useStore()
  const toast = useToast()

  const defaultType = resource.typeField ? resource.typeField.options[0]?.value ?? '' : ''

  const [search, setSearch] = useState('')
  const [filterValues, setFilterValues] = useState({})
  const [form, setForm] = useState(null) // { mode: 'add' } | { mode: 'edit', row }
  const [values, setValues] = useState({})
  const [errors, setErrors] = useState({})
  const [typeKey, setTypeKey] = useState(defaultType)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [view, setView] = useState('menu')

  // ResourcePage stays mounted while the route changes (e.g. switching
  // voucher books), so stale search/filter/type state must reset per section.
  useEffect(() => {
    setSearch('')
    setFilterValues({})
    setForm(null)
    setErrors({})
    setPendingDelete(null)
    setTypeKey(resource.typeField ? resource.typeField.options[0]?.value ?? '' : '')
    setView('menu')
  }, [resource.title, resource.csvName])

  const baseRows = useMemo(() => {
    const all = records(resource.collection)
    const scoped = resource.baseFilter ? all.filter(resource.baseFilter) : all
    return resource.decorate ? resource.decorate(scoped, data) : scoped
  }, [records, resource, data])

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return baseRows.filter((row) => {
      if (needle) {
        const haystack = (resource.searchKeys || [])
          .map((key) => row[key])
          .concat(resource.searchText ? [resource.searchText(row)] : [])
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(needle)) return false
      }
      return (resource.filters || []).every((filter) => {
        const selected = filterValues[filter.key]
        if (!selected) return true
        return String(row[filter.key] ?? '') === String(selected)
      })
    })
  }, [baseRows, search, filterValues, resource])

  const fields = useMemo(
    () => (resource.fieldsFor ? resource.fieldsFor(typeKey) : resource.fields || []),
    [resource, typeKey],
  )

  const showFilters = !resource.hideFilters && (resource.filters || []).length > 0

  const openAdd = () => {
    const next = { ...(resource.createDefaults ? resource.createDefaults(typeKey) : {}) }
    fields.forEach((field) => {
      if (field.defaultValue !== undefined && next[field.key] === undefined) {
        next[field.key] = field.defaultValue
      }
    })
    if (resource.typeField) next[resource.typeField.key] = typeKey
    setValues(next)
    setErrors({})
    setForm({ mode: 'add' })
    setView('form')
  }

  const openEdit = (row) => {
    if (resource.typeField) setTypeKey(row[resource.typeField.key] || defaultType)
    setValues({ ...row })
    setErrors({})
    setForm({ mode: 'edit', row })
    setView('form')
  }

  const closeForm = () => {
    setForm(null)
    setView(resource.twoStep ? 'table' : 'list')
  }

  const handleChange = (key, value) => {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current))
  }

  const handleTypeChange = (key, value) => {
    setTypeKey(value)
    setValues((current) => ({ ...current, [key]: value, category: '' }))
  }

  const handleSubmit = async () => {
    const problems = validateValues(values, fields)
    if (Object.keys(problems).length) {
      setErrors(problems)
      toast.error('Please fill in the required fields.')
      return
    }
    const payload = coerceValues(values, fields)
    if (resource.typeField) {
      payload[resource.typeField.key] = values[resource.typeField.key] || typeKey
    }
    if (resource.sanitize) Object.assign(payload, resource.sanitize(payload, values) || {})

    try {
      if (form?.mode === 'edit' && form?.row) {
        await update(resource.collection, form.row.id, payload)
        toast.success(`${resource.singular || 'Record'} ${form.row.id} updated.`)
      } else {
        const created = await add(resource.collection, payload)
        toast.success(`${resource.singular || 'Record'} ${created.id} saved.`)
      }
      closeForm()
    } catch (err) {
      toast.error(err.message || 'Could not save to the SQL database.')
    }
  }

  const handleDelete = async () => {
    if (!pendingDelete) return
    try {
      await remove(resource.collection, pendingDelete.id)
      toast.info(`${resource.singular || 'Record'} ${pendingDelete.id} deleted.`)
    } catch (err) {
      toast.error(err.message || 'Could not delete from the SQL database.')
    }
    setPendingDelete(null)
  }

  const exportCSV = () => {
    downloadCSV(resource.csvName || `${resource.collection}.csv`, resource.columns, rows)
    toast.success(`Exported ${rows.length} record(s) to CSV.`)
  }

  // ---- FULL PAGE form view (replaces the old popup Modal) ----
  if (form) {
    const isEdit = form.mode === 'edit'
    return (
      <div className="page">
        <PageHeader
          crumb={`${resource.crumb || resource.title} / ${isEdit ? 'Edit' : 'Add'}`}
          title={`${isEdit ? 'Edit' : 'Add'} ${resource.singular || 'record'}`}
          subtitle={
            isEdit && form.row
              ? `${resource.idLabel || 'ID'}: ${form.row.id}`
              : resource.formHint
          }
          actions={
            <button type="button" className="btn btn-ghost" onClick={closeForm}>
              <i className="bi bi-arrow-left" aria-hidden="true" /> Back to {resource.title}
            </button>
          }
        />
        <Panel
          title={`${isEdit ? 'Edit' : 'New'} ${resource.singular || 'record'} details`}
          subtitle={resource.formHint || 'Fill the form and save.'}
          action={
            <div className="toolbar">
              <button type="button" className="btn btn-ghost" onClick={closeForm}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSubmit}>
                <i className="bi bi-check2" aria-hidden="true" />
                {isEdit ? 'Save changes' : `Save ${resource.singular || 'record'}`}
              </button>
            </div>
          }
        >
          <FormGrid
            fields={fields}
            values={values}
            errors={errors}
            onChange={handleChange}
            before={
              resource.typeField ? (
                <FormField
                  field={{
                    key: resource.typeField.key,
                    label: resource.typeField.label,
                    type: 'select',
                    required: true,
                    options: resource.typeField.options,
                    placeholder: 'Choose a site spend head',
                  }}
                  value={values[resource.typeField.key] || typeKey}
                  onChange={handleTypeChange}
                />
              ) : null
            }
          />
        </Panel>
      </div>
    )
  }

  return (
    <div className="page page-list">
      <PageHeader
        crumb={resource.crumb}
        title={resource.title}
        subtitle={resource.subtitle}
        actions={
          <>
            {resource.backTo ? (
              <Link className="btn btn-ghost" to={resource.backTo.to}>
                <i className="bi bi-arrow-left" aria-hidden="true" /> Back
              </Link>
            ) : null}
            {resource.twoStep && view === 'table' ? (
              <button type="button" className="btn btn-ghost" onClick={() => setView('menu')}>
                <i className="bi bi-arrow-left" aria-hidden="true" /> Back
              </button>
            ) : null}
            {resource.hideAdd ? null : (
              <button type="button" className="btn btn-ghost" onClick={exportCSV} disabled={!rows.length}>
                <i className="bi bi-filetype-csv" aria-hidden="true" /> Export CSV
              </button>
            )}
            {resource.hideAdd || resource.hideAddButton || resource.twoStep ? null : (
              <button type="button" className="btn btn-primary" onClick={openAdd}>
                <i className="bi bi-plus-lg" aria-hidden="true" /> Add {resource.singular || 'record'}
              </button>
            )}
          </>
        }
      />

      {resource.twoStep && view === 'menu' ? (
        <Panel title={`${resource.title} options`} subtitle="Choose one - only that view opens.">
          <div className="menu-cards">
            {(resource.menuCards || []).map((card) => (
              <button
                key={card.key}
                type="button"
                className="menu-card"
                onClick={() => {
                  if (card.key === 'add') openAdd()
                  else setView('table')
                }}
              >
                <i className={`bi bi-${card.icon || 'grid'}`} aria-hidden="true" />
                <span className="menu-card-label">{card.label}</span>
                <span className="muted-sm">{card.hint}</span>
              </button>
            ))}
          </div>
        </Panel>
      ) : null}

      {resource.twoStep && view !== 'table' ? null : (
      <Panel
        title={`${resource.title} list`}
        subtitle={`${rows.length} record(s) shown${
          baseRows.length !== rows.length ? ` of ${baseRows.length}` : ''
        }`}
        action={
          <div className="toolbar">
            <label className="search-box">
              <i className="bi bi-search" aria-hidden="true" />
              <input
                type="search"
                className="input"
                placeholder="Search..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            {showFilters
              ? (resource.filters || []).map((filter) => (
              <select
                key={filter.key}
                className="input input-sm"
                value={filterValues[filter.key] || ''}
                onChange={(event) =>
                  setFilterValues((current) => ({ ...current, [filter.key]: event.target.value }))
                }
              >
                <option value="">All {filter.label.toLowerCase()}</option>
                {normaliseOptions(
                  typeof filter.options === 'function' ? filter.options() : filter.options,
                ).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              ))
              : null}
          </div>
        }
      >
        {resource.hideTable ? (
          <p className="muted-sm">Use the heads below - each head opens its own voucher book.</p>
        ) : (
        <DataTable
          columns={resource.columns}
          rows={rows}
          defaultSort={resource.defaultSort}
          onEdit={openEdit}
          onDelete={setPendingDelete}
          emptyTitle={resource.emptyTitle || `No ${String(resource.title).toLowerCase()} yet`}
          emptyMessage={
            resource.emptyMessage || `Click "Add ${resource.singular || 'record'}" to create one.`
          }
          footerNote={resource.footerNote}
        />
        )}
      </Panel>
      )}

      {resource.panelRender ? (
        <Panel title={resource.panelTitle} subtitle={resource.panelSubtitle}>
          {resource.panelRender(rows, data)}
        </Panel>
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={`Delete ${resource.singular || 'record'}?`}
        message={
          pendingDelete ? `${pendingDelete.id} will be removed permanently. This cannot be undone.` : ''
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  )
}

