import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [searchParams] = useSearchParams()
  const { signUp, signInWithOAuth } = useAuth()
  const navigate = useNavigate()

  // Get the return URL from query params, default to home
  // Sanitize returnTo to prevent open redirects - only accept relative paths
  const rawReturnTo = searchParams.get('returnTo')?.trim() ?? '/'
  const returnTo = rawReturnTo.startsWith('/') && !rawReturnTo.startsWith('//') ? rawReturnTo : '/'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // Validation
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long')
      setLoading(false)
      return
    }

    try {
      const { error } = await signUp(email, password)
      if (error) {
        setError(error.message || 'Failed to sign up')
      } else {
        setSuccess(true)
        // Don't navigate immediately - show success message about email confirmation
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleOAuthSignUp = async (provider: 'google' | 'lichess' | 'chess_com') => {
    setError('')
    setLoading(true)

    try {
      const { error } = await signInWithOAuth(provider, returnTo)
      if (error) {
        setError(error.message || `Failed to sign up with ${provider}`)
        setLoading(false)
      }
      // OAuth will redirect, so we don't set loading to false here
    } catch (err) {
      setError('An unexpected error occurred')
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-100 shadow-xl shadow-black/40">
            <div className="bg-emerald-900/50 border border-emerald-500 text-emerald-200 px-6 py-4 rounded-2xl">
              <h3 className="text-lg font-medium mb-2">Check your email!</h3>
              <p className="text-sm">
                We've sent you a confirmation email to <strong>{email}</strong>.
                Please click the link in the email to verify your account.
              </p>
              <p className="text-sm mt-3">
                After confirming, you can{' '}
                <Link to="/login" className="font-medium text-emerald-300 hover:text-emerald-200 underline">
                  sign in here
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-100 shadow-xl shadow-black/40">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-semibold text-white">Create your account</h2>
            <p className="mt-2 text-sm text-slate-300">
              Already have an account?{' '}
              <Link
                to={returnTo !== '/' ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login'}
                className="font-medium text-sky-300 hover:text-sky-200"
              >
                Sign in
              </Link>
            </p>
          </div>

          {error && (
            <div className="mb-4 bg-rose-900/50 border border-rose-500 text-rose-200 px-4 py-3 rounded-2xl">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
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
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none focus:ring-2 focus:ring-sky-400/40"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none focus:ring-2 focus:ring-sky-400/40"
                  placeholder="••••••••"
                  minLength={8}
                />
                <p className="mt-1 text-xs text-slate-500">At least 8 characters</p>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300 mb-2">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none focus:ring-2 focus:ring-sky-400/40"
                  placeholder="••••••••"
                  minLength={8}
                />
              </div>
            </div>

            <div className="text-xs text-slate-400">
              By signing up, you agree to our Terms of Service and Privacy Policy.
              You'll start with a free account with 100 game imports and 5 analyses per day.
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl border border-sky-400/40 bg-sky-500/20 px-6 py-3 text-sm font-semibold text-sky-100 transition hover:border-sky-300/60 hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-sky-200"></div>
                    <span>Creating account...</span>
                  </div>
                ) : (
                  'Sign up'
                )}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-slate-900 text-slate-400">Or sign up with</span>
              </div>
            </div>

            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => handleOAuthSignUp('google')}
                disabled={loading}
                className="w-full max-w-xs rounded-2xl border border-white/10 bg-white/10 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50 inline-flex justify-center items-center"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span className="ml-2">Google</span>
              </button>

              {/* Temporarily hidden - Chess.com OAuth
              <button
                type="button"
                onClick={() => handleOAuthSignUp('chess_com')}
                disabled={loading}
                className="w-full rounded-2xl border border-white/10 bg-white/10 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50 inline-flex justify-center items-center"
              >
                <span className="font-bold text-green-500">♞</span>
                <span className="ml-2">Chess.com</span>
              </button>
              */}

              {/* Temporarily hidden - Lichess OAuth
              <button
                type="button"
                onClick={() => handleOAuthSignUp('lichess')}
                disabled={loading}
                className="w-full rounded-2xl border border-white/10 bg-white/10 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50 inline-flex justify-center items-center"
              >
                <span className="font-bold">♞</span>
                <span className="ml-2">Lichess</span>
              </button>
              */}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
