// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { getTimeControlCategory } from '../../utils/timeControlUtils'
import { ResponsiveTrendChart } from './ResponsiveTrendChart'

interface EloTrendGraphProps {
  userId: string
  platform: 'lichess' | 'chess.com'
  className?: string
  selectedTimeControl: string | null
  onTimeControlChange?: (timeControl: string) => void
  onGamesUsedChange?: (gamesUsed: number) => void
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
}: EloTrendGraphProps) {
  const [allGames, setAllGames] = useState<any[]>([])
  const [availableTimeControls, setAvailableTimeControls] = useState<TimeControlOption[]>([])
  const [eloData, setEloData] = useState<EloDataPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const activeTimeControl = useMemo(() => {
    if (selectedTimeControl) {
      return selectedTimeControl
    }
    return availableTimeControls[0]?.value || ''
  }, [selectedTimeControl, availableTimeControls])

  useEffect(() => {
    const fetchGames = async () => {
      try {
        setLoading(true)
        setError(null)

        const { data: games, error: fetchError } = await supabase
          .from('games')
          .select('time_control, my_rating, played_at, id')
          .eq('user_id', userId.toLowerCase())
          .eq('platform', platform)
          .not('my_rating', 'is', null)
          .not('time_control', 'is', null)

        if (fetchError) {
          throw fetchError
        }

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
  }, [userId, platform, selectedTimeControl, onTimeControlChange])

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
      .slice(0, 50)
    

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
  }, [allGames, activeTimeControl])

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
      <div className={`flex items-center justify-center h-32 ${className}`}>
        <div className="text-gray-500">Loading ELO trend...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-32 ${className}`}>
        <div className="text-red-500">{error}</div>
      </div>
    )
  }

  if (eloData.length === 0) {
    return (
      <div className={`flex items-center justify-center h-32 ${className}`}>
        <div className="text-gray-500">No ELO data available</div>
      </div>
    )
  }

  return (
    <div className={className}>
      {availableTimeControls.length > 0 && (
        <div className="mb-3 flex items-center space-x-2">
          <label className="text-xs font-medium text-gray-600" htmlFor="time-control-selector">
            Time Control
          </label>
          <select
            id="time-control-selector"
            value={activeTimeControl}
            onChange={handleTimeControlSelection}
            className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            {availableTimeControls.map(option => (
              <option key={option.value} value={option.value}>
                {option.value} ({option.count} games)
              </option>
            ))}
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
