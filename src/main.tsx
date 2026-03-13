import './index.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initializeClarity } from './lib/clarity'

// Initialize Microsoft Clarity
const CLARITY_PROJECT_ID = import.meta.env.VITE_CLARITY_PROJECT_ID || 'tygdbslg22'

// Debug: Log environment variable status
console.log('Clarity Project ID:', CLARITY_PROJECT_ID)
console.log('From env var?', import.meta.env.VITE_CLARITY_PROJECT_ID ? 'Yes' : 'No (using fallback)')

if (CLARITY_PROJECT_ID) {
  initializeClarity(CLARITY_PROJECT_ID)
} else {
  console.warn('Clarity not initialized: VITE_CLARITY_PROJECT_ID environment variable is missing')
}

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

// Suppress unhandled promise rejections from browser extensions
window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  // Check if the error is related to browser extension message channels
  if (event.reason && typeof event.reason === 'object' && event.reason.message) {
    const message = event.reason.message.toLowerCase()
    if (message.includes('listener indicated an asynchronous response') ||
        message.includes('message channel closed') ||
        message.includes('extension://') ||
        message.includes('chrome-extension://') ||
        message.includes('moz-extension://')) {
      // Log suppressed promise rejections for observability
      console.debug('Suppressed extension promise rejection:', event.reason.message)
      event.preventDefault()
    }
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
