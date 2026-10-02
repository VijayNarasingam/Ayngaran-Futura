/** Single KPI tile. `tone` drives the accent colour (brand/ok/warn/danger/info/muted). */
export function KpiCard({ label, value, sub, tone = 'brand', icon }) {
  return (
    <div className={`kpi kpi-${tone}`}>
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        {icon ? <i className={`bi bi-${icon} kpi-icon`} aria-hidden="true" /> : null}
      </div>
      <div className="kpi-value">{value}</div>
      {sub ? <div className="kpi-sub">{sub}</div> : null}
    </div>
  )
}

export function KpiGrid({ items = [], className = '' }) {
  if (!items.length) return null
  return (
    <div className={`kpi-grid ${className}`.trim()}>
      {items.map((item) => (
        <KpiCard key={item.label} {...item} />
      ))}
    </div>
  )
}
