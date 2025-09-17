import React from 'react'

interface OpeningPlayerCardProps {
  score: number
  phaseAccuracy: number
}

export function OpeningPlayerCard({ score, phaseAccuracy }: OpeningPlayerCardProps) {
  const getScoreLevel = (score: number) => {
    if (score >= 80) return { level: 'Excellent', color: 'text-green-600' }
    if (score >= 70) return { level: 'Good', color: 'text-blue-600' }
    if (score >= 60) return { level: 'Average', color: 'text-yellow-600' }
    return { level: 'Needs Work', color: 'text-red-600' }
  }

  const { level, color } = getScoreLevel(score)

  return (
    <div className="bg-blue-900 text-white rounded-lg shadow-md p-6">
      <div className="flex items-center mb-4">
        <div className="w-3 h-3 bg-blue-300 rounded-full mr-3"></div>
        <h3 className="text-lg font-semibold">Opening Player</h3>
      </div>
      
      <p className="text-blue-100 mb-4">
        You have {score >= 70 ? 'strong' : score >= 60 ? 'decent' : 'developing'} opening knowledge and understand {score >= 70 ? 'advanced' : 'basic'} theoretical concepts.
      </p>
      
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-blue-200">Your Score</span>
            <span className="text-2xl font-bold">{score}</span>
          </div>
          <p className={`text-sm ${color}`}>{level} - {score >= 70 ? 'Above average strength' : score >= 60 ? 'Average strength' : 'Below average strength'}</p>
        </div>
        
        <div>
          <p className="text-sm text-blue-200 mb-1">Improvement Focus</p>
          <p className="text-sm text-blue-100">
            {score >= 80 ? 'Maintain excellence' : score >= 70 ? 'Fine-tune skills' : 'Study opening theory'}
          </p>
        </div>
        
        <div>
          <p className="text-sm text-blue-200 mb-1">What this means</p>
          <p className="text-sm text-blue-100">
            Your opening knowledge {score >= 70 ? 'gives you strong positions' : score >= 60 ? 'helps you get reasonable positions' : 'needs improvement to avoid early disadvantages'} in most games.
          </p>
        </div>
        
        <div>
          <p className="text-sm text-blue-200 mb-1">Examples in your games</p>
          <ul className="text-sm text-blue-100 space-y-1">
            <li>• Opening theory</li>
            <li>• Development patterns</li>
            <li>• Center control</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
