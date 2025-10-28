/**
 * Time Spent Page
 * Displays comprehensive time analytics for a player
 */

import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { TimeSpentAnalysis } from '../components/simple/TimeSpentAnalysis'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import type { Game } from '../types'

export function TimeSpentPage() {
  const { userId, platform } = useParams<{ userId: string; platform: string }>()
  const navigate = useNavigate()

  // Fetch games for the user
  const { data: games, isLoading, error } = useQuery({
    queryKey: ['games', userId, platform],
    queryFn: async () => {
      if (!userId || !platform) {
        throw new Error('User ID and platform are required')
      }

      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('user_id', userId)
        .eq('platform', platform)
        .order('played_at', { ascending: false })

      if (error) throw error
      return data as Game[]
    },
    enabled: !!userId && !!platform
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl animate-spin mb-4">⏳</div>
          <p className="text-gray-600">Loading game data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">❌</div>
          <p className="text-gray-900 font-semibold mb-2">Error loading data</p>
          <p className="text-gray-600 mb-4">{(error as Error).message}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  if (!games || games.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto p-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <div className="text-6xl mb-4">🕐</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No Games Found</h2>
            <p className="text-gray-600">
              No games found for {userId} on {platform}. Import some games to see time statistics.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <span className="text-xl">←</span>
            Back
          </button>
          <h1 className="text-3xl font-bold text-gray-900">
            Time Analysis for {userId}
          </h1>
          <p className="text-gray-600 mt-2">
            Platform: {platform} · {games.length} games analyzed
          </p>
        </div>

        {/* Time Spent Analysis */}
        <TimeSpentAnalysis games={games} />
      </div>
    </div>
  )
}
