/**
 * Guards the DEPLOYED shape of the API, not just the router.
 *
 * Every other driver test calls handleRequest() directly, which means it
 * exercises my route table but completely bypasses Vercel's routing layer.
 * A bug living only in that layer is invisible to them: api/[...path].js
 * matched just ONE segment in this project, so every /api/<collection>/<id>
 * request fell through to Vercel's static handler and returned Vercel's own
 * 404 page. That shipped, and it silently broke Edit and Delete for every
 * record in production while all 64 driver tests stayed green.
 *
 * So this test boots the real thing (`vercel dev`) and asserts that requests
 * actually REACH the app. The distinguishing signal is the body: the app
 * answers with JSON, Vercel's static handler answers with its own HTML/text
 * 404 page.
 */

import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 4399
const BASE = `http://127.0.0.1:${PORT}`

let passed = 0
let failed = 0

function check(name, ok, detail = '') {
  if (ok) {
    passed++
    console.log(`  ok   ${name}`)
  } else {
    failed++
    console.log(`  FAIL ${name}${detail ? `  [${detail}]` : ''}`)
  }
}

/** True when the response body is my app's JSON rather than a Vercel page. */
function reachedApp(text) {
  const t = text.trimStart()
  return t.startsWith('{') || t.startsWith('[')
}

/**
 * A 404 is only acceptable if the APP produced it. Vercel's own 404 mentions
 * NOT_FOUND or "could not be found" and carries a Vercel request id.
 */
function isVercel404(text) {
  return /NOT_FOUND|could not be found|VERCEL/i.test(text)
}

async function waitForServer(child, getBase, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const base = getBase()
    if (base) {
      try {
        const r = await fetch(`${base}/api/state`)
        if (r.status) return base
      } catch {}
    }
    if (child.exitCode !== null) return null
    await new Promise(r => setTimeout(r, 500))
  }
  return null
}

async function probe(base, pathname) {
  const r = await fetch(base + pathname)
  const body = await r.text()
  return { status: r.status, body, mine: reachedApp(body) }
}

console.log('=== deployed routing shape (vercel dev) ===')

// ---- static config assertions: cheap, and catch the regression at commit time
const vercelJson = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'))
const rewrites = vercelJson.rewrites || []
const apiRewrite = rewrites.find(x => x.source === '/api/:path*')

check('vercel.json rewrites /api/:path*', Boolean(apiRewrite), JSON.stringify(rewrites))
check(
  'the /api rewrite points at the single function',
  Boolean(apiRewrite) && apiRewrite.destination === '/api',
  apiRewrite ? apiRewrite.destination : 'missing',
)
check('api/index.js exists', fs.existsSync(path.join(root, 'api', 'index.js')))
check(
  'no api/[...path].js catch-all (it only matched one segment)',
  !fs.existsSync(path.join(root, 'api', '[...path].js')),
)

// The SPA fallback must not swallow /api.
const spaFallback = rewrites.find(x => String(x.destination).includes('index.html'))
check(
  'the SPA fallback excludes /api',
  Boolean(spaFallback) && /api/.test(spaFallback.source),
  spaFallback ? spaFallback.source : 'missing',
)

// ---- live assertions against the real routing layer
//
// Scope note: without a local DATABASE_URL the function short-circuits to its
// misconfiguration response, which is still the APP answering in JSON. That is
// enough here, because the property under test is REACHABILITY, not status
// codes - statuses are already covered by the driver tests against a mocked
// transport. What must never happen is Vercel's own 404 page leaking through.
let child = null
try {
  child = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['vercel', 'dev', '--port', String(PORT), '--yes'],
    { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' },
  )
  child.on('error', () => {})

  // `vercel dev` runs the project's dev command (Vite), so it owns the port and
  // may ignore --port. Take whatever URL it actually reports.
  let reportedBase = null
  const onChunk = buf => {
    const m = String(buf).match(/https?:\/\/(?:localhost|127\.0\.0\.1):(\d+)/)
    if (m) reportedBase = `http://127.0.0.1:${m[1]}`
  }
  child.stdout.on('data', onChunk)
  child.stderr.on('data', onChunk)

  const base = await waitForServer(child, () => reportedBase)
  if (!base) {
    console.log('  SKIP live routing probes - `vercel dev` did not start in this environment')
    console.log('       (the static vercel.json assertions above still ran and are the regression guard)')
  } else {
    console.log(`       probing ${base}`)

    const DEPTH2 = [
      '/api/marketers/MKT-0001',
      '/api/projects/PRJ-0001',
      '/api/bookings/BKG-0001',
      '/api/loans/LN-0001',
      '/api/vouchers/VC-0001',
      '/api/vouchers/site/road',
    ]

    for (const p of ['/api/state', '/api/marketers', ...DEPTH2]) {
      const r = await probe(base, p)
      check(
        `GET ${p} reaches the app`,
        r.mine && !isVercel404(r.body),
        isVercel404(r.body) ? `VERCEL 404 LEAKED: ${r.body.trim().slice(0, 50)}` : r.body.slice(0, 60),
      )
    }

    // The failure mode we shipped: an unknown collection must still come from
    // the app. If this returns Vercel's page, routing is broken again.
    const unknownColl = await probe(base, '/api/nope')
    check(
      'unknown collection is answered by the app, never Vercel',
      unknownColl.mine && !isVercel404(unknownColl.body),
      `status=${unknownColl.status} vercelPage=${isVercel404(unknownColl.body)}`,
    )
  }
} finally {
  if (child) {
    child.kill()
    await Promise.race([once(child, 'exit'), new Promise(r => setTimeout(r, 3000))])
  }
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exitCode = 1