/**
 * API contract test - runs the real /api routes against the ASYNC Neon driver
 * with a mocked PostgREST.
 *
 * Why this exists: the SQLite driver is synchronous, so a missing `await` in
 * the route handlers went unnoticed. Against Neon the same code passed a
 * Promise to res.json(), which serialised to `{}` with HTTP 200 - and because
 * a Promise is always truthy, every `if (!row)` 404 guard silently stopped
 * firing. This test fails if that ever regresses.
 *
 * No Neon project and no network access are required.
 */

import assert from 'node:assert/strict'

// --- Mock PostgREST -------------------------------------------------------

let requestLog = []

/** Rows the fake database will answer with, keyed by table. */
const rows = {
  marketers: [{ id: 'MKT-0001', name: 'Karthik Raja', status: 'Active' }],
  projects: [
    { id: 'PRJ-0001', name: 'Project 1', totalPlots: 96 },
    { id: 'PRJ-0002', name: 'Project 2', totalPlots: 72 },
  ],
  bookings: [{ id: 'BKG-0001', customerName: 'Senthil Kumar', totalAmount: 992750, projectRef: 'PRJ-0001' }],
  loans: [{ id: 'LN-0001', lenderName: 'HDFC Bank', outstandingBalance: 1200000 }],
  vouchers: [{ id: 'VC-0001', type: 'office', amount: 2500, projectRef: 'PRJ-0002' }],
}

/** Tables whose rows were deleted, so we can prove DELETE actually deletes. */
const deleted = new Set()

const jsonResponse = (status, body, headers = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: new Map(Object.entries(headers)),
  text: async () => JSON.stringify(body),
})

globalThis.fetch = async (url, options = {}) => {
  const method = options.method || 'GET'
  const href = String(url)
  const query = href.split('?')[1] || ''
  // REST_URL is https://<host>/<db>/rest/v1, so strip everything through
  // the 'rest/v1/' segment - the database name sits in between.
  const path = href.includes('/rest/v1/') ? href.split('/rest/v1/')[1] : href
  requestLog.push(`${method} /${path}`)

  // settings key/value table
  if (href.includes('/settings')) {
    if (method === 'POST') return jsonResponse(201, [{ key: 'theme', value: 'castle' }])
    return jsonResponse(200, [{ value: 'castle' }])
  }

  const table = path.split('?')[0]
  const store = rows[table] || []
  const idMatch = /id=eq\."?([^"&]+)"?/.exec(query)
  const wantedId = idMatch ? decodeURIComponent(idMatch[1]) : null

  /** Applies every `<col>=eq."<value>"` filter in the query. */
  const applyFilters = (list) => {
    let out = list
    for (const match of query.matchAll(/(\w+)=eq\."?([^"&]+)"?/g)) {
      const [, column, value] = match
      out = out.filter((row) => String(row[column] ?? '') === decodeURIComponent(value))
    }
    return out
  }

  // Exact-count probe (referential checks use select=seq + Prefer: count=exact)
  if (query.includes('select=seq')) {
    const matches = applyFilters(store)
    return jsonResponse(200, matches.length ? [{ seq: 1 }] : [], {
      'content-range': `0-0/${matches.length}`,
    })
  }

  if (method === 'GET' && wantedId) {
    const hit = store.find((row) => row.id === wantedId)
    return hit ? jsonResponse(200, [hit]) : jsonResponse(200, [])
  }

  if (method === 'GET') return jsonResponse(200, applyFilters(store))

  if (method === 'POST') {
    // PostgREST POST inserts; it never updates existing rows.
    const payload = options.body ? JSON.parse(options.body) : {}
    const created = { ...payload, id: payload.id || `NEW-${store.length + 1}` }
    store.push(created)
    return jsonResponse(201, [created])
  }

  if (method === 'PATCH') {
    const patch = options.body ? JSON.parse(options.body) : {}
    // PATCH really updates the stored rows, so a cascade detach is observable
    // by the next request - exactly how PostgREST behaves.
    const affected = applyFilters(store)
    for (const row of affected) Object.assign(row, patch)
    return jsonResponse(200, affected)
  }

  if (method === 'DELETE') {
    const index = store.findIndex((row) => row.id === wantedId)
    if (index >= 0) {
      const [removed] = store.splice(index, 1)
      deleted.add(`${table}:${removed.id}`)
      return jsonResponse(200, [removed])
    }
    return jsonResponse(200, [])
  }

  return jsonResponse(200, [])
}

// Force the Neon REST (PostgREST) driver without touching a real database, and
// make sure DATABASE_URL cannot take precedence over it.
delete process.env.DATABASE_URL
process.env.NEON_REST_URL = 'https://unit-test.apirest.us-east-2.aws.neon.tech/neondb/rest/v1'
process.env.NEON_API_KEY = 'unit-test-key'
process.env.NEON_SCHEMA = 'public'

const { DRIVER, handleRequest } = await import('../server/app.js')

// --- Harness --------------------------------------------------------------

async function call(method, url, body) {
  let sent = null
  let status = 200
  const res = {
    setHeader() {},
    writeHead(code) { status = code },
    end(payload) { sent = payload },
  }
  await handleRequest({ method, url, headers: {}, body }, res)
  return { status, text: sent, json: sent ? JSON.parse(sent) : null }
}

