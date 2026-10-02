import { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import {
  buildSeedState,
  clearState,
  loadState,
  nextId,
  saveState,
  STORAGE_KEY,
  storeReducer,
} from '../lib/storeReducer.js'

const StoreContext = createContext(null)

/**
 * Single source of truth for the dashboard data.
 * Every mutation flows through the pure reducer in lib/storeReducer.js and the
 * whole state is mirrored into localStorage so nothing is lost on refresh.
 */
export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(storeReducer, undefined, loadState)

  useEffect(() => {
    saveState(state)
  }, [state])

  const value = useMemo(() => {
    return {
      data: state,
      settings: state.settings,
      records: (collection) => state[collection] || [],
      find: (collection, id) => (state[collection] || []).find((record) => record.id === id) || null,
      add: (collection, values) => {
        const record = { ...values, id: values.id || nextId(state, collection) }
        dispatch({ type: 'add', collection, values: record })
        return record
      },
      update: (collection, id, values) => dispatch({ type: 'update', collection, id, values }),
      remove: (collection, id) => dispatch({ type: 'remove', collection, id }),
      setSetting: (values) => dispatch({ type: 'settings', values }),
      exportData: () => JSON.stringify(state, null, 2),
      importData: (payload) => dispatch({ type: 'import', state: payload }),
      reset: () => {
        clearState()
        dispatch({ type: 'reset' })
        return buildSeedState()
      },
    }
  }, [state])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside a StoreProvider')
  return ctx
}

export { STORAGE_KEY }
