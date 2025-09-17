import React from 'react'
import { DeepAnalysisData } from '../../services/deepAnalysisService'

interface LongTermPlannerProps {
  data: DeepAnalysisData
}

export function LongTermPlanner({ data }: LongTermPlannerProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">The Long-term Planner</h2>
      
      <div className="space-y-4">
        <p className="text-gray-700 leading-relaxed">
          You are a {data.playerLevel} player with {data.averageAccuracy.toFixed(1)}% average accuracy across {data.totalGames} games. 
          {data.playingStyle}
        </p>
        
        <div className="bg-blue-50 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">Improvement Roadmap</h3>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start">
              <span className="font-medium text-blue-800 mr-2">Primary Focus:</span>
              <span className="text-blue-700">{data.recommendations.primary}</span>
            </li>
            <li className="flex items-start">
              <span className="font-medium text-blue-800 mr-2">Secondary Focus:</span>
              <span className="text-blue-700">{data.recommendations.secondary}</span>
            </li>
            <li className="flex items-start">
              <span className="font-medium text-blue-800 mr-2">Leverage Strength:</span>
              <span className="text-blue-700">{data.recommendations.leverage}</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
