/**
 * Ayngaran Futura - SQL schema (SQLite).
 * One table per collection + key/value settings.
 * All columns are nullable TEXT/REAL except the id primary key so the UI can
 * keep its flexible JSON-ish records. Keep in sync with src/data/seed.js.
 */

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS marketers (
  id TEXT PRIMARY KEY,
  name TEXT, phone TEXT, email TEXT, region TEXT,
  commissionPercent REAL, status TEXT, joinedOn TEXT, remarks TEXT,
  createdAt TEXT, updatedAt TEXT
);
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT, siteName TEXT, location TEXT, surveyNumber TEXT, pattaNumber TEXT,
  approvalNo TEXT, totalAreaAcres REAL, totalAreaSqft REAL, totalPlots REAL,
  pricePerSqft REAL, launchDate TEXT, landOwner TEXT, status TEXT, remarks TEXT,
  createdAt TEXT, updatedAt TEXT
);
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  customerName TEXT, phone TEXT, projectRef TEXT, plotNumber TEXT,
  areaCents REAL, squareFeet REAL, totalAmount REAL, bookingAmount REAL,
  bookingDate TEXT, marketerRef TEXT, status TEXT, remarks TEXT,
  createdAt TEXT, updatedAt TEXT
);
CREATE TABLE IF NOT EXISTS loans (
  id TEXT PRIMARY KEY,
  lenderName TEXT, liabilityType TEXT, projectRef TEXT,
  principalAmount REAL, outstandingBalance REAL, interestRate REAL,
  emiAmount REAL, emiDay TEXT, tenureMonths REAL, sanctionDate TEXT,
  documentRef TEXT, status TEXT, remarks TEXT,
  createdAt TEXT, updatedAt TEXT
);
CREATE TABLE IF NOT EXISTS vouchers (
  id TEXT PRIMARY KEY,
  type TEXT, date TEXT, category TEXT, amount REAL, paymentMode TEXT,
  paidTo TEXT, projectRef TEXT, remarks TEXT,
  createdAt TEXT, updatedAt TEXT
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
`

/** Columns per table (excluding createdAt/updatedAt which the API manages). */
export const TABLE_COLUMNS = {
  marketers: ['id', 'name', 'phone', 'email', 'region', 'commissionPercent', 'status', 'joinedOn', 'remarks'],
  projects: ['id', 'name', 'siteName', 'location', 'surveyNumber', 'pattaNumber', 'approvalNo', 'totalAreaAcres', 'totalAreaSqft', 'totalPlots', 'pricePerSqft', 'launchDate', 'landOwner', 'status', 'remarks'],
  bookings: ['id', 'customerName', 'phone', 'projectRef', 'plotNumber', 'areaCents', 'squareFeet', 'totalAmount', 'bookingAmount', 'bookingDate', 'marketerRef', 'status', 'remarks'],
  loans: ['id', 'lenderName', 'liabilityType', 'projectRef', 'principalAmount', 'outstandingBalance', 'interestRate', 'emiAmount', 'emiDay', 'tenureMonths', 'sanctionDate', 'documentRef', 'status', 'remarks'],
  vouchers: ['id', 'type', 'date', 'category', 'amount', 'paymentMode', 'paidTo', 'projectRef', 'remarks'],
}

export const NUMERIC_COLUMNS = new Set([
  'commissionPercent',
  'totalAreaAcres', 'totalAreaSqft', 'totalPlots', 'pricePerSqft',
  'areaCents', 'squareFeet', 'totalAmount', 'bookingAmount',
  'principalAmount', 'outstandingBalance', 'interestRate', 'emiAmount', 'tenureMonths',
  'amount',
])

export const COLLECTION_TABLES = ['marketers', 'projects', 'bookings', 'loans', 'vouchers']
