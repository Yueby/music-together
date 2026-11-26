import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { handlePreloadError } from '@/lib/preloadError'

window.addEventListener('vite:preloadError', handlePreloadError)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
