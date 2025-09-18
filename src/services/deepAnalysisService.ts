import { supabase } from '../lib/supabase'

export interface DeepAnalysisData {
  // Basic stats
  totalGames: number
  averageAccuracy: number
  currentRating: number

  // Personality scores (calculated from game features)
  personalityScores: {
    tactical: number
    positional: number
    aggressive: number
    patient: number
    endgame: number
    opening: number
    novelty: number
    staleness: number
  }

  // Player classification
  playerLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  playerStyle: {
    category: 'positional' | 'tactical' | 'aggressive' | 'balanced'
    description: string
    confidence: number
  }

  // Analysis insights
  primaryStrengths: string[]
  improvementAreas: string[]
  playingStyle: string

  // Detailed metrics
  phaseAccuracies: {
    opening: number
    middleGame: number
    endgame: number
  }

  // Recommendations
  recommendations: {
    primary: string
    secondary: string
    leverage: string
  }
}

export async function fetchDeepAnalysis(
  userId: string,
  platform: 'lichess' | 'chess.com'
): Promise<DeepAnalysisData> {
  // Fetch games data - only select columns that exist
  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select(
      'id, user_id, platform, result, color, provider_game_id, opening, opening_family, accuracy, opponent_rating, my_rating, time_control, played_at, created_at'
    )
    .eq('user_id', userId)
    .eq('platform', platform === 'chess.com' ? 'chess.com' : 'lichess')
    .order('played_at', { ascending: false })

  if (gamesError) {
    throw new Error(`Database error: ${gamesError.message}`)
  }

  if (!games || games.length === 0) {
    return getDefaultAnalysis()
  }

  // Fetch analysis data from game_analyses table
  const { data: analyses, error: analysesError } = await supabase
    .from('game_analyses')
    .select('*')
    .eq('user_id', userId)
    .eq('platform', platform === 'chess.com' ? 'chess.com' : 'lichess')
    .order('analysis_date', { ascending: false })

  if (analysesError) {
    console.warn('Error fetching analysis data:', analysesError)
  }

  // Calculate basic stats
  const totalGames = games.length
  const currentRating = games[0]?.my_rating || 0

  // Use analysis data for accuracy if available, otherwise fall back to games data
  let averageAccuracy = 0
  if (analyses && analyses.length > 0) {
    averageAccuracy =
      analyses.reduce((sum: number, a: any) => sum + (a.accuracy || 0), 0) / analyses.length
    console.log('Using analysis data for accuracy:', {
      analysisCount: analyses.length,
      averageAccuracy,
    })
  } else {
    averageAccuracy = games.reduce((sum: number, g: any) => sum + (g.accuracy || 0), 0) / totalGames
    console.log('Using games data for accuracy:', { gameCount: games.length, averageAccuracy })
  }

  // Calculate personality scores from game data and analysis data
  // Use move_analyses data for personality scores
  const personalityScores = calculatePersonalityScoresFromGames(games, analyses || [], userId)

  // Determine player level
  const playerLevel = determinePlayerLevel(currentRating, averageAccuracy)

  // Determine player style
  const playerStyle = determinePlayerStyle(personalityScores)

  // Calculate phase accuracies
  const phaseAccuracies = calculatePhaseAccuracies(games)

  // Generate insights
  const primaryStrengths = identifyPrimaryStrengths(personalityScores)
  const improvementAreas = identifyImprovementAreas(personalityScores)
  const playingStyle = generatePlayingStyleDescription(playerStyle, personalityScores)

  // Generate recommendations
  const recommendations = generateRecommendations(personalityScores, improvementAreas)

  return {
    totalGames,
    averageAccuracy,
    currentRating,
    personalityScores,
    playerLevel,
    playerStyle,
    primaryStrengths,
    improvementAreas,
    playingStyle,
    phaseAccuracies,
    recommendations,
  }
}

