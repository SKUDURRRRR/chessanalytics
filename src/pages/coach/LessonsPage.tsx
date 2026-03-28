/**
 * Game Review List Page (replaces old Lessons Page)
 * Shows analyzed games that have mistakes, available for guided review with Coach Tal.
 */

import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import UnifiedAnalysisService from '../../services/unifiedAnalysisService'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useCoachUser } from '../../hooks/useCoachUser'
import type { GameAnalysisSummary, Platform } from '../../types'

// ============================================================================
// Types
// ============================================================================

interface ReviewableGame {
  gameId: string
  platform: Platform
  userId: string
  opponent: string
  result: 'win' | 'loss' | 'draw'
  playerColor: 'white' | 'black'
  opening: string
  timeControl: string
  playedAt: string
  accuracy: number
  blunders: number
  mistakes: number
  inaccuracies: number
  keyMomentsCount: number
}

type SortOption = 'recent' | 'most-mistakes' | 'lowest-accuracy'

// ============================================================================
// Helpers
// ============================================================================

const canonicalizeUserId = (userId: string, platform: Platform): string => {
  if (platform === 'chess.com') return userId.trim().toLowerCase()
  return userId.trim()
}

const parseResult = (result: string | undefined, color: string | undefined): 'win' | 'loss' | 'draw' => {
  const r = (result || '').toLowerCase()
  const c = (color || '').toLowerCase()
  if (r === '1-0') return c === 'black' ? 'loss' : 'win'
  if (r === '0-1') return c === 'white' ? 'loss' : 'win'
  if (r.includes('win')) return 'win'
  if (r.includes('loss') || r.includes('lose')) return 'loss'
  if (r.includes('draw') || r === '1/2-1/2') return 'draw'
  return 'draw'
}

// ============================================================================
// Component
// ============================================================================

