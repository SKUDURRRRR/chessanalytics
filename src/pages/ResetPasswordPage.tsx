import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    // Supabase automatically picks up the recovery token from the URL hash
    // and establishes a session. Listen for the PASSWORD_RECOVERY event.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true)
      }
    })

    // Also check if we already have a session (e.g. page loaded after token was processed)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionReady(true)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setError(error.message || 'Failed to update password')
      } else {
        setSuccess(true)
        setTimeout(() => navigate('/login'), 3000)
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <div className="rounded-lg bg-surface-1 p-6 text-gray-300 shadow-card">
            <div className="bg-green-900/50 shadow-card text-green-200 px-6 py-4 rounded-lg">
              <h3 className="text-lg font-medium mb-2">Password updated!</h3>
              <p className="text-sm">
                Your password has been successfully reset. Redirecting to login...
              </p>
              <p className="text-sm mt-3">
                <Link to="/login" className="font-medium text-green-300 hover:text-green-200 underline">
                  Go to login now
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!sessionReady) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <div className="rounded-lg bg-surface-1 p-6 text-gray-300 shadow-card text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-sky-200 mx-auto mb-4"></div>
            <p className="text-gray-400">Verifying reset link...</p>
            <p className="text-sm text-gray-500 mt-2">
              If this takes too long, your link may have expired.{' '}
              <Link to="/forgot-password" className="text-sky-300 hover:text-sky-200 underline">
                Request a new one
              </Link>
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="rounded-lg bg-surface-1 p-6 text-gray-300 shadow-card">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-semibold text-white">Set new password</h2>
            <p className="mt-2 text-sm text-gray-400">
              Enter your new password below.
            </p>
          </div>

          {error && (
            <div className="mb-4 bg-rose-900/50 shadow-card text-rose-200 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-400 mb-2">
                New password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg shadow-card bg-surface-1/60 px-4 py-3 text-gray-300 placeholder:text-gray-500 focus:border-sky-400/60 focus:outline-none focus:ring-2 focus:ring-sky-400/40"
                placeholder="••••••••"
                minLength={6}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-400 mb-2">
                Confirm new password
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg shadow-card bg-surface-1/60 px-4 py-3 text-gray-300 placeholder:text-gray-500 focus:border-sky-400/60 focus:outline-none focus:ring-2 focus:ring-sky-400/40"
                placeholder="••••••••"
                minLength={6}
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-sky-500/20 shadow-card px-6 py-3 text-sm font-semibold text-sky-100 transition-colors hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-sky-200"></div>
                    <span>Updating...</span>
                  </div>
                ) : (
                  'Update password'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