function calculatePersonalityScoresFromGames(
  games: any[],
  analyses: any[] = [],
  userId: string = 'unknown'
): DeepAnalysisData['personalityScores'] {
  if (games.length === 0) {
    return {
      tactical: 50,
      positional: 50,
      aggressive: 50,
      patient: 50,
      endgame: 50,
      opening: 50,
      novelty: 50,
      staleness: 50,
    }
  }

  console.log('calculatePersonalityScoresFromGames - Debug Info:', {
    totalGames: games.length,
    totalAnalyses: analyses.length,
    sampleAnalysis: analyses[0],
    hasMoveAnalyses: analyses.some(a => a.tactical_score !== undefined),
  })

  // If we have detailed analysis data from move_analyses table (Stockfish), use it
  if (analyses && analyses.length > 0 && analyses.some(a => a.tactical_score !== undefined)) {
    console.log('Using detailed analysis data from move_analyses table (Stockfish)', {
      analysisCount: analyses.length,
      sampleAnalysis: analyses[0],
      hasTacticalScore: analyses[0]?.tactical_score !== undefined,
      hasPositionalScore: analyses[0]?.positional_score !== undefined,
    })
    return calculatePersonalityFromMoveAnalyses(analyses)
  }

  // If we have analysis data from game_analyses table, use it
  if (analyses && analyses.length > 0) {
    console.log('Using analysis data from game_analyses table', {
      analysisCount: analyses.length,
      sampleAnalysis: analyses[0],
      avgAccuracy: analyses.reduce((sum, a) => sum + (a.accuracy || 0), 0) / analyses.length,
      avgBlunders: analyses.reduce((sum, a) => sum + (a.blunders || 0), 0) / analyses.length,
    })
    return calculatePersonalityFromAnalyzedGames(analyses)
  }

  // Fallback: Check for analysis data in games table
  const analyzedGames = games.filter(
    g => g.accuracy !== null && g.accuracy !== undefined && g.accuracy > 0
  )

  // If we have enough analyzed games (at least 3), use them
  if (analyzedGames.length >= 3) {
    console.log('Using analysis data from games table')
    return calculatePersonalityFromAnalyzedGames(analyzedGames)
  }

  // If we have some analyzed games but not enough, combine with basic data
  if (analyzedGames.length > 0) {
    console.log('Combining analysis data with basic estimation')
    const combinedScores = calculatePersonalityFromAnalyzedGames(analyzedGames)
    const basicScores = estimatePersonalityFromBasicData(games, userId)

    // Weight the analyzed games more heavily
    const weight = analyzedGames.length / games.length
    return {
      tactical: Math.round(combinedScores.tactical * weight + basicScores.tactical * (1 - weight)),
      positional: Math.round(
        combinedScores.positional * weight + basicScores.positional * (1 - weight)
      ),
      aggressive: Math.round(
        combinedScores.aggressive * weight + basicScores.aggressive * (1 - weight)
      ),
      patient: Math.round(combinedScores.patient * weight + basicScores.patient * (1 - weight)),
      endgame: Math.round(combinedScores.endgame * weight + basicScores.endgame * (1 - weight)),
      opening: Math.round(combinedScores.opening * weight + basicScores.opening * (1 - weight)),
      novelty: Math.round(combinedScores.novelty * weight + basicScores.novelty * (1 - weight)),
      staleness: Math.round(
        combinedScores.staleness * weight + basicScores.staleness * (1 - weight)
      ),
    }
  }

  // Only use basic estimation as last resort, but with improved logic
  console.log(
    'Using basic estimation fallback - this will give similar scores for similar ratings!'
  )
  console.log('Games data for estimation:', {
    totalGames: games.length,
    avgRating: games.reduce((sum, g) => sum + (g.my_rating || 1200), 0) / games.length,
    winRate: games.filter(g => g.result === 'win').length / games.length,
    sampleGame: games[0],
  })
  return estimatePersonalityFromBasicData(games, userId)
}

