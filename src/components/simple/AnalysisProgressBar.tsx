import type { AnalysisProgress as AnalysisProgressData } from '../../services/unifiedAnalysisService'

const PHASE_LABELS: Record<string, string> = {
  fetching: 'Preparing games',
  analyzing: 'Analyzing moves',
  calculating: 'Calculating insights',
  saving: 'Saving results',
  complete: 'Analysis complete'
}

const PHASE_DESCRIPTIONS: Record<string, string> = {
  fetching: 'Collecting your recent games and normalising the data.',
  analyzing: 'Running the engine on every position to evaluate your play.',
  calculating: 'Aggregating move quality and building your summaries.',
  saving: 'Persisting results so they show up across the app.',
  complete: 'All done. Refreshing your analytics with the latest results.'
}

interface AnalysisProgressBarProps {
  analyzing: boolean
  progress: AnalysisProgressData | null
}

function formatEta(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds))
  if (seconds === 0) {
    return ''
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes === 0) {
    return `${remainingSeconds}s`
  }

  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  const parts: string[] = [`${hours}h`]

  if (remainingMinutes > 0) {
    parts.push(`${remainingMinutes}m`)
  }

  if (remainingSeconds > 0 && hours < 2) {
    parts.push(`${remainingSeconds}s`)
  }

  return parts.join(' ')
}

export function AnalysisProgressBar({ analyzing, progress }: AnalysisProgressBarProps) {
  const isComplete = progress?.is_complete ?? false

  if (!analyzing && (!progress || isComplete)) {
    return null
  }

  const percentage = progress ? Math.min(Math.max(progress.progress_percentage ?? 0, 0), 100) : 0
  const analyzedGames = progress?.analyzed_games ?? 0
  const totalGames = progress?.total_games ?? 0
  const hasTotals = totalGames > 0
  const rawPhase = progress?.current_phase?.toLowerCase()
  const phaseKey = rawPhase && PHASE_LABELS[rawPhase] ? rawPhase : isComplete ? 'complete' : 'fetching'
  const phaseLabel = progress ? PHASE_LABELS[phaseKey] ?? 'Analyzing games' : 'Preparing analysis'
  const phaseDescription = progress ? PHASE_DESCRIPTIONS[phaseKey] ?? 'Crunching games to build your insights.' : 'Setting up the engine and fetching your games.'
  const eta = progress?.estimated_time_remaining
  const etaText = typeof eta === 'number' && eta > 0 ? formatEta(eta) : null

  return (
    <div className="w-full max-w-md mx-auto mt-4 mb-6 rounded-lg border border-blue-100 bg-blue-50/70 p-4 shadow-sm">
      <div className="flex items-center justify-between text-sm text-blue-900">
        <span className="font-medium">{phaseLabel}</span>
        {hasTotals && (
          <span className="text-xs text-blue-700">{analyzedGames}/{totalGames} games</span>
        )}
      </div>

      <div className="relative mt-3 h-2.5 w-full overflow-hidden rounded-full bg-blue-100">
        {progress ? (
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-[width] duration-300 ease-out"
            style={{ width: `${percentage}%` }}
          ></div>
        ) : (
          <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-blue-200 via-blue-100 to-blue-200"></div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-blue-700">
        <span>{progress ? `${percentage}% complete` : 'Getting everything ready...'}</span>
        {etaText && <span>~{etaText} remaining</span>}
      </div>

      <p className="mt-2 text-xs text-blue-800">{phaseDescription}</p>
    </div>
  )
}
