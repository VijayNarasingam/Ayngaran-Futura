import { registerApiRoutes } from './routes/api.js'
import { DB_PATH, closeDatabase } from './db/index.js'

/**
 * Framework-free application core, shared by the standalone Node server
 * (server/index.js) and the Vercel serverless function (api/[...path].js).
 * Both supply Node-style req/res objects; this module does the rest.
 */

const MAX_BODY = 5 * 1024 * 1024
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || ''

/** Error carrying an HTTP status, so handlers can fail cleanly with 4xx. */
export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export const sendJson = (res, status, data) => {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

/**
 * Buffers the request body and parses it as JSON.
 * Rejects on malformed JSON or an oversized payload - it must never fall back
 * to `{}`, or a garbage request would silently insert a blank record.
 */
const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    let settled = false
    const fail = (status, message) => {
      if (settled) return
      settled = true
      reject(new HttpError(status, message))
    }

    req.on('data', (chunk) => {
      if (settled) return
      size += chunk.length
      if (size > MAX_BODY) {
        fail(413, 'Request body too large')
        if (typeof req.destroy === 'function') req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (settled) return
      const raw = Buffer.concat(chunks).toString('utf8')
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
  patch(path, handler) { this.routes.push({ method: 'PATCH', path, handler }) },
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

const applyCors = (res) => {
  // Open CORS is only safe for a trusted localhost deployment. Set CORS_ORIGIN
  // to an exact origin before exposing the API anywhere else.
  const origin = ALLOWED_ORIGIN || '*'
  res.setHeader('access-control-allow-origin', origin)
  res.setHeader('vary', 'origin')
  res.setHeader('access-control-allow-methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  res.setHeader('access-control-allow-headers', 'content-type')
}

/**
 * Handles one request end to end and resolves once the response is sent.
 * Vercel awaits this; the standalone server ignores the promise.
 */
export const handleRequest = async (req, res) => {
  applyCors(res)

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  // Vercel provides the path via req.url; strip any /api prefix the rewrite
  // may have left so /api/api/... never happens.
  const url = new URL(req.url || '/', 'http://localhost')
  let pathname = url.pathname
  if (pathname.startsWith('/api/api/')) pathname = pathname.slice(4)

  const found = matchRoute(req.method, pathname)
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
  if (!['GET', 'HEAD', 'DELETE'].includes(req.method)) {
    // Vercel pre-parses JSON bodies; a plain http server does not.
    if (req.body && typeof req.body === 'object') {
      body = req.body
    } else if (typeof req.body === 'string' && req.body.trim()) {
      try {
        body = JSON.parse(req.body)
      } catch {
        sendJson(res, 400, { error: 'Request body is not valid JSON' })
        return
      }
    } else {
      try {
        body = await readBody(req)
      } catch (error) {
        sendJson(res, error.status || 400, { error: error.message || 'Bad request' })
        return
      }
    }
  }

  const facadeReq = {
    method: req.method,
    params: found.params,
    body,
    query: Object.fromEntries(url.searchParams),
  }

  try {
    await found.route.handler(facadeReq, facadeRes)
  } catch (error) {
    if (error && typeof error.status === 'number') {
      sendJson(res, error.status, { error: error.message })
      return
    }
    console.error('[server]', error)
    sendJson(res, 500, { error: 'Internal server error' })
  }
}

export { DB_PATH, closeDatabase }
export { app }
export { DRIVER } from './db/index.js'