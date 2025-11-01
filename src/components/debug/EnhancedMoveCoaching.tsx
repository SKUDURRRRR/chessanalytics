import { ProcessedMove } from '../../pages/GameAnalysisPage'

interface EnhancedMoveCoachingProps {
  move: ProcessedMove
  className?: string
}

// Generate positional guidance based on game phase and move number
function generatePositionalGuidance(move: ProcessedMove): string | null {
  const gamePhase = move.gamePhase || 'opening'
  const moveNumber = move.moveNumber || 0

  // Only add guidance for non-brilliant, non-best moves
  if (move.classification === 'brilliant' || move.classification === 'best') {
    return null
  }

  if (gamePhase === 'opening' || moveNumber <= 15) {
    const developmentAdvice = [
      'Look to develop knights and bishops toward the center.',
      'Focus on developing pieces and controlling the center.',
      'Consider castling to ensure king safety.',
      'Control central squares with pawns and pieces.',
      'Develop pieces before moving the same piece twice.'
    ]
    // Use move number for consistency instead of random
    return developmentAdvice[moveNumber % developmentAdvice.length]
  } else if (gamePhase === 'middlegame' || moveNumber <= 40) {
    const middlegameAdvice = [
      'Look for tactical opportunities and threats.',
      'Consider piece coordination and activity.',
      'Evaluate pawn structure and weak squares.',
      'Look for ways to improve piece placement.',
      'Search for tactical motifs like pins, forks, or skewers.',
      'Consider where your opponent\'s pieces are weakly placed.'
    ]
    return middlegameAdvice[moveNumber % middlegameAdvice.length]
  } else if (gamePhase === 'endgame') {
    const endgameAdvice = [
      'Activate your king - it\'s a strong piece in the endgame.',
      'Push passed pawns and restrict opponent\'s pawns.',
      'Look for opportunities to create passed pawns.',
      'Coordinate pieces to support pawn advancement.',
      'Calculate carefully - precision matters in the endgame.',
      'Keep your king active and centralized.'
    ]
    return endgameAdvice[moveNumber % endgameAdvice.length]
  }

  return null
}

export function EnhancedMoveCoaching({ move, className = '' }: EnhancedMoveCoachingProps) {
  // Show coaching for both user moves and opponent moves
  // if (!move.isUserMove) {
  //   return null
  // }

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

  // Get positional guidance for this move
  const positionalGuidance = generatePositionalGuidance(move)

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Main Coaching Comment */}
      {move.coachingComment && (
        <div className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 p-4 rounded-lg border-l-4 border-sky-400 lg:h-48 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg font-semibold text-white">
              Move Analysis
            </span>
          </div>
          <div className="space-y-2 flex-1 overflow-auto">
            <p className="text-slate-200 leading-relaxed">{move.coachingComment}</p>
            {positionalGuidance && (
              <p className="text-slate-300 text-sm leading-relaxed pt-2 border-t border-white/10">
                {positionalGuidance}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Enhanced Fallback for moves without coaching data */}
      {!move.coachingComment && move.explanation && (
        <div className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 p-4 rounded-lg border-l-4 border-sky-400 lg:h-48 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg font-semibold text-white">
              Move Analysis
            </span>
          </div>
          <div className="space-y-2 flex-1 overflow-auto">
            <p className="text-slate-200 leading-relaxed">{move.explanation}</p>
            {positionalGuidance && (
              <p className="text-slate-300 text-sm leading-relaxed pt-2 border-t border-white/10">
                {positionalGuidance}
              </p>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
