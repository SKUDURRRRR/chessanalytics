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
    if (score >= 80) return { level: 'Excellent', color: 'text-emerald-300', bgColor: 'bg-emerald-500/20' }
    if (score >= 70) return { level: 'Good', color: 'text-sky-300', bgColor: 'bg-sky-500/20' }
    if (score >= 60) return { level: 'Average', color: 'text-amber-300', bgColor: 'bg-amber-500/20' }
    return { level: 'Needs Work', color: 'text-rose-300', bgColor: 'bg-rose-500/20' }
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
    <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-200 shadow-xl shadow-black/40">
      <div className="flex items-center mb-4">
        <div className="mr-3 h-3 w-3 animate-pulse rounded-full bg-sky-300" />
        <h3 className="text-lg font-semibold text-white">Opening Performance</h3>
      </div>

      <p className="mb-4 text-sm text-slate-200">
        {feedback.assessment}
      </p>

      <div className="space-y-4">
        {/* Score Section */}
        <div className={`${bgColor} rounded-2xl border border-white/10 p-4`}> 
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-slate-200">Opening Accuracy</span>
            <span className="text-2xl font-semibold text-white">{Math.round(score)}%</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className={`font-medium ${color}`}>
              {level} - {score >= 70 ? 'Above average' : score >= 60 ? 'Average' : 'Below average'}
            </span>
            <div className="h-2 w-20 overflow-hidden rounded-full bg-black/40">
              <div 
                className={`h-full transition-all duration-500 ${score >= 70 ? 'bg-emerald-400' : score >= 60 ? 'bg-amber-300' : 'bg-rose-400'}`}
                style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Improvement Focus */}
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Improvement Focus</p>
          <p className="text-sm text-slate-200">{feedback.focus}</p>
        </div>

        {/* What this means */}
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">What this means</p>
          <p className="text-sm text-slate-200">{feedback.meaning}</p>
        </div>

        {/* Opening Statistics */}
        {insights.totalOpeningGames > 0 && (
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">Your Opening Performance</p>
            <div className="space-y-2">
              {insights.bestOpening && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-200">Best: {insights.bestOpening.opening}</span>
                  <span className="font-semibold text-emerald-300">{insights.bestOpening.winRate.toFixed(0)}% ({insights.bestOpening.games} games)</span>
                </div>
              )}
              {insights.worstOpening && insights.worstOpening.games >= 3 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-200">Needs work: {insights.worstOpening.opening}</span>
                  <span className="font-semibold text-rose-300">{insights.worstOpening.winRate.toFixed(0)}% ({insights.worstOpening.games} games)</span>
                </div>
              )}
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-200">Overall opening win rate</span>
                <span className="font-semibold text-sky-300">{insights.averageWinRate.toFixed(0)}%</span>
              </div>
            </div>
          </div>
        )}

        {/* Personalized Recommendations */}
        {insights.recommendations.length > 0 && (
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">Personalized Recommendations</p>
            <ul className="space-y-1 text-sm text-slate-200">
              {insights.recommendations.map((rec, index) => (
                <li key={index} className="flex items-start">
                  <span className="mr-2 text-sky-300">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Key Areas */}
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">Key Areas to Focus On</p>
          <div className="grid grid-cols-1 gap-2">
            <div className="flex items-center text-sm text-slate-200">
              <span className="mr-2 h-2 w-2 rounded-full bg-sky-300"></span>
              Opening theory and principles
            </div>
            <div className="flex items-center text-sm text-slate-200">
              <span className="mr-2 h-2 w-2 rounded-full bg-sky-300"></span>
              Development patterns and piece coordination
            </div>
            <div className="flex items-center text-sm text-slate-200">
              <span className="mr-2 h-2 w-2 rounded-full bg-sky-300"></span>
              Center control and pawn structure
            </div>
            {score < 70 && (
              <div className="flex items-center text-sm text-slate-200">
                <span className="mr-2 h-2 w-2 rounded-full bg-amber-300"></span>
                Avoiding early tactical mistakes
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
