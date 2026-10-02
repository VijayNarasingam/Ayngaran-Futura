import { registerApiRoutes } from './routes/api.js'
import { DB_PATH } from './db/database.js'

/**
 * Ayngaran Futura - SQL API server (zero dependencies, Node 22+).
 * Uses node:sqlite -> server/ayngaran-futura.sqlite (or $SQLITE_PATH).
 * Frontend calls /api/* (proxied by Vite in dev, same-origin in production).
 */
const PORT = Number(process.env.PORT || 8080)

const sendJson = (res, status, data) => {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

const readBody = (req) =>
  new Promise((resolve) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 5 * 1024 * 1024) req.destroy()
    })
    req.on('end', () => {
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch {
        resolve({})
      }
    })
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
  res.setHeader('access-control-allow-origin', '*')
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
  const body = req.method === 'GET' || req.method === 'DELETE' ? {} : await readBody(req)
  const facadeReq = { params: found.params, body, query: Object.fromEntries(url.searchParams) }
  const facadeRes = {
    status(code) { this.statusCode = code; return this },
    json(data) { sendJson(res, this.statusCode || 200, data) },
  }
  try {
    await found.route.handler(facadeReq, facadeRes)
  } catch (error) {
    console.error('[server]', error)
    sendJson(res, 500, { error: 'Internal server error' })
  }
})

server.listen(PORT, () => {
  console.log(`[Ayngaran Futura] SQL API on http://localhost:${PORT} (db: ${DB_PATH})`)
})
