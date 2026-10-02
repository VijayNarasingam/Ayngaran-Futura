import { CURRENCY, MONTHS_SHORT } from '../data/reference.js'

/** Safe numeric parse. */
export const num = (value) => {
  const parsed = parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/** Indian currency grouping, e.g. 1282500 -> ₹12,82,500 */
export const money = (value) => {
  const n = Math.round(num(value))
  const sign = n < 0 ? '-' : ''
  const digits = String(Math.abs(n))
  const last3 = digits.slice(-3)
  const rest = digits.slice(0, -3)
  if (!rest) return `${sign}${CURRENCY}${last3}`
  return `${sign}${CURRENCY}${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}`
}

/** Short currency for KPI tiles: ₹1.28 Cr / ₹9.93 L / ₹24.5 K */
export const compactMoney = (value) => {
  const n = num(value)
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 10000000) return `${sign}${CURRENCY}${(abs / 10000000).toFixed(2)} Cr`
  if (abs >= 100000) return `${sign}${CURRENCY}${(abs / 100000).toFixed(2)} L`
  if (abs >= 1000) return `${sign}${CURRENCY}${(abs / 1000).toFixed(1)} K`
  return money(n)
}

export const formatNumber = (value) => {
  const n = num(value)
  const sign = n < 0 ? '-' : ''
  const parts = String(Math.abs(n)).split('.')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return sign + parts.join('.')
}

export const formatPercent = (value) => `${Math.round(num(value) * 100) / 100}%`

/** YYYY-MM-DD -> DD-MM-YYYY */
export const formatDate = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''))
  return match ? `${match[3]}-${match[2]}-${match[1]}` : String(value || '')
}

/** Keeps <input type="date"> happy (yyyy-mm-dd only). */
export const toInputDate = (value) => {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(value || ''))
  return match ? match[1] : ''
}

export const todayISO = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export const truncate = (value, length = 60) => {
  const text = String(value ?? '')
  return text.length > length ? `${text.slice(0, length - 1)}\u2026` : text
}

export const monthKey = (date) => {
  const text = String(date || '')
  return /^\d{4}-\d{2}/.test(text) ? text.slice(0, 7) : ''
}

export const monthLabel = (key) => {
  const parts = String(key || '').split('-')
  if (parts.length < 2) return key || ''
  const index = parseInt(parts[1], 10) - 1
  return `${MONTHS_SHORT[index] ?? ''} ${parts[0]}`.trim()
}

/** Last N month keys (oldest first) ending with the reference month. */
export const recentMonths = (count, reference) => {
  const ref = reference ? new Date(reference) : new Date()
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(ref.getFullYear(), ref.getMonth() - (count - 1 - index), 1)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  })
}

export const initials = (name) =>
  String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('')
