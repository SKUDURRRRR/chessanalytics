import React from 'react'
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

  const getGamePhaseColor = (phase: string) => {
    switch (phase) {
      case 'opening': return 'text-sky-300'
      case 'middlegame': return 'text-emerald-300'
      case 'endgame': return 'text-purple-300'
      default: return 'text-slate-300'
    }
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Main Coaching Comment */}
      {move.coachingComment && (
        <div className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 p-4 rounded-lg border-l-4 border-sky-400 h-48 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg font-semibold text-white">
              Move Analysis
            </span>
            {move.encouragementLevel && (
              <span className={`text-sm font-medium ${getEncouragementColor(move.encouragementLevel)}`}>
                {move.encouragementLevel >= 4 ? 'Excellent' : 
                 move.encouragementLevel >= 3 ? 'Good' : 
                 move.encouragementLevel >= 2 ? 'Needs Work' : 'Poor'}
              </span>
            )}
          </div>
          <p className="text-slate-200 leading-relaxed flex-1 overflow-hidden">{move.coachingComment}</p>
        </div>
      )}

      {/* Move Quality and Game Phase */}
      <div className="flex gap-2 flex-wrap">
        {move.moveQuality && (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getMoveQualityColor(move.moveQuality)}`}>
            {move.moveQuality.charAt(0).toUpperCase() + move.moveQuality.slice(1)}
          </span>
        )}
        {move.gamePhase && (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getGamePhaseColor(move.gamePhase)} bg-slate-600/30 border border-slate-400/30`}>
            {move.gamePhase.charAt(0).toUpperCase() + move.gamePhase.slice(1)}
          </span>
        )}
      </div>

      {/* Enhanced Fallback for moves without coaching data */}
      {!move.coachingComment && move.explanation && (
        <div className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 p-4 rounded-lg border-l-4 border-sky-400 h-48 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg font-semibold text-white">
              Move Analysis
            </span>
            {move.encouragementLevel && (
              <span className={`text-sm font-medium ${getEncouragementColor(move.encouragementLevel)}`}>
                {move.encouragementLevel >= 4 ? 'Excellent' : 
                 move.encouragementLevel >= 3 ? 'Good' : 
                 move.encouragementLevel >= 2 ? 'Needs Work' : 'Poor'}
              </span>
            )}
          </div>
          <p className="text-slate-200 leading-relaxed flex-1 overflow-hidden">{move.explanation}</p>
        </div>
      )}

    </div>
  )
}
