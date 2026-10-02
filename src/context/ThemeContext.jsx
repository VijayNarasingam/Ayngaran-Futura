import { createContext, useContext, useEffect } from 'react'

const ThemeContext = createContext(null)

/** Single Castle theme (dark green #071E16 + gold #E8CD82). No switching. */
export function ThemeProvider({ children }) {
  const theme = 'castle'

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme }}>{children}</ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside a ThemeProvider')
  return ctx
}
