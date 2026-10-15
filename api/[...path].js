/**
 * Vercel serverless function for the Ayngaran Futura SQL API.
 *
 * Vercel maps every /api/* request to this file. It reuses the exact same
 * route table as the standalone server (server/index.js), so behaviour is
 * identical - the only difference is that storage comes from Neon, because a
 * serverless instance has no persistent disk for SQLite.
 *
 * Reads NEON_REST_URL and NEON_API_KEY from the Vercel environment.
 */

import { handleRequest } from '../server/app.js'

/**
 * On Vercel there is no persistent disk, so silently falling back to SQLite
 * would accept writes and then throw them away on the next cold start. Fail
 * loudly instead, with instructions.
 */
function misconfigured(res) {
  res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' })
  res.end(
    JSON.stringify({
      error:
        'Storage is not configured. Set NEON_REST_URL and NEON_API_KEY in the Vercel project environment variables.',
      hint: 'See .env.example, and run server/db/neon-schema.sql against your Neon database.',
    }),
  )
}

export default async function handler(req, res) {
  if (!process.env.NEON_REST_URL || !process.env.NEON_API_KEY) {
    return misconfigured(res)
  }
  await handleRequest(req, res)
}

// Serverless instances are short-lived; keep the bundle lean.
export const config = {
  maxDuration: 30,
}