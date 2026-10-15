import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { SCHEMA_SQL, TABLE_COLUMNS, NUMERIC_COLUMNS, COLLECTION_TABLES, MAX_ID_LENGTH, MAX_TEXT_LENGTH, REFERENCES } from './schema.js'
import {
  SEED_BOOKINGS,
  SEED_LOANS,
  SEED_MARKETERS,
  SEED_PROJECTS,
  SEED_VOUCHERS,
} from '../../src/data/seed.js'
import { validateBookingAmounts } from '../../src/lib/rules.js'

/** Error carrying an HTTP status, so the route layer can return 4xx instead of 500. */
export class ValidationError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const here = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = process.env.SQLITE_PATH || path.join(here, '..', 'ayngaran-futura.sqlite')

export const db = new DatabaseSync(DB_PATH)
db.exec(SCHEMA_SQL)
db.exec('PRAGMA foreign_keys = ON')

/** Flushes and closes cleanly on SIGINT/SIGTERM instead of dropping the write. */
export const closeDatabase = () => {
  try {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
    db.close()
  } catch {
    /* already closed */
  }
}

const now = () => new Date().toISOString()

/**
 * Coerces one field for storage. Rejects values that cannot be represented
 * (an over-long string, or text in a numeric column) instead of silently
 * discarding them as NULL.
 */
const toDbValue = (column, value) => {
  if (value === undefined || value === null || value === '') return null
  if (NUMERIC_COLUMNS.has(column)) {
    if (typeof value === 'boolean') return value ? 1 : 0
    const n = Number(value)
    if (!Number.isFinite(n)) {
      throw new ValidationError(400, `"${column}" must be a number, received "${String(value).slice(0, 40)}"`)
    }
    return n
  }
  const text = String(value)
  if (text.length > MAX_TEXT_LENGTH) {
    throw new ValidationError(400, `"${column}" exceeds ${MAX_TEXT_LENGTH} characters`)
  }
  return text
}

const fromDbRow = (table, row) => {
  if (!row) return row
  const out = { ...row }
  for (const key of Object.keys(out)) {
    if (out[key] === null) out[key] = table === 'settings' ? out[key] : ''
  }
  return out
}

/** Ids are PREFIX-0001 style; keep them short, printable and safe for URLs. */
const assertValidId = (table, id) => {
  if (typeof id !== 'string' || !id.trim()) {
    throw new ValidationError(400, 'id must be a non-empty string')
  }
  if (id.length > MAX_ID_LENGTH) {
    throw new ValidationError(400, `id exceeds ${MAX_ID_LENGTH} characters`)
  }
  if (!/^[A-Za-z0-9._-]+$/.test(id)) {
    throw new ValidationError(400, 'id may only contain letters, numbers, dot, dash and underscore')
  }
}

export const nextId = (table, prefix) => {
  // Ordering happens in JS, not SQL: a TEXT column would sort 'MKT-10000'
  // before 'MKT-9999'.
  const rows = db.prepare(`SELECT id FROM ${table}`).all()
  let highest = 0
  for (const r of rows) {
    const m = /(\d+)\s*$/.exec(String(r.id || ''))
    if (m) highest = Math.max(highest, parseInt(m[1], 10))
  }
  return `${prefix}-${String(highest + 1).padStart(4, '0')}`
}

const PREFIX = { marketers: 'MKT', projects: 'PRJ', bookings: 'BKG', loans: 'LN', vouchers: 'VC' }

export const listAll = (table) => {
  const cols = TABLE_COLUMNS[table]
  if (!cols) throw new Error(`Unknown table: ${table}`)
  return db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all().map((r) => fromDbRow(table, r))
}

export const findById = (table, id) => {
  const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id)
  return row ? fromDbRow(table, row) : null
}

/**
 * Cross-field rules that must hold for every collection, enforced in the
 * database layer as well as the form so the API cannot be bypassed.
 * Reuses the same rule module the UI validates against.
 */
const COLLECTION_RULES = {
  bookings: (values) => validateBookingAmounts(values),
}

