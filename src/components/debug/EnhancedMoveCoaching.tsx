import { ProcessedMove } from '../../pages/GameAnalysisPage'

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

  // Debug: log if we have a coaching comment
  if (move.coachingComment && !move.coachingComment.includes('centipawn')) {
    console.log(`[EnhancedMoveCoaching] Move ${move.moveNumber} (${move.san}): Has coaching comment:`, move.coachingComment.substring(0, 50) + '...')
  }

  const getEncouragementColor = (level: number) => {
    if (level >= 4) return 'text-emerald-300'
    if (level >= 3) return 'text-sky-300'
    if (level >= 2) return 'text-amber-300'
    return 'text-rose-300'
  }

  const getMoveQualityColor = (quality: string) => {
    switch (quality) {
      case 'brilliant': return 'text-purple-300 bg-purple-500/20 border border-purple-400/30'
      case 'best': return 'text-emerald-300 bg-emerald-500/20 border border-emerald-400/30'
      case 'good': return 'text-sky-300 bg-sky-500/20 border border-sky-400/30'
      case 'acceptable': return 'text-amber-300 bg-amber-500/20 border border-amber-400/30'
      case 'inaccuracy': return 'text-orange-300 bg-orange-500/20 border border-orange-400/30'
      case 'mistake': return 'text-rose-300 bg-rose-500/20 border border-rose-400/30'
      case 'blunder': return 'text-red-300 bg-red-500/20 border border-red-400/30'
      default: return 'text-slate-300 bg-slate-500/20 border border-slate-400/30'
    }
  }

  // Check if we have any coaching data to display
  const hasCoachingData = text ||
    move.whatWentRight ||
    move.whatWentWrong ||
    move.howToImprove ||
    (move.tacticalInsights && move.tacticalInsights.length > 0) ||
    (move.positionalInsights && move.positionalInsights.length > 0) ||
    (move.risks && move.risks.length > 0) ||
    (move.benefits && move.benefits.length > 0) ||
    (move.learningPoints && move.learningPoints.length > 0)

  if (!hasCoachingData) return null

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Main Coaching Comment */}
      {text && (
        <div className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 p-4 rounded-lg border-l-4 border-sky-400">
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
              <span className="px-2 py-1 rounded-full text-xs font-semibold text-slate-300 bg-slate-600/30 border border-slate-500/30">
                {move.gamePhase}
              </span>
            )}
          </div>
          <p className="text-slate-200 leading-relaxed">
            {text}
          </p>
        </div>
      )}

      {/* What Went Right */}
      {move.whatWentRight && (
        <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-4">
          <h4 className="text-emerald-300 font-semibold mb-2 flex items-center gap-2">
            <span className="text-lg">✓</span>
            What Went Right
          </h4>
          <p className="text-emerald-100 text-sm leading-relaxed">
            {move.whatWentRight}
          </p>
        </div>
      )}

      {/* What Went Wrong */}
      {move.whatWentWrong && (
        <div className="bg-rose-900/20 border border-rose-500/30 rounded-lg p-4">
          <h4 className="text-rose-300 font-semibold mb-2 flex items-center gap-2">
            <span className="text-lg">✗</span>
            What Went Wrong
          </h4>
          <p className="text-rose-100 text-sm leading-relaxed">
            {move.whatWentWrong}
          </p>
        </div>
      )}

      {/* How to Improve */}
      {move.howToImprove && (
        <div className="bg-sky-900/20 border border-sky-500/30 rounded-lg p-4">
          <h4 className="text-sky-300 font-semibold mb-2 flex items-center gap-2">
            <span className="text-lg">💡</span>
            How to Improve
          </h4>
          <p className="text-sky-100 text-sm leading-relaxed">
            {move.howToImprove}
          </p>
        </div>
      )}

      {/* Tactical Insights */}
      {move.tacticalInsights && move.tacticalInsights.length > 0 && (
        <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-4">
          <h4 className="text-purple-300 font-semibold mb-2 flex items-center gap-2">
            <span className="text-lg">⚔️</span>
            Tactical Insights
          </h4>
          <ul className="space-y-1">
            {move.tacticalInsights.map((insight, idx) => (
              <li key={idx} className="text-purple-100 text-sm leading-relaxed flex items-start gap-2">
                <span className="text-purple-400 mt-1">•</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Positional Insights */}
      {move.positionalInsights && move.positionalInsights.length > 0 && (
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
          <h4 className="text-blue-300 font-semibold mb-2 flex items-center gap-2">
            <span className="text-lg">🎯</span>
            Positional Insights
          </h4>
          <ul className="space-y-1">
            {move.positionalInsights.map((insight, idx) => (
              <li key={idx} className="text-blue-100 text-sm leading-relaxed flex items-start gap-2">
                <span className="text-blue-400 mt-1">•</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Risks */}
      {move.risks && move.risks.length > 0 && (
        <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg p-4">
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

      {/* Benefits */}
      {move.benefits && move.benefits.length > 0 && (
        <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-4">
          <h4 className="text-emerald-300 font-semibold mb-2 flex items-center gap-2">
            <span className="text-lg">✨</span>
            Benefits
          </h4>
          <ul className="space-y-1">
            {move.benefits.map((benefit, idx) => (
              <li key={idx} className="text-emerald-100 text-sm leading-relaxed flex items-start gap-2">
                <span className="text-emerald-400 mt-1">•</span>
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Learning Points */}
      {move.learningPoints && move.learningPoints.length > 0 && (
        <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-4">
          <h4 className="text-amber-300 font-semibold mb-2 flex items-center gap-2">
            <span className="text-lg">📚</span>
            Learning Points
          </h4>
          <ul className="space-y-1">
            {move.learningPoints.map((point, idx) => (
              <li key={idx} className="text-amber-100 text-sm leading-relaxed flex items-start gap-2">
                <span className="text-amber-400 mt-1">•</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
