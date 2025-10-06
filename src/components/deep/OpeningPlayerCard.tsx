interface OpeningPlayerCardProps {
  score: number
  phaseAccuracy: number
  openingStats?: Array<{
    opening: string
    openingFamily: string
    games: number
    winRate: number
    averageElo: number
    identifiers: {
      openingFamilies: string[]
      openings: string[]
    }
  }>
  totalGames?: number
}

export function OpeningPlayerCard({
  score,
  phaseAccuracy: _phaseAccuracy,
  openingStats = [],
  totalGames = 0,
}: OpeningPlayerCardProps) {
  const getScoreLevel = (score: number) => {
    if (score >= 80) return { level: 'Excellent', color: 'text-green-400', bgColor: 'bg-green-500/20' }
    if (score >= 70) return { level: 'Good', color: 'text-blue-400', bgColor: 'bg-blue-500/20' }
    if (score >= 60) return { level: 'Average', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' }
    return { level: 'Needs Work', color: 'text-red-400', bgColor: 'bg-red-500/20' }
  }

  const { level, color, bgColor } = getScoreLevel(score)

  // Calculate opening insights from actual data
  const getOpeningInsights = () => {
    if (openingStats.length === 0) {
      return {
        bestOpening: null,
        worstOpening: null,
        totalOpeningGames: 0,
        averageWinRate: 0,
        recommendations: []
      }
    }

    const sortedByWinRate = [...openingStats].sort((a, b) => b.winRate - a.winRate)
    const bestOpening = sortedByWinRate[0]
    const worstOpening = sortedByWinRate[sortedByWinRate.length - 1]
    const totalOpeningGames = openingStats.reduce((sum, stat) => sum + stat.games, 0)
    const averageWinRate = openingStats.reduce((sum, stat) => sum + (stat.winRate * stat.games), 0) / totalOpeningGames

    const recommendations = []
    if (bestOpening && bestOpening.winRate > 60) {
      recommendations.push(`Continue playing ${bestOpening.opening} (${bestOpening.winRate.toFixed(0)}% win rate)`)
    }
    if (worstOpening && worstOpening.winRate < 40 && worstOpening.games >= 3) {
      recommendations.push(`Consider studying ${worstOpening.opening} or switching openings`)
    }
    if (openingStats.length < 3) {
      recommendations.push('Expand your opening repertoire for more variety')
    }

    return { bestOpening, worstOpening, totalOpeningGames, averageWinRate, recommendations }
  }

  const insights = getOpeningInsights()

  const getPersonalizedFeedback = () => {
    if (score >= 80) {
      return {
        assessment: "You have excellent opening knowledge and consistently achieve strong positions.",
        focus: "Maintain your high level and explore advanced variations.",
        meaning: "Your opening preparation gives you significant advantages in most games."
      }
    } else if (score >= 70) {
      return {
        assessment: "You have good opening knowledge with solid theoretical understanding.",
        focus: "Fine-tune your repertoire and study key variations more deeply.",
        meaning: "Your opening play helps you reach reasonable positions consistently."
      }
    } else if (score >= 60) {
      return {
        assessment: "You have developing opening knowledge with basic theoretical concepts.",
        focus: "Study opening principles and expand your repertoire systematically.",
        meaning: "Your opening knowledge helps you avoid major disadvantages in most games."
      }
    } else {
      return {
        assessment: "Your opening knowledge needs significant improvement to avoid early disadvantages.",
        focus: "Focus on fundamental opening principles and basic theory.",
        meaning: "Improving your opening play will prevent many early game problems."
      }
    }
  }

  const feedback = getPersonalizedFeedback()

  return (
    <div className="bg-gradient-to-br from-blue-900 to-blue-800 text-white rounded-lg shadow-lg p-6 border border-blue-700">
      <div className="flex items-center mb-4">
        <div className="w-3 h-3 bg-blue-300 rounded-full mr-3 animate-pulse"></div>
        <h3 className="text-lg font-semibold">Opening Performance</h3>
      </div>

      <p className="text-blue-100 mb-4 text-sm leading-relaxed">
        {feedback.assessment}
      </p>

      <div className="space-y-4">
        {/* Score Section */}
        <div className={`${bgColor} rounded-lg p-3 border border-blue-600/30`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-blue-200 font-medium">Opening Accuracy</span>
            <span className="text-2xl font-bold">{Math.round(score)}%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className={`text-sm font-medium ${color}`}>
              {level} - {score >= 70 ? 'Above average' : score >= 60 ? 'Average' : 'Below average'}
            </span>
            <div className="w-16 h-2 bg-blue-800 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${score >= 70 ? 'bg-green-400' : score >= 60 ? 'bg-yellow-400' : 'bg-red-400'}`}
                style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Improvement Focus */}
        <div>
          <p className="text-sm text-blue-200 mb-1 font-medium">Improvement Focus</p>
          <p className="text-sm text-blue-100">{feedback.focus}</p>
        </div>

        {/* What this means */}
        <div>
          <p className="text-sm text-blue-200 mb-1 font-medium">What this means</p>
          <p className="text-sm text-blue-100">{feedback.meaning}</p>
        </div>

        {/* Opening Statistics */}
        {insights.totalOpeningGames > 0 && (
          <div>
            <p className="text-sm text-blue-200 mb-2 font-medium">Your Opening Performance</p>
            <div className="space-y-2">
              {insights.bestOpening && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-blue-100">Best: {insights.bestOpening.opening}</span>
                  <span className="text-green-400 font-medium">{insights.bestOpening.winRate.toFixed(0)}% ({insights.bestOpening.games} games)</span>
                </div>
              )}
              {insights.worstOpening && insights.worstOpening.games >= 3 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-blue-100">Needs work: {insights.worstOpening.opening}</span>
                  <span className="text-red-400 font-medium">{insights.worstOpening.winRate.toFixed(0)}% ({insights.worstOpening.games} games)</span>
                </div>
              )}
              <div className="flex justify-between items-center text-sm">
                <span className="text-blue-100">Overall opening win rate</span>
                <span className="text-blue-300 font-medium">{insights.averageWinRate.toFixed(0)}%</span>
              </div>
            </div>
          </div>
        )}

        {/* Personalized Recommendations */}
        {insights.recommendations.length > 0 && (
          <div>
            <p className="text-sm text-blue-200 mb-2 font-medium">Personalized Recommendations</p>
            <ul className="text-sm text-blue-100 space-y-1">
              {insights.recommendations.map((rec, index) => (
                <li key={index} className="flex items-start">
                  <span className="text-blue-400 mr-2">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Key Areas */}
        <div>
          <p className="text-sm text-blue-200 mb-2 font-medium">Key Areas to Focus On</p>
          <div className="grid grid-cols-1 gap-2">
            <div className="flex items-center text-sm text-blue-100">
              <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
              Opening theory and principles
            </div>
            <div className="flex items-center text-sm text-blue-100">
              <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
              Development patterns and piece coordination
            </div>
            <div className="flex items-center text-sm text-blue-100">
              <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
              Center control and pawn structure
            </div>
            {score < 70 && (
              <div className="flex items-center text-sm text-blue-100">
                <span className="w-2 h-2 bg-yellow-400 rounded-full mr-2"></span>
                Avoiding early tactical mistakes
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
