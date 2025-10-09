import React, { useState } from 'react'
import { EnhancedOpeningAnalysis, OpeningMistake, StudyRecommendation } from '../../types'

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
}

export function EnhancedOpeningPlayerCard({
  score,
  phaseAccuracy: _phaseAccuracy,
  openingStats = [],
  totalGames = 0,
  enhancedAnalysis
}: EnhancedOpeningPlayerCardProps) {
  const [selectedTab, setSelectedTab] = useState<'overview' | 'mistakes' | 'study' | 'progress'>('overview')
  const [selectedMistake, setSelectedMistake] = useState<OpeningMistake | null>(null)

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

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'mistakes', label: 'Mistakes', icon: '🎯' },
    { id: 'study', label: 'Study', icon: '📚' },
    { id: 'progress', label: 'Progress', icon: '📈' }
  ]

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-200 shadow-xl shadow-black/40">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <div className="mr-3 h-3 w-3 animate-pulse rounded-full bg-sky-300" />
          <h3 className="text-lg font-semibold text-white">Enhanced Opening Analysis</h3>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-white">{Math.round(score)}%</div>
          <div className="text-xs text-slate-300">Overall Accuracy</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-6 bg-slate-800/50 rounded-xl p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedTab(tab.id as any)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedTab === tab.id
                ? 'bg-sky-500 text-white shadow-lg'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {selectedTab === 'overview' && (
        <div className="space-y-6">
          <p className="text-sm text-slate-200 mb-4">
            {feedback.assessment}
          </p>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className={`${bgColor} rounded-xl p-4`}>
              <div className="text-lg font-bold text-white">{Math.round(score)}%</div>
              <div className="text-xs text-slate-300">Opening Accuracy</div>
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
              <div className="text-lg font-bold text-purple-300">{insights.averageWinRate.toFixed(0)}%</div>
              <div className="text-xs text-slate-300">Win Rate</div>
            </div>
          </div>

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
                          {mistake.centipawnLoss} centipawn loss
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
          <h5 className="font-semibold text-white">Study Recommendations</h5>
          
          {enhancedAnalysis?.studyRecommendations && enhancedAnalysis.studyRecommendations.length > 0 ? (
            <div className="space-y-3">
              {enhancedAnalysis.studyRecommendations.map((rec, index) => (
                <div key={index} className="bg-slate-800/50 rounded-xl p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{getRecommendationIcon(rec.type)}</span>
                        <h4 className="font-semibold text-white">{rec.title}</h4>
                        <span className={`px-2 py-1 rounded text-xs ${
                          rec.priority === 'high' ? 'bg-red-500/20 text-red-300' :
                          rec.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
                          'bg-green-500/20 text-green-300'
                        }`}>
                          {rec.priority}
                        </span>
                      </div>
                      <p className="text-sm text-slate-300 mb-2">{rec.description}</p>
                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <span>⏱️ {rec.estimatedTime}</span>
                        <span>📊 {rec.difficulty}</span>
                        {rec.url && (
                          <a 
                            href={rec.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sky-300 hover:text-sky-200"
                          >
                            Open Resource →
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">📚</div>
              <h5 className="font-semibold text-white mb-2">Study Resources Coming Soon</h5>
              <p className="text-sm text-slate-300">Personalized study recommendations will appear here based on your performance.</p>
            </div>
          )}
        </div>
      )}

      {selectedTab === 'progress' && (
        <div className="space-y-4">
          <h5 className="font-semibold text-white">Progress Tracking</h5>
          
          {enhancedAnalysis?.improvementTrend && enhancedAnalysis.improvementTrend.length > 0 ? (
            <div className="space-y-4">
              <div className="bg-slate-800/50 rounded-xl p-4">
                <h6 className="font-semibold text-white mb-3">Accuracy Trend (Last 7 Games)</h6>
                <div className="flex items-end space-x-2 h-20">
                  {enhancedAnalysis.improvementTrend.map((point, index) => (
                    <div key={index} className="flex-1 flex flex-col items-center">
                      <div 
                        className="w-full bg-sky-500 rounded-t"
                        style={{ height: `${(point.accuracy / 100) * 60}px` }}
                      ></div>
                      <div className="text-xs text-slate-400 mt-1">{point.accuracy}%</div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <h6 className="font-semibold text-white mb-2">Current Streak</h6>
                  <div className="text-2xl font-bold text-emerald-300">3</div>
                  <div className="text-xs text-slate-400">Games without major mistakes</div>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4">
                  <h6 className="font-semibold text-white mb-2">Best Performance</h6>
                  <div className="text-2xl font-bold text-blue-300">85%</div>
                  <div className="text-xs text-slate-400">Highest accuracy achieved</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">📈</div>
              <h5 className="font-semibold text-white mb-2">Progress Tracking Coming Soon</h5>
              <p className="text-sm text-slate-300">Track your improvement over time with detailed analytics.</p>
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