function estimatePersonalityFromBasicData(
  games: any[],
  userId: string = 'unknown'
): DeepAnalysisData['personalityScores'] {
  const totalGames = games.length
  const wins = games.filter(g => g.result === 'win').length
  const winRate = wins / totalGames

  // Calculate average rating for skill estimation
  const avgRating = games.reduce((sum, g) => sum + (g.my_rating || 1200), 0) / totalGames

  // Debug logging
  console.log('estimatePersonalityFromBasicData - Debug Info:', {
    totalGames,
    avgRating,
    sampleGame: games[0],
    hasAccuracy: games.some(g => g.accuracy !== null && g.accuracy !== undefined),
    hasBlunders: games.some(g => g.blunders !== null && g.blunders !== undefined),
  })

  // Skill-based scaling function - much more realistic for beginners
  function getSkillBasedScore(rating: number, baseMetric: number): number {
    // Rating thresholds for different skill levels
    if (rating < 1000) return Math.min(25, baseMetric * 0.3) // Beginner: max 25
    if (rating < 1200) return Math.min(35, baseMetric * 0.4) // Novice: max 35
    if (rating < 1400) return Math.min(45, baseMetric * 0.5) // Club: max 45
    if (rating < 1600) return Math.min(55, baseMetric * 0.6) // Intermediate: max 55
    if (rating < 1800) return Math.min(65, baseMetric * 0.7) // Advanced: max 65
    if (rating < 2000) return Math.min(75, baseMetric * 0.8) // Expert: max 75
    if (rating < 2200) return Math.min(85, baseMetric * 0.9) // Master: max 85
    return Math.min(95, baseMetric) // Grandmaster: max 95
  }

  // Calculate base metrics from actual game data, with fallbacks for missing data
  let avgAccuracy = games.reduce((sum, g) => sum + (g.accuracy || 0), 0) / totalGames
  let avgBlunders = games.reduce((sum, g) => sum + (g.blunders || 0), 0) / totalGames
  let avgMistakes = games.reduce((sum, g) => sum + (g.mistakes || 0), 0) / totalGames
  let avgInaccuracies = games.reduce((sum, g) => sum + (g.inaccuracies || 0), 0) / totalGames

  // If no analysis data is available, estimate based on rating and results
  if (avgAccuracy === 0 && avgBlunders === 0 && avgMistakes === 0) {
    console.log('No analysis data found, estimating based on rating and results')

    // Estimate accuracy based on rating (realistic ranges)
    avgAccuracy = Math.max(30, Math.min(95, 50 + (avgRating - 1000) / 25))

    // Estimate errors based on accuracy and rating
    avgBlunders = Math.max(0, Math.round((100 - avgAccuracy) / 20 + (avgRating < 1200 ? 3 : 1)))
    avgMistakes = Math.max(0, Math.round((100 - avgAccuracy) / 12 + (avgRating < 1200 ? 2 : 0.5)))
    avgInaccuracies = Math.max(
      0,
      Math.round((100 - avgAccuracy) / 6 + (avgRating < 1200 ? 1 : 0.2))
    )

    // Adjust based on win rate (winners play better)
    const winRateAdjustment = (winRate - 0.5) * 10
    avgAccuracy = Math.max(30, Math.min(95, avgAccuracy + winRateAdjustment))
    avgBlunders = Math.max(0, avgBlunders - winRateAdjustment / 5)
    avgMistakes = Math.max(0, avgMistakes - winRateAdjustment / 8)
    avgInaccuracies = Math.max(0, avgInaccuracies - winRateAdjustment / 10)

    // Add some individual variation based on game patterns

    // Add small random variations to make each player unique
    const randomFactor = ((userId.charCodeAt(0) + userId.length) % 20) - 10 // Deterministic "random" based on username
    avgAccuracy = Math.max(30, Math.min(95, avgAccuracy + randomFactor * 0.5))
    avgBlunders = Math.max(0, avgBlunders + randomFactor * 0.1)
    avgMistakes = Math.max(0, avgMistakes + randomFactor * 0.2)
    avgInaccuracies = Math.max(0, avgInaccuracies + randomFactor * 0.3)
  }

  // Analyze opening preferences for aggressiveness
  const aggressiveOpenings = games.filter(g => {
    const opening = (g.opening || '').toLowerCase()
    return (
      opening.includes('sicilian') ||
      opening.includes("king's indian") ||
      opening.includes('dragon') ||
      opening.includes('najdorf') ||
      opening.includes('pirc') ||
      opening.includes('modern') ||
      opening.includes('gambit') ||
      opening.includes('attack')
    )
  }).length

  const aggressiveRatio = aggressiveOpenings / totalGames

  // Analyze time control for patience estimation
  const blitzGames = games.filter(g => {
    const tc = g.time_control || ''
    return tc.includes('60') || tc.includes('120') || tc.includes('180')
  }).length

  const blitzRatio = blitzGames / totalGames

  // Calculate realistic scores based on actual chess performance
  const tacticalBase = Math.max(0, avgAccuracy - avgBlunders * 5 - avgMistakes * 2)
  const tactical = Math.round(getSkillBasedScore(avgRating, tacticalBase))

  const positionalBase = Math.max(0, avgAccuracy - avgInaccuracies * 1.5)
  const positional = Math.round(getSkillBasedScore(avgRating, positionalBase))

  const aggressiveBase = Math.min(100, aggressiveRatio * 100 + (avgRating - 1200) / 20)
  const aggressive = Math.round(getSkillBasedScore(avgRating, aggressiveBase))

  const patientBase = Math.max(0, avgAccuracy - avgBlunders * 3 - blitzRatio * 20)
  const patient = Math.round(getSkillBasedScore(avgRating, patientBase))

  // Calculate endgame score based on accuracy and game length
  const avgGameLength = games.reduce((sum, g) => sum + (g.total_moves || 40), 0) / totalGames
  const endgameBase = Math.max(0, avgAccuracy - avgBlunders * 2 - (avgGameLength < 30 ? 10 : 0))
  const endgame = Math.round(getSkillBasedScore(avgRating, endgameBase))

  // Calculate opening score based on accuracy and opening knowledge
  const openingBase = Math.max(0, avgAccuracy - avgInaccuracies * 2 + aggressiveRatio * 10)
  const opening = Math.round(getSkillBasedScore(avgRating, openingBase))

  // Calculate novelty and staleness from basic game data
  const novelty = calculateNoveltyScoreFromBasicData(games, avgRating)
  const staleness = calculateStalenessScoreFromBasicData(games, avgRating)

  // Debug logging for final scores
  console.log('Final score calculations (Analyzed Games):', {
    avgAccuracy,
    avgBlunders,
    avgMistakes,
    avgInaccuracies,
    avgRating,
    tacticalBase,
    tactical,
    positionalBase,
    positional,
    aggressiveBase,
    aggressive,
    patientBase,
    patient,
    endgameBase,
    endgame,
    openingBase,
    opening,
  })

  // Additional debugging for skill-based scaling
  console.log('Skill-based scaling debug:', {
    avgRating,
    tacticalBase,
    'tactical after scaling': tactical,
    'scaling factor for 1200 rating': avgRating < 1200 ? 0.4 : 'higher',
    'max for 1200 rating': avgRating < 1200 ? 35 : 'higher',
  })

  return {
    tactical,
    positional,
    aggressive,
    patient,
    endgame,
    opening,
    novelty,
    staleness,
  }
}

