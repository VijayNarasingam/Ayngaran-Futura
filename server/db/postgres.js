import { neon } from '@neondatabase/serverless'
import {
  COLLECTION_TABLES,
  MAX_ID_LENGTH,
  MAX_TEXT_LENGTH,
  NUMERIC_COLUMNS,
  REFERENCES,
  TABLE_COLUMNS,
} from './schema.js'
import { validateBookingAmounts } from '../../src/lib/rules.js'

/**
 * PostgreSQL driver, used on Vercel. Connects with the standard
 * `DATABASE_URL` connection string via @neondatabase/serverless, which talks
 * to Neon over HTTPS - no TCP, so a serverless cold start cannot exhaust the
 * database's connection limit.
 *
 * Env:
 *   DATABASE_URL  postgresql://user:password@host/db?sslmode=require
 *
 * Implements the same interface as ./database.js (SQLite) and ./neon.js
 * (PostgREST), so routes stay driver-agnostic.
 *
 * Every statement goes through sql.query(text, values). Values are always
 * bound as $1, $2... - never interpolated. Identifiers cannot be bound, so
 * they are quoted by ident() and always come from the TABLE_COLUMNS whitelist.
 */

const DATABASE_URL = process.env.DATABASE_URL || ''

if (!DATABASE_URL) {
  throw new Error(
    'Postgres driver selected but DATABASE_URL is not set. Unset it to fall back to SQLite or the Neon REST API.',
  )
}

const sql = neon(DATABASE_URL)

export class ValidationError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const PREFIX = { marketers: 'MKT', projects: 'PRJ', bookings: 'BKG', loans: 'LN', vouchers: 'VC' }

const now = () => new Date().toISOString()

/**
 * The schema uses quoted camelCase columns, and Postgres folds unquoted
 * identifiers to lower case, so every identifier must be quoted. Callers only
 * ever pass whitelisted names; this escapes any embedded double quote anyway.
 */
const ident = (name) => `"${String(name).replace(/"/g, '""')}"`

/** Strips the password so the connection string is safe to log. */
const redact = (url) => url.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@')

/**
 * SQLSTATE -> the same HTTP contract the other drivers return.
 *
 * Note: @neondatabase/serverless over HTTPS does NOT surface SQLSTATE
 * structurally - a Postgres error arrives as a NeonDbError whose `code` is
 * undefined and whose message embeds the SQLSTATE text. So we match on the
 * message as well as on `error.code`. The duplicate-id case does not rely on
 * either path; insertRow checks first, see below.
 */
const SQLSTATE_HINTS = [
  // The schema has not been applied yet - almost always this, right after a
  // first deploy. Say so, because a bare 500 sends people hunting elsewhere.
  ['42P01', 500, 'table does not exist - run `npm run db:setup` against DATABASE_URL'],
  ['23505', 409, 'that id already exists'],
  ['23503', 409, 'referenced by another record'],
  ['22P02', 400, 'expected a number'],
  ['22001', 400, 'value too long'],
  ['23502', 400, 'a required value was missing'],
  ['22007', 400, 'invalid date/time format'],
  ['42601', 400, 'invalid query'],
]

const toHttpError = (error, context) => {
  if (error instanceof ValidationError) return error
  const haystack = `${error?.code || ''} ${error?.message || ''}`
  for (const [state, status, reason] of SQLSTATE_HINTS) {
    if (haystack.includes(state)) {
      return new ValidationError(status, `${context}: ${reason}`)
    }
  }
  return error
}

const assertTable = (table) => {
  if (!COLLECTION_TABLES.includes(table) || !TABLE_COLUMNS[table]) {
    throw new ValidationError(404, `Unknown collection: ${table}`)
  }
}

