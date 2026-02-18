/**
 * Hook for resolving the chess platform user for coach pages.
 * Falls back from URL query params → linked account → empty.
 */

import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function useCoachUser() {
  const [searchParams] = useSearchParams()
  const { user } = useAuth()

  const queryPlatform = searchParams.get('platform')
  const queryUserId = searchParams.get('userId')

  const platform = (queryPlatform || user?.primaryPlatform || 'lichess') as 'lichess' | 'chess.com'

  const platformUsername = queryUserId
    || (platform === 'chess.com' ? user?.chessComUsername : user?.lichessUsername)
    || ''

  const authenticatedUserId = user?.id || ''
  const hasLinkedAccount = !!(user?.chessComUsername || user?.lichessUsername)

  // Expose both linked accounts for features that aggregate across platforms
  const linkedAccounts: Array<{ platform: 'chess.com' | 'lichess'; username: string }> = []
  if (user?.chessComUsername) linkedAccounts.push({ platform: 'chess.com', username: user.chessComUsername })
  if (user?.lichessUsername) linkedAccounts.push({ platform: 'lichess', username: user.lichessUsername })

  return { platform, platformUsername, authenticatedUserId, hasLinkedAccount, linkedAccounts }
}
