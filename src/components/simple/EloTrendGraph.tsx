// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react'
import { UnifiedAnalysisService } from '../../services/unifiedAnalysisService'
import { getTimeControlCategory } from '../../utils/timeControlUtils'
import { ResponsiveTrendChart } from './ResponsiveTrendChart'

interface EloTrendGraphProps {
  userId: string
  platform: 'lichess' | 'chess.com'
  className?: string
  selectedTimeControl: string | null
  onTimeControlChange?: (timeControl: string) => void
  onGamesUsedChange?: (gamesUsed: number) => void
  gameLimit?: number  // Default: 50
}

interface EloDataPoint {
  date: string
  rating: number
  gameId: string
  timeControl: string
}

interface TimeControlOption {
  value: string
  count: number
}

export function EloTrendGraph({
  userId,
  platform,
  className = '',
  selectedTimeControl,
  onTimeControlChange,
  onGamesUsedChange,
  gameLimit: propGameLimit = 50,
}: EloTrendGraphProps) {
  const [allGames, setAllGames] = useState<any[]>([])
  const [availableTimeControls, setAvailableTimeControls] = useState<TimeControlOption[]>([])
  const [eloData, setEloData] = useState<EloDataPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [gameLimit, setGameLimit] = useState<number>(propGameLimit)

  const activeTimeControl = useMemo(() => {
    if (selectedTimeControl) {
      return selectedTimeControl
    }
    return availableTimeControls[0]?.value || ''
  }, [selectedTimeControl, availableTimeControls])

  // Canonicalize user ID based on platform (chess.com lowercases, lichess preserves case)
  const canonicalUserId = useMemo(() => {
    if (platform === 'chess.com') {
      return userId.trim().toLowerCase()
    } else { // lichess
      return userId.trim()
    }
  }, [userId, platform])

  useEffect(() => {
    const fetchGames = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch games from backend API instead of direct Supabase query
        const games = await UnifiedAnalysisService.getEloHistory(
          canonicalUserId,
          platform,
          500 // Fetch 500 recent games for ELO trend analysis
        )

        if (!games || games.length === 0) {
          setAllGames([])
          setAvailableTimeControls([])
          setEloData([])
          setError('No ELO data available')
          return
        }

        setAllGames(games)

        const controlMap = new Map<string, number>()
        games.forEach(game => {
          const category = getTimeControlCategory(game.time_control || 'Unknown')
          controlMap.set(category, (controlMap.get(category) || 0) + 1)
        })

        const options = Array.from(controlMap.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([category, count]) => ({ value: category, count }))

        setAvailableTimeControls(options)

        if (!selectedTimeControl && options[0]) {
          onTimeControlChange?.(options[0].value)
        }
      } catch (err) {
        console.error('Error fetching ELO history:', err)
        setError('Failed to load ELO trend data')
      } finally {
        setLoading(false)
      }
    }

    fetchGames()
  }, [canonicalUserId, platform, selectedTimeControl, onTimeControlChange])

  useEffect(() => {
    if (!activeTimeControl || allGames.length === 0) {
      setEloData([])
      return
    }


    const filteredGames = allGames
      .filter(game => {
        const category = getTimeControlCategory(game.time_control || 'Unknown')
        const matches = category === activeTimeControl


        return matches
      })
      .sort((a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime())
      .slice(0, gameLimit === 0 ? undefined : gameLimit)  // 0 means show all

    let processedData: EloDataPoint[] = filteredGames
      .filter(game => game.my_rating && game.my_rating > 0)
      .map(game => ({
        date: game.played_at,
        rating: game.my_rating,
        gameId: game.id,
        timeControl: getTimeControlCategory(game.time_control || 'Unknown')
      }))
      .reverse()

    // Use all games for consistency with recent performance calculation
    // No filtering - show all games to match the sample size

    setEloData(processedData)

    // Notify parent component of the actual number of games used in the graph
    onGamesUsedChange?.(processedData.length)
  }, [allGames, activeTimeControl, gameLimit, onGamesUsedChange])

  const activeLabel = useMemo(() => {
    if (!activeTimeControl) return 'Unknown'
    const count = availableTimeControls.find(option => option.value === activeTimeControl)?.count
    return count ? `${activeTimeControl} (${count} games)` : activeTimeControl
  }, [availableTimeControls, activeTimeControl])

  const trendDirection = useMemo(() => {
    if (eloData.length === 0) return 'stable'
    const midpoint = Math.floor(eloData.length / 2)
    const firstHalf = eloData.slice(0, midpoint)
    const secondHalf = eloData.slice(midpoint)

    if (firstHalf.length === 0 || secondHalf.length === 0) {
      return 'stable'
    }

    const firstHalfAvg = firstHalf.reduce((sum, d) => sum + d.rating, 0) / firstHalf.length
    const secondHalfAvg = secondHalf.reduce((sum, d) => sum + d.rating, 0) / secondHalf.length
    if (secondHalfAvg > firstHalfAvg + 10) return 'improving'
    if (secondHalfAvg < firstHalfAvg - 10) return 'declining'
    return 'stable'
  }, [eloData])

  const handleTimeControlSelection = (event: React.ChangeEvent<HTMLSelectElement>) => {
    onTimeControlChange?.(event.target.value)
  }

  if (loading) {
    return (
      <div className={`flex h-32 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] ${className}`}>
        <div className="mr-3 h-6 w-6 animate-spin rounded-full border-b-2 border-sky-300" />
        <div className="text-sm text-slate-300">Loading ELO trend…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`flex h-32 items-center justify-center rounded-2xl border border-rose-400/40 bg-rose-500/10 text-sm text-rose-100 ${className}`}>
        {error}
      </div>
    )
  }

  if (eloData.length === 0) {
    return (
      <div className={`flex h-32 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-sm text-slate-400 ${className}`}>
        No ELO data available
      </div>
    )
  }

  return (
    <div className={className}>
      {availableTimeControls.length > 0 && (
        <div className="mb-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <label className="text-xs font-medium uppercase tracking-wide text-slate-400 flex-shrink-0" htmlFor="time-control-selector">
            Time Control
          </label>
          <select
            id="time-control-selector"
            value={activeTimeControl}
            onChange={handleTimeControlSelection}
            className="rounded-full border border-white/10 bg-slate-800/50 px-3 py-1 text-xs text-slate-100 transition focus:border-sky-400/60 focus:outline-none focus:ring-2 focus:ring-sky-400/30 min-w-0 flex-1 sm:flex-none appearance-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23cbd5e1' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
              backgroundPosition: 'right 4px center',
              backgroundRepeat: 'no-repeat',
              backgroundSize: '14px',
              paddingRight: '24px'
            }}
          >
            {availableTimeControls.map(option => (
              <option
                key={option.value}
                value={option.value}
                className="bg-slate-800 text-slate-100"
              >
                {option.value} ({option.count} games)
              </option>
            ))}
          </select>

          <label className="text-xs font-medium uppercase tracking-wide text-slate-400 flex-shrink-0" htmlFor="game-limit-selector">
            Show Games
          </label>
          <select
            id="game-limit-selector"
            value={gameLimit}
            onChange={(e) => setGameLimit(Number(e.target.value))}
            className="rounded-full border border-white/10 bg-slate-800/50 px-3 py-1 text-xs text-slate-100 transition focus:border-sky-400/60 focus:outline-none focus:ring-2 focus:ring-sky-400/30 min-w-0 flex-1 sm:flex-none appearance-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23cbd5e1' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
              backgroundPosition: 'right 4px center',
              backgroundRepeat: 'no-repeat',
              backgroundSize: '14px',
              paddingRight: '24px'
            }}
          >
            <option value={25} className="bg-slate-800 text-slate-100">Last 25</option>
            <option value={50} className="bg-slate-800 text-slate-100">Last 50</option>
            <option value={100} className="bg-slate-800 text-slate-100">Last 100</option>
            <option value={200} className="bg-slate-800 text-slate-100">Last 200</option>
            <option value={0} className="bg-slate-800 text-slate-100">All Games</option>
          </select>
        </div>
      )}

      <ResponsiveTrendChart
        selectedTimeControlLabel={activeLabel}
        trendDirection={trendDirection}
        data={eloData}
      />
    </div>
  )
}
