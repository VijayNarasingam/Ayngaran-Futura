import { useEffect, useMemo, useState } from 'react'
import { formatDate, formatNumber, formatPercent, money, truncate } from '../lib/format.js'
import { StatusBadge } from './Badge.jsx'

const valueOf = (column, row) => (column.value ? column.value(row) : row[column.key])

const compareValues = (left, right) => {
  if (typeof left === 'number' || typeof right === 'number') {
    return (Number(left) || 0) - (Number(right) || 0)
  }
  return String(left ?? '').localeCompare(String(right ?? ''))
}

/** Renders one cell according to its column definition. */
export function CellContent({ column, row }) {
  if (column.render) return column.render(row)
  const value = valueOf(column, row)

  if (value === undefined || value === null || value === '') {
    return <span className="cell-empty">-</span>
  }
  if (column.type === 'currency') {
    return (
      <span className={`num ${column.tone ? `text-${column.tone}` : ''}`.trim()}>{money(value)}</span>
    )
  }
  if (column.type === 'number') return <span className="num">{formatNumber(value)}</span>
  if (column.type === 'percent') return <span className="num">{formatPercent(value)}</span>
  if (column.type === 'date') return <span className="num">{formatDate(value)}</span>
  if (column.type === 'textarea') {
    const text = String(value)
    return <span title={text}>{truncate(text, 55)}</span>
  }
  if (column.badge) return <StatusBadge value={String(value)} tones={column.tones} />
  if (column.mono) return <span className="mono">{String(value)}</span>
  return String(value)
}

export function DataTable({
  columns = [],
  rows = [],
  defaultSort,
  onEdit,
  onDelete,
  emptyTitle = 'No records yet',
  emptyMessage = 'Use the Add button to create the first entry.',
  footerNote,
  initialPageSize = 10,
}) {
  const [sort, setSort] = useState(defaultSort || { key: columns[0]?.key, direction: 'asc' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)

  useEffect(() => {
    setSort(defaultSort || { key: columns[0]?.key, direction: 'asc' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultSort?.key, defaultSort?.direction])

  useEffect(() => {
    setPage(1)
  }, [rows, pageSize])

  const sorted = useMemo(() => {
    const column = columns.find((item) => item.key === sort?.key)
    if (!column) return rows
    const direction = sort.direction === 'asc' ? 1 : -1
    return [...rows].sort(
      (a, b) => compareValues(valueOf(column, a), valueOf(column, b)) * direction,
    )
  }, [rows, sort, columns])

  const totalPages = Math.max(Math.ceil(sorted.length / pageSize), 1)
  const currentPage = Math.min(page, totalPages)
  const start = (currentPage - 1) * pageSize
  const visible = sorted.slice(start, start + pageSize)

  const toggleSort = (column) => {
    if (column.sortable === false) return
    setSort((current) =>
      current.key === column.key
        ? { key: column.key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key: column.key, direction: 'asc' },
    )
  }

  if (!rows.length) {
    return (
      <div className="empty-state">
        <i className="bi bi-inbox" aria-hidden="true" />
        <p className="empty-title">{emptyTitle}</p>
        <p className="muted-sm">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  style={column.width ? { width: column.width } : undefined}
                  className={column.align === 'right' ? 'align-right' : ''}
                >
                  <button
                    type="button"
                    className={`th-sort ${sort?.key === column.key ? 'is-active' : ''}`.trim()}
                    onClick={() => toggleSort(column)}
                  >
                    {column.label}
                    <i
                      className={`bi bi-caret-${
                        sort?.key === column.key && sort.direction === 'asc' ? 'up' : 'down'
                      }-fill`}
                      aria-hidden="true"
                    />
                  </button>
                </th>
              ))}
              <th className="actions-col align-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id}>
                {columns.map((column) => (
                  <td key={column.key} className={column.align === 'right' ? 'align-right' : ''}>
                    <CellContent column={column} row={row} />
                  </td>
                ))}
                <td className="actions-col align-right">
                  <button type="button" className="icon-btn" title="Edit" onClick={() => onEdit?.(row)}>
                    <i className="bi bi-pencil" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="icon-btn icon-btn-danger"
                    title="Delete"
                    onClick={() => onDelete?.(row)}
                  >
                    <i className="bi bi-trash3" aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="table-foot">
        <span className="muted-sm">
          Showing <strong>{start + 1}</strong>-<strong>{Math.min(start + pageSize, sorted.length)}</strong> of{' '}
          <strong>{sorted.length}</strong> record(s)
          {footerNote ? ` \u00B7 ${footerNote}` : ''}
        </span>
        <div className="table-foot-controls">
          <label className="inline-field">
            Rows
            <select
              className="input input-sm"
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
            >
              {[10, 25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
          >
            <i className="bi bi-chevron-left" aria-hidden="true" /> Prev
          </button>
          <span className="muted-sm">
            Page {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={currentPage >= totalPages}
            onClick={() => setPage(currentPage + 1)}
          >
            Next <i className="bi bi-chevron-right" aria-hidden="true" />
          </button>
        </div>
      </div>
    </>
  )
}
