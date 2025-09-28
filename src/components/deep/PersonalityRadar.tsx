import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts'
import type { PersonalityScores } from '../../types'

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
  patient: 'bg-indigo-500',
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
  const validatedScores = validateScores(scores)
  
  if (!validatedScores) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Chess Personality Radar</h3>
        <p className="text-gray-600">No personality data available. Run game analysis to generate personality insights.</p>
      </div>
    )
  }

  const chartData = TRAIT_DISPLAY_ORDER.map((trait) => ({
    skill: TRAIT_LABELS[trait],
    score: validatedScores[trait],
  }))

  const traitBadges = TRAIT_DISPLAY_ORDER.map((trait) => ({
    label: TRAIT_LABELS[trait],
    score: Math.round(validatedScores[trait]),
    color: TRAIT_COLORS[trait],
    description: TRAIT_DESCRIPTIONS[trait],
  }))

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        Your Chess Personality Radar
        <span className="ml-2 text-gray-400 text-sm">?</span>
      </h3>

      <div className="h-64 mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={chartData}>
            <PolarGrid />
            <PolarAngleAxis dataKey="skill" />
            <PolarRadiusAxis domain={[0, 100]} />
            <Radar
              name="Chess Traits"
              dataKey="score"
              stroke="#3B82F6"
              fill="#3B82F6"
              fillOpacity={0.3}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {traitBadges.map(({ label, score, color, description }) => (
          <div 
            key={label} 
            className="bg-white rounded-lg border border-gray-200 p-3 text-center hover:shadow-md transition-shadow group cursor-help"
            title={description}
          >
            <div
              className={`w-12 h-12 ${color} rounded-full flex items-center justify-center mx-auto mb-2 group-hover:scale-105 transition-transform`}
            >
              <span className="text-white font-bold text-sm">{score}</span>
            </div>
            <p className="text-xs font-medium text-gray-700">{label}</p>
            <div className="mt-1">
              <div className="w-full bg-gray-200 rounded-full h-1">
                <div 
                  className={`h-1 rounded-full transition-all duration-300 ${
                    score >= 70 ? 'bg-green-500' : 
                    score >= 50 ? 'bg-yellow-500' : 
                    'bg-red-500'
                  }`}
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