function calculatePersonalityFromMoveAnalyses(
  moveAnalyses: any[]
): DeepAnalysisData['personalityScores'] {
  const totalAnalyses = moveAnalyses.length

  console.log('calculatePersonalityFromMoveAnalyses - Debug Info:', {
    totalAnalyses,
    sampleAnalysis: moveAnalyses[0],
    hasTacticalScore: moveAnalyses.some(a => a.tactical_score !== undefined),
    hasPositionalScore: moveAnalyses.some(a => a.positional_score !== undefined),
    hasAggressiveScore: moveAnalyses.some(a => a.aggressive_score !== undefined),
  })

  // Calculate average personality scores directly from move_analyses
  const tactical = moveAnalyses.reduce((sum, a) => sum + (a.tactical_score || 0), 0) / totalAnalyses
  const positional =
    moveAnalyses.reduce((sum, a) => sum + (a.positional_score || 0), 0) / totalAnalyses
  const aggressive =
    moveAnalyses.reduce((sum, a) => sum + (a.aggressive_score || 0), 0) / totalAnalyses
  const patient = moveAnalyses.reduce((sum, a) => sum + (a.patient_score || 0), 0) / totalAnalyses
  const endgame = moveAnalyses.reduce((sum, a) => sum + (a.endgame_score || 0), 0) / totalAnalyses
  const opening = moveAnalyses.reduce((sum, a) => sum + (a.opening_score || 0), 0) / totalAnalyses

  // Calculate novelty and staleness from move analysis data
  const novelty = calculateNoveltyScore(moveAnalyses)
  const staleness = calculateStalenessScore(moveAnalyses)

  return {
    tactical: Math.round(tactical),
    positional: Math.round(positional),
    aggressive: Math.round(aggressive),
    patient: Math.round(patient),
    endgame: Math.round(endgame),
    opening: Math.round(opening),
    novelty: Math.round(novelty),
    staleness: Math.round(staleness),
  }
}

