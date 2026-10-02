import { COLLECTION_TABLES, TABLE_COLUMNS } from '../db/schema.js'
import { deleteRow, findById, insertRow, listAll, updateRow, getSetting, setSetting } from '../db/database.js'

const asyncHandler = (fn) => (req, res) => {
  Promise.resolve(fn(req, res)).catch((error) => {
    console.error('[api]', error)
    res.status(500).json({ error: 'Internal server error' })
  })
}

const checkTable = (req, res) => {
  const { collection } = req.params
  if (!COLLECTION_TABLES.includes(collection) || !TABLE_COLUMNS[collection]) {
    res.status(404).json({ error: `Unknown collection: ${collection}` })
    return null
  }
  return collection
}

export const registerApiRoutes = (app) => {
  // Whole dashboard state in one call (keeps selectors/store shape unchanged).
  app.get('/api/state', asyncHandler(async (req, res) => {
    const state = {
      meta: { app: 'Ayngaran Futura', version: '1.0.0', updatedAt: new Date().toISOString() },
      settings: { theme: getSetting('theme') || 'castle' },
    }
    for (const table of COLLECTION_TABLES) state[table] = listAll(table)
    res.json(state)
  }))

  app.get('/api/settings', asyncHandler(async (req, res) => {
    res.json({ theme: getSetting('theme') || 'castle' })
  }))

  app.put('/api/settings', asyncHandler(async (req, res) => {
    const body = req.body || {}
    if (body.theme !== undefined) setSetting('theme', body.theme)
    res.json({ theme: getSetting('theme') || 'castle' })
  }))

  app.get('/api/:collection', asyncHandler(async (req, res) => {
    const table = checkTable(req, res)
    if (!table) return
    res.json(listAll(table))
  }))

  app.get('/api/:collection/:id', asyncHandler(async (req, res) => {
    const table = checkTable(req, res)
    if (!table) return
    const row = findById(table, req.params.id)
    if (!row) return res.status(404).json({ error: 'Not found' })
    res.json(row)
  }))

  app.post('/api/:collection', asyncHandler(async (req, res) => {
    const table = checkTable(req, res)
    if (!table) return
    res.status(201).json(insertRow(table, req.body || {}))
  }))

  app.put('/api/:collection/:id', asyncHandler(async (req, res) => {
    const table = checkTable(req, res)
    if (!table) return
    const row = updateRow(table, req.params.id, req.body || {})
    if (!row) return res.status(404).json({ error: 'Not found' })
    res.json(row)
  }))

  app.delete('/api/:collection/:id', asyncHandler(async (req, res) => {
    const table = checkTable(req, res)
    if (!table) return
    if (!deleteRow(table, req.params.id)) return res.status(404).json({ error: 'Not found' })
    res.json({ ok: true, id: req.params.id })
  }))
}