const assertValidId = (id) => {
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

/** Postgres returns nulls as null; the UI expects '' exactly like the other drivers. */
const fromDbRow = (table, row) => {
  if (!row || table === 'settings') return row
  const out = {}
  for (const [key, value] of Object.entries(row)) {
    if (key === 'seq') continue
    out[key] = value === null ? '' : value
  }
  return out
}

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

const COLLECTION_RULES = {
  bookings: (values) => validateBookingAmounts(values),
}

const assertRules = (table, values) => {
  const rule = COLLECTION_RULES[table]
  if (rule) {
    const violation = rule(values)
    if (violation) throw new ValidationError(400, violation)
  }
}

/** Runs a statement, translating Postgres SQLSTATEs into HTTP statuses. */
const run = async (query, values, context) => {
  try {
    return await sql.query(query, values)
  } catch (error) {
    throw toHttpError(error, context)
  }
}

// --- reads ---------------------------------------------------------------

export const listAll = async (table) => {
  assertTable(table)
  const rows = await run(`SELECT * FROM ${ident(table)} ORDER BY seq ASC`, [], table)
  return rows.map((row) => fromDbRow(table, row))
}

export const findById = async (table, id) => {
  assertTable(table)
  const rows = await run(`SELECT * FROM ${ident(table)} WHERE id = $1 LIMIT 1`, [id], table)
  return rows.length ? fromDbRow(table, rows[0]) : null
}

export const countRows = async (table) => {
  assertTable(table)
  const rows = await run(`SELECT COUNT(*)::int AS n FROM ${ident(table)}`, [], table)
  return Number(rows[0]?.n ?? 0)
}

/** Highest numeric suffix, computed in JS: 'MKT-10000' must beat 'MKT-9999'. */
export const nextId = async (table, prefix = PREFIX[table]) => {
  assertTable(table)
  const rows = await run(`SELECT id FROM ${ident(table)}`, [], table)
  let highest = 0
  for (const row of rows) {
    const match = /(\d+)\s*$/.exec(String(row.id || ''))
    if (match) highest = Math.max(highest, parseInt(match[1], 10))
  }
  return `${prefix}-${String(highest + 1).padStart(4, '0')}`
}

// --- writes --------------------------------------------------------------

export const insertRow = async (table, values) => {
  assertTable(table)
  assertRules(table, values)

  // Coerce and validate every value BEFORE any round-trip, so a malformed
  // payload fails with 400 without spending a query on it.
  const coerced = {}
  for (const column of TABLE_COLUMNS[table]) {
    if (column === 'id') continue
    coerced[column] = toDbValue(column, values[column])
  }

  const id = values.id || (await nextId(table))
  assertValidId(id)

  // The HTTPS driver cannot report a primary-key clash in a form we can map to
  // 409, so check first. Costs one extra round-trip on create only; the insert
  // still relies on the unique constraint, which closes the race.
  if (await findById(table, id)) {
    throw new ValidationError(409, `${table}: that id already exists`)
  }

  const stamp = now()
  const row = { id, ...coerced, createdAt: values.createdAt || stamp, updatedAt: stamp }

  const columns = Object.keys(row)
  const query =
    `INSERT INTO ${ident(table)} (${columns.map(ident).join(', ')}) ` +
    `VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`

  const rows = await run(query, Object.values(row), table)
  return fromDbRow(table, rows[0])
}

export const updateRow = async (table, id, values) => {
  assertTable(table)
  assertValidId(id)
  const existing = await findById(table, id)
  if (!existing) return null
  // Rules must see the post-merge record, not just the changed fields.
  assertRules(table, { ...existing, ...values })

  const patch = {}
  for (const column of TABLE_COLUMNS[table]) {
    if (column in values) patch[column] = toDbValue(column, values[column])
  }
  patch.updatedAt = now()

  const patchColumns = Object.keys(patch)
  const query =
    `UPDATE ${ident(table)} ` +
    `SET ${patchColumns.map((c, i) => `${ident(c)} = $${i + 1}`).join(', ')} ` +
    'WHERE id = $' + `${patchColumns.length + 1} RETURNING *`

  const rows = await run(query, [...Object.values(patch), id], table)
  return rows.length ? fromDbRow(table, rows[0]) : null
}

export const findReferences = async (table, id) => {
  const found = []
  for (const [childTable, column] of Object.entries(REFERENCES)) {
    if (!TABLE_COLUMNS[childTable]?.includes(column)) continue
    const rows = await run(
      `SELECT COUNT(*)::int AS n FROM ${ident(childTable)} WHERE ${ident(column)} = $1`,
      [id],
      childTable,
    )
    const n = Number(rows[0]?.n ?? 0)
    if (n) found.push({ table: childTable, column, count: n })
  }
  return found
}

export const deleteRow = async (table, id, { cascade = false } = {}) => {
  assertTable(table)
  assertValidId(id)
  const linked = await findReferences(table, id)
  if (linked.length && !cascade) {
    const summary = linked.map((l) => `${l.count} ${l.table} record(s)`).join(', ')
    throw new ValidationError(
      409,
      `Cannot delete "${id}": still referenced by ${summary}. Detach them first, or delete with cascade.`,
    )
  }
  for (const { table: childTable, column } of linked) {
    if (!cascade) continue
    await run(
      `UPDATE ${ident(childTable)} SET ${ident(column)} = '' WHERE ${ident(column)} = $1`,
      [id],
      childTable,
    )
  }
  const rows = await run(`DELETE FROM ${ident(table)} WHERE id = $1 RETURNING id`, [id], table)
  return rows.length > 0
}

export const getSetting = async (key) => {
  const rows = await run('SELECT value FROM settings WHERE key = $1 LIMIT 1', [key], 'settings')
  return rows.length ? rows[0].value : null
}

export const setSetting = async (key, value) => {
  await run(
    'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
    [key, String(value)],
    'settings',
  )
}

/** Skips tables that already hold rows, so re-running never duplicates. */
export const seedIfEmpty = async (seeds = {}) => {
  const inserted = {}
  for (const table of COLLECTION_TABLES) {
    if ((await countRows(table)) > 0) continue
    const rows = seeds[table] || []
    for (const row of rows) await insertRow(table, row)
    inserted[table] = rows.length
  }
  if ((await getSetting('theme')) === null) await setSetting('theme', 'castle')
  return inserted
}

export const DB_PATH = redact(DATABASE_URL)
export const closeDatabase = () => {}