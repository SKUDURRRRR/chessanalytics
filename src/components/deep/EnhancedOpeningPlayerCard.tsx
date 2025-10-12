import React, { useState } from 'react'
import { EnhancedOpeningAnalysis, OpeningMistake, StudyRecommendation, StyleRecommendation, TrendPoint } from '../../types'

interface EnhancedOpeningPlayerCardProps {
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
  // Enhanced analysis data
  enhancedAnalysis?: EnhancedOpeningAnalysis
  // Personality scores for style display
  personalityScores?: Record<string, number>
}

// Helper to normalize API data (snake_case to camelCase)
function normalizeEnhancedAnalysis(data: any): EnhancedOpeningAnalysis | undefined {
  if (!data) return undefined
  
  const normalized: any = {
    openingWinRate: data.opening_win_rate ?? data.openingWinRate ?? 0,
    specificMistakes: (data.specific_mistakes || data.specificMistakes || []).map((m: any) => ({
      move: m.move,
      moveNotation: m.move_notation || m.moveNotation,
      mistake: m.mistake,
      correctMove: m.correct_move || m.correctMove,
      explanation: m.explanation,
      severity: m.severity,
      centipawnLoss: m.centipawn_loss ?? m.centipawnLoss,
      classification: m.classification,
      fen: m.fen
    })),
    styleRecommendations: (data.style_recommendations || data.styleRecommendations || []).map((r: any) => ({
      openingName: r.opening_name || r.openingName,
      compatibilityScore: r.compatibility_score ?? r.compatibilityScore,
      reasoning: r.reasoning,
      suggestedLines: r.suggested_lines || r.suggestedLines || [],
      priority: r.priority
    })),
    actionableInsights: data.actionable_insights || data.actionableInsights || [],
    improvementTrend: (data.improvement_trend || data.improvementTrend || []).map((t: any) => ({
      date: t.date,
      openingWinRate: t.opening_win_rate ?? t.openingWinRate,
      games: t.games,
      accuracy: t.accuracy
    })),
    repertoireAnalysis: {
      diversityScore: data.repertoire_analysis?.diversity_score ?? data.repertoireAnalysis?.diversityScore ?? 0,
      whiteOpenings: data.repertoire_analysis?.white_openings || data.repertoireAnalysis?.whiteOpenings || [],
      blackOpenings: data.repertoire_analysis?.black_openings || data.repertoireAnalysis?.blackOpenings || [],
      mostSuccessful: {
        opening: data.repertoire_analysis?.most_successful?.opening || data.repertoireAnalysis?.mostSuccessful?.opening || 'None',
        winRate: data.repertoire_analysis?.most_successful?.win_rate ?? data.repertoire_analysis?.most_successful?.winRate ?? data.repertoireAnalysis?.mostSuccessful?.winRate ?? 0,
        games: data.repertoire_analysis?.most_successful?.games || data.repertoireAnalysis?.mostSuccessful?.games || 0
      },
      needsWork: {
        opening: data.repertoire_analysis?.needs_work?.opening || data.repertoireAnalysis?.needsWork?.opening || 'None',
        winRate: data.repertoire_analysis?.needs_work?.win_rate ?? data.repertoire_analysis?.needs_work?.winRate ?? data.repertoireAnalysis?.needsWork?.winRate ?? 0,
        games: data.repertoire_analysis?.needs_work?.games || data.repertoireAnalysis?.needsWork?.games || 0
      },
      styleMatchScore: data.repertoire_analysis?.style_match_score ?? data.repertoireAnalysis?.styleMatchScore ?? 0
    }
  }
  
  return normalized
}

