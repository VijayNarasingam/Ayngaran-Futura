import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { fetchState, createRecord, updateRecord, deleteRecord } from '../lib/api.js'
import { buildSeedState } from '../lib/storeReducer.js'

const StoreContext = createContext(null)

/**
 * Single source of truth - now backed by the SQL database via /api/*.
 * Loads once from SQLite, then every add/update/remove hits the API and
 * refreshes local state from the returned row (no localStorage).
 */
export function StoreProvider({ children }) {
  const [state, setState] = useState(() => buildSeedState())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const next = await fetchState()
      setState(next)
    } catch (err) {
      setError(err.message || 'Could not reach the SQL server. Run `npm run server`.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const add = useCallback(async (collection, values) => {
    const record = await createRecord(collection, values)
    setState((current) => ({
      ...current,
      [collection]: [...(current[collection] || []), record],
    }))
    return record
  }, [])

  const update = useCallback(async (collection, id, values) => {
    const record = await updateRecord(collection, id, values)
    setState((current) => ({
      ...current,
      [collection]: (current[collection] || []).map((row) => (row.id === id ? record : row)),
    }))
    return record
  }, [])

  const remove = useCallback(async (collection, id) => {
    await deleteRecord(collection, id)
    setState((current) => ({
      ...current,
      [collection]: (current[collection] || []).filter((row) => row.id !== id),
    }))
  }, [])

  const value = useMemo(() => {
    return {
      data: state,
      settings: state.settings,
      loading,
      error,
      reload,
      records: (collection) => state[collection] || [],
      find: (collection, id) => (state[collection] || []).find((record) => record.id === id) || null,
      add,
      update,
      remove,
      setSetting: () => {},
      exportData: () => JSON.stringify(state, null, 2),
      importData: () => reload(),
      reset: () => reload(),
    }
  }, [state, loading, error, reload, add, update, remove])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside a StoreProvider')
  return ctx
}

export { STORAGE_KEY } from '../lib/storeReducer.js'

