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
 * Neon (Postgres) driver, talking to Neon's PostgREST endpoint over HTTP.
 * Implements the same interface as ./database.js so routes are driver-agnostic.
 *
 * Env:
 *   NEON_REST_URL  https://<id>.apirest.<region>.aws.neon.tech/<db>/rest/v1
 *   NEON_API_KEY   the Neon API key, sent as a bearer token
 */

const REST_URL = (process.env.NEON_REST_URL || '').replace(/\/+$/, '')
const API_KEY = process.env.NEON_API_KEY || ''
const SCHEMA = process.env.NEON_SCHEMA || 'public'

if (!REST_URL || !API_KEY) {
  throw new Error(
    'Neon driver selected but NEON_REST_URL / NEON_API_KEY are not set. Unset them to fall back to SQLite.',
  )
}

export class ValidationError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const PREFIX = { marketers: 'MKT', projects: 'PRJ', bookings: 'BKG', loans: 'LN', vouchers: 'VC' }

const now = () => new Date().toISOString()

/** PostgREST wants double quotes around values containing reserved characters. */
const eqFilter = (value) => `"${String(value).replace(/"/g, '""')}"`

const tableUrl = (table, query = '') =>
  `${REST_URL}/${encodeURIComponent(table)}${query ? `?${query}` : ''}`

/** Maps a PostgREST/Postgres error onto the same 4xx contract as the SQLite driver. */
const toHttpError = (status, payload, context) => {
  const code = payload?.code
  if (code === '23505') return new ValidationError(409, `${context}: duplicate key`)
  if (code === '23503') return new ValidationError(409, `${context}: referenced by another record`)
  if (code === 'PGRST116') return new ValidationError(404, 'Not found')
  if (status === 404) return new ValidationError(404, 'Not found')
  if (status >= 400 && status < 500) {
    return new ValidationError(status, payload?.message || payload?.hint || 'Bad request')
  }
  const error = new Error(payload?.message || `Database request failed (${status})`)
  error.status = 500
  return error
}

