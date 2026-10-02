import { SITE_SPEND_CATEGORIES, siteHeadKey } from '../data/reference.js'
import { monthKey, monthLabel, num, recentMonths } from './format.js'

export const pendingAmount = (booking) =>
  Math.max(num(booking?.totalAmount) - num(booking?.bookingAmount), 0)

export const bookedAmount = (booking) => num(booking?.bookingAmount)

/** Effective rate per square foot of a booking. */
export const bookingRate = (booking) => {
  const sqft = num(booking?.squareFeet)
  return sqft ? num(booking.totalAmount) / sqft : 0
}

export const collectedPercent = (booking) => {
  const total = num(booking?.totalAmount)
  return total ? Math.min((num(booking.bookingAmount) / total) * 100, 100) : 0
}

export const sumBy = (rows, keyOrFn) =>
  (rows || []).reduce(
    (total, row) => total + num(typeof keyOrFn === 'function' ? keyOrFn(row) : row[keyOrFn]),
    0,
  )

/** [{ key, label, total, count }] grouped by a key function, biggest first. */
export const groupTotals = (rows, keyFn, labelFn, amountFn = (row) => row.amount) => {
  const buckets = new Map()
  ;(rows || []).forEach((row) => {
    const key = keyFn(row)
    const bucket = buckets.get(key) || {
      key,
      label: labelFn ? labelFn(key) : key,
      total: 0,
      count: 0,
    }
    bucket.total += num(amountFn(row))
    bucket.count += 1
    buckets.set(key, bucket)
  })
  return [...buckets.values()].sort((a, b) => b.total - a.total)
}

/** Monthly voucher spend for the dashboard chart. */
export const voucherMonthlySeries = (vouchers, months = 6) => {
  const keys = recentMonths(months)
  const totals = new Map(keys.map((key) => [key, 0]))
  ;(vouchers || []).forEach((voucher) => {
    const key = monthKey(voucher.date)
    if (totals.has(key)) totals.set(key, totals.get(key) + num(voucher.amount))
  })
  return keys.map((key) => ({ key, label: monthLabel(key), total: totals.get(key) }))
}

/** Monthly booking counts for the dashboard chart. */
export const bookingMonthlySeries = (bookings, months = 6) => {
  const keys = recentMonths(months)
  const totals = new Map(keys.map((key) => [key, 0]))
  ;(bookings || []).forEach((booking) => {
    const key = monthKey(booking.bookingDate)
    if (totals.has(key)) totals.set(key, totals.get(key) + 1)
  })
  return keys.map((key) => ({ key, label: monthLabel(key), total: totals.get(key) }))
}

/** Voucher spend per Site Spend head (all 11 heads, zero included). */
export const siteSpendByHead = (vouchers) =>
  SITE_SPEND_CATEGORIES.map((category) => {
    const key = siteHeadKey(category)
    const rows = (vouchers || []).filter((voucher) => voucher.type === key)
    return { key, label: category, total: sumBy(rows, 'amount'), count: rows.length }
  })

export const vouchersOfType = (vouchers, typeKey) =>
  (vouchers || []).filter((voucher) => voucher.type === typeKey)

export const vouchersOfSite = (vouchers) =>
  (vouchers || []).filter((voucher) => String(voucher.type || '').startsWith('site-'))

export const bookingsOfProject = (bookings, projectId) =>
  (bookings || []).filter((booking) => booking.projectRef === projectId)

export const loansOfProject = (loans, projectId) =>
  (loans || []).filter((loan) => loan.projectRef === projectId)

export const vouchersOfProject = (vouchers, projectId) =>
  (vouchers || []).filter((voucher) => voucher.projectRef === projectId)

/** tests call projectStats(state, id) while UI calls projectStats(obj, data) - support both. */
const normalizeProjectArg = (first, second) => {
  const looksLikeState = first && typeof first === 'object' && Array.isArray(first.bookings)
  if (looksLikeState) {
    const id = typeof second === 'string' ? second : second?.id
    const project = (first.projects || []).find((item) => item.id === id) || null
    return { target: project, safe: first }
  }
  return { target: first || null, safe: second || {} }
}

