/**
 * Seeds Postgres with the demo records from src/data/seed.js.
 * Safe to re-run: tables that already hold rows are skipped.
 *
 * Requires DATABASE_URL in the environment (.env is loaded automatically).
 */

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile()
  } catch {
    /* no .env file - rely on the real environment */
  }
}

if (!process.env.DATABASE_URL) {
  console.error(
    'DATABASE_URL must be set.\n' +
      'Copy .env.example to .env and fill it in, or export it before running.\n' +
      'DATABASE_URL is the Postgres connection string, e.g.\n' +
      '  postgresql://user:password@ep-xxx-pooler.<region>.aws.neon.tech/neondb?sslmode=require',
  )
  process.exit(1)
}

const { seedIfEmpty, countRows, listAll, DB_PATH, DRIVER } = await import('./db/index.js')
const { SEED_BOOKINGS, SEED_LOANS, SEED_MARKETERS, SEED_PROJECTS, SEED_VOUCHERS } =
  await import('../src/data/seed.js')

if (DRIVER !== 'postgres') {
  console.error(
    `This script seeds Postgres, but the Postgres driver is not active (driver=${DRIVER}). ` +
      'Check DATABASE_URL.',
  )
  process.exit(1)
}

const seeds = {
  marketers: SEED_MARKETERS,
  projects: SEED_PROJECTS,
  bookings: SEED_BOOKINGS,
  loans: SEED_LOANS,
  vouchers: SEED_VOUCHERS,
}

console.log(`Seeding ${DB_PATH}`)
const inserted = await seedIfEmpty(seeds)

let total = 0
for (const table of Object.keys(seeds)) {
  const existing = await countRows(table)
  total += existing
  console.log(
    `  ${table.padEnd(10)} ${inserted[table] === 0 ? 'already had rows - skipped' : `inserted ${inserted[table] ?? 0}`}` +
      ` (now ${existing})`,
  )
}

if (total === 0) {
  console.warn('\nNo rows in any table - did you run server/db/neon-schema.sql first?')
}

const projects = await listAll('projects')
console.log(`\nDone. ${total} rows total. Projects: ${projects.map((p) => p.name).join(', ') || 'none'}`)
process.exit(0)