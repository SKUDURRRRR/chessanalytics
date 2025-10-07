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
        <div className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 p-4 rounded-lg border-l-4 border-sky-400">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg font-semibold text-white">
              {move.isUserMove ? 'Move Analysis' : 'Opponent Move Analysis'}
            </span>
            {move.encouragementLevel && (
              <span className={`text-sm font-medium ${getEncouragementColor(move.encouragementLevel)}`}>
                {move.encouragementLevel >= 4 ? 'Excellent' : 
                 move.encouragementLevel >= 3 ? 'Good' : 
                 move.encouragementLevel >= 2 ? 'Needs Work' : 'Poor'}
              </span>
            )}
          </div>
          <p className="text-slate-200 leading-relaxed">{move.coachingComment}</p>
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

      {/* What Went Right */}
      {move.whatWentRight && (
        <div className="bg-emerald-500/10 p-4 rounded-lg border-l-4 border-emerald-400">
          <h4 className="font-semibold text-emerald-300 mb-2">
            What Went Right
          </h4>
          <p className="text-slate-200">{move.whatWentRight}</p>
        </div>
      )}

      {/* What Went Wrong */}
      {move.whatWentWrong && (
        <div className="bg-rose-500/10 p-4 rounded-lg border-l-4 border-rose-400">
          <h4 className="font-semibold text-rose-300 mb-2">
            What Went Wrong
          </h4>
          <p className="text-slate-200">{move.whatWentWrong}</p>
        </div>
      )}

      {/* How to Improve */}
      {move.howToImprove && (
        <div className="bg-amber-500/10 p-4 rounded-lg border-l-4 border-amber-400">
          <h4 className="font-semibold text-amber-300 mb-2">
            How to Improve
          </h4>
          <p className="text-slate-200">{move.howToImprove}</p>
        </div>
      )}

      {/* Tactical Insights */}
      {move.tacticalInsights && move.tacticalInsights.length > 0 && (
        <div className="bg-purple-500/10 p-4 rounded-lg border-l-4 border-purple-400">
          <h4 className="font-semibold text-purple-300 mb-3">
            Tactical Insights
          </h4>
          <ul className="space-y-2">
            {move.tacticalInsights.map((insight, index) => (
              <li key={index} className="text-slate-200 flex items-start gap-2">
                <span className="text-purple-400 mt-1">•</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Positional Insights */}
      {move.positionalInsights && move.positionalInsights.length > 0 && (
        <div className="bg-indigo-500/10 p-4 rounded-lg border-l-4 border-indigo-400">
          <h4 className="font-semibold text-indigo-300 mb-3">
            Positional Insights
          </h4>
          <ul className="space-y-2">
            {move.positionalInsights.map((insight, index) => (
              <li key={index} className="text-slate-200 flex items-start gap-2">
                <span className="text-indigo-400 mt-1">•</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Risks and Benefits */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Risks */}
        {move.risks && move.risks.length > 0 && (
          <div className="bg-rose-500/10 p-4 rounded-lg border-l-4 border-rose-400">
            <h4 className="font-semibold text-rose-300 mb-3">
              Risks
            </h4>
            <ul className="space-y-2">
              {move.risks.map((risk, index) => (
                <li key={index} className="text-slate-200 flex items-start gap-2">
                  <span className="text-rose-400 mt-1">•</span>
                  <span>{risk}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Benefits */}
        {move.benefits && move.benefits.length > 0 && (
          <div className="bg-emerald-500/10 p-4 rounded-lg border-l-4 border-emerald-400">
            <h4 className="font-semibold text-emerald-300 mb-3">
              Benefits
            </h4>
            <ul className="space-y-2">
              {move.benefits.map((benefit, index) => (
                <li key={index} className="text-slate-200 flex items-start gap-2">
                  <span className="text-emerald-400 mt-1">•</span>
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Learning Points */}
      {move.learningPoints && move.learningPoints.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 p-4 rounded-lg border-l-4 border-amber-400">
          <h4 className="font-semibold text-amber-300 mb-3">
            Learning Points
          </h4>
          <ul className="space-y-2">
            {move.learningPoints.map((point, index) => (
              <li key={index} className="text-slate-200 flex items-start gap-2">
                <span className="text-amber-400 mt-1">•</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Enhanced Fallback for moves without coaching data */}
      {!move.coachingComment && !move.whatWentRight && !move.whatWentWrong && move.explanation && (
        <div className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 p-4 rounded-lg border-l-4 border-sky-400">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg font-semibold text-white">
              {move.isUserMove ? 'Move Analysis' : 'Opponent Move Analysis'}
            </span>
            {move.encouragementLevel && (
              <span className={`text-sm font-medium ${getEncouragementColor(move.encouragementLevel)}`}>
                {move.encouragementLevel >= 4 ? 'Excellent' : 
                 move.encouragementLevel >= 3 ? 'Good' : 
                 move.encouragementLevel >= 2 ? 'Needs Work' : 'Poor'}
              </span>
            )}
          </div>
          <p className="text-slate-200 leading-relaxed">{move.explanation}</p>
        </div>
      )}
    </div>
  )
}
