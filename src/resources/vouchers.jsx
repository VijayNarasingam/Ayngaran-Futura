import { Link } from 'react-router-dom'
import { ENUMS, VOUCHER_TYPES } from '../data/reference.js'
import { money } from '../lib/format.js'
import { siteSpendByHead } from '../lib/selectors.js'
import { enumOptions, projectNameOf, projectOptions, todayISO, voucherFieldsFor } from './common.jsx'

const voucherColumns = (options = {}) => {
  const columns = [
    { key: 'id', label: 'Voucher No', width: '100px', mono: true },
    { key: 'date', label: 'Date', type: 'date', width: '105px' },
  ]
  if (options.withHead) {
    columns.push({
      key: 'type',
      label: 'Site Spend Head',
      width: '130px',
      value: (row) => VOUCHER_TYPES[row.type]?.label || row.type,
      badge: true,
      tones: { 'site-road': 'brand', 'site-electricity': 'warn', 'site-miscellaneous': 'muted' },
    })
  }
  if (options.withCategory) {
    columns.push({ key: 'category', label: 'Category', width: '140px' })
  }
  columns.push(
    { key: 'amount', label: 'Amount', type: 'currency', width: '120px' },
    {
      key: 'paymentMode',
      label: 'Payment Mode',
      width: '135px',
      badge: true,
      tones: { Cash: 'ok', UPI: 'info', 'Bank Transfer': 'brand', Cheque: 'muted' },
    },
    { key: 'paidTo', label: 'Paid To', width: '15%' },
    { key: 'projectName', label: 'Project', width: '105px' },
    { key: 'remarks', label: 'Remarks', type: 'textarea', width: '18%' },
  )
  return columns
}

const decorateWithProject = (data) => (rows) =>
  rows.map((row) => ({ ...row, projectName: projectNameOf(data, row.projectRef) }))

/** One Daily Voucher section: Office Spend, Promotion, Registration or a site head. */
export const voucherResource = (data, type) => ({
  collection: 'vouchers',
  title: type.label,
  crumb: type.group === 'site' ? 'Daily Vouchers / Site Spend' : 'Daily Vouchers',
  subtitle: type.hint,
  singular: `${type.label} voucher`,
  idLabel: 'Voucher No',
  csvName: `daily-vouchers-${type.slug}.csv`,
  backTo:
    type.group === 'site'
      ? { to: '/vouchers/site', label: 'Site Spend' }
      : { to: '/vouchers', label: 'Daily Vouchers' },
  defaultSort: { key: 'date', direction: 'desc' },
  searchKeys: ['id', 'category', 'paidTo', 'remarks'],
  baseFilter: (record) => record.type === type.key,
  decorate: decorateWithProject(data),
  createDefaults: () => ({ type: type.key, date: todayISO(), category: '' }),
  fields: [
    { key: 'date', label: 'Date', type: 'date', required: true, defaultValue: todayISO() },
    ...voucherFieldsFor(type),
    {
      key: 'projectRef',
      label: 'Project (optional)',
      type: 'select',
      options: projectOptions(data, true),
      placeholder: 'Not linked to a project',
    },
  ],
  columns: voucherColumns({ withCategory: type.hasCategory }),
  filters: [
    { key: 'projectRef', label: 'Project', options: projectOptions(data, true) },
    { key: 'paymentMode', label: 'Payment Mode', options: enumOptions(ENUMS.paymentMode) },
  ],
  emptyTitle: `No ${type.label} vouchers yet`,
  emptyMessage: `Use "Add ${type.label} voucher" to record the spend.`,
  formHint: type.hasCategory
    ? 'Fields: Date, Category, Remarks (Amount and Payment Mode are optional).'
    : 'Fields: Date and Remarks (Amount and Payment Mode are optional).',
})

/** Site Spend hub - buttons only. 11 head buttons; click a head to open
 *  that head's own book (/vouchers/site/:head) which shows only that head
 *  with its details and Add option. The hub itself never shows a register. */
export const siteSpendResource = (data) => ({
  collection: 'vouchers',
  title: 'Site Spend',
  crumb: 'Daily Vouchers',
  subtitle:
    'Choose a Site Spend head below to open that voucher book: Site Travelling, Electricity, Road, Drainage, Compound Wall, Water Tank, Plot Stone, Street Light, CCTV, OSR and Miscellaneous.',
  singular: 'Site Spend voucher',
  idLabel: 'Voucher No',
  csvName: 'daily-vouchers-site-spend.csv',
  backTo: { to: '/vouchers', label: 'Daily Vouchers' },
  isHub: true,
  hideAdd: true,
  hideTable: true,
  hideFilters: true,
  searchKeys: ['id', 'category', 'paidTo', 'remarks'],
  baseFilter: (record) => String(record.type || '').startsWith('site-'),
  decorate: decorateWithProject(data),
  columns: voucherColumns({ withHead: true, withCategory: true }),
  filters: [],
  panelTitle: 'Site Spend Heads',
  panelSubtitle: 'Click a head to open that voucher book - only that head is shown there.',
  panelRender: (rows) => (
    <div className="menu-cards">
      {siteSpendByHead(rows).map((item) => (
        <Link
          key={item.key}
          className="menu-card"
          to={`/vouchers/site/${VOUCHER_TYPES[item.key]?.slug || ''}`}
        >
          <i className="bi bi-cone-striped" aria-hidden="true" />
          <span className="menu-card-label">{item.label}</span>
          <span className="muted-sm">
            {item.count} voucher(s) · {money(item.total)}
          </span>
        </Link>
      ))}
    </div>
  ),
  emptyTitle: 'No site spend recorded',
  emptyMessage: 'Open a head below and use "Add" there to record the spend.',
  formHint: 'Open the head first - the Add form lives inside each head book.',
})