function calculatePersonalityFromAnalyzedGames(
  analyses: any[]
): DeepAnalysisData['personalityScores'] {
  const totalAnalyses = analyses.length

  // Calculate average rating for skill-based scaling
  const avgRating = analyses.reduce((sum, a) => sum + (a.my_rating || 1200), 0) / totalAnalyses

  console.log('calculatePersonalityFromAnalyzedGames - Debug Info:', {
    totalAnalyses,
    avgRating,
    sampleAnalysis: analyses[0],
    hasAccuracy: analyses.some(a => a.accuracy !== null && a.accuracy !== undefined),
    hasBlunders: analyses.some(a => a.blunders !== null && a.blunders !== undefined),
    availableFields: Object.keys(analyses[0] || {}),
    firstFewAnalyses: analyses.slice(0, 3).map(a => ({
      accuracy: a.accuracy,
      blunders: a.blunders,
      mistakes: a.mistakes,
      brilliant_moves: a.brilliant_moves,
      my_rating: a.my_rating,
    })),
  })

  // Skill-based scaling function - more realistic scaling
  function getSkillBasedScore(rating: number, baseMetric: number): number {
    if (rating < 1000) return Math.min(40, baseMetric * 0.5) // Beginner: max 40
    if (rating < 1200) return Math.min(55, baseMetric * 0.7) // Novice: max 55
    if (rating < 1400) return Math.min(65, baseMetric * 0.8) // Club: max 65
    if (rating < 1600) return Math.min(75, baseMetric * 0.85) // Intermediate: max 75
    if (rating < 1800) return Math.min(80, baseMetric * 0.9) // Advanced: max 80
    if (rating < 2000) return Math.min(85, baseMetric * 0.95) // Expert: max 85
    if (rating < 2200) return Math.min(90, baseMetric * 0.98) // Master: max 90
    return Math.min(95, baseMetric) // Grandmaster: max 95
  }

  // Calculate tactical score based on accuracy, brilliant moves, and blunder rate
  const avgAccuracy = analyses.reduce((sum, a) => sum + (a.accuracy || 0), 0) / totalAnalyses
  const avgBrilliantMoves =
    analyses.reduce((sum, a) => sum + (a.brilliant_moves || 0), 0) / totalAnalyses
  const avgBlunders = analyses.reduce((sum, a) => sum + (a.blunders || 0), 0) / totalAnalyses
  const avgMistakes = analyses.reduce((sum, a) => sum + (a.mistakes || 0), 0) / totalAnalyses

  // Tactical: High accuracy + brilliant moves - blunders/mistakes
  const tacticalBase = Math.max(
    0,
    avgAccuracy * 0.7 + avgBrilliantMoves * 8 - avgBlunders * 4 - avgMistakes * 2
  )
  const tactical = Math.round(getSkillBasedScore(avgRating, tacticalBase))

  // Calculate positional score based on middle game accuracy and consistency
  const avgMiddleGameAccuracy =
    analyses.reduce((sum, a) => sum + (a.middle_game_accuracy || 0), 0) / totalAnalyses
  const avgGameLength = analyses.reduce((sum, a) => sum + (a.total_moves || 40), 0) / totalAnalyses

  // Positional: Middle game accuracy + game length factor + overall consistency
  const positionalBase = Math.max(
    0,
    avgMiddleGameAccuracy * 0.8 + Math.min(10, (avgGameLength - 30) * 0.5) + (100 - avgBlunders * 3)
  )
  const positional = Math.round(getSkillBasedScore(avgRating, positionalBase))

  // Calculate aggressive score based on aggressiveness index, material sacrifices, and opening choices
  const avgAggressiveness =
    analyses.reduce((sum, a) => sum + (a.aggressiveness_index || 0), 0) / totalAnalyses
  const avgSacrifices =
    analyses.reduce((sum, a) => sum + (a.material_sacrifices || 0), 0) / totalAnalyses

  // Count aggressive openings
  const aggressiveOpenings = analyses.filter(a => {
    const opening = (a.opening || '').toLowerCase()
    return (
      opening.includes('sicilian') ||
      opening.includes("king's indian") ||
      opening.includes('dragon') ||
      opening.includes('najdorf') ||
      opening.includes('pirc') ||
      opening.includes('modern')
    )
  }).length

  const aggressiveBase = Math.max(
    0,
    Math.min(
      100,
      avgAggressiveness * 100 + avgSacrifices * 15 + (aggressiveOpenings / totalAnalyses) * 20
    )
  )
  const aggressive = Math.round(getSkillBasedScore(avgRating, aggressiveBase))

  // Calculate patient score based on accuracy, low blunder rate, and endgame performance
  const avgEndgameAccuracy =
    analyses.reduce((sum, a) => sum + (a.endgame_accuracy || 0), 0) / totalAnalyses
  const avgInaccuracies =
    analyses.reduce((sum, a) => sum + (a.inaccuracies || 0), 0) / totalAnalyses

  // Patient: High accuracy + low blunders + good endgame + low inaccuracies
  const patientBase = Math.max(
    0,
    avgAccuracy * 0.6 + avgEndgameAccuracy * 0.3 - avgBlunders * 2 - avgInaccuracies * 0.5
  )
  const patient = Math.round(getSkillBasedScore(avgRating, patientBase))

  // Calculate endgame score based on endgame accuracy and game length
  const avgEndgameAccuracyForEndgame =
    analyses.reduce((sum, a) => sum + (a.endgame_accuracy || 0), 0) / totalAnalyses
  const endgameBase = Math.max(
    0,
    avgEndgameAccuracyForEndgame * 0.8 + (avgGameLength > 40 ? 10 : 0)
  )
  const endgame = Math.round(getSkillBasedScore(avgRating, endgameBase))

  // Calculate opening score based on opening accuracy and variety
  const avgOpeningAccuracy =
    analyses.reduce((sum, a) => sum + (a.opening_accuracy || 0), 0) / totalAnalyses
  const openingVariety = new Set(analyses.map(a => a.opening).filter(Boolean)).size
  const openingBase = Math.max(0, avgOpeningAccuracy * 0.7 + Math.min(20, openingVariety * 2))
  const opening = Math.round(getSkillBasedScore(avgRating, openingBase))

  // Calculate novelty score based on move uniqueness and position diversity
  const novelty = calculateNoveltyScoreFromGames(analyses)

  // Calculate staleness score based on opening repetition and pattern consistency
  const staleness = calculateStalenessScoreFromGames(analyses)

  return {
    tactical,
    positional,
    aggressive,
    patient,
    endgame,
    opening,
    novelty,
    staleness,
  }
}

