/**
 * Applies server/db/neon-schema.sql to the database in DATABASE_URL.
 *
 * Each statement is sent on its own, because the Neon HTTPS driver executes one
 * query per request - so the file's BEGIN/COMMIT wrapper is dropped and every
 * statement runs in its own implicit transaction. DDL in Postgres is
 * transactional per statement, so this is equivalent.
 *
 * Idempotent: the schema uses CREATE TABLE IF NOT EXISTS, so re-running it is
 * safe and will not drop or duplicate anything.
 *
 * Usage:
 *   npm run db:setup
 *   npm run db:setup -- --dry-run     # print the statements, touch nothing
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile()
  } catch {
    /* no .env file - rely on the real environment */
  }
}

const here = path.dirname(fileURLToPath(import.meta.url))
const SCHEMA_FILE = path.join(here, 'db', 'neon-schema.sql')

const dryRun = process.argv.includes('--dry-run')

/**
 * Splits a SQL file into individual statements: strips `--` line comments,
 * then splits on `;`. This schema only uses double-quoted identifiers (never
 * single-quoted strings containing a semicolon), so a plain split is safe.
 */
export const splitStatements = (sql) =>
  sql
    .split('\n')
    .filter((line) => !/^\s*--/.test(line))
    .join('\n')
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean)

// BEGIN/COMMIT cannot span separate HTTP queries, and each statement already
// runs in its own implicit transaction.
const TRANSACTION_CONTROL = /^(BEGIN|COMMIT|ROLLBACK|START\s+TRANSACTION)\b/i

const statements = splitStatements(readFileSync(SCHEMA_FILE, 'utf8')).filter(
  (statement) => !TRANSACTION_CONTROL.test(statement),
)

console.log(`${SCHEMA_FILE}`)
console.log(`${statements.length} statements${dryRun ? ' (dry run)' : ''}\n`)

if (dryRun) {
  statements.forEach((statement, i) => {
    const head = statement.split('\n')[0].slice(0, 74)
    console.log(`  ${String(i + 1).padStart(2)}. ${head}`)
  })
  process.exit(0)
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set.\nCopy .env.example to .env and fill it in, or export it.')
  process.exit(1)
}

const { neon } = await import('@neondatabase/serverless')
const sql = neon(process.env.DATABASE_URL)

let applied = 0
for (const [index, statement] of statements.entries()) {
  const head = statement.split('\n')[0].slice(0, 74)
  try {
    await sql.query(statement, [])
    applied += 1
    console.log(`  ok   ${String(index + 1).padStart(2)}. ${head}`)
  } catch (error) {
    console.error(`  FAIL ${String(index + 1).padStart(2)}. ${head}`)
    console.error(`       ${error.code || ''} ${error.message}`.trim())
    process.exit(1)
  }
}

console.log(`\nApplied ${applied}/${statements.length} statements.`)

// The HTTPS driver is also used by PostgREST, which caches its schema view.
console.log('Reloading PostgREST schema cache...')
try {
  await sql.query("NOTIFY pgrst, 'reload schema'", [])
} catch {
  console.log('  (skipped - only relevant if you also use the REST API)')
}

const { listAll, DB_PATH, DRIVER } = await import('./db/index.js')
const tables = ['marketers', 'projects', 'bookings', 'loans', 'vouchers']
console.log(`\nConnected via ${DRIVER}: ${DB_PATH}`)
for (const table of tables) {
  const rows = await listAll(table)
  console.log(`  ${table.padEnd(10)} ${rows.length} row(s)`)
}

console.log('\nSchema is ready. Load the demo data with:  npm run db:seed')
process.exit(0)