export function EnhancedOpeningPlayerCard({
  score,
  phaseAccuracy: _phaseAccuracy,
  openingStats = [],
  totalGames = 0,
  enhancedAnalysis: rawEnhancedAnalysis,
  personalityScores = {}
}: EnhancedOpeningPlayerCardProps) {
  const [selectedTab, setSelectedTab] = useState<'overview' | 'mistakes' | 'study' | 'progress'>('overview')
  const [selectedMistake, setSelectedMistake] = useState<OpeningMistake | null>(null)
  
  // Normalize the enhanced analysis data
  const enhancedAnalysis = normalizeEnhancedAnalysis(rawEnhancedAnalysis)
  
  // Debug logging
  React.useEffect(() => {
    console.log('[EnhancedOpeningPlayerCard] Raw analysis:', rawEnhancedAnalysis)
    console.log('[EnhancedOpeningPlayerCard] Normalized analysis:', enhancedAnalysis)
    if (enhancedAnalysis) {
      console.log('  - Mistakes:', enhancedAnalysis.specificMistakes?.length || 0)
      console.log('  - Recommendations:', enhancedAnalysis.styleRecommendations?.length || 0)
      console.log('  - Insights:', enhancedAnalysis.actionableInsights?.length || 0)
      console.log('  - Trend points:', enhancedAnalysis.improvementTrend?.length || 0)
    }
  }, [rawEnhancedAnalysis, enhancedAnalysis])
  
  // Use opening win rate from enhanced analysis if available, otherwise use score
  const effectiveScore = enhancedAnalysis?.openingWinRate || score
  
  // Get dominant personality trait
  const getDominantTrait = () => {
    const traits = ['aggressive', 'tactical', 'positional', 'patient']
    let maxTrait = 'balanced'
    let maxScore = 0
    
    for (const trait of traits) {
      const score = personalityScores[trait] || 0
      if (score > maxScore) {
        maxScore = score
        maxTrait = trait
      }
    }
    
    return { trait: maxTrait, score: Math.round(maxScore) }
  }
  
  const dominantTrait = getDominantTrait()

  const getScoreLevel = (score: number) => {
    if (score >= 80) return { level: 'Excellent', color: 'text-emerald-300', bgColor: 'bg-emerald-500/20' }
    if (score >= 70) return { level: 'Good', color: 'text-sky-300', bgColor: 'bg-sky-500/20' }
    if (score >= 60) return { level: 'Average', color: 'text-amber-300', bgColor: 'bg-amber-500/20' }
    return { level: 'Needs Work', color: 'text-rose-300', bgColor: 'bg-rose-500/20' }
  }

  const { level, color, bgColor } = getScoreLevel(effectiveScore)

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

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'mistakes', label: 'Mistakes', icon: '🎯' },
    { id: 'study', label: 'Study', icon: '📚' },
    { id: 'progress', label: 'Progress', icon: '📈' }
  ]

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-200 shadow-xl shadow-black/40">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 space-y-3 sm:space-y-0">
        <div className="flex items-center">
          <div className="mr-3 h-3 w-3 animate-pulse rounded-full bg-sky-300" />
          <h3 className="text-lg font-semibold text-white">Enhanced Opening Analysis</h3>
        </div>
        <div className="text-left sm:text-right">
          <div className="text-2xl font-bold text-white">{Math.round(effectiveScore)}%</div>
          <div className="text-xs text-slate-300">Opening Win Rate</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex sm:flex sm:space-x-1 grid grid-cols-2 gap-2 sm:gap-0 mb-6 bg-slate-800/50 rounded-xl p-1 sm:p-1 overflow-x-auto sm:overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedTab(tab.id as any)}
            className={`flex-1 sm:flex-1 min-w-0 flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
              selectedTab === tab.id
                ? 'bg-sky-500 text-white shadow-lg'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
          >
            <span className="text-sm sm:text-base">{tab.icon}</span>
            <span className="hidden xs:inline sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {selectedTab === 'overview' && (
        <div className="space-y-6">
          <p className="text-sm text-slate-200 mb-4">
            {feedback.assessment}
          </p>

          {/* Player Style Card */}
          {dominantTrait.score > 50 && (
            <div className="bg-gradient-to-r from-sky-500/20 to-purple-500/20 border border-sky-500/30 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-slate-300 mb-1">Your Playing Style</div>
                  <div className="text-xl font-bold text-white capitalize">
                    {dominantTrait.trait} {dominantTrait.trait !== 'balanced' && (
                      <span className="text-sky-300">({dominantTrait.score}/100)</span>
                    )}
                  </div>
                </div>
                <div className="text-4xl">
                  {dominantTrait.trait === 'aggressive' && '⚔️'}
                  {dominantTrait.trait === 'tactical' && '🎯'}
                  {dominantTrait.trait === 'positional' && '🏰'}
                  {dominantTrait.trait === 'patient' && '🛡️'}
                  {dominantTrait.trait === 'balanced' && '⚖️'}
                </div>
              </div>
            </div>
          )}

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={`${bgColor} rounded-xl p-4`}>
              <div className="text-lg font-bold text-white">{Math.round(effectiveScore)}%</div>
              <div className="text-xs text-slate-300">Opening Win Rate</div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4">
              <div className="text-lg font-bold text-emerald-300">{insights.totalOpeningGames}</div>
              <div className="text-xs text-slate-300">Games Played</div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4">
              <div className="text-lg font-bold text-blue-300">{openingStats.length}</div>
              <div className="text-xs text-slate-300">Openings</div>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4">
              <div className="text-lg font-bold text-purple-300">
                {enhancedAnalysis?.repertoireAnalysis?.styleMatchScore?.toFixed(0) || insights.averageWinRate.toFixed(0)}%
              </div>
              <div className="text-xs text-slate-300">
                {enhancedAnalysis?.repertoireAnalysis ? 'Style Match' : 'Win Rate'}
              </div>
            </div>
          </div>
          
          {/* Actionable Insights */}
          {enhancedAnalysis?.actionableInsights && enhancedAnalysis.actionableInsights.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
              <h5 className="font-semibold text-amber-300 mb-3 flex items-center">
                <span className="mr-2">💡</span>
                Key Insights for Your Style
              </h5>
              <div className="space-y-2">
                {enhancedAnalysis.actionableInsights.map((insight, idx) => (
                  <p key={idx} className="text-sm text-slate-200 leading-relaxed">
                    • {insight}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Improvement Focus */}
          <div className="bg-slate-800/30 rounded-xl p-4">
            <h5 className="font-semibold text-white mb-2">Focus Areas</h5>
            <p className="text-sm text-slate-200 mb-2">{feedback.focus}</p>
            <p className="text-xs text-slate-400">{feedback.meaning}</p>
          </div>

          {/* Opening Statistics */}
          {insights.totalOpeningGames > 0 && (
            <div className="bg-slate-800/30 rounded-xl p-4">
              <h5 className="font-semibold text-white mb-3">Your Opening Performance</h5>
              <div className="space-y-3">
                {insights.bestOpening && (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-sm space-y-1 sm:space-y-0">
                    <span className="text-slate-200">Best: {insights.bestOpening.opening}</span>
                    <span className="font-semibold text-emerald-300">{insights.bestOpening.winRate.toFixed(0)}% ({insights.bestOpening.games} games)</span>
                  </div>
                )}
                {insights.worstOpening && insights.worstOpening.games >= 3 && (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-sm space-y-1 sm:space-y-0">
                    <span className="text-slate-200">Needs work: {insights.worstOpening.opening}</span>
                    <span className="font-semibold text-rose-300">{insights.worstOpening.winRate.toFixed(0)}% ({insights.worstOpening.games} games)</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {selectedTab === 'mistakes' && (
        <div className="space-y-4">
          {enhancedAnalysis?.specificMistakes && enhancedAnalysis.specificMistakes.length > 0 ? (
            <>
              <div className="flex items-center justify-between">
                <h5 className="font-semibold text-white">Recent Mistakes</h5>
                <span className="text-sm text-slate-400">{enhancedAnalysis.specificMistakes.length} mistakes found</span>
              </div>
              
              <div className="space-y-3">
                {enhancedAnalysis.specificMistakes.map((mistake, index) => (
                  <div 
                    key={index}
                    className={`p-4 rounded-xl border cursor-pointer transition-all hover:bg-slate-800/30 ${
                      mistake.severity === 'critical' ? 'border-red-400/50 bg-red-500/10' :
                      mistake.severity === 'major' ? 'border-orange-400/50 bg-orange-500/10' :
                      'border-yellow-400/50 bg-yellow-500/10'
                    }`}
                    onClick={() => setSelectedMistake(mistake)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-white">
                          Move {mistake.move}: {mistake.moveNotation}
                        </div>
                        <div className="text-sm text-slate-300">
                          {mistake.classification.charAt(0).toUpperCase() + mistake.classification.slice(1)} • 
                          {mistake.centipawnLoss} point loss
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-sky-300">
                          Best: {mistake.correctMove}
                        </div>
                        <div className="text-xs text-slate-400">
                          Click for details
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">🎉</div>
              <h5 className="font-semibold text-white mb-2">No Major Mistakes Found!</h5>
              <p className="text-sm text-slate-300">Your opening play is solid. Keep up the good work!</p>
            </div>
          )}

          {/* Mistake Detail Modal */}
          {selectedMistake && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-slate-800 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between items-start mb-4">
                  <h4 className="text-xl font-bold text-white">
                    Move {selectedMistake.move} Analysis
                  </h4>
                  <button 
                    onClick={() => setSelectedMistake(null)}
                    className="text-slate-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-slate-400">Your Move</div>
                      <div className="text-lg font-semibold text-red-300">{selectedMistake.moveNotation}</div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-400">Best Move</div>
                      <div className="text-lg font-semibold text-green-300">{selectedMistake.correctMove}</div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-slate-400">Explanation</div>
                    <div className="text-slate-200">{selectedMistake.explanation}</div>
                  </div>
                  
                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <div className="text-sm text-slate-400 mb-2">Learning Tip</div>
                    <div className="text-slate-200">
                      {getLearningTip(selectedMistake.classification, selectedMistake.move)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {selectedTab === 'study' && (
        <div className="space-y-4">
          <h5 className="font-semibold text-white">Opening Recommendations for Your Style</h5>
          
          {enhancedAnalysis?.styleRecommendations && enhancedAnalysis.styleRecommendations.length > 0 ? (
            <div className="space-y-3">
              {enhancedAnalysis.styleRecommendations.map((rec, index) => (
                <div key={index} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 hover:bg-slate-800/70 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">♟️</span>
                        <h4 className="font-semibold text-white">{rec.openingName}</h4>
                        <span className={`px-2 py-1 rounded text-xs ${
                          rec.priority === 'high' ? 'bg-emerald-500/20 text-emerald-300' :
                          rec.priority === 'medium' ? 'bg-sky-500/20 text-sky-300' :
                          'bg-slate-500/20 text-slate-300'
                        }`}>
                          {rec.priority} priority
                        </span>
                      </div>
                      <div className="mb-2">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="text-xs text-slate-400">Style Match:</div>
                          <div className="flex-1 bg-slate-700 rounded-full h-2 overflow-hidden">
                            <div 
                              className="bg-gradient-to-r from-sky-500 to-emerald-500 h-full transition-all"
                              style={{ width: `${rec.compatibilityScore}%` }}
                            />
                          </div>
                          <div className="text-xs font-semibold text-emerald-300">{Math.round(rec.compatibilityScore)}%</div>
                        </div>
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">{rec.reasoning}</p>
                      {rec.suggestedLines && rec.suggestedLines.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-700">
                          <div className="text-xs text-slate-400 mb-1">Suggested Lines:</div>
                          {rec.suggestedLines.map((line, idx) => (
                            <div key={idx} className="text-xs text-slate-300 font-mono">• {line}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <a 
                      href={`https://www.youtube.com/results?search_query=${encodeURIComponent(rec.openingName + ' chess opening')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs px-3 py-1 bg-red-500/20 text-red-300 rounded hover:bg-red-500/30 transition-colors"
                    >
                      🎥 Watch Video
                    </a>
                    <a 
                      href={`https://lichess.org/study/search?q=${encodeURIComponent(rec.openingName)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs px-3 py-1 bg-sky-500/20 text-sky-300 rounded hover:bg-sky-500/30 transition-colors"
                    >
                      📚 Lichess Study
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">📚</div>
              <h5 className="font-semibold text-white mb-2">Analyzing Your Style</h5>
              <p className="text-sm text-slate-300">Opening recommendations will appear here based on your playing style and performance.</p>
            </div>
          )}
        </div>
      )}

      {selectedTab === 'progress' && (
        <div className="space-y-4">
          <h5 className="font-semibold text-white">Opening Performance Trend</h5>
          
          {enhancedAnalysis?.improvementTrend && enhancedAnalysis.improvementTrend.length > 0 ? (
            <div className="space-y-4">
              <div className="bg-slate-800/50 rounded-xl p-4">
                <h6 className="font-semibold text-white mb-3">Opening Win Rate Over Time</h6>
                <div className="flex items-end justify-between space-x-1 h-32 mb-2">
                  {enhancedAnalysis.improvementTrend.map((point, index) => {
                    const heightPercent = (point.openingWinRate / 100) * 100
                    const color = point.openingWinRate >= 60 ? 'bg-emerald-500' : 
                                 point.openingWinRate >= 50 ? 'bg-sky-500' : 
                                 point.openingWinRate >= 40 ? 'bg-amber-500' : 'bg-rose-500'
                    return (
                      <div key={index} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 px-2 py-1 rounded text-xs whitespace-nowrap z-10">
                          <div className="font-semibold">{point.openingWinRate.toFixed(1)}% win rate</div>
                          <div className="text-slate-400">{point.games} games</div>
                          <div className="text-slate-400">{new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                        </div>
                        <div 
                          className={`w-full ${color} rounded-t transition-all hover:opacity-80`}
                          style={{ height: `${heightPercent}%` }}
                        ></div>
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-between text-xs text-slate-400 mt-2">
                  <span>{new Date(enhancedAnalysis.improvementTrend[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  <span>{new Date(enhancedAnalysis.improvementTrend[enhancedAnalysis.improvementTrend.length - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <h6 className="font-semibold text-white mb-2">Recent Performance</h6>
                  <div className="text-2xl font-bold text-emerald-300">
                    {enhancedAnalysis.improvementTrend[enhancedAnalysis.improvementTrend.length - 1]?.openingWinRate.toFixed(0) || 0}%
                  </div>
                  <div className="text-xs text-slate-400">Last week's win rate</div>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <h6 className="font-semibold text-white mb-2">Best Week</h6>
                  <div className="text-2xl font-bold text-blue-300">
                    {Math.max(...enhancedAnalysis.improvementTrend.map(t => t.openingWinRate)).toFixed(0)}%
                  </div>
                  <div className="text-xs text-slate-400">Highest win rate achieved</div>
                </div>
              </div>
              
              {enhancedAnalysis.repertoireAnalysis && (
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <h6 className="font-semibold text-white mb-3">Repertoire Insights</h6>
                  <div className="space-y-3">
                    {enhancedAnalysis.repertoireAnalysis.mostSuccessful.opening !== 'None' && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-300">Best Opening:</span>
                        <div className="text-right">
                          <div className="font-semibold text-emerald-300">{enhancedAnalysis.repertoireAnalysis.mostSuccessful.opening}</div>
                          <div className="text-xs text-slate-400">
                            {enhancedAnalysis.repertoireAnalysis.mostSuccessful.winRate.toFixed(0)}% win rate ({enhancedAnalysis.repertoireAnalysis.mostSuccessful.games} games)
                          </div>
                        </div>
                      </div>
                    )}
                    {enhancedAnalysis.repertoireAnalysis.needsWork.opening !== 'None' && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-300">Needs Work:</span>
                        <div className="text-right">
                          <div className="font-semibold text-rose-300">{enhancedAnalysis.repertoireAnalysis.needsWork.opening}</div>
                          <div className="text-xs text-slate-400">
                            {enhancedAnalysis.repertoireAnalysis.needsWork.winRate.toFixed(0)}% win rate ({enhancedAnalysis.repertoireAnalysis.needsWork.games} games)
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-3 border-t border-slate-700">
                      <span className="text-sm text-slate-300">Repertoire Diversity:</span>
                      <div className="text-right">
                        <div className="font-semibold text-sky-300">{enhancedAnalysis.repertoireAnalysis.diversityScore.toFixed(0)}%</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">📈</div>
              <h5 className="font-semibold text-white mb-2">Building Your Progress History</h5>
              <p className="text-sm text-slate-300">Play more games to see your opening performance trends over time.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Helper functions
function getLearningTip(classification: string, moveNumber: number): string {
  const tips = {
    blunder: 'This was a critical mistake. Take time to understand why this move is bad and what the correct continuation should be.',
    mistake: 'This move gives your opponent a significant advantage. Focus on the fundamental principles you violated.',
    inaccuracy: 'This move is not the best but not terrible. Look for ways to improve your position more efficiently.'
  }
  
  return tips[classification] || 'Review this move and understand the engine\'s recommendation.'
}

function getRecommendationIcon(type: string): string {
  const icons = {
    video: '🎥',
    article: '📄',
    practice: '♟️',
    game: '🎮',
    course: '📚'
  }
  return icons[type] || '📖'
}