function determinePlayerLevel(rating: number, _accuracy: number): DeepAnalysisData['playerLevel'] {
  // More accurate skill level determination based on rating thresholds
  if (rating < 1000) return 'beginner'
  if (rating < 1200) return 'beginner' // Still beginner until 1200
  if (rating < 1400) return 'intermediate' // Club level
  if (rating < 1600) return 'intermediate' // Strong club level
  if (rating < 1800) return 'advanced' // Expert level
  if (rating < 2000) return 'advanced' // Strong expert
  if (rating < 2200) return 'expert' // Master level
  return 'expert' // Grandmaster level
}

function determinePlayerStyle(
  scores: DeepAnalysisData['personalityScores']
): DeepAnalysisData['playerStyle'] {
  const { tactical, positional, aggressive } = scores

  if (positional > tactical && positional > aggressive) {
    return {
      category: 'positional',
      description:
        'reminiscent of Anatoly Karpov and Tigran Petrosian - positional players who excel at long-term strategy',
      confidence: Math.min(90, positional),
    }
  }

  if (tactical > positional && tactical > aggressive) {
    return {
      category: 'tactical',
      description:
        'reminiscent of Mikhail Tal and Garry Kasparov - tactical players who excel at combinations',
      confidence: Math.min(90, tactical),
    }
  }

  if (aggressive > positional && aggressive > tactical) {
    return {
      category: 'aggressive',
      description:
        'reminiscent of Bobby Fischer and Magnus Carlsen - aggressive players who seek dynamic positions',
      confidence: Math.min(90, aggressive),
    }
  }

  return {
    category: 'balanced',
    description: 'a balanced player with no single dominant style',
    confidence: 60,
  }
}

function calculatePhaseAccuracies(games: any[]): DeepAnalysisData['phaseAccuracies'] {
  const analyzedGames = games.filter(
    g => g.opening_accuracy && g.middle_game_accuracy && g.endgame_accuracy
  )

  if (analyzedGames.length === 0) {
    return { opening: 0, middleGame: 0, endgame: 0 }
  }

  return {
    opening: Math.round(
      analyzedGames.reduce((sum, g) => sum + g.opening_accuracy, 0) / analyzedGames.length
    ),
    middleGame: Math.round(
      analyzedGames.reduce((sum, g) => sum + g.middle_game_accuracy, 0) / analyzedGames.length
    ),
    endgame: Math.round(
      analyzedGames.reduce((sum, g) => sum + g.endgame_accuracy, 0) / analyzedGames.length
    ),
  }
}

function identifyPrimaryStrengths(scores: DeepAnalysisData['personalityScores']): string[] {
  const strengths = []
  if (scores.positional >= 70) strengths.push('Positional understanding')
  if (scores.tactical >= 70) strengths.push('Tactical vision')
  if (scores.aggressive >= 70) strengths.push('Dynamic play')
  if (scores.patient >= 70) strengths.push('Patience and calculation')
  if (scores.novelty >= 70) strengths.push('Creative and experimental play')
  if (scores.staleness <= 30) strengths.push('Varied and adaptive style')
  return strengths
}

function identifyImprovementAreas(scores: DeepAnalysisData['personalityScores']): string[] {
  const areas = []
  if (scores.tactical < 50) areas.push('Tactical pattern recognition')
  if (scores.patient < 50) areas.push('Calculation depth and patience')
  if (scores.novelty < 50) areas.push('Creative play and experimentation')
  if (scores.staleness > 70) areas.push('Variety in openings and patterns')
  return areas
}

