import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { SCHEMA_SQL, TABLE_COLUMNS, NUMERIC_COLUMNS, COLLECTION_TABLES } from './schema.js'
import {
  SEED_BOOKINGS,
  SEED_LOANS,
  SEED_MARKETERS,
  SEED_PROJECTS,
  SEED_VOUCHERS,
} from '../../src/data/seed.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = process.env.SQLITE_PATH || path.join(here, '..', 'ayngaran-futura.sqlite')

export const db = new DatabaseSync(DB_PATH)
db.exec(SCHEMA_SQL)

const now = () => new Date().toISOString()

const toDbValue = (column, value) => {
  if (value === undefined || value === null || value === '') return null
  if (NUMERIC_COLUMNS.has(column)) {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return String(value)
}

const fromDbRow = (table, row) => {
  if (!row) return row
  const out = { ...row }
  for (const key of Object.keys(out)) {
    if (out[key] === null) out[key] = table === 'settings' ? out[key] : ''
  }
  return out
}

export const nextId = (table, prefix) => {
  const row = db.prepare(`SELECT id FROM ${table} ORDER BY id DESC LIMIT 20`).all()
  let highest = 0
  for (const r of row) {
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

export const insertRow = (table, values) => {
  const cols = TABLE_COLUMNS[table]
  const id = values.id || nextId(table, PREFIX[table])
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
  const existing = findById(table, id)
  if (!existing) return null
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

export const deleteRow = (table, id) => {
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
