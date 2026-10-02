import { formatDate } from './format.js'

const escapeCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`

const cellValue = (column, row) => {
  const value = column.value ? column.value(row) : row[column.key]
  if (value === undefined || value === null) return ''
  if (column.type === 'date') return formatDate(value)
  return value
}

/** Builds a CSV string (with header row) from table columns + rows. */
export const toCSV = (columns, rows) => {
  const header = columns.map((column) => escapeCell(column.label || column.key)).join(',')
  const lines = rows.map((row) => columns.map((column) => escapeCell(cellValue(column, row))).join(','))
  return [header, ...lines].join('\r\n')
}

export const downloadCSV = (filename, columns, rows) => {
  const blob = new Blob(['\uFEFF', toCSV(columns, rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
