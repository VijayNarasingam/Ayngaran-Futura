import http from 'node:http'
import { DB_PATH, DRIVER, closeDatabase, handleRequest } from './app.js'

/**
 * Ayngaran Futura - standalone SQL API server (zero dependencies, Node 22+).
 * Storage driver is chosen automatically: Neon when NEON_REST_URL is set,
 * otherwise the local SQLite file in server/ayngaran-futura.sqlite (or $SQLITE_PATH).
 * Frontend calls /api/* (proxied by Vite in dev, same-origin in production).
 */
const PORT = Number(process.env.PORT || 8080)

const server = http.createServer((req, res) => {
  handleRequest(req, res)
})

server.listen(PORT, () => {
  console.log(`[Ayngaran Futura] SQL API on http://localhost:${PORT} (${DRIVER}: ${DB_PATH})`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => {
      closeDatabase()
      process.exit(0)
    })
  })
}