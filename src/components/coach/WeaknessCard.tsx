/**
 * Weakness Card Component
 * Displays a user weakness with stats and recommendation
 */

import { Weakness } from '../../types'

interface WeaknessCardProps {
  weakness: Weakness
  onClick?: () => void
}

export function WeaknessCard({ weakness, onClick }: WeaknessCardProps) {
  const severityColor = weakness.severity === 'critical'
    ? 'border-rose-500/50 bg-rose-500/10'
    : 'border-amber-500/50 bg-amber-500/10'

  return (
    <div
      className={`rounded-2xl border ${severityColor} p-6 cursor-pointer transition-all hover:border-white/30 hover:bg-white/[0.08] ${onClick ? '' : 'cursor-default'}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-lg font-semibold text-white">{weakness.title}</h3>
        <span className={`px-2 py-1 rounded text-xs font-semibold ${
          weakness.severity === 'critical'
            ? 'bg-rose-500/20 text-rose-300'
            : 'bg-amber-500/20 text-amber-300'
        }`}>
          {weakness.severity}
        </span>
      </div>
      <p className="text-slate-300 text-sm mb-4">{weakness.description}</p>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-rose-400 transition-all"
              style={{ width: `${Math.max(0, Math.min(100, 100 - weakness.score))}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-1">Score: {weakness.score.toFixed(1)}</p>
        </div>
      </div>
      <p className="text-slate-400 text-xs mt-4 italic">{weakness.recommendation}</p>
    </div>
  )
}
