import { ENUMS } from '../data/reference.js'
import { enumOptions, projectNameOf, projectOptions } from './common.jsx'

/** Loan and Liabilities section. */
export const loansResource = (data) => ({
  collection: 'loans',
  title: 'Loan and Liabilities',
  crumb: 'Ayngaran Futura',
  subtitle: 'Bank loans, private borrowings, supplier dues and statutory liabilities.',
  singular: 'Loan / Liability',
  idLabel: 'Loan No',
  csvName: 'loan-and-liabilities.csv',
  defaultSort: { key: 'sanctionDate', direction: 'desc' },
  searchKeys: ['id', 'lenderName', 'liabilityType', 'documentRef', 'remarks'],
  decorate: (rows) =>
    rows.map((row) => ({
      ...row,
      projectName: projectNameOf(data, row.projectRef),
      repaid: Math.max(Number(row.principalAmount) - Number(row.outstandingBalance), 0),
      repaidPercent: Number(row.principalAmount)
        ? Math.min(
            ((Number(row.principalAmount) - Number(row.outstandingBalance)) /
              Number(row.principalAmount)) *
              100,
            100,
          )
        : 0,
    })),
  fields: [
    { key: 'lenderName', label: 'Lender / Party Name', type: 'text', required: true, span: 2, placeholder: 'e.g. HDFC Bank' },
    { key: 'liabilityType', label: 'Type', type: 'select', required: true, options: enumOptions(ENUMS.liabilityType), defaultValue: 'Bank Loan' },
    { key: 'projectRef', label: 'Project (optional)', type: 'select', options: projectOptions(data, true), placeholder: 'Not linked to a project' },
    { key: 'principalAmount', label: 'Principal Amount', type: 'currency', required: true },
    { key: 'outstandingBalance', label: 'Outstanding Balance', type: 'currency', required: true },
    { key: 'interestRate', label: 'Interest Rate %', type: 'percent', hint: 'Per annum. Enter 0 for interest-free dues.' },
    { key: 'emiAmount', label: 'EMI Amount', type: 'currency' },
    { key: 'emiDay', label: 'EMI Due', type: 'text', placeholder: 'e.g. 5th of every month' },
    { key: 'tenureMonths', label: 'Tenure (Months)', type: 'number', min: '0', hint: '0 for on-demand liabilities.' },
    { key: 'sanctionDate', label: 'Sanction Date', type: 'date' },
    { key: 'documentRef', label: 'Document / Reference', type: 'text', placeholder: 'Sanction letter / invoice no.' },
    { key: 'status', label: 'Status', type: 'select', required: true, options: enumOptions(ENUMS.liabilityStatus), defaultValue: 'Active' },
    { key: 'remarks', label: 'Remarks', type: 'textarea', span: 2, placeholder: 'Repayment plan, security offered, etc.' },
  ],
  columns: [
    { key: 'id', label: 'Loan No', width: '95px', mono: true },
    { key: 'lenderName', label: 'Lender / Party', width: '17%' },
    {
      key: 'liabilityType',
      label: 'Type',
      width: '135px',
      badge: true,
      tones: {
        'Bank Loan': 'info',
        'Private Loan': 'warn',
        'Vehicle Loan': 'brand',
        'Supplier Liability': 'muted',
        'Statutory Dues': 'danger',
        'Other Liability': 'muted',
      },
    },
    { key: 'projectName', label: 'Project', width: '105px' },
    { key: 'principalAmount', label: 'Principal', type: 'currency', width: '125px' },
    { key: 'outstandingBalance', label: 'Outstanding', type: 'currency', tone: 'danger', width: '125px' },
    { key: 'interestRate', label: 'Interest %', type: 'percent', width: '95px' },
    { key: 'emiAmount', label: 'EMI', type: 'currency', width: '110px' },
    { key: 'sanctionDate', label: 'Sanction Date', type: 'date', width: '115px' },
    { key: 'repaidPercent', label: 'Repaid %', type: 'percent', width: '95px' },
    {
      key: 'status',
      label: 'Status',
      width: '95px',
      badge: true,
      tones: { Active: 'warn', Closed: 'ok' },
    },
  ],
  filters: [
    { key: 'liabilityType', label: 'Type', options: enumOptions(ENUMS.liabilityType) },
    { key: 'projectRef', label: 'Project', options: projectOptions(data, true) },
    { key: 'status', label: 'Status', options: enumOptions(ENUMS.liabilityStatus) },
  ],
  emptyTitle: 'No loans or liabilities recorded',
  emptyMessage: 'Add borrowings and dues to track outstanding balances and EMI commitments.',
  footerNote: 'Outstanding figures are entered per record; EMI total covers active liabilities.',
})
