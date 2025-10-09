import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initializeMobileOptimizations } from './utils/mobilePerformance'

// Initialize mobile optimizations
initializeMobileOptimizations()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
