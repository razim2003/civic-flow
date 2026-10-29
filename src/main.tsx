import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { applyTheme, readTheme } from './shared/ui/theme'

applyTheme(readTheme())

const root = document.getElementById('root')
if (!root) throw new Error('Missing application root')
const appRoot = createRoot(root)
void import('./app/App').then(({ App }) => {
  appRoot.render(<StrictMode><App /></StrictMode>)
}).catch(() => {
  appRoot.render(<main className="not-found"><h1>CivicFlow could not start.</h1><p>Check your connection or contact the project administrator.</p></main>)
})