const results = []
function check(name, condition, detail = '') {
  results.push({ name, pass: Boolean(condition), detail })
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${name}${condition || !detail ? '' : `  [${detail}]`}`)
}

/** A leaked Promise serialises to an empty object - the signature of a missing await. */
function looksLikeLeakedPromise(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0
}

// --- Tests ----------------------------------------------------------------

console.log('=== API contract (async Neon driver, mocked PostgREST) ===')

check('Neon REST driver is the one under test', DRIVER === 'neon-rest', `got ${DRIVER}`)

// GET /api/state
{
  const { status, json } = await call('GET', '/api/state')
  check('GET /api/state returns 200', status === 200, `got ${status}`)
  const collections = ['marketers', 'projects', 'bookings', 'loans', 'vouchers']
  const leaked = collections.filter((key) => looksLikeLeakedPromise(json?.[key]))
  check('GET /api/state resolves every collection', leaked.length === 0, `leaked: ${leaked}`)
  check('GET /api/state returns real rows',
    Array.isArray(json?.projects) && json.projects.length === 2,
    `projects = ${JSON.stringify(json?.projects)}`)
  check('GET /api/state resolves settings.theme',
    json?.settings?.theme === 'castle', `theme = ${JSON.stringify(json?.settings?.theme)}`)
  check('GET /api/state fetches each collection exactly once',
    ['marketers', 'projects', 'bookings', 'loans', 'vouchers'].every(
      (t) => requestLog.filter((line) => line.startsWith(`GET /${t}?`)).length === 1,
    ),
    requestLog.join(' | '))
}

// GET /api/:collection
{
  const { status, json } = await call('GET', '/api/projects')
  check('GET /api/:collection returns an array', Array.isArray(json), `got ${JSON.stringify(json)}`)
  check('GET /api/:collection returns the rows', json?.length === 2, `len=${json?.length}`)
}

// GET /api/:collection/:id  (found)
{
  const { status, json } = await call('GET', '/api/projects/PRJ-0001')
  check('GET by id returns the row', status === 200 && json?.id === 'PRJ-0001',
    `${status} ${JSON.stringify(json)}`)
}

// GET /api/:collection/:id  (missing) - the regression: Promise is truthy,
// so `if (!row)` used to never fire and this returned 200 {} instead of 404.
{
  const { status, json } = await call('GET', '/api/loans/LN-9999')
  check('GET a missing id returns 404, not 200 {}',
    status === 404 && !looksLikeLeakedPromise(json),
    `got ${status} ${JSON.stringify(json)}`)
  check('404 body carries an error message', typeof json?.error === 'string', JSON.stringify(json))
}

// POST
{
  const { status, json } = await call('POST', '/api/projects', { name: 'Project 4' })
  check('POST returns 201 with the created row', status === 201 && json?.name === 'Project 4',
    `${status} ${JSON.stringify(json)}`)
}

// PUT  (missing id must 404, not echo a Promise)
{
  const { status, json } = await call('PUT', '/api/projects/PRJ-9999', { name: 'Nope' })
  check('PUT a missing id returns 404', status === 404, `got ${status} ${JSON.stringify(json)}`)
}

// PUT  (found)
{
  const { status, json } = await call('PUT', '/api/projects/PRJ-0001', { name: 'Renamed' })
  check('PUT returns the updated row', status === 200 && json?.name === 'Renamed',
    `${status} ${JSON.stringify(json)}`)
}

// DELETE  (referenced) - PRJ-0001 still has a booking pointing at it
{
  const { status, json } = await call('DELETE', '/api/projects/PRJ-0001')
  check('DELETE of a referenced row returns 409', status === 409, `got ${status} ${JSON.stringify(json)}`)
  check('409 names the blocking dependents',
    /bookings/.test(json?.error || ''), JSON.stringify(json))
  check('409 never leaks a Promise', !looksLikeLeakedPromise(json))
}

// DELETE with cascade (PRJ-0002 has a voucher pointing at it)
{
  const { status, json } = await call('DELETE', '/api/projects/PRJ-0002?cascade=1')
  check('DELETE ?cascade=1 succeeds despite references',
    status === 200 && json?.ok === true, `${status} ${JSON.stringify(json)}`)
  check('cascade really issued the delete', deleted.has('projects:PRJ-0002'), [...deleted].join(','))
  check('cascade detached the dependents',
    requestLog.some((line) => line.startsWith('PATCH /vouchers?projectRef=eq.')),
    'no PATCH to detach vouchers')
}

// DELETE  (missing) - used to false-pass because an unresolved Promise is truthy
{
  const { status, json } = await call('DELETE', '/api/projects/PRJ-0002')
  check('DELETE of an already-removed row returns 404, not a false ok',
    status === 404, `got ${status} ${JSON.stringify(json)}`)
}

// Unknown collection
{
  const { status, json } = await call('GET', '/api/nosuchtable')
  check('Unknown collection returns 404', status === 404, `got ${status}`)
}

// Settings
{
  const get = await call('GET', '/api/settings')
  check('GET /api/settings resolves the theme', get.json?.theme === 'castle', JSON.stringify(get.json))
  const put = await call('PUT', '/api/settings', { theme: 'castle' })
  check('PUT /api/settings awaits the write before reading back',
    put.status === 200 && put.json?.theme === 'castle', `${put.status} ${JSON.stringify(put.json)}`)
}

// --- Summary --------------------------------------------------------------

const passed = results.filter((r) => r.pass).length
const failed = results.length - passed
console.log(`\n=== ${passed} passed, ${failed} failed ===`)

if (failed) {
  console.log('\nFailures:')
  for (const r of results.filter((x) => !x.pass)) console.log(`  - ${r.name}  ${r.detail}`)
  process.exit(1)
}
process.exit(0)