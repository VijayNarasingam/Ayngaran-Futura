import { COLLECTION_TABLES, TABLE_COLUMNS } from '../db/schema.js'
import {
  deleteRow,
  findById,
  insertRow,
  listAll,
  updateRow,
  getSetting,
  setSetting,
} from '../db/index.js'

// Returns the promise so callers can await the handler. Without this,
// handleRequest() resolves as soon as the handler is *invoked* rather than
// when it has finished writing the response.
const asyncHandler = (fn) => (req, res) =>
  Promise.resolve(fn(req, res)).catch((error) => {
    // ValidationError carries a 4xx status; let it through as-is.
    if (error && typeof error.status === 'number') {
      res.status(error.status).json({ error: error.message })
      return
    }
    console.error('[api]', error)
    res.status(500).json({ error: 'Internal server error' })
  })

const checkTable = (req, res) => {
  const { collection } = req.params
  if (!COLLECTION_TABLES.includes(collection) || !TABLE_COLUMNS[collection]) {
    res.status(404).json({ error: `Unknown collection: ${collection}` })
    return null
  }
  return collection
}

export const registerApiRoutes = (app) => {
  // Every driver call is awaited. The SQLite driver resolves synchronously,
  // but the Neon driver is genuinely async - without `await` a Promise would
  // be handed to res.json() and serialise to `{}` with a 200.
  app.get('/api/state', asyncHandler(async (req, res) => {
    // Fetch collections in parallel rather than one round-trip at a time.
    const collections = await Promise.all(COLLECTION_TABLES.map((table) => listAll(table)))
    const state = {
      meta: { app: 'Ayngaran Futura', version: '1.0.0', updatedAt: new Date().toISOString() },
      settings: { theme: (await getSetting('theme')) || 'castle' },
    }
    COLLECTION_TABLES.forEach((table, index) => { state[table] = collections[index] })
    res.json(state)
  }))

  app.get('/api/settings', asyncHandler(async (req, res) => {
    res.json({ theme: (await getSetting('theme')) || 'castle' })
  }))

  app.put('/api/settings', asyncHandler(async (req, res) => {
    const body = req.body || {}
    // Must complete before reading back, or the response races the write.
    if (body.theme !== undefined) await setSetting('theme', body.theme)
    res.json({ theme: (await getSetting('theme')) || 'castle' })
  }))

  app.get('/api/:collection', asyncHandler(async (req, res) => {
    const table = checkTable(req, res)
    if (!table) return
    res.json(await listAll(table))
  }))

  app.get('/api/:collection/:id', asyncHandler(async (req, res) => {
    const table = checkTable(req, res)
    if (!table) return
    const row = await findById(table, req.params.id)
    if (!row) return res.status(404).json({ error: 'Not found' })
    res.json(row)
  }))

  app.post('/api/:collection', asyncHandler(async (req, res) => {
    const table = checkTable(req, res)
    if (!table) return
    res.status(201).json(await insertRow(table, req.body || {}))
  }))

  app.put('/api/:collection/:id', asyncHandler(async (req, res) => {
    const table = checkTable(req, res)
    if (!table) return
    const row = await updateRow(table, req.params.id, req.body || {})
    if (!row) return res.status(404).json({ error: 'Not found' })
    res.json(row)
  }))

  app.delete('/api/:collection/:id', asyncHandler(async (req, res) => {
    const table = checkTable(req, res)
    if (!table) return
    // ?cascade=1 detaches dependent records instead of refusing the delete.
    const cascade = req.query.cascade === '1' || req.query.cascade === 'true'
    const deleted = await deleteRow(table, req.params.id, { cascade })
    if (!deleted) return res.status(404).json({ error: 'Not found' })
    res.json({ ok: true, id: req.params.id })
  }))
}
