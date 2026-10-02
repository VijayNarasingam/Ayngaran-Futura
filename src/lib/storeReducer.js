import { APP, COLLECTIONS, ID_PREFIX } from '../data/reference.js'
import {
  SEED_BOOKINGS,
  SEED_LOANS,
  SEED_MARKETERS,
  SEED_PROJECTS,
  SEED_VOUCHERS,
} from '../data/seed.js'

export const STORAGE_KEY = APP.storageKey

const now = () => new Date().toISOString()

/** Fresh state seeded with the starter records (including Project 1/2/3). */
export const buildSeedState = () => ({
  meta: { app: APP.name, version: APP.version, createdAt: now(), updatedAt: now() },
  settings: { theme: 'castle' },
  marketers: SEED_MARKETERS,
  projects: SEED_PROJECTS,
  bookings: SEED_BOOKINGS,
  loans: SEED_LOANS,
  vouchers: SEED_VOUCHERS,
})

/** Guards against old/partial payloads coming from localStorage or a backup file. */
export const normalizeState = (raw) => {
  const base = { ...buildSeedState(), ...(raw && typeof raw === 'object' ? raw : {}) }
  const clean = {
    meta: { ...buildSeedState().meta, ...(base.meta || {}), updatedAt: now() },
    settings: { theme: 'castle', ...(base.settings || {}), theme: 'castle' },
  }
  COLLECTIONS.forEach((collection) => {
    clean[collection] = Array.isArray(base[collection]) ? base[collection] : []
  })
  return clean
}

/** Next sequential id for a collection, e.g. MKT-0004 / BKG-0006 / VC-0021. */
export const nextId = (state, collection) => {
  const prefix = ID_PREFIX[collection] || 'REC'
  const highest = (state[collection] || []).reduce((max, record) => {
    const match = /(\d+)\s*$/.exec(String(record.id || ''))
    return match ? Math.max(max, parseInt(match[1], 10)) : max
  }, 0)
  return `${prefix}-${String(highest + 1).padStart(4, '0')}`
}

const withStamp = (record, createdAt) => ({
  ...record,
  createdAt: createdAt || now(),
  updatedAt: now(),
})

/** Pure reducer - every mutation returns a new state object. */
export const storeReducer = (state, action) => {
  switch (action.type) {
    case 'add': {
      const { collection, values } = action
      const record = withStamp({ ...values, id: values.id || nextId(state, collection) })
      return {
        ...state,
        meta: { ...state.meta, updatedAt: now() },
        [collection]: [...state[collection], record],
      }
    }
    case 'update': {
      const { collection, id, values } = action
      return {
        ...state,
        meta: { ...state.meta, updatedAt: now() },
        [collection]: state[collection].map((record) =>
          record.id === id ? withStamp({ ...record, ...values }, record.createdAt) : record,
        ),
      }
    }
    case 'remove': {
      const { collection, id } = action
      return {
        ...state,
        meta: { ...state.meta, updatedAt: now() },
        [collection]: state[collection].filter((record) => record.id !== id),
      }
    }
    case 'settings':
      return { ...state, settings: { ...state.settings, ...action.values } }
    case 'import':
      return normalizeState(action.state)
    case 'reset':
      return buildSeedState()
    default:
      return state
  }
}

/** Reads the persisted payload; falls back to seed data (SSR/node safe). */
export const loadState = () => {
  if (typeof window === 'undefined' || !window.localStorage) return buildSeedState()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? normalizeState(JSON.parse(raw)) : buildSeedState()
  } catch (error) {
    console.warn('[Ayngaran Futura] Could not read saved data, starting fresh.', error)
    return buildSeedState()
  }
}

export const saveState = (state) => {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (error) {
    console.warn('[Ayngaran Futura] Could not save data.', error)
  }
}

export const clearState = () => {
  if (typeof window === 'undefined' || !window.localStorage) return
  window.localStorage.removeItem(STORAGE_KEY)
}
