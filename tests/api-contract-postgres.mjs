/**
 * Contract tests for the DATABASE_URL (Postgres) driver.
 *
 * @neondatabase/serverless sends every query as
 *   POST https://api.<region>.aws.neon.tech/sql   { query, params }
 * and expects PostgREST-shaped JSON back:
 *   { command, rowCount, fields:[{name,dataTypeID}], rows:[[...]] }
 *
 * neonConfig.fetchFunction is a documented public hook, so we swap the
 * transport for a fake and assert on the SQL the driver actually emits. No
 * database and no network access required.
 *
 * Why this matters: DATABASE_URL is the production store on Vercel, and a
 * driver that silently built the wrong SQL would only surface against a real
 * database.
 */

import assert from 'node:assert/strict'
import { neonConfig } from '@neondatabase/serverless'

process.env.DATABASE_URL =
  'postgresql://user:secret@ep-unit-test.us-east-2.aws.neon.tech/neondb?sslmode=require'

// --- fake PostgREST-over-HTTP transport -----------------------------------

/** Every statement the driver issued, as { query, params }. */
let executed = []

/** Rows the fake database returns, keyed by the table named in the query. */
const rows = {
  marketers: [{ id: 'MKT-0001', name: 'Karthik Raja', status: 'Active', seq: 1 }],
  projects: [
    { id: 'PRJ-0001', name: 'Project 1', totalPlots: 96, projectRef: '', seq: 1 },
    { id: 'PRJ-0002', name: 'Project 2', totalPlots: 72, projectRef: '', seq: 2 },
  ],
  bookings: [{ id: 'BKG-0001', customerName: 'Senthil', projectRef: 'PRJ-0001', seq: 1 }],
  loans: [{ id: 'LN-0001', lenderName: 'HDFC Bank', projectRef: '', seq: 1 }],
  vouchers: [{ id: 'VC-0001', type: 'office', amount: 2500, projectRef: 'PRJ-0002', seq: 1 }],
  settings: [{ key: 'theme', value: 'castle' }],
}

/** Error to raise for the next matching statement, keyed by SQLSTATE. */
let injectError = null

/** Rows the last DELETE removed, so we can prove it really deleted. */
let deletedRows = []

const TYPES = { id: 25, seq: 20 }

