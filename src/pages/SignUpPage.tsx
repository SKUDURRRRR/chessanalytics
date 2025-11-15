import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Upload, BarChart3, BookOpen, Brain, TrendingUp, CheckCircle2 } from 'lucide-react'

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
    <div className="min-h-screen bg-slate-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-start">
          {/* Left Column: Value Proposition */}
          <div className="flex flex-col mt-8 lg:mt-12">
            <div className="mb-8">
              <h1 className="text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight">
                Start analyzing your chess games
              </h1>
              <p className="text-xl text-slate-300 mb-6 leading-relaxed">
                Get deep insights into your playing style, openings, and personality traits. All free to start.
              </p>
            </div>

            {/* Feature Highlights */}
            <div className="space-y-3 mb-8">
              <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-900/50 border border-slate-800/50 hover:border-slate-700/50 transition-colors">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-sky-500/20 border border-sky-500/30 flex items-center justify-center">
                  <Upload className="w-5 h-5 text-sky-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white mb-1 text-base">100 Game Imports Per Day</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">Import up to 100 games per day from Chess.com, Lichess, and more</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-900/50 border border-slate-800/50 hover:border-slate-700/50 transition-colors">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white mb-1 text-base">5 Game Analyses Per Day</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">Get comprehensive game analysis with Stockfish engine insights</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-900/50 border border-slate-800/50 hover:border-slate-700/50 transition-colors">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white mb-1 text-base">Personalized Openings</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">Get openings tailored to your playing style</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-900/50 border border-slate-800/50 hover:border-slate-700/50 transition-colors">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                  <Brain className="w-5 h-5 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white mb-1 text-base">Personality Scores</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">Discover your playing style: tactical, positional, aggressive, or patient</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-900/50 border border-slate-800/50 hover:border-slate-700/50 transition-colors">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-rose-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white mb-1 text-base">Performance Tracking</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">Track your progress over time with detailed analytics and insights</p>
                </div>
              </div>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-slate-400">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Free forever</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>No payment required</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>

          {/* Right Column: Sign Up Form */}
          <div className="flex flex-col lg:max-w-md w-full mt-8 lg:mt-32 relative">
            <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-8 text-slate-100 shadow-xl shadow-black/40 relative">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold text-white mb-2">Create your account</h2>
                <p className="text-sm text-slate-300">
                  Already have an account?{' '}
                  <Link
                    to={returnTo !== '/' ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login'}
                    className="font-medium text-sky-300 hover:text-sky-200 underline transition-colors"
                  >
                    Sign in
                  </Link>
                </p>
              </div>

              {error && (
                <div className="mb-5 bg-rose-900/50 border border-rose-500/50 text-rose-200 px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
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
                    className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none focus:ring-2 focus:ring-sky-400/40 transition"
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
                    className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none focus:ring-2 focus:ring-sky-400/40 transition"
                    placeholder="••••••••"
                    minLength={8}
                  />
                  <p className="mt-1.5 text-xs text-slate-500">At least 8 characters</p>
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
                    className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-sky-400/60 focus:outline-none focus:ring-2 focus:ring-sky-400/40 transition"
                    placeholder="••••••••"
                    minLength={8}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-semibold text-base transition-all hover:bg-emerald-500/20 hover:border-emerald-500/50 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-emerald-500/10 disabled:hover:border-emerald-500/30 disabled:hover:text-emerald-300"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Creating account...</span>
                    </>
                  ) : (
                    <span>Start Free - No Credit Card Required</span>
                  )}
                </button>
              </form>

              <div className="text-xs text-slate-400 text-center leading-relaxed mt-4">
                By signing up, you agree to our{' '}
                <Link
                  to="/terms"
                  className="text-sky-400 hover:text-sky-300 underline transition-colors"
                >
                  Terms of Service
                </Link>
                {' '}and{' '}
                <Link
                  to="/privacy"
                  className="text-sky-400 hover:text-sky-300 underline transition-colors"
                >
                  Privacy Policy
                </Link>
                . You'll start with a free account with 100 game imports and 5 analyses per day.
              </div>

              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-3 bg-slate-900/95 text-slate-400">Or sign up with</span>
                  </div>
                </div>

                <div className="mt-6 flex justify-center">
                  <button
                    type="button"
                    onClick={() => handleOAuthSignUp('google')}
                    disabled={loading}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-200 transition-all hover:border-white/30 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 inline-flex justify-center items-center gap-3"
                  >
                    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
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
                    <span>Continue with Google</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
