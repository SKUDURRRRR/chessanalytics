import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import HomePage from './pages/HomePage'
import SimpleAnalyticsPage from './pages/SimpleAnalyticsPage'
import './index.css'

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<HomePage />} />
            <Route path="/simple-analytics" element={<SimpleAnalyticsPage />} />
            <Route path="/profile/:userId/:platform" element={<SimpleAnalyticsPage />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  )
}

export default App
