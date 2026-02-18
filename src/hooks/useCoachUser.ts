/**
 * Hook for resolving the chess platform user for coach pages.
 * Falls back from URL query params → linked account → empty.
 */

import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function useCoachUser() {
  const [searchParams] = useSearchParams()
  const { user, loading, profileLoaded } = useAuth()

  // Still loading if auth is initializing or user profile (chess usernames) hasn't been fetched yet
  const isLoading = loading || (!!user && !profileLoaded)

  const queryPlatform = searchParams.get('platform')
  const queryUserId = searchParams.get('userId')

  const platform = (queryPlatform || user?.primaryPlatform || 'lichess') as 'lichess' | 'chess.com'

  const platformUsername = queryUserId
    || (platform === 'chess.com' ? user?.chessComUsername : user?.lichessUsername)
    || ''

  const authenticatedUserId = user?.id || ''
  const hasLinkedAccount = !!(user?.chessComUsername || user?.lichessUsername)

  // Expose both linked accounts for features that aggregate across platforms
  const linkedAccounts = useMemo(() => {
    const accounts: Array<{ platform: 'chess.com' | 'lichess'; username: string }> = []
    if (user?.chessComUsername) accounts.push({ platform: 'chess.com', username: user.chessComUsername })
    if (user?.lichessUsername) accounts.push({ platform: 'lichess', username: user.lichessUsername })
    return accounts
  }, [user?.chessComUsername, user?.lichessUsername])

  return { platform, platformUsername, authenticatedUserId, hasLinkedAccount, linkedAccounts, isLoading }
}
