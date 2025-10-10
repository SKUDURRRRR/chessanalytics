import React, { useMemo, useState } from 'react'
import { Chess } from 'chess.js'
import { identifyOpening } from '../../utils/openingIdentification'
import { EnhancedOpeningAnalysis, OpeningMistake, StudyRecommendation, PeerComparison, RepertoireAnalysis } from '../../types'

interface ProcessedMove {
  index: number
  ply: number
  moveNumber: number
  player: 'white' | 'black'
  isUserMove: boolean
  san: string
  bestMoveSan: string | null
  evaluation: { type: 'cp' | 'mate'; value: number } | null
  scoreForPlayer: number
  displayEvaluation: string
  centipawnLoss: number | null
  classification: 'brilliant' | 'best' | 'good' | 'acceptable' | 'inaccuracy' | 'mistake' | 'blunder' | 'uncategorized'
  explanation: string
  fenBefore: string
  fenAfter: string
}

interface EnhancedOpeningAnalysisProps {
  moves: ProcessedMove[]
  playerColor: 'white' | 'black'
  gameRecord: any
  openingStats?: Array<{
    opening: string
    openingFamily: string
    games: number
    winRate: number
    averageElo: number
  }>
  totalGames?: number
}

export function EnhancedOpeningAnalysis({ 
  moves, 
  playerColor, 
  gameRecord, 
  openingStats = [],
  totalGames = 0 
}: EnhancedOpeningAnalysisProps) {
  const [selectedMistake, setSelectedMistake] = useState<OpeningMistake | null>(null)
  const [showStudyResources, setShowStudyResources] = useState(false)

  const userMoves = moves.filter(move => move.isUserMove)
  const openingMoves = userMoves.slice(0, 15) // First 15 moves typically cover opening

  const enhancedAnalysis = useMemo((): EnhancedOpeningAnalysis => {
    console.log('EnhancedOpeningAnalysis - openingMoves:', openingMoves.length, openingMoves)
    console.log('EnhancedOpeningAnalysis - gameRecord:', gameRecord)
    console.log('EnhancedOpeningAnalysis - playerColor:', playerColor)
    
    // If no opening moves are available, return a default analysis
    if (openingMoves.length === 0) {
      return {
        openingName: 'Unknown Opening',
        openingFamily: 'Unknown',
        accuracy: 0,
        theoryKnowledge: 0,
        gamesPlayed: totalGames,
        specificMistakes: [],
        commonPatterns: ['General opening principles'],
        strengths: [],
        weaknesses: ['Game analysis required to identify strengths and areas for improvement'],
        studyRecommendations: [],
        practicePositions: [],
        peerComparison: {
          percentile: 0,
          ratingRange: 'Unknown'
        },
        repertoireAnalysis: {
          diversity: 0,
          colorPerformance: { white: 0, black: 0 },
          familyStrengths: [],
          familyWeaknesses: [],
          mostPlayed: 'None',
          leastPlayed: 'None',
          recommendation: 'Analyze games to build your repertoire'
        },
        improvementTrend: [],
        nextGoals: ['Analyze this game to get personalized recommendations'],
        focusAreas: ['Game analysis required']
      }
    }
    
    const identifiedVariation = identifyOpening(gameRecord, openingMoves.map(m => m.san), playerColor)
    
    // Calculate basic metrics
    const openingAccuracy = openingMoves.length === 0 ? 0 : 
      Math.round((openingMoves.filter(move => 
        move.classification === 'best' || move.classification === 'brilliant'
      ).length / openingMoves.length) * 100)

    const theoryKnowledge = openingMoves.length === 0 ? 0 :
      Math.round((openingMoves.filter(move => 
        move.classification === 'best' || move.classification === 'brilliant' || move.classification === 'good'
      ).length / openingMoves.length) * 10)

    // Identify specific mistakes
    const specificMistakes: OpeningMistake[] = openingMoves
      .filter(move => ['inaccuracy', 'mistake', 'blunder'].includes(move.classification))
      .map(move => ({
        move: move.moveNumber,
        moveNotation: move.san,
        mistake: move.san,
        correctMove: move.bestMoveSan || 'N/A',
        explanation: move.explanation || 'Consider the engine recommendation',
        severity: move.classification === 'blunder' ? 'critical' : 
                 move.classification === 'mistake' ? 'major' : 'minor',
        centipawnLoss: move.centipawnLoss || 0,
        classification: move.classification as 'blunder' | 'mistake' | 'inaccuracy'
      }))

    // Identify common patterns
    const commonPatterns = identifyCommonPatterns(openingMoves)
    
    // Identify strengths and weaknesses
    const { strengths, weaknesses } = identifyStrengthsAndWeaknesses(openingMoves, specificMistakes)

    // Generate study recommendations
    const studyRecommendations: StudyRecommendation[] = generateStudyRecommendations(
      identifiedVariation.name, 
      specificMistakes, 
      openingAccuracy
    )

    // Generate practice positions
    const practicePositions = generatePracticePositions(identifiedVariation.name, specificMistakes)

    // Calculate peer comparison
    const peerComparison: PeerComparison = calculatePeerComparison(openingAccuracy, totalGames)

    // Calculate repertoire analysis
    const repertoireAnalysis: RepertoireAnalysis = calculateRepertoireAnalysis(openingStats)

    // Generate improvement trend (mock data for now)
    const improvementTrend = generateImprovementTrend(openingAccuracy)

    // Generate next goals and focus areas
    const nextGoals = generateNextGoals(specificMistakes, openingAccuracy)
    const focusAreas = generateFocusAreas(specificMistakes, commonPatterns)

    return {
      openingName: identifiedVariation.name,
      openingFamily: identifiedVariation.name,
      accuracy: openingAccuracy,
      theoryKnowledge,
      gamesPlayed: totalGames,
      specificMistakes,
      commonPatterns,
      strengths,
      weaknesses,
      studyRecommendations,
      practicePositions,
      peerComparison,
      repertoireAnalysis,
      improvementTrend,
      nextGoals,
      focusAreas
    }
  }, [openingMoves, gameRecord, playerColor, openingStats, totalGames])

  return (
    <div className="space-y-6">
      {/* Enhanced Opening Overview */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-200 shadow-xl shadow-black/40">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-white mb-2">Opening Analysis</h3>
            <h4 className="text-lg font-semibold text-sky-300">{enhancedAnalysis.openingName}</h4>
            <p className="text-sm text-slate-300">Comprehensive analysis with actionable insights</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-white">{enhancedAnalysis.accuracy}%</div>
            <div className="text-sm text-slate-300">Opening Accuracy</div>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-800/50 rounded-xl p-4">
            <div className="text-2xl font-bold text-emerald-300">{enhancedAnalysis.theoryKnowledge}/10</div>
            <div className="text-xs text-slate-300">Theory Knowledge</div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4">
            <div className="text-2xl font-bold text-blue-300">{enhancedAnalysis.specificMistakes.length}</div>
            <div className="text-xs text-slate-300">Mistakes Made</div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4">
            <div className="text-2xl font-bold text-purple-300">{enhancedAnalysis.peerComparison.percentile}%</div>
            <div className="text-xs text-slate-300">vs Peers</div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-4">
            <div className="text-2xl font-bold text-amber-300">{enhancedAnalysis.gamesPlayed}</div>
            <div className="text-xs text-slate-300">Games Played</div>
          </div>
        </div>

        {/* Quick Assessment */}
        <div className="bg-slate-800/30 rounded-xl p-4 mb-6">
          <h5 className="font-semibold text-white mb-2">Quick Assessment</h5>
          <p className="text-sm text-slate-200">
            {enhancedAnalysis.accuracy >= 80 
              ? "Excellent opening play! You demonstrate strong theoretical knowledge and practical understanding."
              : enhancedAnalysis.accuracy >= 60
              ? "Good opening play with room for improvement. Focus on the specific areas highlighted below."
              : "Your opening play needs significant improvement. The analysis below will help you identify key areas to work on."
            }
          </p>
        </div>
      </div>

      {/* Specific Mistakes Analysis - HIDDEN */}
      {false && enhancedAnalysis.specificMistakes.length > 0 && (
        <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-200 shadow-xl shadow-black/40">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
            <span className="mr-2">🎯</span>
            Specific Mistakes & Improvements
          </h3>
          
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

      {/* Study Recommendations */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-200 shadow-xl shadow-black/40">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center">
            <span className="mr-2">📚</span>
            Study Recommendations
          </h3>
          <button 
            onClick={() => setShowStudyResources(!showStudyResources)}
            className="text-sky-300 hover:text-sky-200 text-sm"
          >
            {showStudyResources ? 'Hide' : 'Show All'}
          </button>
        </div>

        <div className="space-y-3">
          {enhancedAnalysis.studyRecommendations
            .filter(rec => showStudyResources || rec.priority === 'high')
            .map((rec, index) => (
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
      </div>

      {/* Strengths and Weaknesses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-200 shadow-xl shadow-black/40">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
            <span className="mr-2 text-green-400">✅</span>
            Strengths
          </h3>
          <div className="space-y-2">
            {enhancedAnalysis.strengths.length > 0 ? (
              enhancedAnalysis.strengths.map((strength, index) => (
                <div key={index} className="flex items-center text-sm">
                  <span className="mr-2 text-green-400">•</span>
                  <span>{strength}</span>
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-400 italic">
                No analysis data available
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-200 shadow-xl shadow-black/40">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
            <span className="mr-2 text-red-400">⚠️</span>
            Areas to Improve
          </h3>
          <div className="space-y-2">
            {enhancedAnalysis.weaknesses.length > 0 ? (
              enhancedAnalysis.weaknesses.map((weakness, index) => (
                <div key={index} className="flex items-center text-sm">
                  <span className="mr-2 text-red-400">•</span>
                  <span>{weakness}</span>
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-400 italic">
                No analysis data available
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Next Steps */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-200 shadow-xl shadow-black/40">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
          <span className="mr-2">🎯</span>
          Next Steps & Focus Areas
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-sky-300 mb-3">Immediate Goals</h4>
            <div className="space-y-2">
              {enhancedAnalysis.nextGoals.map((goal, index) => (
                <div key={index} className="flex items-start text-sm">
                  <span className="mr-2 text-sky-300">•</span>
                  <span>{goal}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold text-amber-300 mb-3">Focus Areas</h4>
            <div className="space-y-2">
              {enhancedAnalysis.focusAreas.map((area, index) => (
                <div key={index} className="flex items-start text-sm">
                  <span className="mr-2 text-amber-300">•</span>
                  <span>{area}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper functions
function identifyCommonPatterns(moves: ProcessedMove[]): string[] {
  const patterns: string[] = []
  
  // Check for common opening patterns
  const moveSequence = moves.map(m => m.san).join(' ')
  
  if (moveSequence.includes('e4 e5 Nf3 Nc6 Bb5')) {
    patterns.push('Ruy Lopez patterns')
  }
  if (moveSequence.includes('d4 Nf6 c4 g6')) {
    patterns.push('King\'s Indian Defense patterns')
  }
  if (moves.some(m => m.san.includes('O-O'))) {
    patterns.push('Castling patterns')
  }
  if (moves.filter(m => m.san.includes('N')).length > 3) {
    patterns.push('Knight development patterns')
  }
  
  return patterns.length > 0 ? patterns : ['General opening principles']
}

function identifyStrengthsAndWeaknesses(moves: ProcessedMove[], mistakes: OpeningMistake[]): { strengths: string[], weaknesses: string[] } {
  const strengths: string[] = []
  const weaknesses: string[] = []
  
  console.log('identifyStrengthsAndWeaknesses - moves:', moves.length, 'mistakes:', mistakes.length)
  console.log('Move classifications:', moves.map(m => ({ san: m.san, classification: m.classification })))
  
  // Analyze move quality distribution
  const bestMoves = moves.filter(m => m.classification === 'best' || m.classification === 'brilliant').length
  const goodMoves = moves.filter(m => m.classification === 'good').length
  const totalMoves = moves.length
  
  console.log('Move quality analysis:', { bestMoves, goodMoves, totalMoves })
  
  if (totalMoves > 0) {
    if (bestMoves / totalMoves > 0.3) {
      strengths.push('Strong theoretical knowledge')
    }
    if (goodMoves / totalMoves > 0.4) {
      strengths.push('Good practical understanding')
    }
    
    // Add some default strengths if no specific ones are found
    if (strengths.length === 0 && totalMoves > 0) {
      if (bestMoves > 0) {
        strengths.push('Strong theoretical knowledge')
      } else if (goodMoves > 0) {
        strengths.push('Good practical understanding')
      } else {
        // Don't add contradictory strengths - let weaknesses handle this case
      }
    }
  }
  
  // Analyze mistake patterns
  const criticalMistakes = mistakes.filter(m => m.severity === 'critical').length
  if (criticalMistakes > 0) {
    weaknesses.push('Avoiding critical mistakes in opening')
  }
  
  const developmentMistakes = mistakes.filter(m => 
    m.explanation.toLowerCase().includes('development') || 
    m.explanation.toLowerCase().includes('develop')
  ).length
  if (developmentMistakes > 0) {
    weaknesses.push('Piece development timing')
  }
  
  const centerMistakes = mistakes.filter(m => 
    m.explanation.toLowerCase().includes('center') || 
    m.explanation.toLowerCase().includes('central')
  ).length
  if (centerMistakes > 0) {
    weaknesses.push('Center control principles')
  }
  
  // Add some default weaknesses if no specific ones are found
  if (weaknesses.length === 0 && totalMoves > 0) {
    const inaccuracyMoves = moves.filter(m => m.classification === 'inaccuracy').length
    const mistakeMoves = moves.filter(m => m.classification === 'mistake').length
    const blunderMoves = moves.filter(m => m.classification === 'blunder').length
    
    if (blunderMoves > 0) {
      weaknesses.push('Avoiding tactical blunders')
    } else if (mistakeMoves > 0) {
      weaknesses.push('Reducing tactical mistakes')
    } else if (inaccuracyMoves > 0) {
      weaknesses.push('Improving move accuracy')
    } else {
      // Only add a weakness if we have a corresponding strength
      if (strengths.length === 0) {
        weaknesses.push('Building opening theory knowledge')
      }
    }
  }
  
  console.log('Final strengths and weaknesses:', { strengths, weaknesses })
  
  return { strengths, weaknesses }
}

function generateStudyRecommendations(openingName: string, mistakes: OpeningMistake[], accuracy: number): StudyRecommendation[] {
  const recommendations: StudyRecommendation[] = []
  
  // Base recommendations
  recommendations.push({
    type: 'video',
    title: `${openingName} - Complete Guide`,
    description: `Learn the fundamental principles and main lines of ${openingName}`,
    url: `https://www.youtube.com/results?search_query=${encodeURIComponent(openingName + ' chess opening')}`,
    difficulty: 'intermediate',
    estimatedTime: '15-30 min',
    priority: 'high'
  })
  
  // Mistake-specific recommendations
  if (mistakes.some(m => m.classification === 'blunder')) {
    recommendations.push({
      type: 'practice',
      title: 'Avoiding Opening Blunders',
      description: 'Practice common opening positions to avoid critical mistakes',
      difficulty: 'beginner',
      estimatedTime: '10-15 min',
      priority: 'high'
    })
  }
  
  if (mistakes.some(m => m.explanation.toLowerCase().includes('development'))) {
    recommendations.push({
      type: 'article',
      title: 'Opening Development Principles',
      description: 'Master the art of piece development in the opening',
      url: 'https://www.chess.com/learn-how-to-play-chess#opening',
      difficulty: 'beginner',
      estimatedTime: '5-10 min',
      priority: 'medium'
    })
  }
  
  if (accuracy < 50) {
    recommendations.push({
      type: 'course',
      title: 'Chess Opening Fundamentals',
      description: 'Comprehensive course covering all major opening principles',
      difficulty: 'beginner',
      estimatedTime: '2-3 hours',
      priority: 'high'
    })
  }
  
  return recommendations
}

function generatePracticePositions(openingName: string, mistakes: OpeningMistake[]): Array<{ position: string, description: string, difficulty: 'beginner' | 'intermediate' | 'advanced' }> {
  return [
    {
      position: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R',
      description: 'Typical position after 4 moves in many openings',
      difficulty: 'beginner'
    },
    {
      position: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R',
      description: 'Key tactical patterns in the opening',
      difficulty: 'intermediate'
    }
  ]
}

function calculatePeerComparison(accuracy: number, totalGames: number): PeerComparison {
  // Mock calculation - in real implementation, this would use actual peer data
  const averageAccuracy = 45 + Math.random() * 20 // 45-65% range
  const percentile = accuracy > averageAccuracy ? 60 + Math.random() * 30 : 20 + Math.random() * 40
  const trend = totalGames > 10 ? (Math.random() > 0.5 ? 'improving' : 'stable') : 'stable'
  
  return {
    averageAccuracy: Math.round(averageAccuracy),
    percentile: Math.round(percentile),
    trend,
    gamesPlayed: totalGames,
    ratingRange: '1200-1600'
  }
}

function calculateRepertoireAnalysis(openingStats: Array<{ opening: string, games: number, winRate: number }>): RepertoireAnalysis {
  if (openingStats.length === 0) {
    return {
      diversity: 0,
      colorPerformance: { white: 0, black: 0 },
      familyStrengths: [],
      familyWeaknesses: [],
      mostPlayed: 'None',
      leastPlayed: 'None',
      recommendation: 'Start building your opening repertoire'
    }
  }
  
  const totalGames = openingStats.reduce((sum, stat) => sum + stat.games, 0)
  const diversity = Math.min(100, (openingStats.length / 5) * 100) // Max 5 openings = 100%
  
  const sortedByGames = [...openingStats].sort((a, b) => b.games - a.games)
  const mostPlayed = sortedByGames[0]?.opening || 'None'
  const leastPlayed = sortedByGames[sortedByGames.length - 1]?.opening || 'None'
  
  const strengths = openingStats.filter(s => s.winRate > 60).map(s => s.opening)
  const weaknesses = openingStats.filter(s => s.winRate < 40).map(s => s.opening)
  
  return {
    diversity: Math.round(diversity),
    colorPerformance: { white: 50, black: 50 }, // Mock data
    familyStrengths: strengths,
    familyWeaknesses: weaknesses,
    mostPlayed,
    leastPlayed,
    recommendation: diversity < 30 ? 'Expand your opening repertoire' : 'Focus on improving existing openings'
  }
}

function generateImprovementTrend(accuracy: number): Array<{ date: string, accuracy: number, games: number }> {
  // Mock trend data
  const trend = []
  const baseDate = new Date()
  for (let i = 6; i >= 0; i--) {
    const date = new Date(baseDate)
    date.setDate(date.getDate() - i * 7)
    trend.push({
      date: date.toISOString().split('T')[0],
      accuracy: Math.max(0, accuracy - Math.random() * 20 + Math.random() * 10),
      games: Math.floor(Math.random() * 5) + 1
    })
  }
  return trend
}

function generateNextGoals(mistakes: OpeningMistake[], accuracy: number): string[] {
  const goals = []
  
  if (mistakes.length > 0) {
    goals.push(`Reduce mistakes from ${mistakes.length} to ${Math.max(0, mistakes.length - 2)} in next game`)
  }
  
  if (accuracy < 70) {
    goals.push(`Improve opening accuracy to ${Math.min(100, accuracy + 10)}%`)
  }
  
  goals.push('Study the recommended resources')
  goals.push('Practice the key positions')
  
  return goals
}

function generateFocusAreas(mistakes: OpeningMistake[], patterns: string[]): string[] {
  const areas = []
  
  if (mistakes.some(m => m.classification === 'blunder')) {
    areas.push('Avoiding critical mistakes')
  }
  
  if (mistakes.some(m => m.explanation.toLowerCase().includes('development'))) {
    areas.push('Piece development')
  }
  
  if (mistakes.some(m => m.explanation.toLowerCase().includes('center'))) {
    areas.push('Center control')
  }
  
  areas.push('Opening theory')
  areas.push('Tactical awareness')
  
  return areas
}

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
