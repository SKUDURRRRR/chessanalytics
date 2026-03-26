import type { ProcessedMove } from '../../utils/moveProcessor'

interface EnhancedMoveCoachingProps {
  move: ProcessedMove
  className?: string
}

export function EnhancedMoveCoaching({ move, className = '' }: EnhancedMoveCoachingProps) {
  // Show coaching for both user moves and opponent moves
  // if (!move.isUserMove) {
  //   return null
  // }

  const text = move.coachingComment || move.explanation || ''

  const getEncouragementColor = (level: number) => {
    if (level >= 4) return 'text-emerald-300'
    if (level >= 3) return 'text-sky-300'
    if (level >= 2) return 'text-amber-300'
    return 'text-rose-300'
  }

  const getMoveQualityColor = (quality: string) => {
    switch (quality) {
      case 'brilliant': return 'text-purple-300 bg-purple-500/20 shadow-card'
      case 'best': return 'text-emerald-300 bg-emerald-500/20 shadow-card'
      case 'good': return 'text-sky-300 bg-sky-500/20 shadow-card'
      case 'acceptable': return 'text-amber-300 bg-amber-500/20 shadow-card'
      case 'inaccuracy': return 'text-orange-300 bg-orange-500/20 shadow-card'
      case 'mistake': return 'text-rose-300 bg-rose-500/20 shadow-card'
      case 'blunder': return 'text-red-300 bg-red-500/20 shadow-card'
      default: return 'text-gray-400 bg-surface-1 shadow-card'
    }
  }

  // Check if we have any coaching data to display
  const hasCoachingData = text ||
    move.whatWentWrong ||
    move.howToImprove ||
    (move.risks && move.risks.length > 0)

  if (!hasCoachingData) return null

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Main Coaching Comment */}
      {text && (
        <div className="bg-gradient-to-r from-surface-2/50 to-surface-3/50 p-4 rounded-lg border-l-4 border-sky-400">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg font-semibold text-white">
              Tal Coach Commentary
            </span>
            {move.moveQuality && (
              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getMoveQualityColor(move.moveQuality)}`}>
                {move.moveQuality}
              </span>
            )}
            {move.gamePhase && (
              <span className="px-2 py-1 rounded-full text-xs font-semibold text-gray-400 bg-surface-3/40 shadow-card">
                {move.gamePhase}
              </span>
            )}
          </div>
          <p className="text-gray-300 leading-relaxed">
            {text}
          </p>
        </div>
      )}


      {/* Risks */}
      {move.risks && move.risks.length > 0 && (
        <div className="bg-orange-900/20 shadow-card rounded-lg p-4">
          <h4 className="text-orange-300 font-semibold mb-2 flex items-center gap-2">
            <span className="text-lg">⚠️</span>
            Risks
          </h4>
          <ul className="space-y-1">
            {move.risks.map((risk, idx) => (
              <li key={idx} className="text-orange-100 text-sm leading-relaxed flex items-start gap-2">
                <span className="text-orange-400 mt-1">•</span>
                <span>{risk}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

    </div>
  )
}
