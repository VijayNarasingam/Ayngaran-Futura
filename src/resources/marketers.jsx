import { marketerStats } from '../lib/selectors.js'

/** Marketer Details section - two-step view, no status dropdown.
 *  Step 1 (view=menu): only "Add Marketer" + table preview, nothing else.
 *  Step 2 (view=table): only the full marketer table (back button to menu). */
export const marketersResource = (data) => ({
  collection: 'marketers',
  title: 'Marketer Details',
  crumb: 'Ayngaran Futura',
  subtitle: 'Marketing executives, commission structure and the business they sourced.',
  singular: 'Marketer',
  idLabel: 'Marketer Code',
  csvName: 'marketer-details.csv',
  defaultSort: { key: 'id', direction: 'asc' },
  searchKeys: ['id', 'name', 'phone', 'email', 'region', 'remarks'],
  hideFilters: true,
  twoStep: true,
  menuCards: [
    { key: 'add', label: 'Add Marketer', hint: 'Open the add marketer form', icon: 'person-plus' },
    { key: 'table', label: 'Marketer Table', hint: 'Show the marketer details table', icon: 'table' },
  ],
  decorate: (rows) => marketerStats(rows, data.bookings),
  fields: [
    { key: 'name', label: 'Marketer Name', type: 'text', required: true, placeholder: 'e.g. Karthik Raja' },
    { key: 'phone', label: 'Phone', type: 'tel', placeholder: '+91 XXXXX XXXXX' },
    { key: 'email', label: 'Email', type: 'email', placeholder: 'name@example.com' },
    { key: 'region', label: 'Region', type: 'text', placeholder: 'Chennai / Kovai / Madurai' },
    {
      key: 'commissionPercent',
      label: 'Commission %',
      type: 'percent',
      hint: 'Commission paid on the booking value.',
    },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      required: true,
      options: [
        { value: 'Active', label: 'Active' },
        { value: 'Inactive', label: 'Inactive' },
      ],
      defaultValue: 'Active',
    },
    { key: 'joinedOn', label: 'Joined On', type: 'date' },
    { key: 'remarks', label: 'Remarks', type: 'textarea', span: 2 },
  ],
  columns: [
    { key: 'id', label: 'Code', width: '105px', mono: true },
    { key: 'name', label: 'Marketer Name', width: '18%' },
    { key: 'phone', label: 'Phone', width: '15%', mono: true },
    { key: 'region', label: 'Region', width: '110px' },
    { key: 'commissionPercent', label: 'Commission %', type: 'percent', width: '110px' },
    { key: 'bookingsCount', label: 'Bookings', type: 'number', width: '95px' },
    { key: 'bookedValue', label: 'Booked Value', type: 'currency', width: '135px' },
    { key: 'commissionDue', label: 'Commission Due', type: 'currency', tone: 'warn', width: '140px' },
    {
      key: 'status',
      label: 'Status',
      width: '105px',
      badge: true,
      tones: { Active: 'ok', Inactive: 'muted' },
    },
  ],
  filters: [],
  emptyTitle: 'No marketers yet',
  emptyMessage: 'Add your marketing executives to track the bookings they source.',
  footerNote: 'Commission due = booked value x commission %',
})