function generatePlayingStyleDescription(
  style: DeepAnalysisData['playerStyle'],
  scores: DeepAnalysisData['personalityScores']
): string {
  return `You are a ${style.category} player with ${scores.positional}% positional understanding and ${scores.aggressive}% aggressive tendencies. ${style.description}`
}

function generateRecommendations(
  scores: DeepAnalysisData['personalityScores'],
  improvementAreas: string[]
): DeepAnalysisData['recommendations'] {
  const lowestScore = Math.min(...Object.values(scores))
  const lowestArea = Object.entries(scores).find(([_, score]) => score === lowestScore)?.[0]

  return {
    primary: `Focus on improving ${lowestArea} skills. Practice ${lowestArea === 'tactical' ? 'tactical puzzles' : lowestArea === 'patient' ? 'calculation exercises' : `${lowestArea} positions`} daily.`,
    secondary: `Work on ${improvementAreas[1] || 'overall game understanding'} through targeted practice.`,
    leverage: `Your ${Object.entries(scores).sort(([, a], [, b]) => b - a)[0][0]} skills are excellent - focus on positions that highlight this strength.`,
  }
}

function getDefaultAnalysis(): DeepAnalysisData {
  return {
    totalGames: 0,
    averageAccuracy: 0,
    currentRating: 0,
    personalityScores: {
      tactical: 50,
      positional: 50,
      aggressive: 50,
      patient: 50,
      endgame: 50,
      opening: 50,
      novelty: 50,
      staleness: 50,
    },
    playerLevel: 'beginner',
    playerStyle: { category: 'balanced', description: 'a developing player', confidence: 50 },
    primaryStrengths: [],
    improvementAreas: [],
    playingStyle: 'A developing player',
    phaseAccuracies: { opening: 0, middleGame: 0, endgame: 0 },
    recommendations: {
      primary: 'Play more games to develop your chess understanding',
      secondary: 'Study basic chess principles',
      leverage: 'Focus on enjoying the game and learning from each position',
    },
  }
}

// Novelty and Staleness Calculation Functions

function calculateNoveltyScore(moveAnalyses: any[]): number {
  if (moveAnalyses.length === 0) return 50

  const totalMoves = moveAnalyses.length

  // Creative moves: good moves that aren't engine's top choice
  const creativeMoves = moveAnalyses.filter(
    m => !m.is_best && !m.is_mistake && !m.is_inaccuracy && (m.centipawn_loss || 0) < 50
  ).length

  // Unorthodox patterns: moves with unique characteristics
  const unorthodoxMoves = moveAnalyses.filter(
    m =>
      m.move_san && (m.move_san.includes('!') || m.move_san.includes('?') || m.move_san.length > 4)
  ).length

  // Position diversity: variety in move types and patterns
  const moveTypes = new Set()
  moveAnalyses.forEach(m => {
    if (m.move_san) {
      moveTypes.add(m.move_san[0]) // First character (piece type)
    }
  })

  const diversityBonus = Math.min(20, moveTypes.size * 5)

  // Calculate novelty score
  const creativeScore = (creativeMoves / totalMoves) * 60
  const unorthodoxScore = (unorthodoxMoves / totalMoves) * 30
  const diversityScore = diversityBonus

  return Math.max(0, Math.min(100, creativeScore + unorthodoxScore + diversityScore))
}

function calculateStalenessScore(moveAnalyses: any[]): number {
  if (moveAnalyses.length === 0) return 50

  const totalMoves = moveAnalyses.length

  // Move pattern repetition
  const movePatterns: { [key: string]: number } = {}
  moveAnalyses.forEach(m => {
    if (m.move_san) {
      const pattern = m.move_san.substring(0, 2) // First two characters
      movePatterns[pattern] = (movePatterns[pattern] || 0) + 1
    }
  })

  // Calculate pattern diversity
  const uniquePatterns = Object.keys(movePatterns).length
  const patternDiversity = (uniquePatterns / totalMoves) * 100

  // Standard opening moves (ply <= 15)
  const openingMoves = moveAnalyses.filter(m => m.opening_ply && m.opening_ply <= 15).length
  const openingRatio = openingMoves / totalMoves

  // Calculate staleness (higher = more stale)
  const patternStaleness = 100 - patternDiversity
  const openingStalenessScore = openingRatio * 40

  const finalScore = patternStaleness * 0.6 + openingStalenessScore * 0.4

  return Math.max(0, Math.min(100, finalScore))
}

