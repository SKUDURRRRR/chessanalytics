import { DeepAnalysisData } from '../../services/unifiedAnalysisService'

interface LongTermPlannerProps {
  data: DeepAnalysisData
  userId: string
}

export function LongTermPlanner({ data, userId }: LongTermPlannerProps) {
  // Debug: Log the data to see what we're receiving
  console.log('LongTermPlanner data:', data)
  console.log('Famous players data:', data?.famous_players)
  
  // Handle case where data might be null or properties might be undefined
  if (!data) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">{userId}'s Game Style</h2>
        <p className="text-gray-600">Loading analysis data...</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">{userId}'s Game Style</h2>

      <div className="space-y-6">
        {/* AI-Powered Style Analysis */}
        {data.ai_style_analysis ? (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-3">Style Analysis</h3>
            <div className="space-y-3">
              <p className="text-gray-700 leading-relaxed">
                {data.ai_style_analysis.style_summary}
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-white rounded p-3 border border-blue-200">
                  <h4 className="font-medium text-blue-800 mb-1">Key Characteristics</h4>
                  <p className="text-sm text-blue-700">{data.ai_style_analysis.characteristics}</p>
                </div>
                
                <div className="bg-white rounded p-3 border border-blue-200">
                  <h4 className="font-medium text-blue-800 mb-1">Main Strengths</h4>
                  <p className="text-sm text-blue-700">{data.ai_style_analysis.strengths}</p>
                </div>
                
                <div className="bg-white rounded p-3 border border-blue-200">
                  <h4 className="font-medium text-blue-800 mb-1">Playing Patterns</h4>
                  <p className="text-sm text-blue-700">{data.ai_style_analysis.playing_patterns}</p>
                </div>
                
                <div className="bg-white rounded p-3 border border-blue-200">
                  <h4 className="font-medium text-blue-800 mb-1">Improvement Focus</h4>
                  <p className="text-sm text-blue-700">{data.ai_style_analysis.improvement_focus}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4">
            <p className="text-gray-700 leading-relaxed">
              You are a <span className="font-semibold text-blue-800">{data.player_level || 'Unknown'}</span> player across <span className="font-semibold text-blue-800">{data.total_games || 0}</span> games.
              {data.playing_style && (
                <span className="block mt-2 text-gray-600 italic">
                  "{data.playing_style}"
                </span>
              )}
            </p>
          </div>
        )}

        {/* Personality Insights */}
        {data.personality_insights && (
          <div className="bg-green-50 rounded-lg p-4">
            <h3 className="font-semibold text-green-900 mb-3">Your Chess Personality Insights</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(data.personality_insights).map(([trait, insight]) => (
                <div key={trait} className="bg-white rounded p-3 border border-green-200">
                  <h4 className="font-medium text-green-800 capitalize mb-1">{trait}</h4>
                  <p className="text-sm text-green-700">{insight}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Famous Player Comparisons */}
        {data.famous_players ? (
          <div className="bg-purple-50 rounded-lg p-4">
            <h3 className="font-semibold text-purple-900 mb-3">Players with Similar Style</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Primary Comparison */}
              <div className="bg-white rounded-lg p-4 border border-purple-200">
                <div className="flex items-center mb-2">
                  <div className="w-3 h-3 bg-purple-500 rounded-full mr-2"></div>
                  <h4 className="font-semibold text-purple-800">{data.famous_players.primary.name}</h4>
                </div>
                <p className="text-sm text-purple-700 mb-2">{data.famous_players.primary.description}</p>
                <p className="text-xs text-purple-600 mb-2">Era: {data.famous_players.primary.era}</p>
                {data.famous_players.primary.similarity && (
                  <p className="text-sm text-purple-600 mb-2 italic bg-purple-50 p-2 rounded">
                    {data.famous_players.primary.similarity}
                  </p>
                )}
                <div className="flex flex-wrap gap-1">
                  {data.famous_players.primary.strengths.map((strength, index) => (
                    <span key={index} className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">
                      {strength}
                    </span>
                  ))}
                </div>
              </div>

              {/* Secondary Comparison */}
              <div className="bg-white rounded-lg p-4 border border-purple-200">
                <div className="flex items-center mb-2">
                  <div className="w-3 h-3 bg-purple-400 rounded-full mr-2"></div>
                  <h4 className="font-semibold text-purple-800">{data.famous_players.secondary.name}</h4>
                </div>
                <p className="text-sm text-purple-700 mb-2">{data.famous_players.secondary.description}</p>
                <p className="text-xs text-purple-600 mb-2">Era: {data.famous_players.secondary.era}</p>
                {data.famous_players.secondary.similarity && (
                  <p className="text-sm text-purple-600 mb-2 italic bg-purple-50 p-2 rounded">
                    {data.famous_players.secondary.similarity}
                  </p>
                )}
                <div className="flex flex-wrap gap-1">
                  {data.famous_players.secondary.strengths.map((strength, index) => (
                    <span key={index} className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">
                      {strength}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-yellow-50 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-900 mb-3">Players with Similar Style</h3>
            <p className="text-yellow-700 text-sm">Famous player comparisons will appear here once analysis is complete.</p>
            <p className="text-yellow-600 text-xs mt-2">Debug: famous_players data is {data.famous_players ? 'present' : 'missing'}</p>
          </div>
        )}

        {/* Improvement Roadmap */}
        <div className="bg-blue-50 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-3">Improvement Roadmap</h3>
          <ul className="space-y-3">
            <li className="flex items-start">
              <div className="w-2 h-2 bg-red-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
              <div>
                <span className="font-medium text-blue-800">Primary Focus:</span>
                <p className="text-blue-700 text-sm mt-1">{data.recommendations?.primary || 'Complete game analysis to get detailed insights'}</p>
              </div>
            </li>
            <li className="flex items-start">
              <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
              <div>
                <span className="font-medium text-blue-800">Secondary Focus:</span>
                <p className="text-blue-700 text-sm mt-1">{data.recommendations?.secondary || 'Focus on tactical patterns'}</p>
              </div>
            </li>
            <li className="flex items-start">
              <div className="w-2 h-2 bg-green-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
              <div>
                <span className="font-medium text-blue-800">Leverage Strength:</span>
                <p className="text-blue-700 text-sm mt-1">{data.recommendations?.leverage || 'Build on your current strengths'}</p>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
