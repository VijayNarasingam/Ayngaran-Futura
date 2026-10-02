const TONES = {
  ok: 'badge-ok',
  warn: 'badge-warn',
  danger: 'badge-danger',
  info: 'badge-info',
  brand: 'badge-brand',
  muted: 'badge-muted',
}

export function Badge({ tone = 'muted', value, children }) {
  const text = children ?? value ?? ''
  return <span className={`badge ${TONES[tone] || TONES.muted}`}>{text}</span>
}

/** Enum value rendered as a coloured badge using a value -> tone map. */
export function StatusBadge({ value, tones = {} }) {
  if (!value) return <span className="cell-empty">-</span>
  return <Badge tone={tones[value] || 'muted'}>{value}</Badge>
}
