/**
 * Strength Card Component
 * Displays a user strength with celebration
 */

import { Strength } from '../../types'

interface StrengthCardProps {
  strength: Strength
}

export function StrengthCard({ strength }: StrengthCardProps) {
  return (
    <div className="rounded-2xl border border-emerald-500/50 bg-emerald-500/10 p-6">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{strength.icon}</span>
          <h3 className="text-lg font-semibold text-white">{strength.title}</h3>
        </div>
      </div>
      <p className="text-slate-300 text-sm mb-4">{strength.description}</p>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-400 transition-all"
              style={{ width: `${Math.max(0, Math.min(100, strength.score))}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-1">Score: {strength.score.toFixed(1)}</p>
        </div>
      </div>
    </div>
  )
}
