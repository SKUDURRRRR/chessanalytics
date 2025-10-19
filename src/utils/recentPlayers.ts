// Utility for managing recently searched players in localStorage

export interface RecentPlayer {
  userId: string
  platform: 'lichess' | 'chess.com'
  displayName?: string
  rating?: number
  searchedAt: number // timestamp
}

const RECENT_PLAYERS_KEY = 'chess_analytics_recent_players'
const MAX_RECENT_PLAYERS = 10

/**
 * Get all recent players from localStorage
 */
export function getRecentPlayers(): RecentPlayer[] {
  try {
    const stored = localStorage.getItem(RECENT_PLAYERS_KEY)
    if (!stored) return []
    
    const players: RecentPlayer[] = JSON.parse(stored)
    // Sort by most recent first
    return players.sort((a, b) => b.searchedAt - a.searchedAt)
  } catch (error) {
    console.error('Error reading recent players:', error)
    return []
  }
}

/**
 * Add a player to recent players list
 */
export function addRecentPlayer(player: Omit<RecentPlayer, 'searchedAt'>): void {
  try {
    let recent = getRecentPlayers()
    
    // Remove existing entry for this player if it exists
    recent = recent.filter(
      p => !(p.userId === player.userId && p.platform === player.platform)
    )
    
    // Add new entry at the beginning
    recent.unshift({
      ...player,
      searchedAt: Date.now()
    })
    
    // Keep only the most recent MAX_RECENT_PLAYERS
    recent = recent.slice(0, MAX_RECENT_PLAYERS)
    
    localStorage.setItem(RECENT_PLAYERS_KEY, JSON.stringify(recent))
  } catch (error) {
    console.error('Error saving recent player:', error)
  }
}

/**
 * Clear all recent players
 */
export function clearRecentPlayers(): void {
  try {
    localStorage.removeItem(RECENT_PLAYERS_KEY)
  } catch (error) {
    console.error('Error clearing recent players:', error)
  }
}

/**
 * Remove a specific player from recent players
 */
export function removeRecentPlayer(userId: string, platform: 'lichess' | 'chess.com'): void {
  try {
    let recent = getRecentPlayers()
    recent = recent.filter(
      p => !(p.userId === userId && p.platform === platform)
    )
    localStorage.setItem(RECENT_PLAYERS_KEY, JSON.stringify(recent))
  } catch (error) {
    console.error('Error removing recent player:', error)
  }
}

