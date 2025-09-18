interface ScoreCardsProps {
  scores: {
    tactical: number
    positional: number
    aggressive: number
    patient: number
    endgame: number
    opening: number
  }
}

export function ScoreCards({ scores }: ScoreCardsProps) {
  const scoreData = [
    { label: 'Tactical', score: scores.tactical, color: 'bg-blue-500' },
    { label: 'Positional', score: scores.positional, color: 'bg-green-500' },
    { label: 'Patient', score: scores.patient, color: 'bg-purple-500' },
    { label: 'Endgame', score: scores.endgame, color: 'bg-orange-500' },
    { label: 'Opening', score: scores.opening, color: 'bg-cyan-500' },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {scoreData.map(({ label, score, color }) => (
        <div key={label} className="bg-white rounded-lg shadow-md p-4 text-center">
          <div
            className={`w-16 h-16 ${color} rounded-full flex items-center justify-center mx-auto mb-2`}
          >
            <span className="text-white font-bold text-lg">{score}</span>
          </div>
          <p className="text-sm font-medium text-gray-700">{label}</p>
        </div>
      ))}
    </div>
  )
}
