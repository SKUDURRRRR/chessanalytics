import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts'
import type { PersonalityScores } from '../../types'
import { useMemo, useState } from 'react'

interface PersonalityRadarProps {
  scores: PersonalityScores | null | undefined
}

const TRAIT_DISPLAY_ORDER: Array<keyof PersonalityScores> = [
  'tactical',
  'positional',
  'aggressive',
  'patient',
  'novelty',
  'staleness',
]

const TRAIT_LABELS: Record<keyof PersonalityScores, string> = {
  tactical: 'Tactical',
  positional: 'Positional',
  aggressive: 'Aggressive',
  patient: 'Patient',
  novelty: 'Novelty',
  staleness: 'Staleness',
}

const TRAIT_COLORS: Record<keyof PersonalityScores, string> = {
  tactical: 'bg-blue-500',
  positional: 'bg-green-500',
  aggressive: 'bg-red-500',
  patient: 'bg-yellow-500',
  novelty: 'bg-purple-500',
  staleness: 'bg-orange-500',
}

const TRAIT_DESCRIPTIONS: Record<keyof PersonalityScores, string> = {
  tactical: 'Accuracy in forcing sequences and tactical calculations',
  positional: 'Maintaining healthy structures and long-term advantages',
  aggressive: 'Willingness to seize initiative and create pressure',
  patient: 'Disciplined play and ability to consolidate advantages',
  novelty: 'Creativity and willingness to explore new ideas',
  staleness: 'Conservative play with few openings and solid structures',
}

const TRAIT_INSIGHTS: Record<keyof PersonalityScores, { high: string; medium: string; low: string }> = {
  tactical: {
    high: 'You recognize tactical motifs quickly and punish inaccuracies. Keep sharpening with puzzle rush or complex tactical studies to maintain your edge.',
    medium: 'You spot core tactics reliably, but sharper lines sometimes slip through. Daily puzzle sets and theme-based drills can raise your conversion rate.',
    low: 'Opponents often outcalculate you in forcing lines. Focus on tactical primers and visualization exercises to avoid tactical oversights.',
  },
  positional: {
    high: 'You understand pawn structures and piece placement at a deep level. Continue annotating classical positional games to keep your instincts sharp.',
    medium: 'Your sense of structure is solid, though imbalances sometimes go unused. Review model games in your main openings to learn typical positional plans.',
    low: 'You occasionally mis-handle long-term weaknesses. Study simplified positions and strategic endgame manuals to strengthen your positional vision.',
  },
  aggressive: {
    high: 'You thrive in initiative-driven positions and aren’t afraid to sacrifice when justified. Balance this by occasionally practicing solid systems to avoid overextension.',
    medium: 'You attack when opportunities arise but sometimes hesitate to press advantages. Practice sharp opening lines to build confidence launching attacks.',
    low: 'You rarely seize the initiative, allowing opponents to dictate play. Introduce dynamic openings and analyze famous attacking games to embrace active plans.',
  },
  patient: {
    high: 'You convert small advantages with disciplined play. Keep fine-tuning your endgame technique so patient play continues to pay dividends.',
    medium: 'You can consolidate when necessary but occasionally rush decisions. Play longer time controls and annotate your own endgames to reinforce patience.',
    low: 'Early simplifications or rushed decisions hurt your results. Practice technical endgames and slower games to build confidence in patient maneuvering.',
  },
  novelty: {
    high: 'You regularly surprise opponents with creative ideas. Build a repertoire notebook to catalogue the best novelties you uncover.',
    medium: 'You enjoy exploring new concepts but sometimes revert to familiar lines. Analyze instructive annotated games to widen your creative toolkit.',
    low: 'Your repertoire can become predictable. Allocate study time to exploring sidelines and modern theory updates to regain unpredictability.',
  },
  staleness: {
    high: 'A solid, low-risk style keeps you hard to beat. Add periodic opening refreshes to ensure opponents can’t easily prepare against you.',
    medium: 'You maintain structure but occasionally fall into repetitive patterns. Mix in dynamic systems to prevent opponents from steering you into comfort zones.',
    low: 'You vary your play frequently, reducing predictability. Continue rotating between systems while cataloguing which structures give you the best results.',
  },
}

const getTraitInsight = (trait: keyof PersonalityScores, score: number) => {
  const tier = score >= 70 ? 'high' : score >= 55 ? 'medium' : 'low'
  return `${TRAIT_DESCRIPTIONS[trait]}. ${TRAIT_INSIGHTS[trait][tier]}`
}

