import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const { resetPassword } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { error } = await resetPassword(email)
      if (error) {
        setError(error.message || 'Failed to send reset email')
      } else {
        setSuccess(true)
      }
    } catch (err) {
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
              <h3 className="text-section font-semibold tracking-section mb-2">Check your email!</h3>
              <p className="text-small text-emerald-300/60">
                We've sent password reset instructions to <span className="text-emerald-300/80 font-medium">{email}</span>.
              </p>
              <p className="text-small text-emerald-300/60 mt-3">
                <Link to="/login" className="font-medium text-cta hover:text-cta-hover transition-colors underline">
                  Return to login
                </Link>
              </p>
            </div>
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
            <h2 className="text-title font-semibold tracking-heading text-[#f0f0f0]">Reset your password</h2>
            <p className="mt-2 text-small text-gray-400">
              Enter your email address and we'll send you instructions to reset your password.
            </p>
          </div>

          {error && (
            <div className="mb-4 bg-rose-500/10 text-rose-300/80 px-4 py-3 rounded-md text-small" style={{ boxShadow: '0 0 0 1px rgba(244,63,94,0.2)' }}>
              {error}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="label text-gray-500 mb-1.5 block">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-surface-2 shadow-input rounded-md px-3.5 py-2.5 text-body text-gray-300 placeholder:text-gray-500 focus:shadow-input-focus focus:outline-none transition-shadow"
                placeholder="you@example.com"
              />
            </div>

            <div className="pt-1">
              <Button
                type="submit"
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Sending...' : 'Send reset instructions'}
              </Button>
            </div>

            <div className="text-center">
              <Link to="/login" className="text-small font-medium text-gray-500 hover:text-gray-400 transition-colors">
                Back to login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
