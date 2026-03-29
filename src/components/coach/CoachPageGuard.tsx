/**
 * Shared guard component for coach pages.
 * Handles loading, authentication, and platform linking checks.
 */

import { Link } from 'react-router-dom'

interface CoachPageGuardProps {
  isLoading: boolean
  authenticatedUserId: string | null
  platformUsername: string | null
  profileLoaded?: boolean
  requiresLinkedAccount?: boolean
  connectMessage?: string
  children: React.ReactNode
}

export function CoachPageGuard({
  isLoading,
  authenticatedUserId,
  platformUsername,
  profileLoaded = true,
  requiresLinkedAccount = true,
  connectMessage = 'Link your Chess.com or Lichess account to get personalized coaching, lessons, and puzzles based on your games.',
  children,
}: CoachPageGuardProps) {
  // Wait for both auth and profile to finish loading before showing "connect account"
  if (isLoading || (authenticatedUserId && !profileLoaded)) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
      </div>
    )
  }

  if (!authenticatedUserId) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <p className="text-gray-500">Please log in to access Coach features</p>
      </div>
    )
  }

  if (requiresLinkedAccount && !platformUsername) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-lg shadow-card bg-surface-1 p-8 text-center">
          <h2 className="text-2xl font-semibold text-white mb-4">Connect your chess account</h2>
          <p className="text-gray-400 mb-6">{connectMessage}</p>
          <Link
            to="/profile"
            className="inline-block bg-[#e4e8ed] hover:bg-[#f0f2f5] text-[#111] font-medium py-3 px-6 rounded-lg transition-colors"
          >
            Go to Profile to Connect
          </Link>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