function buildResponse(result) {
  if (injectError) {
    const error = new Error(injectError.message)
    error.code = injectError.code
    return Promise.reject(error)
  }
  const rowArray = result.map((row) =>
    Array.isArray(row) ? row : Object.values(row).map((v) => (v === undefined ? null : v)))
  // The driver builds a value parser per field, so `fields` must line up with
  // the width of every row. Derive it from the first row unless told otherwise.
  const names =
    result.__fields ||
    (result.length && !Array.isArray(result[0]) ? Object.keys(result[0]) : [])
  const fields = names.map((name) => ({ name, dataTypeID: TYPES[name] ?? 25 }))
  return new Response(
    JSON.stringify({ command: 'SELECT', rowCount: rowArray.length, fields, rows: rowArray }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  )
}

// The driver quotes table names in FROM/INTO/UPDATE, but writes `settings`
// unquoted, so accept both.
const tableIn = (query) => /\b(?:FROM|INTO|UPDATE)\s+"?([A-Za-z_]\w*)"?/i.exec(query)?.[1]

neonConfig.fetchFunction = async (_url, init) => {
  const body = JSON.parse(init.body)
  executed.push(body)

  const table = tableIn(body.query) || 'settings'
  const store = rows[table] || []

  // COUNT(*)
  if (/COUNT\(\*\)/i.test(body.query)) {
    const filtered = applyFilters(store, body.params, body.query)
    const payload = [{ n: String(filtered.length) }]
    payload.__fields = ['n']
    return buildResponse(payload)
  }

  // INSERT ... RETURNING *
  if (/^\s*INSERT/i.test(body.query)) {
    const columns = insertColumns(body.query)
    const created = Object.fromEntries(columns.map((col, i) => [col, body.params[i]]))

    // settings is a key/value table and the driver relies on
    // ON CONFLICT (key) DO UPDATE, so model it as an upsert.
    if (columns.includes('key')) {
      const index = store.findIndex((r) => r.key === created.key)
      if (index >= 0) store[index] = { ...store[index], ...created }
      else store.push(created)
      return buildResponse([store.find((r) => r.key === created.key)])
    }

    // Only collection rows have an `id`, and only those have a primary key
    // clash to detect.
    if (store.some((r) => String(r.id) === String(created.id))) {
      injectError = { code: '23505', message: 'duplicate key value violates unique constraint' }
      return buildResponse([])
    }
    store.push(created)
    return buildResponse([created])
  }

  // UPDATE ... RETURNING *  - matches on its own WHERE clause, which may be
  // `WHERE id = $n` (edit) or `WHERE "projectRef" = $n` (cascade detach).
  if (/^\s*UPDATE/i.test(body.query)) {
    const assignments = setAssignments(body.query, body.params)
    const targets = applyFilters(store, body.params, body.query)
    for (const target of targets) {
      for (const [column, value] of assignments) target[column] = value
    }
    return buildResponse(targets)
  }

  // DELETE ... RETURNING id
  if (/^\s*DELETE/i.test(body.query)) {
    const id = body.params[0]
    const index = store.findIndex((r) => String(r.id) === String(id))
    if (index < 0) return buildResponse([])
    const [removed] = store.splice(index, 1)
    deletedRows.push(removed.id)
    return buildResponse([{ id: removed.id }])
  }

  // SELECT
  const payload = applyFilters(store, body.params, body.query).map((r) => ({ ...r }))
  if (payload.length) payload.__fields = Object.keys(payload[0])
  return buildResponse(payload)
}

/** Extracts column names from the quoted identifier list in a statement. */
const insertColumns = (query) =>
  /\(([^)]+)\)\s*VALUES/i.exec(query)?.[1].split(',').map((c) => c.trim().replace(/"/g, '')) || []

/**
 * Parses the SET clause of an UPDATE into [column, value] pairs.
 * The right-hand side is either a bound parameter ($n) or an inline literal
 * (the cascade detach uses `SET "projectRef" = ''`), so handle both.
 */
const setAssignments = (query, params) => {
  const set = /\sSET\s+(.+?)\s+WHERE/i.exec(query)?.[1] || ''
  return set.split(',').map((part) => {
    const [, column, value] = /"([^"]+)"\s*=\s*(.+)$/.exec(part.trim()) || []
    if (!column) return null
    const param = /^\$(\d+)$/.exec(value.trim())
    if (param) return [column, params[Number(param[1]) - 1]]
    return [column, value.trim().replace(/^'(.*)'$/, '$1')]
  }).filter(Boolean)
}

/** Applies any `WHERE <col> = $n` filters present in the statement (quoted or not). */
function applyFilters(store, params, query) {
  const where = /WHERE\s+(.+?)(?:\s+ORDER BY|\s+LIMIT|$)/i.exec(query)?.[1] || ''
  const filters = [...where.matchAll(/"?(\w+)"?\s*=\s*\$(\d+)/g)].map(([, col, n]) => [
    col,
    params[Number(n) - 1],
  ])
  return filters.reduce((out, [col, value]) => out.filter((r) => String(r[col] ?? '') === String(value)), store)
}