// Helper function to validate and normalize scores
function validateScores(scores: any): PersonalityScores | null {
  if (!scores || typeof scores !== 'object') {
    return null
  }

  const validatedScores: Partial<PersonalityScores> = {}
  let hasValidScores = false

  for (const trait of TRAIT_DISPLAY_ORDER) {
    const value = scores[trait]
    if (typeof value === 'number' && !isNaN(value)) {
      validatedScores[trait] = Math.max(0, Math.min(100, value))
      hasValidScores = true
    } else {
      validatedScores[trait] = 50 // Default neutral score
    }
  }

  return hasValidScores ? (validatedScores as PersonalityScores) : null
}

export function PersonalityRadar({ scores }: PersonalityRadarProps) {
  const [activeTrait, setActiveTrait] = useState<
    { label: string; score: number; description: string; rect: DOMRect | null } | null
  >(null)
  const validatedScores = validateScores(scores)
  
  if (!validatedScores) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-slate-200 shadow-xl shadow-black/40">
        <h3 className="mb-4 text-lg font-semibold text-white">Your Chess Personality Radar</h3>
        <p>No personality data available. Run game analysis to generate personality insights.</p>
      </div>
    )
  }

  const chartData = TRAIT_DISPLAY_ORDER.map((trait) => ({
    skill: TRAIT_LABELS[trait],
    score: validatedScores[trait],
  }))

  const traitBadges = TRAIT_DISPLAY_ORDER.map(trait => ({
    trait,
    label: TRAIT_LABELS[trait],
    score: Math.round(validatedScores[trait]),
    color: TRAIT_COLORS[trait],
  }))

  return (
    <div className="relative rounded-3xl border border-white/10 bg-white/[0.04] p-6 pb-16 text-slate-200 shadow-xl shadow-black/40">
      <h3 className="mb-4 flex items-center text-lg font-semibold text-white">
        Your Chess Personality Radar
        <span className="ml-2 text-sm text-slate-400">?</span>
      </h3>

      <div className="mb-8 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={chartData}>
            <PolarGrid stroke="rgba(255,255,255,0.08)" />
            <PolarAngleAxis dataKey="skill" stroke="rgba(226,232,240,0.7)" fontSize={12} />
            <PolarRadiusAxis domain={[0, 100]} stroke="rgba(226,232,240,0.4)" tick={{ fill: 'rgba(226,232,240,0.5)', fontSize: 10 }} />
            <Radar
              name="Chess Traits"
              dataKey="score"
              stroke="#38bdf8"
              fill="#38bdf8"
              fillOpacity={0.25}
              key="personality-radar"
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {traitBadges.map(({ trait, label, score, color }) => (
          <div 
            key={label} 
            className="group flex cursor-pointer flex-col items-center rounded-xl sm:rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-3 sm:px-4 sm:py-5 text-center transition hover:border-white/30 hover:bg-white/[0.08]"
            onMouseEnter={event => {
              const rect = event.currentTarget.getBoundingClientRect()
              setActiveTrait({
                label,
                score,
                description: getTraitInsight(trait, score),
                rect,
              })
            }}
            onMouseLeave={() => setActiveTrait(null)}
          >
            <div
              className={`mb-2 sm:mb-3 flex h-10 w-10 sm:h-14 sm:w-14 items-center justify-center rounded-full font-semibold text-white transition-transform group-hover:scale-105 ${color.replace('bg-', 'bg-opacity-30 bg-')}`}
            >
              <span className="text-xs sm:text-sm">{score}</span>
            </div>
            <p className="text-xs sm:text-sm font-semibold text-white leading-tight">{label}</p>
            <div className="mt-1.5 sm:mt-2 w-full">
              <div className="h-0.5 sm:h-1 w-full rounded-full bg-white/10">
                <div
                  className="h-0.5 sm:h-1 rounded-full transition-all duration-300 bg-emerald-400"
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {activeTrait && (
        <div
          className="pointer-events-none fixed z-50"
          style={{
            top: activeTrait.rect ? activeTrait.rect.bottom + 12 : undefined,
            left: activeTrait.rect ? activeTrait.rect.left + activeTrait.rect.width / 2 : undefined,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="max-w-sm rounded-[28px] border border-white/20 bg-slate-950/95 px-6 py-5 text-sm text-slate-100 shadow-[0_20px_40px_-20px_rgba(15,23,42,0.8)] ring-1 ring-cyan-400/20">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-300">Trait Focus</p>
                <h4 className="text-xl font-semibold text-white">{activeTrait.label}</h4>
              </div>
              <div className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                Score {activeTrait.score}
              </div>
            </div>
            <p className="mt-3 leading-relaxed text-slate-200">{activeTrait.description}</p>
          </div>
        </div>
      )}
    </div>
  )
}
