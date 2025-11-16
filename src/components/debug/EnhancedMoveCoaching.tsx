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

  if (!text) return null

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="bg-gradient-to-r from-slate-800/50 to-slate-700/50 p-4 rounded-lg border-l-4 border-sky-400 flex flex-col">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg font-semibold text-white">
            Move Analysis
          </span>
        </div>
        <div className="space-y-2">
          <p className="text-slate-200 leading-relaxed">
            {text}
          </p>
        </div>
      </div>
    </div>
  )
}
