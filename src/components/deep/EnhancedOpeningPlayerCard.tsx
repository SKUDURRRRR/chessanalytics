import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Chess } from 'chess.js'
import { EnhancedOpeningAnalysis, OpeningMistake, StudyRecommendation, StyleRecommendation, TrendPoint } from '../../types'

// Helper to convert UCI notation to SAN (Standard Algebraic Notation)
const convertUciToSan = (fen: string, uci: string): string => {
  try {
    const chess = new Chess(fen)
    const from = uci.slice(0, 2)
    const to = uci.slice(2, 4)
    const promotion = uci.length > 4 ? uci[4] : undefined
    const result = chess.move({ from, to, promotion })
    return result ? result.san : uci
  } catch (error) {
    // If conversion fails, return original UCI
    return uci
  }
}

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
  const [showBlundersModal, setShowBlundersModal] = useState(false)
  const [selectedOpeningBlunders, setSelectedOpeningBlunders] = useState<OpeningMistake[]>([])
  const navigate = useNavigate()
  const location = useLocation()

  // Normalize the enhanced analysis data
  const enhancedAnalysis = normalizeEnhancedAnalysis(rawEnhancedAnalysis)


  // Use opening win rate from enhanced analysis if available, otherwise use score
  const effectiveScore = enhancedAnalysis?.openingWinRate || score

  // Get combined playing style description
  const getPlayingStyle = () => {
    const aggressive = personalityScores.aggressive || 0
    const tactical = personalityScores.tactical || 0
    const positional = personalityScores.positional || 0
    const patient = personalityScores.patient || 0

    // All traits with their scores
    const traits = [
      { name: 'aggressive', score: aggressive },
      { name: 'tactical', score: tactical },
      { name: 'positional', score: positional },
      { name: 'patient', score: patient }
    ].sort((a, b) => b.score - a.score)

    const [first, second, third, fourth] = traits

    // Calculate score differences
    const highestScore = first.score
    const lowestScore = fourth.score
    const scoreRange = highestScore - lowestScore
    const topTwoGap = first.score - second.score

    // PRIORITY 0: Check for developing/low skill players FIRST
    // Lower elo players have compressed scores in the 30-55 range
    // We need to identify them before checking if they're "balanced"
    if (highestScore < 55) {
      // Low scores - likely beginner/developing player
      // Still show some variety based on their highest trait
      const beginnerStyles = {
        aggressive: { text: 'Developing Attacker', icon: '⚔️' },
        tactical: { text: 'Learning Tactics', icon: '🎯' },
        positional: { text: 'Learning Strategy', icon: '🏰' },
        patient: { text: 'Cautious Player', icon: '🛡️' }
      }
      const style = beginnerStyles[first.name] || { text: 'Developing Player', icon: '♟️' }
      return {
        description: style.text,
        icon: style.icon,
        primaryTrait: first.name,
        score: Math.round(highestScore)
      }
    }

    // If all scores are very close (within 8 points) AND in mid-skill range, truly balanced
    // This catches players with scores 55-65 that are genuinely balanced
    if (scoreRange < 8 && highestScore >= 55 && highestScore < 70) {
      return {
        description: 'Balanced Player',
        icon: '⚖️',
        primaryTrait: 'balanced',
        score: Math.round(highestScore)
      }
    }

    // PRIORITY 1: Use aggressive/patient dimension if there's meaningful difference
    // This dimension shows the most playing style variety
    // Lowered threshold from 15 to 10 to catch more variety
    const aggrScore = aggressive
    const patientScore = patient
    const aggrPatientDiff = Math.abs(aggrScore - patientScore)

    // If aggressive/patient differ by 10+ points, use that as primary dimension
    if (aggrPatientDiff >= 10) {
      const isPrimaryAggressive = aggrScore > patientScore
      const primaryDimension = isPrimaryAggressive ? 'aggressive' : 'patient'
      const primaryScore = Math.max(aggrScore, patientScore)

      // Find strongest secondary trait (tactical vs positional)
      const tactScore = tactical
      const posScore = positional
      const secondaryDimension = tactScore > posScore ? 'tactical' : 'positional'

      // Style descriptions prioritizing aggr/patient dimension
      const styleMap = {
        'aggressive-tactical': { text: 'Aggressive Tactician', icon: '⚔️' },
        'aggressive-positional': { text: 'Strategic Attacker', icon: '⚔️' },
        'patient-tactical': { text: 'Defensive Tactician', icon: '🛡️' },
        'patient-positional': { text: 'Classical Strategist', icon: '🛡️' }
      }

      const styleKey = `${primaryDimension}-${secondaryDimension}`
      const style = styleMap[styleKey] || { text: 'Versatile Player', icon: '♟️' }

      return {
        description: style.text,
        icon: style.icon,
        primaryTrait: primaryDimension,
        score: Math.round(primaryScore)
      }
    }

    // PRIORITY 2: Check if one trait is truly dominant
    // Lowered requirements to catch more variety (12+ gap OR 65+ score with 8+ gap)
    if ((topTwoGap >= 12 && first.score >= 65) || (topTwoGap >= 8 && first.score >= 75)) {
      const singleTraitStyles = {
        aggressive: { text: 'Pure Attacker', icon: '⚔️' },
        tactical: { text: 'Sharp Tactician', icon: '🎯' },
        positional: { text: 'Strategic Mastermind', icon: '🏰' },
        patient: { text: 'Solid Defender', icon: '🛡️' }
      }
      const style = singleTraitStyles[first.name] || { text: 'Specialized Player', icon: '♟️' }
      return {
        description: style.text,
        icon: style.icon,
        primaryTrait: first.name,
        score: Math.round(first.score)
      }
    }

    // PRIORITY 3: Use top 2 traits, but avoid "Universal Player" unless truly exceptional
    // Only allow Universal/Complete if BOTH tactical and positional are 70+
    const key = `${first.name}-${second.name}`

    // Special handling for tactical-positional combinations
    if ((first.name === 'tactical' && second.name === 'positional') ||
        (first.name === 'positional' && second.name === 'tactical')) {
      // Only call them "Universal/Complete Player" if both scores are genuinely high (70+)
      if (tactical >= 70 && positional >= 70) {
        return {
          description: first.name === 'tactical' ? 'Universal Player' : 'Complete Player',
          icon: first.name === 'tactical' ? '🎯' : '🏰',
          primaryTrait: first.name,
          score: Math.round(first.score)
        }
      }
      // If scores are moderate (55-70 range) and close together (within 5 points), show combined style
      else if (Math.abs(tactical - positional) <= 5 && tactical >= 55 && positional >= 55) {
        return {
          description: 'Well-Rounded Player',
          icon: '♟️',
          primaryTrait: first.name,
          score: Math.round(first.score)
        }
      }
      // Otherwise, use more specific descriptor based on which is clearly higher
      else {
        return {
          description: tactical > positional ? 'Tactical Player' : 'Positional Player',
          icon: tactical > positional ? '🎯' : '🏰',
          primaryTrait: tactical > positional ? 'tactical' : 'positional',
          score: Math.round(Math.max(tactical, positional))
        }
      }
    }

    // Standard combined styles for other combinations
    const combinedStyles = {
      'aggressive-tactical': { text: 'Aggressive Tactician', icon: '⚔️' },
      'aggressive-positional': { text: 'Dynamic Attacker', icon: '⚔️' },
      'aggressive-patient': { text: 'Controlled Aggressor', icon: '⚔️' },
      'tactical-aggressive': { text: 'Sharp Attacker', icon: '🎯' },
      'tactical-patient': { text: 'Calculated Tactician', icon: '🎯' },
      'positional-aggressive': { text: 'Strategic Attacker', icon: '🏰' },
      'positional-patient': { text: 'Solid Positional Player', icon: '🏰' },
      'patient-aggressive': { text: 'Counter-Attacker', icon: '🛡️' },
      'patient-tactical': { text: 'Defensive Tactician', icon: '🛡️' },
      'patient-positional': { text: 'Classical Strategist', icon: '🛡️' }
    }

    const style = combinedStyles[key] || { text: 'Versatile Player', icon: '♟️' }

    return {
      description: style.text,
      icon: style.icon,
      primaryTrait: first.name,
      score: Math.round(first.score)
    }
  }

  const playingStyle = getPlayingStyle()

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

  // Generate personalized Style Match explanation (compressed)
  const getStyleMatchExplanation = () => {
    const styleMatchScore = enhancedAnalysis?.repertoireAnalysis?.styleMatchScore ?? 0
    const aggressive = personalityScores.aggressive || 0
    const tactical = personalityScores.tactical || 0
    const positional = personalityScores.positional || 0
    const patient = personalityScores.patient || 0

    // Get dominant trait
    const traits = [
      { name: 'aggressive', score: aggressive, label: 'aggressive' },
      { name: 'tactical', score: tactical, label: 'tactical' },
      { name: 'positional', score: positional, label: 'positional' },
      { name: 'patient', score: patient, label: 'patient' }
    ].sort((a, b) => b.score - a.score)

    const dominantTrait = traits[0]
    const hasStrongTrait = dominantTrait.score >= 65

    // Get opening insights
    const mostSuccessful = enhancedAnalysis?.repertoireAnalysis?.mostSuccessful
    const needsWork = enhancedAnalysis?.repertoireAnalysis?.needsWork
    const whiteOpenings = enhancedAnalysis?.repertoireAnalysis?.whiteOpenings || []
    const blackOpenings = enhancedAnalysis?.repertoireAnalysis?.blackOpenings || []
    const totalOpenings = whiteOpenings.length + blackOpenings.length

    // Helper to determine if an opening is actually underperforming (win rate < 50%)
    const isActuallyUnderperforming = (winRate: number) => winRate < 50

    // Determine explanation based on score
    let explanation = {
      message: '',
      insight: '',
      advice: '',
      color: 'text-purple-300',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-400/50'
    }

    if (styleMatchScore >= 75) {
      explanation = {
        message: hasStrongTrait
          ? `Your ${dominantTrait.label} style (${Math.round(dominantTrait.score)}/100) aligns well with your openings.`
          : 'Your openings match your balanced playing style.',
        insight: mostSuccessful?.opening && mostSuccessful.opening !== 'None'
          ? `Your ${mostSuccessful.opening} performs strongly at ${Math.round(mostSuccessful.winRate)}% win rate.`
          : totalOpenings > 0
          ? `You have ${totalOpenings} opening${totalOpenings !== 1 ? 's' : ''} that suit your style.`
          : 'Your repertoire is well-suited to your playing approach.',
        advice: hasStrongTrait
          ? `Continue playing ${dominantTrait.label === 'aggressive' ? 'sharp, attacking' : dominantTrait.label === 'tactical' ? 'tactically complex' : dominantTrait.label === 'positional' ? 'strategic' : 'solid'} openings.`
          : 'Maintain your versatility while deepening your knowledge.',
        color: 'text-emerald-300',
        bgColor: 'bg-emerald-500/10',
        borderColor: 'border-emerald-400/50'
      }
    } else if (styleMatchScore >= 60) {
      explanation = {
        message: hasStrongTrait
          ? `Your ${dominantTrait.label} strength (${Math.round(dominantTrait.score)}/100) could be better utilized.`
          : 'Some openings may not highlight your strengths.',
        insight: needsWork?.opening && needsWork.opening !== 'None'
          ? isActuallyUnderperforming(needsWork.winRate)
            ? `Your ${needsWork.opening} (${Math.round(needsWork.winRate)}% win rate) may not align with your style.`
            : `Your ${needsWork.opening} may not fully match your ${dominantTrait.label} style, despite a ${Math.round(needsWork.winRate)}% win rate.`
          : totalOpenings > 0
          ? `Consider whether all ${totalOpenings} opening${totalOpenings !== 1 ? 's' : ''} match your ${dominantTrait.label} preferences.`
          : 'Explore openings that better match your playing style.',
        advice: `Check the Study tab for ${hasStrongTrait ? dominantTrait.label : 'compatible'} openings that could improve your match.`,
        color: 'text-sky-300',
        bgColor: 'bg-sky-500/10',
        borderColor: 'border-sky-400/50'
      }
    } else if (styleMatchScore >= 45) {
      explanation = {
        message: hasStrongTrait
          ? `Your ${dominantTrait.label} style (${Math.round(dominantTrait.score)}/100) isn't being fully utilized by your current openings.`
          : 'Your openings may conflict with your natural playing tendencies.',
        insight: needsWork?.opening && needsWork.opening !== 'None'
          ? isActuallyUnderperforming(needsWork.winRate)
            ? `Your ${needsWork.opening} is underperforming (${Math.round(needsWork.winRate)}% win rate) - likely a style mismatch.`
            : `Your ${needsWork.opening} may not match your ${dominantTrait.label} style, though it has a ${Math.round(needsWork.winRate)}% win rate.`
          : totalOpenings > 0
          ? `Some of your ${totalOpenings} opening${totalOpenings !== 1 ? 's' : ''} may conflict with your ${dominantTrait.label} style.`
          : 'Consider exploring openings that better suit your style.',
        advice: `Prioritize openings that match your ${hasStrongTrait ? dominantTrait.label : 'style'}. See the Study tab for recommendations.`,
        color: 'text-amber-300',
        bgColor: 'bg-amber-500/10',
        borderColor: 'border-amber-400/50'
      }
    } else {
      explanation = {
        message: hasStrongTrait
          ? `Your ${dominantTrait.label} strength (${Math.round(dominantTrait.score)}/100) is being underutilized.`
          : 'There\'s a clear disconnect between your style and opening choices.',
        insight: needsWork?.opening && needsWork.opening !== 'None'
          ? isActuallyUnderperforming(needsWork.winRate)
            ? `Your ${needsWork.opening} is struggling (${Math.round(needsWork.winRate)}% win rate) - this is likely a style conflict.`
            : `Your ${needsWork.opening} doesn't match your ${dominantTrait.label} style, despite a ${Math.round(needsWork.winRate)}% win rate.`
          : totalOpenings > 0
          ? `Your ${totalOpenings} opening${totalOpenings !== 1 ? 's' : ''} may be working against your ${dominantTrait.label} style.`
          : 'Your overall opening performance suggests style mismatches across your repertoire.',
        advice: `Visit the Study tab to find openings that match your ${hasStrongTrait ? dominantTrait.label : 'playing style'}.`,
        color: 'text-rose-300',
        bgColor: 'bg-rose-500/10',
        borderColor: 'border-rose-400/50'
      }
    }

    return explanation
  }

  const styleMatchExplanation = getStyleMatchExplanation()

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'mistakes', label: 'Mistakes', icon: '🎯' },
    { id: 'study', label: 'Study', icon: '📚' },
    { id: 'progress', label: 'Progress', icon: '📈' }
  ]

  return (
    <div className="rounded-lg bg-surface-1 p-6 text-gray-300 shadow-card">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 space-y-3 sm:space-y-0">
        <div className="flex items-center">
          <div className="mr-3 h-3 w-3 animate-pulse rounded-full bg-sky-300" />
          <h3 className="text-lg font-semibold text-white">Enhanced Opening Analysis</h3>
        </div>
        <div className="text-left sm:text-right">
          <div className="text-2xl font-semibold text-white">{Math.round(effectiveScore)}%</div>
          <div className="text-xs text-gray-400">Opening Win Rate</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex sm:flex sm:space-x-1 grid grid-cols-2 gap-2 sm:gap-0 mb-6 bg-surface-2/50 rounded-lg p-1 sm:p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedTab(tab.id as any)}
            className={`flex-1 sm:flex-1 min-w-0 flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              selectedTab === tab.id
                ? 'bg-sky-500 text-white shadow-card'
                : 'text-gray-500 hover:text-gray-300 hover:bg-surface-3/50'
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
          {/* Data-driven assessment */}
          {(enhancedAnalysis?.repertoireAnalysis || insights.totalOpeningGames > 0) && (
            <div className="bg-surface-2/30 rounded-lg p-4">
              <p className="text-sm text-gray-300 leading-relaxed">
                {effectiveScore >= 70
                  ? `You're performing well in the opening phase with a ${Math.round(effectiveScore)}% win rate across ${insights.totalOpeningGames} games.`
                  : effectiveScore >= 60
                  ? `Your opening performance is developing with a ${Math.round(effectiveScore)}% win rate across ${insights.totalOpeningGames} games.`
                  : `Your opening play has room for improvement with a ${Math.round(effectiveScore)}% win rate across ${insights.totalOpeningGames} games.`
                }
                {enhancedAnalysis?.repertoireAnalysis?.mostSuccessful?.opening !== 'None' && enhancedAnalysis?.repertoireAnalysis?.mostSuccessful?.opening ?
                  ` Your ${enhancedAnalysis.repertoireAnalysis.mostSuccessful.opening} is especially strong at ${Math.round(enhancedAnalysis.repertoireAnalysis.mostSuccessful.winRate)}% win rate.` :
                  insights.bestOpening ? ` Your ${insights.bestOpening.opening} is especially strong at ${Math.round(insights.bestOpening.winRate)}% win rate.` : ''
                }
              </p>
            </div>
          )}

          {/* Player Style Card - Always show for players with any personality scores */}
          <div className="bg-surface-2 rounded-lg p-4 shadow-card-highlight">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-400 mb-1">Your Playing Style</div>
                <div className="text-xl font-semibold text-white">
                  {playingStyle.description}
                </div>
                {playingStyle.primaryTrait !== 'balanced' && playingStyle.primaryTrait !== 'developing' && (
                  <div className="text-xs text-sky-300 mt-1">
                    Based on {playingStyle.primaryTrait} traits
                  </div>
                )}
              </div>
              <div className="text-4xl">
                {playingStyle.icon}
              </div>
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={`${bgColor} rounded-lg p-4`}>
              <div className="text-lg font-semibold text-white">{Math.round(effectiveScore)}%</div>
              <div className="text-xs text-gray-400">Opening Win Rate</div>
            </div>
            <div className="bg-surface-2/50 rounded-lg p-4">
              <div className="text-lg font-semibold text-emerald-300">{insights.totalOpeningGames}</div>
              <div className="text-xs text-gray-400">Games Played</div>
            </div>
            <div className="bg-surface-2/50 rounded-lg p-4">
              <div className="text-lg font-semibold text-blue-300">{openingStats.length}</div>
              <div className="text-xs text-gray-400">Openings</div>
            </div>
            <div className="bg-surface-2/50 rounded-lg p-4">
              <div className="text-lg font-semibold text-purple-300">
                {enhancedAnalysis?.repertoireAnalysis?.styleMatchScore?.toFixed(0) || insights.averageWinRate.toFixed(0)}%
              </div>
              <div className="text-xs text-gray-400">
                {enhancedAnalysis?.repertoireAnalysis ? 'Style Match' : 'Win Rate'}
              </div>
            </div>
          </div>

          {/* Personalized Style Match Explanation */}
          {enhancedAnalysis?.repertoireAnalysis?.styleMatchScore !== undefined && (
            <div className={`${styleMatchExplanation.bgColor} border ${styleMatchExplanation.borderColor} rounded-lg p-3`}>
              <div className="flex items-start gap-3">
                <span className={`${styleMatchExplanation.color} text-lg`}>🎯</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-300 mb-1">{styleMatchExplanation.message}</div>
                  <div className={`text-xs text-gray-400 mb-1`}>{styleMatchExplanation.insight}</div>
                  <div className={`text-xs ${styleMatchExplanation.color}`}>{styleMatchExplanation.advice}</div>
                </div>
                <div className={`text-base font-semibold ${styleMatchExplanation.color} shrink-0`}>
                  {enhancedAnalysis.repertoireAnalysis.styleMatchScore.toFixed(0)}%
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {selectedTab === 'mistakes' && (
        <div className="space-y-4">
          {enhancedAnalysis?.specificMistakes && enhancedAnalysis.specificMistakes.length > 0 ? (
            <>
              {/* Most Costly Mistakes Summary */}
              <div className="bg-red-500/10 shadow-card rounded-lg p-4">
                <h5 className="font-semibold text-red-300 mb-3 flex items-center gap-2">
                  <span>🎯</span> Most Costly Mistakes
                </h5>
                <div className="space-y-2">
                  {(() => {
                    const blunders = enhancedAnalysis.specificMistakes.filter(m => m.classification === 'blunder')
                    const mistakes = enhancedAnalysis.specificMistakes.filter(m => m.classification === 'mistake')
                    const avgCPL = blunders.length > 0
                      ? (blunders.reduce((sum, m) => sum + m.centipawnLoss, 0) / blunders.length).toFixed(0)
                      : '0'

                    // Find most common opening
                    const openingCounts: Record<string, number> = {}
                    blunders.forEach(m => {
                      const opening = m.mistake.split(' - ')[0]
                      openingCounts[opening] = (openingCounts[opening] || 0) + 1
                    })
                    const mostCommonOpening = Object.entries(openingCounts).sort((a, b) => b[1] - a[1])[0]

                    return (
                      <>
                        <div className="flex items-center text-gray-300">
                          <span className="text-red-400 mr-2">├─</span>
                          <span className="text-sm">
                            <span className="font-semibold text-white">{blunders.length}</span> blunders in opening
                            {blunders.length > 0 && <span className="text-gray-500"> (avg {avgCPL} CPL)</span>}
                          </span>
                        </div>
                        {mistakes.length > 0 && (
                          <div className="flex items-center text-gray-300">
                            <span className="text-orange-400 mr-2">├─</span>
                            <span className="text-sm">
                              <span className="font-semibold text-white">{mistakes.length}</span> major mistakes detected
                            </span>
                          </div>
                        )}
                        {mostCommonOpening && (
                          <div
                            className="flex items-center text-gray-300 cursor-pointer hover:bg-sky-500/5 rounded-lg p-2 -m-2 transition-colors"
                            onClick={() => {
                              // Get all blunders for this opening
                              const openingBlunders = blunders.filter(b => b.mistake.split(' - ')[0] === mostCommonOpening[0])
                              setSelectedOpeningBlunders(openingBlunders)
                              setShowBlundersModal(true)
                            }}
                          >
                            <span className="text-sky-400 mr-2">└─</span>
                            <span className="text-sm">
                              Study: <span className="font-semibold text-sky-300 underline decoration-dotted">{mostCommonOpening[0]}</span> tactics
                              <span className="text-gray-500"> ({mostCommonOpening[1]} errors)</span>
                            </span>
                          </div>
                        )}
                      </>
                    )
                  })()}
                </div>
              </div>

              {/* Recurring Patterns */}
              <div className="bg-amber-500/10 shadow-card rounded-lg p-4">
                <h5 className="font-semibold text-amber-300 mb-3 flex items-center gap-2">
                  <span>🔍</span> Recurring Patterns
                </h5>
                <div className="space-y-2">
                  {enhancedAnalysis.actionableInsights && enhancedAnalysis.actionableInsights.length > 0 ? (
                    <>
                      {enhancedAnalysis.actionableInsights
                        .filter(insight => !insight.includes('💡 Quick Tip') && !insight.includes('player ('))
                        .slice(0, 3)
                        .map((pattern, idx, arr) => (
                          <div key={idx} className="flex items-start text-gray-300">
                            <span className="text-amber-400 mr-2">{idx === arr.length - 1 ? '└─' : '├─'}</span>
                            <span className="text-sm flex-1">{pattern}</span>
                          </div>
                        ))}
                    </>
                  ) : (
                    <div className="flex items-start text-gray-400">
                      <span className="text-emerald-400 mr-2">✓</span>
                      <span className="text-sm">No recurring patterns detected - your mistakes are varied and not systematic</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Improvement / Quick Tip */}
              {enhancedAnalysis.actionableInsights && enhancedAnalysis.actionableInsights.some(i => i.includes('💡 Quick Tip')) && (
                <div className="bg-sky-500/10 shadow-card rounded-lg p-4">
                  <h5 className="font-semibold text-sky-300 mb-3 flex items-center gap-2">
                    <span>💡</span> Action Plan
                  </h5>
                  <div className="space-y-2">
                    {enhancedAnalysis.actionableInsights
                      .filter(insight => insight.includes('💡 Quick Tip'))
                      .map((tip, idx) => (
                        <div key={idx} className="flex items-start text-gray-300">
                          <span className="text-sky-400 mr-2">└─</span>
                          <span className="text-sm flex-1">{tip.replace('💡 Quick Tip: ', '')}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

            </>
          ) : (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">🎉</div>
              <h5 className="font-semibold text-white mb-2">No Major Mistakes Found!</h5>
              <p className="text-sm text-gray-400">Your opening play is solid. Keep up the good work!</p>
            </div>
          )}

          {/* Mistake Detail Modal */}
          {selectedMistake && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-surface-2 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between items-start mb-4">
                  <h4 className="text-xl font-semibold text-white">
                    Move {selectedMistake.move} Analysis
                  </h4>
                  <button
                    onClick={() => setSelectedMistake(null)}
                    className="text-gray-500 hover:text-white"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-500">Your Move</div>
                      <div className="text-lg font-semibold text-red-300">{selectedMistake.moveNotation}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Best Move</div>
                      <div className="text-lg font-semibold text-green-300">{selectedMistake.correctMove}</div>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-500">Explanation</div>
                    <div className="text-gray-300">{selectedMistake.explanation}</div>
                  </div>

                  <div className="bg-surface-3/50 rounded-lg p-4">
                    <div className="text-sm text-gray-500 mb-2">Learning Tip</div>
                    <div className="text-gray-300">
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
              {enhancedAnalysis.styleRecommendations.slice(0, 3).map((rec, index) => (
                <div key={index} className="bg-surface-2/50 shadow-card rounded-lg p-4 hover:bg-surface-2/70 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">♟️</span>
                        <h4 className="font-semibold text-white">{rec.openingName}</h4>
                        <span className={`px-2 py-1 rounded text-xs ${
                          rec.priority === 'high' ? 'bg-emerald-500/20 text-emerald-300' :
                          rec.priority === 'medium' ? 'bg-sky-500/20 text-sky-300' :
                          'bg-white/[0.06] text-gray-400'
                        }`}>
                          {rec.priority} priority
                        </span>
                      </div>
                      <div className="mb-2">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="text-xs text-gray-500">Style Match:</div>
                          <div className="flex-1 bg-surface-3 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-sky-500 to-emerald-500 h-full transition-colors"
                              style={{ width: `${rec.compatibilityScore}%` }}
                            />
                          </div>
                          <div className="text-xs font-semibold text-emerald-300">{Math.round(rec.compatibilityScore)}%</div>
                        </div>
                      </div>
                      <p className="text-sm text-gray-400 leading-relaxed">{rec.reasoning}</p>
                      {rec.suggestedLines && rec.suggestedLines.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-white/[0.04]">
                          <div className="text-xs text-gray-500 mb-1">Suggested Lines:</div>
                          {rec.suggestedLines.map((line, idx) => (
                            <div key={idx} className="text-xs text-gray-400 font-mono">• {line}</div>
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
              <p className="text-sm text-gray-400">Opening recommendations will appear here based on your playing style and performance.</p>
            </div>
          )}
        </div>
      )}

      {selectedTab === 'progress' && (
        <div className="space-y-4">
          <h5 className="font-semibold text-white">Opening Performance Trend</h5>

          {enhancedAnalysis?.improvementTrend && enhancedAnalysis.improvementTrend.length > 0 ? (
            <div className="space-y-4">
              <div className="bg-surface-2/50 rounded-lg p-4">
                <h6 className="font-semibold text-white mb-3">Opening Win Rate Over Time</h6>
                <div className="flex items-end justify-between space-x-1 h-32 mb-2">
                  {enhancedAnalysis.improvementTrend.map((point, index) => {
                    const heightPercent = (point.openingWinRate / 100) * 100
                    const color = point.openingWinRate >= 60 ? 'bg-emerald-500' :
                                 point.openingWinRate >= 50 ? 'bg-sky-500' :
                                 point.openingWinRate >= 40 ? 'bg-amber-500' : 'bg-rose-500'
                    return (
                      <div key={index} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-surface-1 px-2 py-1 rounded text-xs whitespace-nowrap z-10">
                          <div className="font-semibold">{point.openingWinRate.toFixed(1)}% win rate</div>
                          <div className="text-gray-500">{point.games} games</div>
                          <div className="text-gray-500">{new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                        </div>
                        <div
                          className={`w-full ${color} rounded-t transition-colors hover:opacity-80`}
                          style={{ height: `${heightPercent}%` }}
                        ></div>
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>{new Date(enhancedAnalysis.improvementTrend[0].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  <span>{new Date(enhancedAnalysis.improvementTrend[enhancedAnalysis.improvementTrend.length - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-surface-2/50 rounded-lg p-4">
                  <h6 className="font-semibold text-white mb-2">Recent Performance</h6>
                  <div className="text-2xl font-semibold text-emerald-300">
                    {enhancedAnalysis.improvementTrend[enhancedAnalysis.improvementTrend.length - 1]?.openingWinRate.toFixed(0) || 0}%
                  </div>
                  <div className="text-xs text-gray-500">Last week's win rate</div>
                </div>
                <div className="bg-surface-2/50 rounded-lg p-4">
                  <h6 className="font-semibold text-white mb-2">Best Week</h6>
                  <div className="text-2xl font-semibold text-blue-300">
                    {Math.max(...enhancedAnalysis.improvementTrend.map(t => t.openingWinRate)).toFixed(0)}%
                  </div>
                  <div className="text-xs text-gray-500">Highest win rate achieved</div>
                </div>
              </div>

              {enhancedAnalysis.repertoireAnalysis && (
                <div className="bg-surface-2/50 rounded-lg p-4">
                  <h6 className="font-semibold text-white mb-3">Repertoire Insights</h6>
                  <div className="space-y-3">
                    {enhancedAnalysis.repertoireAnalysis.mostSuccessful.opening !== 'None' && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">Best Opening:</span>
                        <div className="text-right">
                          <div className="font-semibold text-emerald-300">{enhancedAnalysis.repertoireAnalysis.mostSuccessful.opening}</div>
                          <div className="text-xs text-gray-500">
                            {enhancedAnalysis.repertoireAnalysis.mostSuccessful.winRate.toFixed(0)}% win rate ({enhancedAnalysis.repertoireAnalysis.mostSuccessful.games} games)
                          </div>
                        </div>
                      </div>
                    )}
                    {enhancedAnalysis.repertoireAnalysis.needsWork.opening !== 'None' && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">Needs Work:</span>
                        <div className="text-right">
                          <div className="font-semibold text-rose-300">{enhancedAnalysis.repertoireAnalysis.needsWork.opening}</div>
                          <div className="text-xs text-gray-500">
                            {enhancedAnalysis.repertoireAnalysis.needsWork.winRate.toFixed(0)}% win rate ({enhancedAnalysis.repertoireAnalysis.needsWork.games} games)
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-3 border-t border-white/[0.04]">
                      <span className="text-sm text-gray-400">Repertoire Diversity:</span>
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
              <p className="text-sm text-gray-400">Play more games to see your opening performance trends over time.</p>
            </div>
          )}
        </div>
      )}

      {/* Blunders Modal */}
      {showBlundersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setShowBlundersModal(false)}>
          <div className="bg-surface-1 rounded-lg shadow-card max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-surface-1 border-b border-white/10 p-4 flex justify-between items-center z-10">
              <h3 className="text-lg font-semibold text-white">Critical Blunders to Review </h3>
              <button
                onClick={() => setShowBlundersModal(false)}
                className="text-gray-500 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3">
              {selectedOpeningBlunders.map((blunder, idx) => {
                const moveParts = blunder.mistake.split(' - ')
                const opening = moveParts[0]
                const moveInfo = moveParts[1] || `Move ${blunder.move}`
                const gameId = blunder.game_id || blunder.gameId

                // Extract userId and platform from location
                const pathParts = location.pathname.split('/')
                const analyticsIndex = pathParts.indexOf('analytics')
                const userId = (analyticsIndex >= 0 && analyticsIndex + 1 < pathParts.length)
                  ? pathParts[analyticsIndex + 1]
                  : ''
                const platform = (analyticsIndex >= 0 && analyticsIndex + 2 < pathParts.length)
                  ? pathParts[analyticsIndex + 2]
                  : ''

                // Convert UCI moves to SAN if FEN is available
                const yourMove = blunder.moveNotation || blunder.move_notation || '?'
                const bestMove = blunder.correctMove || blunder.correct_move || '?'
                const displayYourMove = (blunder.fen && yourMove !== '?') ? convertUciToSan(blunder.fen, yourMove) : yourMove
                const displayBestMove = (blunder.fen && bestMove !== '?') ? convertUciToSan(blunder.fen, bestMove) : bestMove

                const handleBlunderClick = () => {
                  if (gameId && blunder.move) {
                    // Navigate to the game analysis page with the move number as a query parameter
                    navigate(`/analysis/${platform}/${encodeURIComponent(userId)}/${gameId}?move=${blunder.move}`)
                    setShowBlundersModal(false)
                  }
                }

                return (
                  <div
                    key={idx}
                    onClick={handleBlunderClick}
                    className={`bg-red-500/5 shadow-card rounded-lg p-4 transition-colors ${
                      gameId ? 'hover:bg-red-500/10 hover:border-red-400/50 cursor-pointer hover:scale-[1.02]' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-red-300 mb-1">
                          {opening}
                        </div>
                        <div className="text-xs text-gray-500">
                          {moveInfo}
                        </div>
                      </div>
                      <div className="text-right ml-3">
                        <div className="text-lg font-semibold text-red-400">
                          -{Math.round(blunder.centipawnLoss || blunder.centipawn_loss || 0)}
                        </div>
                        <div className="text-xs text-gray-500">
                          CPL
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="bg-red-500/10 rounded px-2 py-1.5">
                        <div className="text-xs text-gray-500">You played</div>
                        <div className="text-sm font-mono font-semibold text-red-300">
                          {displayYourMove}
                        </div>
                      </div>
                      <div className="bg-emerald-500/10 rounded px-2 py-1.5">
                        <div className="text-xs text-gray-500">Best move</div>
                        <div className="text-sm font-mono font-semibold text-emerald-300">
                          {displayBestMove}
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-gray-400 leading-relaxed mb-2">
                      {blunder.explanation}
                    </div>

                    {gameId && (
                      <div className="flex items-center justify-center gap-2 text-xs text-sky-300 font-medium">
                        <span>📋</span>
                        <span>Click to review in game</span>
                        <span>→</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
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