async function request(path, { method = 'GET', body, prefer, headers = {} } = {}) {
  const response = await fetch(`${REST_URL}${path}`, {
    method,
    headers: {
      apikey: API_KEY,
      Authorization: `Bearer ${API_KEY}`,
      'Accept-Profile': SCHEMA,
      'Content-Profile': SCHEMA,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : null),
      ...(prefer ? { Prefer: prefer } : null),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (response.status === 204) return { data: null, count: null, response }

  const text = await response.text()
  let payload = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = { message: text.slice(0, 200) }
  }

  if (!response.ok) throw toHttpError(response.status, payload, path.split('?')[0].replace('/', ''))

  // PostgREST returns an exact row count in Content-Range when asked.
  const range = response.headers.get('content-range')
  const total = range && range.includes('/') ? Number(range.split('/')[1]) : null

  return { data: payload, count: Number.isFinite(total) ? total : null, response }
}

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

const assertTable = (table) => {
  if (!COLLECTION_TABLES.includes(table) || !TABLE_COLUMNS[table]) {
    throw new ValidationError(404, `Unknown collection: ${table}`)
  }
}

/** Postgres nulls come back as null; the UI expects '' exactly like the SQLite driver. */
const fromDbRow = (table, row) => {
  if (!row) return row
  if (table === 'settings') return row
  const out = {}
  for (const [key, value] of Object.entries(row)) {
    out[key] = value === null ? '' : value
  }
  return out
}

const toDbValue = (table, column, value) => {
  if (value === undefined || value === null || value === '') return null
  if (column === 'seq') return undefined
  if (NUMERIC_COLUMNS.has(column)) {
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

/** Sends only the known columns - unknown keys in the payload are dropped. */
const toRowPayload = (table, values) => {
  const payload = {}
  for (const column of TABLE_COLUMNS[table]) {
    const coerced = toDbValue(table, column, values[column])
    if (coerced !== undefined) payload[column] = coerced
  }
  return payload
}

export const listAll = async (table) => {
  assertTable(table)
  const { data } = await request(`/${table}?select=*&order=seq.asc`)
  return (data || []).map((row) => fromDbRow(table, row))
}

export const findById = async (table, id) => {
  assertTable(table)
  const { data } = await request(
    `/${table}?select=*&id=eq.${eqFilter(id)}&limit=1`,
  )
  return data && data.length ? fromDbRow(table, data[0]) : null
}

export const countRows = async (table) => {
  assertTable(table)
  const { count } = await request(`/${table}?select=seq`, {
    prefer: 'count=exact',
    headers: { Range: '0-0' },
  })
  return count ?? 0
}

export const nextId = async (table, prefix = PREFIX[table]) => {
  // Pull only the ids and pick the highest numerically - sorting them as text
  // would put MKT-10000 before MKT-9999.
  const { data } = await request(`/${table}?select=id`)
  let highest = 0
  for (const row of data || []) {
    const match = /(\d+)\s*$/.exec(String(row.id || ''))
    if (match) highest = Math.max(highest, parseInt(match[1], 10))
  }
  return `${prefix}-${String(highest + 1).padStart(4, '0')}`
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

export const insertRow = async (table, values) => {
  assertTable(table)
  assertRules(table, values)
  const id = values.id || (await nextId(table))
  assertValidId(table, id)
  const stamp = now()
  const row = {
    ...toRowPayload(table, values),
    id,
    createdAt: values.createdAt || stamp,
    updatedAt: stamp,
  }
  const { data } = await request(`/${table}`, {
    method: 'POST',
    body: row,
    prefer: 'return=representation',
  })
  return fromDbRow(table, Array.isArray(data) ? data[0] : data)
}

export const updateRow = async (table, id, values) => {
  assertTable(table)
  assertValidId(table, id)
  const existing = await findById(table, id)
  if (!existing) return null
  // Rules must see the post-merge record, not just the changed fields.
  assertRules(table, { ...existing, ...values })

  const patch = toRowPayload(table, values)
  patch.updatedAt = now()
  const { data } = await request(`/${table}?id=eq.${eqFilter(id)}`, {
    method: 'PATCH',
    body: patch,
    prefer: 'return=representation',
  })
  return fromDbRow(table, Array.isArray(data) ? data[0] : data)
}

export const findReferences = async (table, id) => {
  const found = []
  for (const [childTable, column] of Object.entries(REFERENCES)) {
    if (!TABLE_COLUMNS[childTable]?.includes(column)) continue
    const { count } = await request(
      `/${childTable}?select=seq&${column}=eq.${eqFilter(id)}`,
      { prefer: 'count=exact', headers: { Range: '0-0' } },
    )
    if (count) found.push({ table: childTable, column, count })
  }
  return found
}

export const deleteRow = async (table, id, { cascade = false } = {}) => {
  assertTable(table)
  assertValidId(table, id)
  const linked = await findReferences(table, id)
  if (linked.length && !cascade) {
    const summary = linked.map((l) => `${l.count} ${l.table} record(s)`).join(', ')
    throw new ValidationError(
      409,
      `Cannot delete "${id}": still referenced by ${summary}. Detach them first, or delete with cascade.`,
    )
  }
  if (linked.length && cascade) {
    for (const { table: childTable, column } of linked) {
      await request(`/${childTable}?${column}=eq.${eqFilter(id)}`, {
        method: 'PATCH',
        body: { [column]: '' },
      })
    }
  }
  const { data } = await request(`/${table}?id=eq.${eqFilter(id)}`, {
    method: 'DELETE',
    prefer: 'return=representation',
  })
  return Boolean(data && data.length)
}

export const getSetting = async (key) => {
  const { data } = await request(`/settings?select=value&key=eq.${eqFilter(key)}&limit=1`)
  return data && data.length ? data[0].value : null
}

export const setSetting = async (key, value) => {
  await request('/settings', {
    method: 'POST',
    body: { key, value: String(value) },
    prefer: 'resolution=merge-duplicates,return=representation',
  })
}

/** Used by the seed script; skips tables that already hold rows. */
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

export const DB_PATH = REST_URL
export const closeDatabase = () => {}