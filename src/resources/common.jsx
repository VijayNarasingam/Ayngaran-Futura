import { SITE_SPEND_CATEGORIES, siteHeadKey } from '../data/reference.js'

export const projectOptions = (data, includeBlank = false) => {
  const list = includeBlank ? [{ value: '', label: 'All / not linked' }] : []
  ;(data.projects || []).forEach((project) => {
    list.push({
      value: project.id,
      label: `${project.name}${project.siteName ? ` - ${project.siteName}` : ''}`,
    })
  })
  return list
}

export const marketerOptions = (data, includeBlank = true) => {
  const list = includeBlank ? [{ value: '', label: 'Direct / no marketer' }] : []
  ;(data.marketers || []).forEach((marketer) => {
    list.push({ value: marketer.id, label: `${marketer.name} (${marketer.id})` })
  })
  return list
}

export const enumOptions = (values) => (values || []).map((value) => ({ value, label: value }))

export const projectNameOf = (data, id) =>
  (data.projects || []).find((project) => project.id === id)?.name || ''

export const marketerNameOf = (data, id) =>
  (data.marketers || []).find((marketer) => marketer.id === id)?.name || ''

export const siteHeadOptions = () =>
  SITE_SPEND_CATEGORIES.map((category) => ({
    value: siteHeadKey(category),
    label: category,
  }))

export const todayISO = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')}`
}

/**
 * Voucher form fields.
 * Office Spend -> Date, Category, Remarks. Promotion / Registration and all
 * site heads except Miscellaneous -> Date, Remarks. Miscellaneous adds
 * Category. Amount / Payment mode / Paid to / Project are optional extras that
 * feed the dashboard totals.
 */
export const voucherFieldsFor = (type) => {
  if (!type) return []
  const fields = []

  if (type.hasCategory) {
    fields.push({
      key: 'category',
      label: type.categoryKind === 'datalist' ? 'Category (Miscellaneous)' : 'Category',
      type: type.categoryKind === 'datalist' ? 'datalist' : 'select',
      required: true,
      options: type.categories || [],
      placeholder: 'Select or type a category',
    })
  }

  fields.push(
    {
      key: 'amount',
      label: 'Amount',
      type: 'currency',
      hint: 'Optional - used for the voucher totals.',
    },
    {
      key: 'paymentMode',
      label: 'Payment Mode',
      type: 'select',
      options: [
        'Cash',
        'UPI',
        'Bank Transfer',
        'Cheque',
        'Card',
        'Other',
      ],
      placeholder: 'How was it paid?',
    },
    { key: 'paidTo', label: 'Paid To', type: 'text', placeholder: 'Vendor / person' },
    {
      key: 'remarks',
      label: 'Remarks',
      type: 'textarea',
      span: 2,
      placeholder: 'Purpose of the spend',
    },
  )

  return fields
}
