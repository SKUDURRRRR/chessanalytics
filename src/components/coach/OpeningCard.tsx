/**
 * Opening Card Component
 * Displays opening repertoire stats with win rate bar and confidence
 */

import { OpeningRepertoire } from '../../types'

interface OpeningCardProps {
  opening: OpeningRepertoire
  onClick: () => void
  isExpanded: boolean
  showPlatform?: boolean
}

export function OpeningCard({ opening, onClick, isExpanded, showPlatform }: OpeningCardProps) {
  const winRate = opening.win_rate ?? 0
  const winColor = winRate > 55 ? 'emerald' : winRate < 45 ? 'rose' : 'gray'

  const isDue = opening.spaced_repetition_due
    ? new Date(opening.spaced_repetition_due) <= new Date()
    : false

  return (
    <div
      className={`rounded-lg shadow-card p-4 cursor-pointer transition-colors ${
        isExpanded
          ? 'bg-white/[0.06]'
          : 'bg-white/[0.04] hover:bg-white/[0.04]'
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-white truncate">{opening.opening_family}</h4>
          <div className="flex items-center gap-2">
            <p className="text-xs text-gray-500">{opening.games_played} games</p>
            {showPlatform && opening.platform && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                opening.platform === 'chess.com'
                  ? 'bg-green-500/10 text-green-400 border-green-500/20'
                  : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
              }`}>
                {opening.platform === 'chess.com' ? 'chess.com' : 'lichess'}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isDue && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 shadow-card">
              Due
            </span>
          )}
          <span className={`text-xs font-medium ${
            opening.color === 'white' ? 'text-gray-300' : 'text-gray-500'
          }`}>
            {opening.color === 'white' ? '\u2654' : '\u265A'}
          </span>
        </div>
      </div>

      {/* Win rate bar */}
      <div className="mb-2">
        <div className="flex justify-between text-[11px] mb-1">
          <span className={`text-${winColor}-400`}>{winRate.toFixed(0)}% win</span>
          {opening.avg_accuracy != null && (
            <span className="text-gray-500">{opening.avg_accuracy.toFixed(0)}% acc</span>
          )}
        </div>
        <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-colors ${
              winRate > 55 ? 'bg-emerald-500' : winRate < 45 ? 'bg-rose-500' : 'bg-gray-500'
            }`}
            style={{ width: `${Math.min(100, winRate)}%` }}
          />
        </div>
      </div>

      {/* Confidence */}
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-500">Confidence</span>
        <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500/60"
            style={{ width: `${opening.confidence_level}%` }}
          />
        </div>
        <span className="text-[10px] text-gray-500">{opening.confidence_level.toFixed(0)}%</span>
      </div>
    </div>
  )
}
