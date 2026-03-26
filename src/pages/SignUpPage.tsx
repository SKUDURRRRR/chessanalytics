import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Upload, BarChart3, BookOpen, Brain, TrendingUp, Check } from 'lucide-react'
import { Button } from '../components/ui'

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [searchParams] = useSearchParams()
  const { signUp, signInWithOAuth } = useAuth()

  const rawReturnTo = searchParams.get('returnTo')?.trim() ?? '/'
  const returnTo = rawReturnTo.startsWith('/') && !rawReturnTo.startsWith('//') ? rawReturnTo : '/'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

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
    } catch (err) {
      setError('An unexpected error occurred')
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
                We've sent a confirmation email to <span className="text-emerald-300/80 font-medium">{email}</span>.
                Please click the link to verify your account.
              </p>
              <p className="text-small text-emerald-300/60 mt-3">
                After confirming, you can{' '}
                <Link to="/login" className="font-medium text-cta hover:text-cta-hover transition-colors underline">
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

  const features = [
    { icon: Upload, label: '100 Game Imports Per Day', desc: 'Import from Chess.com and Lichess' },
    { icon: BarChart3, label: '5 Game Analyses Per Day', desc: 'Comprehensive Stockfish analysis' },
    { icon: BookOpen, label: 'Personalized Openings', desc: 'Tailored to your playing style' },
    { icon: Brain, label: 'Personality Scores', desc: 'Tactical, positional, aggressive, patient' },
    { icon: TrendingUp, label: 'Performance Tracking', desc: 'Detailed analytics and insights' },
  ]

  return (
    <div className="min-h-screen bg-surface-base py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-start">
          {/* Left Column: Value Proposition */}
          <div className="flex flex-col mt-8 lg:mt-12">
            <div className="mb-8">
              <h1 className="text-title sm:text-[2rem] font-semibold tracking-heading text-[#f0f0f0] mb-4 leading-tight">
                Start analyzing your chess games
              </h1>
              <p className="text-body text-gray-400 leading-relaxed">
                Get deep insights into your playing style, openings, and personality traits. All free to start.
              </p>
            </div>

            <div className="space-y-2 mb-8">
              {features.map(({ icon: Icon, label, desc }) => (
                <div key={label} className="flex items-start gap-3 p-3.5 rounded-lg bg-surface-1 shadow-card hover:shadow-card-hover transition-colors">
                  <div className="flex-shrink-0 w-8 h-8 rounded-md bg-white/[0.06] flex items-center justify-center">
                    <Icon size={16} className="text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-body font-medium text-[#f0f0f0]">{label}</h3>
                    <p className="text-small text-gray-500">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-small text-gray-500">
              <div className="flex items-center gap-1.5">
                <Check size={14} className="text-emerald-400/60" />
                <span>Free forever</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check size={14} className="text-emerald-400/60" />
                <span>No payment required</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check size={14} className="text-emerald-400/60" />
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>

          {/* Right Column: Sign Up Form */}
          <div className="flex flex-col lg:max-w-sm w-full mt-8 lg:mt-24 relative">
            <div className="bg-surface-1 shadow-card rounded-lg p-6 relative">
              <div className="mb-5">
                <h2 className="text-title font-semibold tracking-heading text-[#f0f0f0] mb-1">Create your account</h2>
                <p className="text-small text-gray-400">
                  Already have an account?{' '}
                  <Link
                    to={returnTo !== '/' ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login'}
                    className="font-medium text-cta hover:text-cta-hover transition-colors"
                  >
                    Sign in
                  </Link>
                </p>
              </div>

              {error && (
                <div className="mb-4 bg-rose-500/10 text-rose-300/80 px-4 py-3 rounded-md text-small" style={{ boxShadow: '0 0 0 1px rgba(244,63,94,0.2)' }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
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

                <div>
                  <label htmlFor="password" className="label text-gray-500 mb-1.5 block">
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
                    className="w-full bg-surface-2 shadow-input rounded-md px-3.5 py-2.5 text-body text-gray-300 placeholder:text-gray-500 focus:shadow-input-focus focus:outline-none transition-shadow"
                    placeholder="••••••••"
                    minLength={8}
                  />
                  <p className="mt-1.5 text-caption text-gray-600">At least 8 characters</p>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="label text-gray-500 mb-1.5 block">
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
                    className="w-full bg-surface-2 shadow-input rounded-md px-3.5 py-2.5 text-body text-gray-300 placeholder:text-gray-500 focus:shadow-input-focus focus:outline-none transition-shadow"
                    placeholder="••••••••"
                    minLength={8}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-700 border-t-gray-300"></div>
                      <span>Creating account...</span>
                    </div>
                  ) : (
                    'Start Free — No Credit Card'
                  )}
                </Button>
              </form>

              <p className="text-caption text-gray-600 text-center leading-relaxed mt-4">
                By signing up, you agree to our{' '}
                <Link to="/terms" className="text-gray-500 hover:text-gray-400 transition-colors underline">Terms</Link>
                {' '}and{' '}
                <Link to="/privacy" className="text-gray-500 hover:text-gray-400 transition-colors underline">Privacy Policy</Link>
                . Free account: 100 imports, 5 analyses per day.
              </p>

              <div className="mt-5">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="divider w-full"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-2 bg-surface-1 text-caption text-gray-500">Or sign up with</span>
                  </div>
                </div>

                <div className="mt-5 flex justify-center">
                  <button
                    type="button"
                    onClick={() => handleOAuthSignUp('google')}
                    disabled={loading}
                    className="w-full rounded-md bg-surface-2 shadow-input px-5 py-2.5 text-body font-medium text-gray-300 hover:shadow-card-hover hover:text-gray-200 transition-colors disabled:cursor-not-allowed disabled:opacity-50 inline-flex justify-center items-center gap-2"
                  >
                    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    <span>Google</span>
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