export default function GameReviewListPage() {
  const { user } = useAuth()
  const { platform, platformUsername, authenticatedUserId, isLoading: authLoading } = useCoachUser()
  const navigate = useNavigate()

  const [games, setGames] = useState<ReviewableGame[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortOption>('recent')

  // Hooks must be called before any conditional returns (React Rules of Hooks)
  useEffect(() => {
    if (!platformUsername || !platform) {
      setLoading(false)
      return
    }

    let cancelled = false

    async function fetchReviewableGames() {
      setLoading(true)
      setError(null)

      try {
        // 1. Get analysis results from backend
        const analyses = await UnifiedAnalysisService.getAnalysisResults(
          platformUsername,
          platform,
          50 // Get up to 50 analyzed games
        )

        if (cancelled) return

        // 2. Filter for games with at least 1 mistake
        const withMistakes = analyses.filter(
          (a: GameAnalysisSummary) => (a.blunders + a.mistakes + a.inaccuracies) > 0
        )

        if (withMistakes.length === 0) {
          setGames([])
          setLoading(false)
          return
        }

        // 3. Fetch game metadata from Supabase
        const gameIds = withMistakes.map((a: GameAnalysisSummary) => a.game_id)
        const canonical = canonicalizeUserId(platformUsername, platform)

        const { data: gameRecords } = await supabase
          .from('games')
          .select('id, provider_game_id, played_at, result, color, opponent_name, opening, opening_family, time_control')
          .eq('user_id', canonical)
          .eq('platform', platform)
          .in('provider_game_id', gameIds)

        if (cancelled) return

        // Also try matching by id (some games use UUID ids)
        let gameMap = new Map<string, Record<string, unknown>>()
        if (gameRecords) {
          for (const g of gameRecords) {
            if (g.provider_game_id) gameMap.set(g.provider_game_id, g)
            gameMap.set(g.id, g)
          }
        }

        // If we didn't match many, try by id field
        const unmatchedIds = gameIds.filter((id: string) => !gameMap.has(id))
        if (unmatchedIds.length > 0) {
          const { data: fallbackRecords } = await supabase
            .from('games')
            .select('id, provider_game_id, played_at, result, color, opponent_name, opening, opening_family, time_control')
            .eq('user_id', canonical)
            .eq('platform', platform)
            .in('id', unmatchedIds)

          if (fallbackRecords) {
            for (const g of fallbackRecords) {
              gameMap.set(g.id, g)
              if (g.provider_game_id) gameMap.set(g.provider_game_id, g)
            }
          }
        }

        if (cancelled) return

        // 4. Merge analysis + game data
        const reviewable: ReviewableGame[] = withMistakes.map((analysis: GameAnalysisSummary) => {
          const game = gameMap.get(analysis.game_id)
          const color = ((game?.color as string) || '').toLowerCase()
          const playerColor: 'white' | 'black' = color === 'black' ? 'black' : 'white'

          return {
            gameId: analysis.game_id,
            platform,
            userId: platformUsername,
            opponent: (game?.opponent_name as string)?.trim() || 'Unknown',
            result: parseResult(game?.result as string, game?.color as string),
            playerColor,
            opening: (game?.opening as string) || (game?.opening_family as string) || 'Unknown Opening',
            timeControl: (game?.time_control as string) || 'Unknown',
            playedAt: (game?.played_at as string) || analysis.analysis_date || '',
            accuracy: analysis.accuracy,
            blunders: analysis.blunders,
            mistakes: analysis.mistakes,
            inaccuracies: analysis.inaccuracies,
            keyMomentsCount: analysis.blunders + analysis.mistakes + analysis.inaccuracies,
          }
        })

        setGames(reviewable)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load games')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchReviewableGames()
    return () => { cancelled = true }
  }, [platformUsername, platform])

  // Sort games
  const sortedGames = useMemo(() => {
    const sorted = [...games]
    switch (sortBy) {
      case 'recent':
        sorted.sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime())
        break
      case 'most-mistakes':
        sorted.sort((a, b) => b.keyMomentsCount - a.keyMomentsCount)
        break
      case 'lowest-accuracy':
        sorted.sort((a, b) => a.accuracy - b.accuracy)
        break
    }
    return sorted
  }, [games, sortBy])

  // Auth/loading guards (placed after all hooks to comply with React Rules of Hooks)
  if (authLoading) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
      </div>
    )
  }

  if (!authenticatedUserId) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <p className="text-gray-500">Please log in to access game reviews</p>
      </div>
    )
  }

  if (!platformUsername) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-lg shadow-card bg-surface-1 p-8 text-center">
          <h2 className="text-title font-semibold text-white mb-4">Connect your chess account</h2>
          <p className="text-gray-400 mb-6">
            Link your Chess.com or Lichess account to review your games with Coach Tal.
          </p>
          <Link
            to="/profile"
            className="inline-block bg-[#e4e8ed] hover:bg-[#f0f2f5] text-[#111] font-medium py-2 px-6 rounded-md text-body transition-colors shadow-btn-primary"
          >
            Go to Profile to Connect
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-base p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-title font-semibold text-white mb-1">Game Review</h1>
          <p className="text-gray-500">Review your games with Coach Tal to learn from your mistakes</p>
        </div>

        {/* Sort controls */}
        {games.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {([
              { id: 'recent', label: 'Most Recent' },
              { id: 'most-mistakes', label: 'Most Mistakes' },
              { id: 'lowest-accuracy', label: 'Lowest Accuracy' },
            ] as const).map(opt => (
              <button
                key={opt.id}
                onClick={() => setSortBy(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  sortBy === opt.id
                    ? 'bg-emerald-500/20 text-emerald-300 shadow-card'
                    : 'bg-white/[0.04] text-gray-500 shadow-card hover:bg-white/[0.06]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-500">Loading analyzed games...</p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="rounded-lg shadow-card bg-surface-1 p-8 text-center">
            <p className="text-gray-400 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-emerald-400 hover:text-emerald-300 transition-colors text-sm"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && games.length === 0 && (
          <div className="rounded-lg shadow-card bg-surface-1 p-8 text-center">
            <div className="text-title mb-4">&#9813;</div>
            <h2 className="text-title font-semibold text-white mb-2">No games to review</h2>
            <p className="text-gray-500 mb-6">
              Analyze some games first, then come back to review your mistakes with Coach Tal.
            </p>
            <Link
              to="/"
              className="text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Go to Analysis
            </Link>
          </div>
        )}

        {/* Game cards */}
        {!loading && !error && sortedGames.length > 0 && (
          <div className="space-y-3">
            {sortedGames.map(game => (
              <GameReviewCard
                key={game.gameId}
                game={game}
                onClick={() => navigate(`/coach/review/${game.platform}/${encodeURIComponent(game.userId)}/${encodeURIComponent(game.gameId)}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Game Review Card
// ============================================================================

interface GameReviewCardProps {
  game: ReviewableGame
  onClick: () => void
}

function GameReviewCard({ game, onClick }: GameReviewCardProps) {
  const resultColors: Record<string, string> = {
    win: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
    loss: 'bg-rose-500/20 text-rose-300 border-rose-400/30',
    draw: 'bg-white/[0.04] text-gray-500 border-white/[0.06]',
  }

  const dateStr = game.playedAt
    ? new Date(game.playedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : ''

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg shadow-card bg-white/[0.03] hover:bg-white/[0.06] p-4 transition-colors group"
    >
      <div className="flex items-center gap-3">
        {/* Result badge */}
        <span className={`text-xs px-2 py-0.5 rounded border uppercase font-semibold shrink-0 ${resultColors[game.result]}`}>
          {game.result}
        </span>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-white font-medium truncate">vs {game.opponent}</span>
            <span className="text-xs text-gray-500 capitalize">({game.playerColor})</span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5 truncate">
            {game.opening} {game.timeControl !== 'Unknown' && `\u00B7 ${game.timeControl}`} {dateStr && `\u00B7 ${dateStr}`}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Accuracy */}
          <div className="text-right hidden sm:block">
            <div className="text-xs text-gray-500">Accuracy</div>
            <div className={`text-sm font-semibold ${
              game.accuracy >= 90 ? 'text-emerald-400' :
              game.accuracy >= 70 ? 'text-amber-400' : 'text-rose-400'
            }`}>
              {game.accuracy.toFixed(1)}%
            </div>
          </div>

          {/* Key moments */}
          <div className="text-right">
            <div className="text-xs text-gray-500 hidden sm:block">Moments</div>
            <div className="flex items-center gap-1">
              {game.blunders > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 font-medium">
                  {game.blunders}!!
                </span>
              )}
              {game.mistakes > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 font-medium">
                  {game.mistakes}?
                </span>
              )}
              {game.inaccuracies > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 font-medium">
                  {game.inaccuracies}?!
                </span>
              )}
            </div>
          </div>

          {/* Arrow */}
          <svg className="w-4 h-4 text-gray-600 group-hover:text-gray-500 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </button>
  )
}
