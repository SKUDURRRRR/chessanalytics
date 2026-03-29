import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui'

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
        <div className="max-w-sm w-full">
          <div className="bg-surface-1 shadow-card rounded-lg p-6">
            <div className="bg-emerald-500/10 text-emerald-300/80 px-5 py-4 rounded-md" style={{ boxShadow: '0 0 0 1px rgba(52,211,153,0.15)' }}>
              <h3 className="text-section font-semibold tracking-section mb-2">Password updated!</h3>
              <p className="text-small text-emerald-300/60">
                Your password has been successfully reset. Redirecting to login...
              </p>
              <p className="text-small text-emerald-300/60 mt-3">
                <Link to="/login" className="font-medium text-cta hover:text-cta-hover transition-colors underline">
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
        <div className="max-w-sm w-full">
          <div className="bg-surface-1 shadow-card rounded-lg p-6 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-700 border-t-gray-300 mx-auto mb-4"></div>
            <p className="text-gray-400 text-body">Verifying reset link...</p>
            <p className="text-small text-gray-500 mt-2">
              If this takes too long, your link may have expired.{' '}
              <Link to="/forgot-password" className="text-cta hover:text-cta-hover transition-colors underline">
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
      <div className="max-w-sm w-full">
        <div className="bg-surface-1 shadow-card rounded-lg p-6">
          <div className="mb-6 text-center">
            <h2 className="text-title font-semibold tracking-heading text-[#f0f0f0]">Set new password</h2>
            <p className="mt-2 text-small text-gray-400">
              Enter your new password below.
            </p>
          </div>

          {error && (
            <div className="mb-4 bg-rose-500/10 text-rose-300/80 px-4 py-3 rounded-md text-small" style={{ boxShadow: '0 0 0 1px rgba(244,63,94,0.2)' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="label text-gray-500 mb-1.5 block">
                New password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surface-2 shadow-input rounded-md px-3.5 py-2.5 text-body text-gray-300 placeholder:text-gray-500 focus:shadow-input-focus focus:outline-none transition-shadow"
                placeholder="••••••••"
                minLength={6}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="label text-gray-500 mb-1.5 block">
                Confirm new password
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-surface-2 shadow-input rounded-md px-3.5 py-2.5 text-body text-gray-300 placeholder:text-gray-500 focus:shadow-input-focus focus:outline-none transition-shadow"
                placeholder="••••••••"
                minLength={6}
              />
            </div>

            <div className="pt-1">
              <Button
                type="submit"
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-700 border-t-gray-300"></div>
                    <span>Updating...</span>
                  </div>
                ) : (
                  'Update password'
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
