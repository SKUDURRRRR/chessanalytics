// Gap Filler Component - Add this to your SimpleAnalyticsPage
// This component detects ELO gaps and offers to fill them automatically

import { useState } from 'react'
import { UnifiedAnalysisService } from '../../services/unifiedAnalysisService'
import { AutoImportService } from '../../services/autoImportService'

interface EloGap {
  index: number
  prevRating: number
  currRating: number
  change: number
  prevDate: string
  currDate: string
  timeGapHours: number
}

interface GapFillerProps {
  userId: string
  platform: 'lichess' | 'chess.com'
  onImportComplete?: () => void
}

export function EloGapFiller({ userId, platform, onImportComplete }: GapFillerProps) {
  const [analyzing, setAnalyzing] = useState(false)
  const [gaps, setGaps] = useState<EloGap[]>([])
  const [importing, setImporting] = useState(false)
  const [importStatus, setImportStatus] = useState<string | null>(null)

  const analyzeGaps = async () => {
    setAnalyzing(true)
    try {
      // Fetch ELO history
      const games = await UnifiedAnalysisService.getEloHistory(
        userId.toLowerCase(),
        platform,
        500
      )

      if (!games || games.length === 0) {
        setGaps([])
        return
      }

      // Group by time control
      const byTimeControl: Record<string, any[]> = {}
      games.forEach(game => {
        const tc = getTimeControlCategory(game.time_control || 'Unknown')
        if (!byTimeControl[tc]) byTimeControl[tc] = []
        byTimeControl[tc].push(game)
      })

      // Find most played time control
      const mostPlayedTC = Object.entries(byTimeControl)
        .sort((a, b) => b[1].length - a[1].length)[0][0]

      const tcGames = byTimeControl[mostPlayedTC]
        .sort((a, b) => new Date(a.played_at).getTime() - new Date(b.played_at).getTime())

      // Take most recent 50
      const recent = tcGames.slice(-50)

      // Find gaps
      const foundGaps: EloGap[] = []
      for (let i = 1; i < recent.length; i++) {
        const prev = recent[i - 1]
        const curr = recent[i]
        const change = curr.my_rating - prev.my_rating

        if (Math.abs(change) > 50) {
          const prevDate = new Date(prev.played_at)
          const currDate = new Date(curr.played_at)
          const timeGapHours = (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60)

          foundGaps.push({
            index: i + 1,
            prevRating: prev.my_rating,
            currRating: curr.my_rating,
            change,
            prevDate: prev.played_at,
            currDate: curr.played_at,
            timeGapHours
          })
        }
      }

      console.log('Gap Filler Debug:', {
        totalGamesAnalyzed: recent.length,
        gapsFound: foundGaps.length,
        gaps: foundGaps.map(g => `Game #${g.index}: ${g.change > 0 ? '+' : ''}${g.change} ELO`)
      })

      setGaps(foundGaps)
    } catch (error) {
      console.error('Error analyzing gaps:', error)
    } finally {
      setAnalyzing(false)
    }
  }

  const fillGap = async (gap: EloGap) => {
    setImporting(true)
    setImportStatus(`Importing games for gap at game #${gap.index}...`)

    try {
      // Add 1-day buffer on each side
      const fromDate = new Date(new Date(gap.prevDate).getTime() - 24 * 60 * 60 * 1000).toISOString()
      const toDate = new Date(new Date(gap.currDate).getTime() + 24 * 60 * 60 * 1000).toISOString()

      // Use the AutoImportService to trigger targeted import
      const result = await AutoImportService.importMoreGames(
        userId,
        platform,
        500,
        { fromDate, toDate }
      )

      if (result.success) {
        setImportStatus(`Import started! Check back in a moment...`)

        // Refresh after a delay
        setTimeout(() => {
          setImportStatus('Import complete! Refresh to see updated data.')
          onImportComplete?.()
        }, 5000)
      } else {
        setImportStatus('Import failed. Please try again.')
      }
    } catch (error) {
      console.error('Error filling gap:', error)
      setImportStatus('Error during import. Please try again.')
    } finally {
      setTimeout(() => {
        setImporting(false)
        setImportStatus(null)
      }, 7000)
    }
  }

  function getTimeControlCategory(tc: string): string {
    if (!tc || tc === 'Unknown') return 'Unknown'

    if (tc.includes('/')) {
      const parts = tc.split('/')
      if (parts.length === 2) {
        const seconds = parseInt(parts[1])
        if (seconds >= 86400) return 'Daily'
      }
    } else if (tc.includes('+')) {
      const parts = tc.split('+')
      if (parts.length === 2) {
        const base = parseInt(parts[0])
        const inc = parseInt(parts[1])
        const total = base + 40 * inc

        if (total < 180) return 'Bullet'
        if (total < 480) return 'Blitz'
        if (total < 1500) return 'Rapid'
        return 'Classical'
      }
    }

    return 'Unknown'
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-200">
          ELO Gap Filler
        </h3>
        <button
          onClick={analyzeGaps}
          disabled={analyzing}
          className="rounded-md bg-blue-500/20 px-3 py-1.5 text-sm font-medium text-blue-300 transition hover:bg-blue-500/30 disabled:opacity-50"
        >
          {analyzing ? 'Analyzing...' : 'Detect Gaps'}
        </button>
      </div>

      {gaps.length === 0 && !analyzing && (
        <p className="text-sm text-slate-400">
          Click "Detect Gaps" to scan your ELO history for missing games
        </p>
      )}

      {gaps.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-slate-300">
            Found {gaps.length} large rating change{gaps.length > 1 ? 's' : ''}:
          </p>
          {gaps.map((gap) => (
            <div
              key={gap.index}
              className="flex items-center justify-between rounded border border-slate-600 bg-slate-900/40 p-3"
            >
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-200">
                  Game #{gap.index}: {gap.change > 0 ? '+' : ''}{gap.change} ELO
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {gap.prevRating} → {gap.currRating} • {gap.timeGapHours.toFixed(1)} hours apart
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {new Date(gap.prevDate).toLocaleDateString()} - {new Date(gap.currDate).toLocaleDateString()}
                </div>
              </div>
              <button
                onClick={() => fillGap(gap)}
                disabled={importing}
                className="ml-3 rounded bg-emerald-500/20 px-3 py-1.5 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/30 disabled:opacity-50"
              >
                Fill Gap
              </button>
            </div>
          ))}
        </div>
      )}

      {importStatus && (
        <div className="mt-3 rounded border border-blue-400/40 bg-blue-500/10 p-2 text-sm text-blue-300">
          {importStatus}
        </div>
      )}

      {gaps.length === 0 && !analyzing && gaps.length !== undefined && (
        <div className="mt-2 rounded border border-green-400/40 bg-green-500/10 p-2 text-sm text-green-300">
          ✓ No large ELO gaps detected! Your data looks good.
        </div>
      )}
    </div>
  )
}