const assertRules = (table, values) => {
  const rule = COLLECTION_RULES[table]
  if (!rule) return
  const violation = rule(values)
  if (violation) throw new ValidationError(400, violation)
}

export const insertRow = (table, values) => {
  const cols = TABLE_COLUMNS[table]
  if (!cols) throw new ValidationError(404, `Unknown collection: ${table}`)
  assertRules(table, values)

  const id = values.id || nextId(table, PREFIX[table])
  assertValidId(table, id)

  // A client-supplied id must not collide with an existing row.
  if (findById(table, id)) {
    throw new ValidationError(409, `${table} record "${id}" already exists`)
  }

  const stamp = now()
  const record = { ...values, id, createdAt: values.createdAt || stamp, updatedAt: stamp }
  const allCols = [...cols, 'createdAt', 'updatedAt']
  const placeholders = allCols.map(() => '?').join(', ')
  db.prepare(`INSERT INTO ${table} (${allCols.join(', ')}) VALUES (${placeholders})`).run(
    ...allCols.map((c) => toDbValue(c, record[c])),
  )
  return fromDbRow(table, findById(table, id))
}

export const updateRow = (table, id, values) => {
  assertValidId(table, id)
  const existing = findById(table, id)
  if (!existing) return null
  // Rules must see the post-merge record, not just the changed fields.
  assertRules(table, { ...existing, ...values })
  const cols = TABLE_COLUMNS[table].filter((c) => c !== 'id')
  const sets = cols.filter((c) => c in values).map((c) => `${c} = ?`).join(', ')
  const params = cols.filter((c) => c in values).map((c) => toDbValue(c, values[c]))
  db.prepare(`UPDATE ${table} SET ${sets ? sets + ', ' : ''}updatedAt = ? WHERE id = ?`).run(
    ...params,
    now(),
    id,
  )
  return fromDbRow(table, findById(table, id))
}

/** Records in other collections that still point at this row. */
export const findReferences = (table, id) => {
  const found = []
  for (const [childTable, column] of Object.entries(REFERENCES)) {
    if (!TABLE_COLUMNS[childTable]?.includes(column)) continue
    const row = db.prepare(`SELECT COUNT(*) AS n FROM ${childTable} WHERE ${column} = ?`).get(id)
    if (row.n > 0) found.push({ table: childTable, column, count: row.n })
  }
  return found
}

/**
 * Blocks a delete that would leave dangling references (e.g. deleting a
 * project that bookings still point at). Pass `{ cascade: true }` to
 * detach the dependents first.
 */
export const deleteRow = (table, id, { cascade = false } = {}) => {
  assertValidId(table, id)
  const linked = findReferences(table, id)
  if (linked.length && !cascade) {
    const summary = linked.map((l) => `${l.count} ${l.table} record(s)`).join(', ')
    throw new ValidationError(
      409,
      `Cannot delete "${id}": still referenced by ${summary}. Detach them first, or delete with cascade.`,
    )
  }
  if (linked.length && cascade) {
    for (const { table: childTable, column } of linked) {
      db.prepare(`UPDATE ${childTable} SET ${column} = '' WHERE ${column} = ?`).run(id)
    }
  }
  const result = db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id)
  return result.changes > 0
}

export const getSetting = (key) => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key)
  return row ? row.value : null
}

export const setSetting = (key, value) => {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, String(value))
}

const tableEmpty = (table) => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n === 0

/** Seed empty tables from src/data/seed.js (keeps existing rows untouched). */
export const seedIfEmpty = () => {
  const seeds = {
    marketers: SEED_MARKETERS,
    projects: SEED_PROJECTS,
    bookings: SEED_BOOKINGS,
    loans: SEED_LOANS,
    vouchers: SEED_VOUCHERS,
  }
  for (const table of COLLECTION_TABLES) {
    if (tableEmpty(table)) {
      for (const row of seeds[table]) insertRow(table, row)
    }
  }
  if (!getSetting('theme')) setSetting('theme', 'castle')
}

seedIfEmpty()

export { DB_PATH }
