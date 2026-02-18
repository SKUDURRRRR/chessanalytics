/**
 * Shared guard component for coach pages.
 * Handles loading, authentication, and platform linking checks.
 */

import { Link } from 'react-router-dom'

interface CoachPageGuardProps {
  isLoading: boolean
  authenticatedUserId: string | null
  platformUsername: string | null
  requiresLinkedAccount?: boolean
  connectMessage?: string
  children: React.ReactNode
}

export function CoachPageGuard({
  isLoading,
  authenticatedUserId,
  platformUsername,
  requiresLinkedAccount = true,
  connectMessage = 'Link your Chess.com or Lichess account to get personalized coaching, lessons, and puzzles based on your games.',
  children,
}: CoachPageGuardProps) {
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
      </div>
    )
  }

  if (!authenticatedUserId) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400">Please log in to access Coach features</p>
      </div>
    )
  }

  if (requiresLinkedAccount && !platformUsername) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Connect your chess account</h2>
          <p className="text-slate-300 mb-6">{connectMessage}</p>
          <Link
            to="/profile"
            className="inline-block bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            Go to Profile to Connect
          </Link>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
