/**
 * Storage driver selection, in precedence order:
 *
 *   1. postgres  - DATABASE_URL is set. Real Postgres over HTTPS. This is what
 *                  Vercel uses, because a serverless instance has no persistent
 *                  disk. See ./postgres.js.
 *   2. neon      - NEON_REST_URL + NEON_API_KEY are set. Neon's PostgREST REST
 *                  API, kept as a fallback for environments without the driver
 *                  dependency. See ./neon.js.
 *   3. sqlite    - neither is set. The local file in ./database.js, used by
 *                  `npm run server` in development.
 *
 * All three expose an identical async interface, so routes never know which one
 * they are talking to. The SQLite driver resolves immediately, so call sites
 * behave the same either way.
 */

const usePostgres = Boolean(process.env.DATABASE_URL)
const useNeonRest = !usePostgres && Boolean(process.env.NEON_REST_URL && process.env.NEON_API_KEY)

const driver = usePostgres
  ? await import('./postgres.js')
  : useNeonRest
    ? await import('./neon.js')
    : await import('./database.js')

export const DRIVER = usePostgres ? 'postgres' : useNeonRest ? 'neon-rest' : 'sqlite'

export const listAll = (...args) => driver.listAll(...args)
export const findById = (...args) => driver.findById(...args)
export const countRows = (...args) => driver.countRows(...args)
export const nextId = (...args) => driver.nextId(...args)
export const insertRow = (...args) => driver.insertRow(...args)
export const updateRow = (...args) => driver.updateRow(...args)
export const deleteRow = (...args) => driver.deleteRow(...args)
export const findReferences = (...args) => driver.findReferences(...args)
export const getSetting = (...args) => driver.getSetting(...args)
export const setSetting = (...args) => driver.setSetting(...args)
export const closeDatabase = (...args) => (driver.closeDatabase || (() => {}))(...args)

export const DB_PATH = driver.DB_PATH
export const ValidationError = driver.ValidationError