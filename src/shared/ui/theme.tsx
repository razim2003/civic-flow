import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

type Theme = 'light' | 'dark'
const key = 'civicflow-theme'

// Theme is a per-viewer convenience: storage may be unavailable, so every access is guarded.
export function readTheme(): Theme {
  try {
    const saved = window.localStorage.getItem(key)
    if (saved === 'light' || saved === 'dark') return saved
  } catch { /* Storage blocked: fall back to the system preference. */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
export function applyTheme(theme: Theme) { document.documentElement.dataset.theme = theme }

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'))
  useEffect(() => {
    applyTheme(theme)
    try { window.localStorage.setItem(key, theme) } catch { /* Not persisted; the choice still applies to this page. */ }
  }, [theme])
  const next = theme === 'dark' ? 'light' : 'dark'
  return <button type="button" className="icon-button theme-toggle" aria-label={`Switch to ${next} theme`} title={`Switch to ${next} theme`} onClick={() => setTheme(next)}>{theme === 'dark' ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}</button>
}