/** Everything the Project Details screen shows for one project. */
export const projectStats = (first, second) => {
  const { target, safe } = normalizeProjectArg(first, second)
  const bookings = bookingsOfProject(safe.bookings, target?.id)
  const decorated = bookings.map((row) => ({ ...row, pending: pendingAmount(row) }))
  const totalValue = sumBy(bookings, 'totalAmount')
  const received = sumBy(bookings, 'bookingAmount')
  const pending = sumBy(bookings, pendingAmount)
  const areaBooked = sumBy(bookings, 'squareFeet')
  const liabilities = loansOfProject(safe.loans, target?.id)
  const activeLiabilities = liabilities.filter((loan) => loan.status === 'Active')
  const spend = vouchersOfProject(safe.vouchers, target?.id)
  const totalPlots = num(target?.totalPlots)
  return {
    bookings: decorated,
    liabilities,
    spend,
    totalValue,
    received,
    pending,
    areaBooked,
    plotsBooked: bookings.length,
    plotsAvailable: Math.max(totalPlots - bookings.length, 0),
    soldPercent: totalPlots ? (bookings.length / totalPlots) * 100 : 0,
    collectedPercent: totalValue ? (received / totalValue) * 100 : 0,
    outstanding: sumBy(activeLiabilities, 'outstandingBalance'),
    monthlyEmi: sumBy(activeLiabilities, 'emiAmount'),
    spendTotal: sumBy(spend, 'amount'),
  }
}

/** Marketer performance: bookings sourced, value and commission due. */
export const marketerStats = (marketers, bookings) =>
  (marketers || []).map((marketer) => {
    const sourced = (bookings || []).filter((booking) => booking.marketerRef === marketer.id)
    const value = sumBy(sourced, 'totalAmount')
    return {
      ...marketer,
      bookingsCount: sourced.length,
      bookedValue: value,
      commissionDue: (value * num(marketer.commissionPercent)) / 100,
    }
  })

export const OFFICE_VOUCHER_TYPES = ['office', 'promotion', 'registration']

/** Headline numbers for the Dashboard overview. */
export const dashboardStats = (data) => {
  const activeBookings = data.bookings.filter((booking) => booking.status !== 'Cancelled')
  const totalValue = sumBy(activeBookings, 'totalAmount')
  const received = sumBy(activeBookings, 'bookingAmount')
  const pending = sumBy(activeBookings, pendingAmount)
  const activeLiabilities = data.loans.filter((loan) => loan.status === 'Active')
  const liabilities = sumBy(activeLiabilities, 'outstandingBalance')
  const officeSpend = sumBy(
    data.vouchers.filter((voucher) => OFFICE_VOUCHER_TYPES.includes(voucher.type)),
    'amount',
  )
  const siteSpend = sumBy(vouchersOfSite(data.vouchers), 'amount')
  return {
    marketers: data.marketers.length,
    activeMarketers: data.marketers.filter((marketer) => marketer.status === 'Active').length,
    projects: data.projects.length,
    bookings: activeBookings.length,
    totalValue,
    received,
    pending,
    collectedPercent: totalValue ? (received / totalValue) * 100 : 0,
    areaBooked: sumBy(activeBookings, 'squareFeet'),
    liabilities,
    activeLiabilities: activeLiabilities.length,
    monthlyEmi: sumBy(activeLiabilities, 'emiAmount'),
    voucherSpend: officeSpend + siteSpend,
    officeSpend,
    siteSpend,
    vouchersCount: data.vouchers.length,
    netPosition: received - liabilities,
  }
}

export const recentRecords = (rows, key, count = 5) =>
  [...(rows || [])]
    .sort((a, b) => String(b[key] || '').localeCompare(String(a[key] || '')))
    .slice(0, count)
