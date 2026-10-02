/**
 * Lightweight dependency-free bar chart.
 * data: [{ key, label, total }]
 * Accepts both `data` and legacy `series` props, and both `format` and
 * legacy `valueFormatter` props so Dashboard call sites keep working.
 */
export function BarChart({
  data,
  series,
  format,
  valueFormatter,
  tone = 'brand',
  emptyLabel = 'No data yet.',
  empty,
  height,
}) {
  const rows = data ?? series ?? []
  const formatValue = format ?? valueFormatter ?? ((value) => value)
  const emptyText = empty ?? emptyLabel
  const max = rows.reduce((highest, item) => Math.max(highest, Number(item.total) || 0), 0)
  if (!rows.length) return <p className="muted-sm">{emptyText}</p>

  return (
    <ul className="bar-chart" style={height ? { height } : undefined}>
      {rows.map((item) => {
        const value = Number(item.total) || 0
        const width = max ? Math.max((value / max) * 100, value ? 3 : 0) : 0
        return (
          <li key={item.key} className="bar-row">
            <span className="bar-label">{item.label}</span>
            <span className="bar-track">
              <span className={`bar-fill bar-${tone}`} style={{ width: `${width}%` }} />
            </span>
            <span className="bar-value">{formatValue(value)}</span>
          </li>
        )
      })}
    </ul>
  )
}

/** Horizontal share list used for site spend / category breakdowns. */
export function ShareList({ items = [], format, valueFormatter, linkTo, empty }) {
  const formatValue = format ?? valueFormatter ?? ((value) => value)
  const total = items.reduce((sum, item) => sum + (Number(item.total) || 0), 0) || 1
  if (!items.length) return <p className="muted-sm">{empty || 'No data yet.'}</p>
  return (
    <ul className="share-list">
      {items.map((item) => {
        const percent = ((Number(item.total) || 0) / total) * 100
        const content = (
          <>
            <span className="share-label">
              {item.label}
              <span className="share-count">{item.count != null ? `${item.count} voucher(s)` : ''}</span>
            </span>
            <span className="share-track">
              <span className="share-fill" style={{ width: `${Math.max(percent, item.total ? 3 : 0)}%` }} />
            </span>
            <span className="share-value">{formatValue(item.total)}</span>
          </>
        )
        return (
          <li key={item.key} className="share-row">
            {linkTo ? (
              <a className="share-link" href={linkTo(item)}>
                {content}
              </a>
            ) : (
              content
            )}
          </li>
        )
      })}
    </ul>
  )
}