const lastQuery = () => executed[executed.length - 1]
const results = []
const check = (name, condition, detail = '') => {
  results.push({ name, pass: Boolean(condition), detail })
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${condition || !detail ? '' : `  [${detail}]`}`)
}

const { DRIVER, listAll, findById, insertRow, updateRow, deleteRow, getSetting, setSetting, nextId, countRows } =
  await import('../server/db/index.js')

console.log('=== Postgres driver contract (DATABASE_URL, mocked transport) ===\n')

check('DATABASE_URL selects the postgres driver', DRIVER === 'postgres', `got ${DRIVER}`)

// --- listAll -------------------------------------------------------------
{
  executed = []
  const out = await listAll('projects')
  const q = lastQuery()
  check('listAll quotes the table identifier', q.query.includes('"projects"'), q.query)
  check('listAll orders by the insertion sequence', /ORDER BY seq/i.test(q.query), q.query)
  check('listAll returns rows', out.length === 2, `len=${out.length}`)
  check('listAll drops the internal seq column', !('seq' in (out[0] || {})), JSON.stringify(out[0]))
  check('listAll binds no values', q.params.length === 0, JSON.stringify(q.params))
}

// --- SQL injection safety ------------------------------------------------
{
  executed = []
  let status = null
  try { await listAll('projects; DROP TABLE projects') } catch (e) { status = e.status }
  check('A hostile table name is rejected by the whitelist before any SQL is built',
    status === 404, `got ${status}`)
  check('No SQL was sent for the hostile table name', executed.length === 0, `${executed.length} statements`)
}
{
  executed = []
  let status = null
  try { await listAll('evil') } catch (e) { status = e.status }
  check('An unknown collection returns 404', status === 404, `got ${status}`)
}
{
  executed = []
  await listAll('projects')
  check('Identifiers are double-quoted, values are never interpolated',
    lastQuery().query.includes('"projects"') && !/'\s*;\s*/.test(lastQuery().query),
    lastQuery().query)
}

// --- findById ----------------------------------------------------------
{
  executed = []
  const hit = await findById('projects', 'PRJ-0001')
  check('findById binds the id as a parameter, not text',
    lastQuery().params[0] === 'PRJ-0001' && lastQuery().query.includes('$1'),
    JSON.stringify(lastQuery()))
  check('findById returns the row', hit?.name === 'Project 1', JSON.stringify(hit))
}
{
  executed = []
  const miss = await findById('projects', 'PRJ-9999')
  check('findById returns null for a missing id', miss === null, JSON.stringify(miss))
}

// --- nextId -------------------------------------------------------------
{
  executed = []
  const next = await nextId('projects')
  check('nextId increments past the highest numeric suffix', next === 'PRJ-0003', next)
}

// --- insertRow ----------------------------------------------------------
{
  executed = []
  const created = await insertRow('projects', { name: 'Project 4' })
  const q = lastQuery()
  check('insertRow uses RETURNING *', /RETURNING \*$/i.test(q.query.trim()), q.query)
  check('insertRow binds every value as a parameter', q.params.includes('Project 4'), JSON.stringify(q.params))
  check('insertRow returns the saved row', created?.name === 'Project 4', JSON.stringify(created))
}
{
  // The HTTPS driver cannot hand back a structured SQLSTATE, so insertRow
  // checks for the clash itself rather than relying on 23505.
  executed = []
  let status = null
  try { await insertRow('projects', { id: 'PRJ-0001', name: 'Clash' }) } catch (e) { status = e.status }
  check('A duplicate id returns 409', status === 409, `got ${status}`)
  check('The clash is detected by a lookup, not by an INSERT',
    executed.some((e) => /^\s*SELECT/i.test(e.query) && e.params.includes('PRJ-0001')) &&
    !executed.some((e) => /^\s*INSERT/i.test(e.query)),
    executed.map((e) => e.query).join(' | '))
}
{
  // Belt and braces: if a clash still slips through (a concurrent insert), the
  // SQLSTATE embedded in the error message must still map to 409.
  executed = []
  injectError = { code: '23505', message: 'Server error (HTTP status 409): {"code":"23505","message":"duplicate key value violates unique constraint"}' }
  let status = null
  try { await insertRow('projects', { id: 'BRAND-NEW-ID', name: 'Race' }) } catch (e) { status = e.status }
  injectError = null
  check('A SQLSTATE embedded only in the message still maps to 409', status === 409, `got ${status}`)
}

// --- updateRow ----------------------------------------------------------
{
  executed = []
  const before = await findById('projects', 'PRJ-0001')
  const updated = await updateRow('projects', 'PRJ-0001', { name: 'Renamed' })
  const q = lastQuery()
  check('updateRow sets only the supplied columns',
    q.query.includes('"name" = $') && !q.query.includes('"totalPlots" = $'), q.query)
  check('updateRow appends the id as the final parameter',
    q.params[q.params.length - 1] === 'PRJ-0001', JSON.stringify(q.params))
  check('updateRow returns the updated row', updated?.name === 'Renamed', JSON.stringify(updated))
  await updateRow('projects', 'PRJ-0001', { name: before.name })
}
{
  executed = []
  const miss = await updateRow('projects', 'PRJ-9999', { name: 'Nope' })
  check('updateRow returns null for a missing id', miss === null, JSON.stringify(miss))
}

// --- deleteRow + referential guard --------------------------------------
{
  executed = []
  let status = null
  try { await deleteRow('projects', 'PRJ-0001') } catch (e) { status = e.status }
  check('Deleting a referenced row returns 409', status === 409, `got ${status}`)
  check('The 409 came from a real COUNT query',
    executed.some((e) => /COUNT\(\*\)/i.test(e.query) && e.params.includes('PRJ-0001')),
    executed.map((e) => e.query).join(' | '))
}
{
  executed = []
  deletedRows = []
  const ok = await deleteRow('projects', 'PRJ-0002', { cascade: true })
  const q = lastQuery()
  check('deleteRow with cascade succeeds', ok === true)
  check('cascade detaches dependents with an UPDATE ... SET ""',
    executed.some((e) => /^\s*UPDATE\s+"vouchers"\s+SET\s+"projectRef"\s*=\s*''/i.test(e.query)),
    executed.map((e) => e.query).join(' | '))
  check('deleteRow uses RETURNING id', /RETURNING id$/i.test(q.query.trim()), q.query)
}
{
  executed = []
  const again = await deleteRow('projects', 'PRJ-0002')
  check('Deleting an already-removed row returns false, not a false ok', again === false, String(again))
}

// --- settings -----------------------------------------------------------
{
  executed = []
  await setSetting('theme', 'castle')
  check('setSetting upserts on the key conflict',
    /ON CONFLICT \(key\) DO UPDATE/i.test(lastQuery().query), lastQuery().query)
  const theme = await getSetting('theme')
  check('getSetting returns the value', theme === 'castle', String(theme))
  check('settings queries are not table-filtered', lastQuery().params[0] === 'theme', JSON.stringify(lastQuery()))
}

// --- value coercion -----------------------------------------------------
{
  executed = []
  let status = null
  try { await insertRow('projects', { name: 'Bad', totalAreaAcres: 'not-a-number' }) } catch (e) { status = e.status }
  check('Text in a numeric column is rejected with 400 before SQL', status === 400, `got ${status}`)
  check('No SQL was sent for the rejected insert', executed.length === 0, `${executed.length} statements`)
}
{
  let status = null
  try { await insertRow('projects', { name: 'x'.repeat(2100) }) } catch (e) { status = e.status }
  check('Over-long text is rejected with 400', status === 400, `got ${status}`)
}
{
  let status = null
  try { await insertRow('projects', { id: 'PRJ 1/x' }) } catch (e) { status = e.status }
  check('An id with illegal characters is rejected with 400', status === 400, `got ${status}`)
}

// --- countRows ----------------------------------------------------------
{
  const n = await countRows('projects')
  check('countRows returns a number', typeof n === 'number' && n >= 0, String(n))
}

const passed = results.filter((r) => r.pass).length
const failed = results.length - passed
console.log(`\n=== ${passed} passed, ${failed} failed ===`)
if (failed) {
  console.log('\nFailures:')
  for (const r of results.filter((x) => !x.pass)) console.log(`  - ${r.name}  ${r.detail}`)
  process.exit(1)
}
process.exit(0)