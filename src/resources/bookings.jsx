import { ENUMS } from '../data/reference.js'
import { money } from '../lib/format.js'
import { pendingAmount } from '../lib/selectors.js'
import { enumOptions, marketerNameOf, projectNameOf, projectOptions, todayISO } from './common.jsx'

/** Plot Booking section - Customer, Area, Sq ft, Plot No, Project and amounts. */
export const bookingsResource = (data) => ({
  collection: 'bookings',
  title: 'Plot Booking',
  crumb: 'Ayngaran Futura',
  subtitle: 'Customer plot bookings with booking amount, pending amount and project mapping.',
  singular: 'Plot Booking',
  idLabel: 'Booking No',
  csvName: 'plot-bookings.csv',
  defaultSort: { key: 'bookingDate', direction: 'desc' },
  searchKeys: ['id', 'customerName', 'phone', 'plotNumber', 'remarks'],
  twoStep: true,
  hideAddButton: true,
  menuCards: [
    { key: 'add', label: 'Plot Booking', hint: 'Open the plot booking form', icon: 'bookmark-plus' },
    { key: 'table', label: 'Plot Booking Table', hint: 'Show the plot booking table', icon: 'table' },
  ],
  formHint: 'Pending Amount is calculated automatically from Total - Booking Amount.',
  decorate: (rows) =>
    rows.map((row) => ({
      ...row,
      projectName: projectNameOf(data, row.projectRef),
      marketerName: marketerNameOf(data, row.marketerRef),
      pending: pendingAmount(row),
    })),
  fields: [
    { key: 'customerName', label: 'Customer Name', type: 'text', required: true, span: 2, placeholder: 'Customer full name' },
    { key: 'phone', label: 'Phone', type: 'tel', placeholder: '+91 XXXXX XXXXX' },
    { key: 'projectRef', label: 'Project', type: 'select', required: true, options: projectOptions(data), placeholder: 'Choose project' },
    { key: 'plotNumber', label: 'Plot Number', type: 'text', required: true, placeholder: 'P-014' },
    { key: 'areaCents', label: 'Area (Cent)', type: 'number', required: true, step: '0.01', min: '0', hint: '1 cent = 435.6 sq ft' },
    { key: 'squareFeet', label: 'Square Feet', type: 'number', required: true, min: '0' },
    { key: 'totalAmount', label: 'Total Amount', type: 'currency', required: true },
    { key: 'bookingAmount', label: 'Booking Amount', type: 'currency', required: true },
    {
      key: 'pendingAmount',
      label: 'Pending Amount',
      type: 'currency',
      computed: (values) => money(pendingAmount(values)),
      hint: 'Auto calculated = Total Amount - Booking Amount',
    },
    { key: 'bookingDate', label: 'Booking Date', type: 'date', required: true, defaultValue: todayISO() },
    { key: 'marketerRef', label: 'Marketer', type: 'select', options: [{ value: '', label: 'Direct / no marketer' }, ...((data.marketers || []).map((marketer) => ({ value: marketer.id, label: `${marketer.name} (${marketer.id})` })))] },
    { key: 'status', label: 'Booking Status', type: 'select', required: true, options: enumOptions(ENUMS.bookingStatus), defaultValue: 'Booked' },
    { key: 'remarks', label: 'Remarks', type: 'textarea', span: 2, placeholder: 'Instalments, registration notes, etc.' },
  ],
  columns: [
    { key: 'id', label: 'Booking No', width: '105px', mono: true },
    { key: 'customerName', label: 'Customer Name', width: '16%' },
    { key: 'projectName', label: 'Project', width: '110px' },
    { key: 'plotNumber', label: 'Plot No', width: '85px' },
    { key: 'areaCents', label: 'Area (Cent)', type: 'number', width: '95px' },
    { key: 'squareFeet', label: 'Sq Ft', type: 'number', width: '85px' },
    { key: 'totalAmount', label: 'Total Amount', type: 'currency', width: '125px' },
    { key: 'bookingAmount', label: 'Booking Amount', type: 'currency', width: '130px' },
    { key: 'pending', label: 'Pending Amount', type: 'currency', tone: 'danger', width: '125px' },
    { key: 'bookingDate', label: 'Booking Date', type: 'date', width: '115px' },
    { key: 'marketerName', label: 'Marketer', width: '120px' },
    {
      key: 'status',
      label: 'Status',
      width: '120px',
      badge: true,
      tones: { Enquiry: 'muted', 'Advance Paid': 'warn', Booked: 'info', Registered: 'ok', Cancelled: 'danger' },
    },
  ],
  filters: [
    { key: 'projectRef', label: 'Project', options: projectOptions(data, true) },
    { key: 'status', label: 'Status', options: enumOptions(ENUMS.bookingStatus) },
    {
      key: 'marketerRef',
      label: 'Marketer',
      options: (data.marketers || []).map((marketer) => ({ value: marketer.id, label: marketer.name })),
    },
  ],
  emptyTitle: 'No plot bookings yet',
  emptyMessage: 'Record the first customer booking to see pending amounts here.',
  footerNote: 'Collected share uses Booking Amount / Total Amount',
})
