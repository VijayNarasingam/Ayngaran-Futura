/**
 * Ayngaran Futura - reference/master data.
 * Voucher heads, enumerations, navigation tree and id prefixes used across the
 * dashboard. Kept free of React and DOM so it can also be unit-tested.
 */

export const APP = {
  name: 'Ayngaran Futura',
  tagline: 'Plot Booking, Project & Daily Voucher Tracker',
  version: '1.0.0',
  storageKey: 'ayngaran-futura:data:v1',
}

export const slugify = (text) =>
  String(text)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/** Site Spend heads required by the specification. */
export const SITE_SPEND_CATEGORIES = [
  'Site Travelling',
  'Electricity',
  'Road',
  'Drainage',
  'Compound Wall',
  'Water Tank',
  'Plot Stone',
  'Street Light',
  'CCTV',
  'OSR',
  'Miscellaneous',
]

/** Only "Miscellaneous" carries a Category field inside Site Spend. */
export const SITE_MISC_CATEGORY = 'Miscellaneous'

export const OFFICE_CATEGORIES = [
  'Rent',
  'Salary',
  'Stationery',
  'EB / Electricity',
  'Water',
  'Internet & Mobile',
  'Travel',
  'Food & Refreshment',
  'Office Maintenance',
  'Software Subscription',
  'Bank Charges',
  'Miscellaneous',
]

export const PROMOTION_CATEGORIES = [
  'Digital Ads',
  'Print & Media',
  'Hoardings',
  'Pamphlet Distribution',
  'Event / Launch',
  'Referral Payout',
  'Miscellaneous',
]

export const REGISTRATION_CATEGORIES = [
  'Sale Deed',
  'Stamp Duty',
  'Registration Fee',
  'Legal / Documentation',
  'Encumbrance Certificate',
  'Miscellaneous',
]

/** Voucher type key for a Site Spend head, e.g. Road -> "site-road". */
export const siteHeadKey = (category) => 'site-' + slugify(category).replace(/^site-/, '')

/** Route slug for a Site Spend head, e.g. Road -> "road". */
export const siteHeadSlug = (category) => slugify(category).replace(/^site-/, '')

export const VOUCHER_TYPES = {
  office: {
    key: 'office',
    label: 'Office Spend',
    group: 'office',
    slug: 'office',
    hasCategory: true,
    categoryKind: 'select',
    categories: OFFICE_CATEGORIES,
    hint: 'Daily office running expenses. Fields: Date, Category, Remarks.',
  },
  promotion: {
    key: 'promotion',
    label: 'Promotion',
    group: 'office',
    slug: 'promotion',
    hasCategory: false,
    hint: 'Marketing and promotional spending. Fields: Date, Remarks.',
  },
  registration: {
    key: 'registration',
    label: 'Registration',
    group: 'office',
    slug: 'registration',
    hasCategory: false,
    hint: 'Registration, stamp duty and documentation costs. Fields: Date, Remarks.',
  },
}

SITE_SPEND_CATEGORIES.forEach((category) => {
  const key = siteHeadKey(category)
  const isMisc = category === SITE_MISC_CATEGORY
  VOUCHER_TYPES[key] = {
    key,
    label: category,
    group: 'site',
    parentLabel: 'Site Spend',
    slug: siteHeadSlug(category),
    hasCategory: isMisc,
    categoryKind: isMisc ? 'datalist' : 'none',
    categories: isMisc ? OFFICE_CATEGORIES : [],
    hint: isMisc
      ? 'Miscellaneous site expense. Fields: Category, Date, Remarks.'
      : `${category} site spend. Fields: Date, Remarks.`,
  }
})

/** All voucher types in sidebar order. */
export const VOUCHER_TYPE_LIST = [
  VOUCHER_TYPES.office,
  VOUCHER_TYPES.promotion,
  VOUCHER_TYPES.registration,
  ...SITE_SPEND_CATEGORIES.map((category) => VOUCHER_TYPES[siteHeadKey(category)]),
]

export const SITE_VOUCHER_TYPES = SITE_SPEND_CATEGORIES.map(
  (category) => VOUCHER_TYPES[siteHeadKey(category)],
)

export const voucherType = (key) => VOUCHER_TYPES[key]

export const ENUMS = {
  marketerStatus: ['Active', 'Inactive'],
  projectStatus: ['Launching', 'Active', 'On Hold', 'Completed', 'Sold Out'],
  bookingStatus: ['Enquiry', 'Advance Paid', 'Booked', 'Registered', 'Cancelled'],
  liabilityType: [
    'Bank Loan',
    'Private Loan',
    'Vehicle Loan',
    'Supplier Liability',
    'Statutory Dues',
    'Other Liability',
  ],
  liabilityStatus: ['Active', 'Closed'],
  paymentMode: ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Card', 'Other'],
}

export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const COLLECTIONS = ['marketers', 'projects', 'bookings', 'loans', 'vouchers']

export const ID_PREFIX = {
  marketers: 'MKT',
  projects: 'PRJ',
  bookings: 'BKG',
  loans: 'LN',
  vouchers: 'VC',
}

export const CURRENCY = '\u20B9'

/* --------------------------------------------------------------- navigation --- */
/**
 * Flat sidebar - no dropdowns. Daily Vouchers opens the /vouchers hub page,
 * where Office / Promotion / Registration / Site are chosen as buttons and
 * each choice opens its own page. Site heads work the same way on the
 * /vouchers/site hub page.
 */
export const NAV_TREE = [
  { to: '/marketers', label: 'Marketer Details', icon: 'people' },
  { to: '/projects', label: 'Project Details', icon: 'buildings' },
  { to: '/bookings', label: 'Plot Booking', icon: 'bookmark-check' },
  { to: '/loans', label: 'Loan and Liabilities', icon: 'cash-coin' },
  { to: '/vouchers', label: 'Daily Vouchers', icon: 'journal-text' },
]
