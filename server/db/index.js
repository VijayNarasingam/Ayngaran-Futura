/**
 * Storage driver selection.
 *
 * Local development and a self-hosted `npm run server` use the SQLite file in
 * ./database.js. Vercel (or any host without a persistent disk) uses Neon over
 * its PostgREST REST API in ./neon.js - selected by the presence of
 * NEON_REST_URL. Both expose an identical async interface, so routes never
 * know which one they are talking to.
 *
 * Every function below is async. The SQLite driver resolves immediately, so
 * call sites behave the same either way.
 */

const useNeon = Boolean(process.env.NEON_REST_URL && process.env.NEON_API_KEY)

const driver = useNeon ? await import('./neon.js') : await import('./database.js')

export const DRIVER = useNeon ? 'neon' : 'sqlite'

export const listAll = (...args) => driver.listAll(...args)
export const findById = (...args) => driver.findById(...args)
export const insertRow = (...args) => driver.insertRow(...args)
export const updateRow = (...args) => driver.updateRow(...args)
export const deleteRow = (...args) => driver.deleteRow(...args)
export const findReferences = (...args) => driver.findReferences(...args)
export const getSetting = (...args) => driver.getSetting(...args)
export const setSetting = (...args) => driver.setSetting(...args)
export const closeDatabase = (...args) => (driver.closeDatabase || (() => {}))(...args)

export const DB_PATH = driver.DB_PATH
export const ValidationError = driver.ValidationError