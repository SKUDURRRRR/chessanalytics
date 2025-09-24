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
  
  const data = [
    { skill: 'Tactical', score: scores.tactical },
    { skill: 'Positional', score: scores.positional },
    { skill: 'Aggressive', score: scores.aggressive },
    { skill: 'Novelty', score: scores.novelty },
    { skill: 'Patient', score: scores.patient },
    { skill: 'Staleness', score: scores.staleness },
  ]
  
  console.log('PersonalityRadar - Chart data:', data)

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        Your Chess Personality Radar
        <span className="ml-2 text-gray-400 text-sm">?</span>
      </h3>

      <div className="h-64">
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
    </div>
  )
}
