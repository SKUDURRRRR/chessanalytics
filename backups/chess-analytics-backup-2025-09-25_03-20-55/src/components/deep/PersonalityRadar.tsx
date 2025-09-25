import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts'

interface PersonalityRadarProps {
  scores: {
    tactical: number
    positional: number
    aggressive: number
    patient: number
    novelty: number
    staleness: number
  }
}

export function PersonalityRadar({ scores }: PersonalityRadarProps) {
  // Debug logging to understand what data we're receiving
  console.log('PersonalityRadar - Received scores:', scores)
  
  // Handle case where scores might be undefined or missing properties
  if (!scores) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Chess Personality Radar</h3>
        <p className="text-gray-600">No personality data available. Run game analysis to generate personality insights.</p>
      </div>
    )
  }
  
  const data = [
    { skill: 'Tactical', score: scores.tactical || 0 },
    { skill: 'Positional', score: scores.positional || 0 },
    { skill: 'Aggressive', score: scores.aggressive || 0 },
    { skill: 'Novelty', score: scores.novelty || 0 },
    { skill: 'Patient', score: scores.patient || 0 },
    { skill: 'Staleness', score: scores.staleness || 0 },
  ]
  
  console.log('PersonalityRadar - Chart data:', data)

  const traitData = [
    { label: 'Tactical', score: Math.round(scores.tactical || 0), color: 'bg-blue-500' },
    { label: 'Positional', score: Math.round(scores.positional || 0), color: 'bg-green-500' },
    { label: 'Aggressive', score: Math.round(scores.aggressive || 0), color: 'bg-red-500' },
    { label: 'Novelty', score: Math.round(scores.novelty || 0), color: 'bg-purple-500' },
    { label: 'Patient', score: Math.round(scores.patient || 0), color: 'bg-indigo-500' },
    { label: 'Staleness', score: Math.round(scores.staleness || 0), color: 'bg-orange-500' },
  ]

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        Your Chess Personality Radar
        <span className="ml-2 text-gray-400 text-sm">?</span>
      </h3>

      <div className="h-64 mb-6">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data}>
            <PolarGrid />
            <PolarAngleAxis dataKey="skill" />
            <PolarRadiusAxis domain={[0, 100]} />
            <Radar
              name="Chess Skills"
              dataKey="score"
              stroke="#3B82F6"
              fill="#3B82F6"
              fillOpacity={0.3}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Trait Score Buttons */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {traitData.map(({ label, score, color }) => (
          <div key={label} className="bg-white rounded-lg border border-gray-200 p-3 text-center hover:shadow-md transition-shadow">
            <div
              className={`w-12 h-12 ${color} rounded-full flex items-center justify-center mx-auto mb-2`}
            >
              <span className="text-white font-bold text-sm">{score}</span>
            </div>
            <p className="text-xs font-medium text-gray-700">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
