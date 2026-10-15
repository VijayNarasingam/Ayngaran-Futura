import { registerApiRoutes } from './routes/api.js'
import { DB_PATH, closeDatabase } from './db/database.js'

/**
 * Ayngaran Futura - SQL API server (zero dependencies, Node 22+).
 * Uses node:sqlite -> server/ayngaran-futura.sqlite (or $SQLITE_PATH).
 * Frontend calls /api/* (proxied by Vite in dev, same-origin in production).
 */
const PORT = Number(process.env.PORT || 8080)
const MAX_BODY = 5 * 1024 * 1024
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || ''

const sendJson = (res, status, data) => {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

/** Error carrying an HTTP status, so route handlers can fail cleanly. */
export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

/**
 * Buffers the request body and parses it as JSON.
 * Rejects on malformed JSON or an oversized payload - it must never fall back
 * to `{}`, or a garbage request would silently insert a blank record.
 */
const readBody = (req) =>
  new Promise((resolve, reject) => {
    let raw = ''
    let settled = false
    const fail = (status, message) => {
      if (settled) return
      settled = true
      reject(new HttpError(status, message))
    }

    req.on('data', (chunk) => {
      if (settled) return
      raw += chunk
      if (raw.length > MAX_BODY) {
        fail(413, 'Request body too large')
        req.destroy()
      }
    })
    req.on('end', () => {
      if (settled) return
      if (!raw.trim()) return fail(400, 'Request body is empty')
      try {
        const parsed = JSON.parse(raw)
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          return fail(400, 'Request body must be a JSON object')
        }
        settled = true
        resolve(parsed)
      } catch {
        fail(400, 'Request body is not valid JSON')
      }
    })
    req.on('error', () => fail(400, 'Could not read request body'))
  })

// Minimal express-like facade so routes stay framework-free.
const app = {
  routes: [],
  get(path, handler) { this.routes.push({ method: 'GET', path, handler }) },
  post(path, handler) { this.routes.push({ method: 'POST', path, handler }) },
  put(path, handler) { this.routes.push({ method: 'PUT', path, handler }) },
  delete(path, handler) { this.routes.push({ method: 'DELETE', path, handler }) },
}

registerApiRoutes(app)

const matchRoute = (method, pathname) => {
  for (const route of app.routes) {
    if (route.method !== method) continue
    const pattern = route.path.replace(/:[^/]+/g, '([^/]+)')
    const match = new RegExp(`^${pattern}$`).exec(pathname)
    if (!match) continue
    const names = [...route.path.matchAll(/:([^/]+)/g)].map((m) => m[1])
    const params = {}
    names.forEach((name, i) => { params[name] = decodeURIComponent(match[i + 1]) })
    return { route, params }
  }
  return null
}

import http from 'node:http'

const server = http.createServer(async (req, res) => {
  // Open CORS is only safe for a trusted localhost deployment. Set CORS_ORIGIN
  // to an exact origin before exposing the API anywhere else.
  res.setHeader('access-control-allow-origin', ALLOWED_ORIGIN || '*')
  res.setHeader('vary', 'origin')
  res.setHeader('access-control-allow-methods', 'GET,POST,PUT,DELETE,OPTIONS')
  res.setHeader('access-control-allow-headers', 'content-type')
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }
  const url = new URL(req.url || '/', 'http://localhost')
  const found = matchRoute(req.method, url.pathname)
  if (!found) {
    sendJson(res, 404, { error: 'Not found' })
    return
  }

  const facadeRes = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this },
    json(data) { sendJson(res, this.statusCode || 200, data) },
  }

  let body = {}
  if (req.method !== 'GET' && req.method !== 'DELETE') {
    try {
      body = await readBody(req)
    } catch (error) {
      sendJson(res, error.status || 400, { error: error.message || 'Bad request' })
      return
    }
  }

  const facadeReq = { params: found.params, body, query: Object.fromEntries(url.searchParams) }
  try {
    await found.route.handler(facadeReq, facadeRes)
  } catch (error) {
    if (error instanceof HttpError) {
      sendJson(res, error.status, { error: error.message })
      return
    }
    console.error('[server]', error)
    sendJson(res, 500, { error: 'Internal server error' })
  }
})

server.listen(PORT, () => {
  console.log(`[Ayngaran Futura] SQL API on http://localhost:${PORT} (db: ${DB_PATH})`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => {
      closeDatabase()
      process.exit(0)
    })
  })
}
