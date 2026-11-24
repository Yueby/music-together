import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

const PRELOAD_RELOAD_KEY = 'mt:vite-preload-reload-at'
const PRELOAD_RELOAD_COOLDOWN_MS = 10_000

// Recover smoothly if a lazy route chunk hash disappeared after a fresh deployment.
window.addEventListener('vite:preloadError', (event) => {
  try {
    const last = Number(window.sessionStorage.getItem(PRELOAD_RELOAD_KEY) ?? '0')
    const now = Date.now()
    if (Number.isFinite(last) && now - last < PRELOAD_RELOAD_COOLDOWN_MS) return
    window.sessionStorage.setItem(PRELOAD_RELOAD_KEY, String(now))
  } catch {
    // sessionStorage may be unavailable in restricted contexts; still attempt recovery once.
  }
  event.preventDefault()
  window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
