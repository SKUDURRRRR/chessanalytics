import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initializeMobileOptimizations } from './utils/mobilePerformance'

// Suppress external script errors (browser extensions, etc.)
window.addEventListener('error', (event: ErrorEvent) => {
  // Suppress errors from external scripts (browser extensions)
  if (event.filename && (
    event.filename.includes('share-modal.js') ||
    event.filename.includes('extension://') ||
    event.filename.includes('moz-extension://') ||
    event.filename.includes('chrome-extension://')
  )) {
    // Log suppressed errors for observability
    console.debug('Suppressed external script error:', event.filename, event.message)
    event.preventDefault()
  }
})

// Initialize mobile optimizations
initializeMobileOptimizations()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
