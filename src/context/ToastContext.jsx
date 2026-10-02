import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

const ToastContext = createContext(null)

/** Small toast stack used for save / delete / import feedback. */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const seq = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const push = useCallback(
    (message, tone = 'info') => {
      seq.current += 1
      const id = seq.current
      setToasts((current) => [...current, { id, message, tone }])
      window.setTimeout(() => dismiss(id), 3400)
    },
    [dismiss],
  )

  const value = useMemo(
    () => ({
      push,
      success: (message) => push(message, 'ok'),
      error: (message) => push(message, 'danger'),
      info: (message) => push(message, 'info'),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.tone}`}>
            <i
              className={`bi ${
                toast.tone === 'danger' ? 'bi-exclamation-octagon' : 'bi-check-circle'
              }`}
            />
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside a ToastProvider')
  return ctx
}
