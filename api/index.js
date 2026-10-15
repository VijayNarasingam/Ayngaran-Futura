/**
 * Vercel serverless function for the Ayngaran Futura SQL API.
 *
 * Routing: this is a single catch-all function at /api, and vercel.json
 * rewrites every /api/* request to it. It used to be api/[...path].js, but in
 * this project configuration that only matched ONE segment - so
 * /api/<collection>/<id> fell through to Vercel's static handler and returned
 * its own 404 page. That silently broke GET/PUT/DELETE by id, i.e. editing and
 * deleting any record. The explicit rewrite below matches any depth.
 *
 * It reuses the exact same route table as the standalone server
 * (server/index.js), so behaviour is identical - the only difference is that
 * storage comes from Postgres, because a serverless instance has no persistent
 * disk for SQLite.
 *
 * Reads DATABASE_URL from the Vercel environment.
 */

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
        'Storage is not configured. Set DATABASE_URL in the Vercel project environment variables.',
      hint:
        'Use the Postgres connection string (postgresql://...). See .env.example, and run `npm run db:setup` against the database first.',
    }),
  )
}

export default async function handler(req, res) {
  if (!process.env.DATABASE_URL) {
    return misconfigured(res)
  }
  // Imported lazily so the app (and therefore the driver selection) is only
  // loaded once DATABASE_URL is confirmed present.
  const { handleRequest } = await import('../server/app.js')
  await handleRequest(req, res)
}