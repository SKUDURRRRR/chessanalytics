import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { getTimeControlCategory } from '../../utils/timeControlUtils'
import { ResponsiveTrendChart } from './ResponsiveTrendChart'

interface EloTrendGraphProps {
  userId: string
  platform: 'lichess' | 'chess.com'
  className?: string
}

interface EloDataPoint {
  date: string
  rating: number
  gameId: string
  timeControl: string
}

export function EloTrendGraph({ userId, platform, className = '' }: EloTrendGraphProps) {
  const [eloData, setEloData] = useState<EloDataPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTimeControl, setSelectedTimeControl] = useState<string>('')
  useEffect(() => {
    const fetchEloHistory = async () => {
      try {
        setLoading(true)
        setError(null)

        // First, fetch all games to determine the most played time control
        const { data: allGames, error: allGamesError } = await supabase
          .from('games')
          .select('time_control, my_rating, played_at, id')
          .eq('user_id', userId.toLowerCase())
          .eq('platform', platform)
          .not('my_rating', 'is', null)
          .not('time_control', 'is', null)

        if (allGamesError) throw allGamesError

        if (!allGames || allGames.length === 0) {
          setEloData([])
          return
        }

        // Find the most played time control
        const timeControlCounts = allGames.reduce((acc, game) => {
          const tc = getTimeControlCategory(game.time_control || 'Unknown')
          acc[tc] = (acc[tc] || 0) + 1
          return acc
        }, {} as Record<string, number>)

        const mostPlayedTimeControl = Object.entries(timeControlCounts).reduce((a, b) => 
          timeControlCounts[a[0]] > timeControlCounts[b[0]] ? a : b, ['Unknown', 0])[0]

        setSelectedTimeControl(mostPlayedTimeControl)

        // Filter games by the most played time control and get recent games
        const filteredGames = allGames
          .filter(game => {
            const gameTimeControl = getTimeControlCategory(game.time_control || 'Unknown')
            return gameTimeControl === mostPlayedTimeControl
          })
          .sort((a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime())
          .slice(0, 50) // Get last 50 games for trend analysis

        // Process data for the graph
        let processedData: EloDataPoint[] = filteredGames
          .filter(game => game.my_rating && game.my_rating > 0)
          .map(game => ({
            date: game.played_at,
            rating: game.my_rating,
            gameId: game.id,
            timeControl: getTimeControlCategory(game.time_control || 'Unknown')
          }))
          .reverse() // Reverse to show chronological order (oldest to newest)

        // Aggressively filter data points to reduce clutter
        // Keep only significant ELO changes and key points
        const cleanEloData: EloDataPoint[] = []
        let lastRating = -1
        let lastSignificantChange = -1
        
        processedData.forEach((point, index) => {
          const change = Math.abs(point.rating - lastRating)
          
          // Always keep first and last points
          if (index === 0 || index === processedData.length - 1) {
            cleanEloData.push(point)
            lastRating = point.rating
            lastSignificantChange = index
          }
          // Keep points with significant ELO changes (>= 5 points)
          else if (change >= 5) {
            cleanEloData.push(point)
            lastRating = point.rating
            lastSignificantChange = index
          }
          // Keep every 5th point to maintain some continuity
          else if (index % 5 === 0 && index - lastSignificantChange >= 3) {
            cleanEloData.push(point)
            lastRating = point.rating
            lastSignificantChange = index
          }
        })

        // Ensure we have at least 8 points for a meaningful graph
        if (cleanEloData.length < 8) {
          // Fallback: keep every 3rd point
          processedData = processedData.filter((_, index) => index % 3 === 0 || index === processedData.length - 1)
        } else {
          processedData = cleanEloData
        }

        setEloData(processedData)
      } catch (err) {
        console.error('Error fetching ELO history:', err)
        setError('Failed to load ELO trend data')
      } finally {
        setLoading(false)
      }
    }

    fetchEloHistory()
  }, [userId, platform])

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

  // Calculate graph dimensions and scaling
  const minRating = Math.min(...eloData.map(d => d.rating))
  const maxRating = Math.max(...eloData.map(d => d.rating))
  const ratingRange = maxRating - minRating
  const padding = Math.max(20, ratingRange * 0.05)
  const graphMin = Math.max(0, minRating - padding)
  const graphMax = maxRating + padding

  // Calculate trend direction
  const firstHalf = eloData.slice(0, Math.floor(eloData.length / 2))
  const secondHalf = eloData.slice(Math.floor(eloData.length / 2))
  
  const firstHalfAvg = firstHalf.reduce((sum, d) => sum + d.rating, 0) / firstHalf.length
  const secondHalfAvg = secondHalf.reduce((sum, d) => sum + d.rating, 0) / secondHalf.length
  
  const trendDirection = secondHalfAvg > firstHalfAvg + 10 ? 'improving' : 
                       secondHalfAvg < firstHalfAvg - 10 ? 'declining' : 'stable'

  const ratingDomain: [number, number] = [Math.floor(graphMin), Math.ceil(graphMax)]

  return (
    <ResponsiveTrendChart
      className={className}
      selectedTimeControl={selectedTimeControl}
      trendDirection={trendDirection}
      data={eloData}
    />
  )
}