function calculateNoveltyScoreFromGames(analyses: any[]): number {
  if (analyses.length === 0) return 50

  // Calculate novelty based on opening variety and game patterns
  const totalAnalyses = analyses.length

  // Count unique openings played
  const uniqueOpenings = new Set(analyses.map(a => a.opening).filter(Boolean)).size
  const openingVariety = Math.min(100, uniqueOpenings * 10) // Up to 100 points for variety

  // Count games with unusual patterns (long games, different time controls)
  const unusualGames = analyses.filter(a => {
    const gameLength = a.total_moves || 40
    const timeControl = a.time_control || ''
    return gameLength > 60 || timeControl.includes('180') || timeControl.includes('300')
  }).length

  const patternVariety = (unusualGames / totalAnalyses) * 50 // Up to 50 points for pattern variety

  // Calculate novelty score
  const noveltyScore = Math.min(100, openingVariety + patternVariety)

  return Math.max(0, Math.min(100, noveltyScore))
}

function calculateStalenessScoreFromGames(analyses: any[]): number {
  if (analyses.length === 0) return 50

  // Calculate staleness based on opening repetition and pattern consistency
  const totalAnalyses = analyses.length

  // Count opening repetition
  const openingCounts = analyses.reduce(
    (acc, a) => {
      const opening = a.opening || 'Unknown'
      acc[opening] = (acc[opening] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const maxOpeningCount = Math.max(...(Object.values(openingCounts) as number[]))
  const openingRepetition = (maxOpeningCount / totalAnalyses) * 100 // Higher = more stale

  // Count games with similar patterns (short games, same time controls)
  const similarGames = analyses.filter(a => {
    const gameLength = a.total_moves || 40
    const timeControl = a.time_control || ''
    return gameLength < 40 && (timeControl.includes('60') || timeControl.includes('120'))
  }).length

  const patternConsistency = (similarGames / totalAnalyses) * 50 // Higher = more stale

  // Calculate staleness score (higher = more stale)
  const stalenessScore = Math.min(100, openingRepetition + patternConsistency)

  return Math.max(0, Math.min(100, stalenessScore))
}

function calculateNoveltyScoreFromBasicData(games: any[], avgRating: number): number {
  if (games.length === 0) return 50

  // Calculate novelty based on basic game data

  // Count unique openings played
  const uniqueOpenings = new Set(games.map(g => g.opening).filter(Boolean)).size
  const openingVariety = Math.min(100, uniqueOpenings * 15) // Up to 100 points for variety

  // Count games with different time controls
  const timeControls = new Set(games.map(g => g.time_control).filter(Boolean)).size
  const timeVariety = Math.min(50, timeControls * 10) // Up to 50 points for time variety

  // Count games with different results (shows adaptability)
  const results = new Set(games.map(g => g.result)).size
  const resultVariety = Math.min(30, results * 15) // Up to 30 points for result variety

  // Calculate novelty score
  const noveltyScore = Math.min(100, openingVariety + timeVariety + resultVariety)

  // Apply skill-based scaling
  const skillFactor = avgRating < 1200 ? 0.7 : avgRating < 1600 ? 0.85 : 0.95
  return Math.max(0, Math.min(100, noveltyScore * skillFactor))
}

function calculateStalenessScoreFromBasicData(games: any[], avgRating: number): number {
  if (games.length === 0) return 50

  // Calculate staleness based on basic game data
  const totalGames = games.length

  // Count opening repetition
  const openingCounts = games.reduce(
    (acc, g) => {
      const opening = g.opening || 'Unknown'
      acc[opening] = (acc[opening] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const maxOpeningCount = Math.max(...(Object.values(openingCounts) as number[]))
  const openingRepetition = (maxOpeningCount / totalGames) * 100 // Higher = more stale

  // Count time control repetition
  const timeControlCounts = games.reduce(
    (acc, g) => {
      const tc = g.time_control || 'Unknown'
      acc[tc] = (acc[tc] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const maxTimeControlCount = Math.max(...(Object.values(timeControlCounts) as number[]))
  const timeControlRepetition = (maxTimeControlCount / totalGames) * 50 // Up to 50 points

  // Calculate staleness score (higher = more stale)
  const stalenessScore = Math.min(100, openingRepetition + timeControlRepetition)

  // Apply skill-based scaling (higher rated players tend to be less stale)
  const skillFactor = avgRating < 1200 ? 1.2 : avgRating < 1600 ? 1.0 : 0.8
  return Math.max(0, Math.min(100, stalenessScore * skillFactor))
}
