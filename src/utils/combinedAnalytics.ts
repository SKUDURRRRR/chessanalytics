/**
 * Merge utilities for combining analytics data from multiple chess platforms.
 * Used when a user has both Chess.com and Lichess accounts linked.
 */

import type { AnalysisStats, ComprehensiveAnalytics, DeepAnalysisData, PersonalityScores } from '../types'

/** Weighted average helper */
function weightedAvg(a: number, wa: number, b: number, wb: number): number {
  const total = wa + wb
  if (total === 0) return 0
  return (a * wa + b * wb) / total
}

/**
 * Merge two AnalysisStats objects using weighted averages (by total_games_analyzed).
 * Additive fields are summed; per-game/average fields use weighted average.
 */
export function mergeAnalysisStats(a: AnalysisStats, b: AnalysisStats): AnalysisStats {
  const gA = a.total_games_analyzed || 0
  const gB = b.total_games_analyzed || 0
  const total = gA + gB

  if (total === 0) return a

  return {
    total_games_analyzed: total,
    average_accuracy: weightedAvg(a.average_accuracy, gA, b.average_accuracy, gB),
    total_blunders: (a.total_blunders || 0) + (b.total_blunders || 0),
    total_mistakes: (a.total_mistakes || 0) + (b.total_mistakes || 0),
    total_inaccuracies: (a.total_inaccuracies || 0) + (b.total_inaccuracies || 0),
    total_brilliant_moves: (a.total_brilliant_moves || 0) + (b.total_brilliant_moves || 0),
    total_material_sacrifices: (a.total_material_sacrifices || 0) + (b.total_material_sacrifices || 0),
    average_opening_accuracy: weightedAvg(a.average_opening_accuracy, gA, b.average_opening_accuracy, gB),
    average_middle_game_accuracy: weightedAvg(a.average_middle_game_accuracy, gA, b.average_middle_game_accuracy, gB),
    average_endgame_accuracy: weightedAvg(a.average_endgame_accuracy, gA, b.average_endgame_accuracy, gB),
    average_aggressiveness_index: weightedAvg(a.average_aggressiveness_index, gA, b.average_aggressiveness_index, gB),
    blunders_per_game: weightedAvg(a.blunders_per_game, gA, b.blunders_per_game, gB),
    mistakes_per_game: weightedAvg(a.mistakes_per_game, gA, b.mistakes_per_game, gB),
    inaccuracies_per_game: weightedAvg(a.inaccuracies_per_game, gA, b.inaccuracies_per_game, gB),
    brilliant_moves_per_game: weightedAvg(a.brilliant_moves_per_game, gA, b.brilliant_moves_per_game, gB),
    material_sacrifices_per_game: weightedAvg(a.material_sacrifices_per_game, gA, b.material_sacrifices_per_game, gB),
    average_time_management_score: weightedAvg(a.average_time_management_score, gA, b.average_time_management_score, gB),
    average_tactical_score: weightedAvg(a.average_tactical_score, gA, b.average_tactical_score, gB),
    average_positional_score: weightedAvg(a.average_positional_score, gA, b.average_positional_score, gB),
    average_aggressive_score: weightedAvg(a.average_aggressive_score, gA, b.average_aggressive_score, gB),
    average_patient_score: weightedAvg(a.average_patient_score, gA, b.average_patient_score, gB),
    average_novelty_score: weightedAvg(a.average_novelty_score, gA, b.average_novelty_score, gB),
    average_staleness_score: weightedAvg(a.average_staleness_score, gA, b.average_staleness_score, gB),
    // Don't merge ratings - keep higher one for display, but side-by-side is handled in UI
    current_rating: Math.max(a.current_rating ?? 0, b.current_rating ?? 0) || undefined,
    most_played_time_control: a.most_played_time_control || b.most_played_time_control,
    is_mock_data: a.is_mock_data && b.is_mock_data,
    analysis_status: (a.analysis_status === 'complete' || b.analysis_status === 'complete') ? 'complete' : a.analysis_status,
    elo_optimization_active: a.elo_optimization_active || b.elo_optimization_active,
    total_games_with_elo: (a.total_games_with_elo ?? 0) + (b.total_games_with_elo ?? 0),
  }
}

/** Merge color stats from two ComprehensiveAnalytics */
function mergeColorStats(
  a: ComprehensiveAnalytics['colorStats'],
  b: ComprehensiveAnalytics['colorStats']
): ComprehensiveAnalytics['colorStats'] {
  const mergeColor = (
    x: { games: number; winRate: number; averageElo: number },
    y: { games: number; winRate: number; averageElo: number }
  ) => ({
    games: x.games + y.games,
    winRate: weightedAvg(x.winRate, x.games, y.winRate, y.games),
    averageElo: weightedAvg(x.averageElo, x.games, y.averageElo, y.games),
  })

  return {
    white: mergeColor(a.white, b.white),
    black: mergeColor(a.black, b.black),
  }
}

/** Merge opening stats arrays: deduplicate by opening name, combine game counts */
function mergeOpeningStats(
  a: ComprehensiveAnalytics['openingStats'],
  b: ComprehensiveAnalytics['openingStats']
): ComprehensiveAnalytics['openingStats'] {
  const map = new Map<string, ComprehensiveAnalytics['openingStats'][number]>()

  for (const entry of [...(a || []), ...(b || [])]) {
    const key = entry.opening.toLowerCase()
    const existing = map.get(key)
    if (existing) {
      const totalGames = existing.games + entry.games
      map.set(key, {
        opening: existing.opening,
        games: totalGames,
        winRate: weightedAvg(existing.winRate, existing.games, entry.winRate, entry.games),
        averageElo: weightedAvg(existing.averageElo, existing.games, entry.averageElo, entry.games),
        identifiers: existing.identifiers,
      })
    } else {
      map.set(key, { ...entry })
    }
  }

  return Array.from(map.values()).sort((x, y) => y.games - x.games)
}

/**
 * Merge two ComprehensiveAnalytics objects.
 * Additive/average fields are merged; platform-specific sections are kept from the first argument.
 */
export function mergeComprehensiveAnalytics(
  a: ComprehensiveAnalytics,
  b: ComprehensiveAnalytics
): ComprehensiveAnalytics {
  const totalA = a.totalGames || a.total_games || 0
  const totalB = b.totalGames || b.total_games || 0
  const totalGames = totalA + totalB

  return {
    totalGames,
    total_games: totalGames,
    winRate: weightedAvg(a.winRate, totalA, b.winRate, totalB),
    win_rate: weightedAvg(a.winRate, totalA, b.winRate, totalB),
    drawRate: weightedAvg(a.drawRate, totalA, b.drawRate, totalB),
    draw_rate: weightedAvg(a.drawRate, totalA, b.drawRate, totalB),
    lossRate: weightedAvg(a.lossRate, totalA, b.lossRate, totalB),
    loss_rate: weightedAvg(a.lossRate, totalA, b.lossRate, totalB),
    colorStats: mergeColorStats(a.colorStats, b.colorStats),
    openingStats: mergeOpeningStats(a.openingStats, b.openingStats),
    openingColorStats: {
      white: [...(a.openingColorStats?.white || []), ...(b.openingColorStats?.white || [])],
      black: [...(a.openingColorStats?.black || []), ...(b.openingColorStats?.black || [])],
    },
    // ELO: show higher across platforms
    highestElo: Math.max(a.highestElo ?? 0, b.highestElo ?? 0) || null,
    highest_elo: Math.max(a.highestElo ?? 0, b.highestElo ?? 0) || null,
    timeControlWithHighestElo: a.timeControlWithHighestElo || b.timeControlWithHighestElo,
    time_control_with_highest_elo: a.timeControlWithHighestElo || b.timeControlWithHighestElo,
    currentElo: Math.max(a.currentElo ?? 0, b.currentElo ?? 0) || null,
    currentEloPerTimeControl: { ...a.currentEloPerTimeControl, ...b.currentEloPerTimeControl },
    current_elo_per_time_control: { ...a.currentEloPerTimeControl, ...b.currentEloPerTimeControl },
    // Keep performance trends from the platform with more games
    performanceTrends: (totalA >= totalB ? a : b).performanceTrends,
    // Platform-specific fields: keep from the platform with more games
    resignationTiming: (totalA >= totalB ? a : b).resignationTiming,
    resignation_timing: (totalA >= totalB ? a : b).resignation_timing,
    personalRecords: (totalA >= totalB ? a : b).personalRecords,
    personal_records: (totalA >= totalB ? a : b).personal_records,
    marathonPerformance: (totalA >= totalB ? a : b).marathonPerformance,
    marathon_performance: (totalA >= totalB ? a : b).marathon_performance,
    recentTrend: (totalA >= totalB ? a : b).recentTrend,
    recent_trend: (totalA >= totalB ? a : b).recent_trend,
    gameLengthStats: (totalA >= totalB ? a : b).gameLengthStats,
    game_length_distribution: (totalA >= totalB ? a : b).game_length_distribution,
    quickVictoryBreakdown: (totalA >= totalB ? a : b).quickVictoryBreakdown,
    quick_victory_breakdown: (totalA >= totalB ? a : b).quick_victory_breakdown,
    patienceRating: weightedAvg(a.patienceRating ?? 0, totalA, b.patienceRating ?? 0, totalB) || null,
    patience_rating: weightedAvg(a.patienceRating ?? 0, totalA, b.patienceRating ?? 0, totalB) || null,
    comebackPotential: (totalA >= totalB ? a : b).comebackPotential,
    comeback_potential: (totalA >= totalB ? a : b).comeback_potential,
  }
}

/** Merge personality scores via weighted average */
function mergePersonalityScores(a: PersonalityScores, wa: number, b: PersonalityScores, wb: number): PersonalityScores {
  return {
    tactical: weightedAvg(a.tactical, wa, b.tactical, wb),
    positional: weightedAvg(a.positional, wa, b.positional, wb),
    aggressive: weightedAvg(a.aggressive, wa, b.aggressive, wb),
    patient: weightedAvg(a.patient, wa, b.patient, wb),
    novelty: weightedAvg(a.novelty, wa, b.novelty, wb),
    staleness: weightedAvg(a.staleness, wa, b.staleness, wb),
  }
}

/**
 * Merge two DeepAnalysisData objects.
 * Personality scores are weighted-averaged; text fields are kept from the platform with more games.
 */
export function mergeDeepAnalysis(a: DeepAnalysisData, b: DeepAnalysisData): DeepAnalysisData {
  const gA = a.total_games || 0
  const gB = b.total_games || 0
  const primary = gA >= gB ? a : b

  return {
    ...primary,
    total_games: gA + gB,
    average_accuracy: weightedAvg(a.average_accuracy, gA, b.average_accuracy, gB),
    current_rating: Math.max(a.current_rating ?? 0, b.current_rating ?? 0),
    personality_scores: mergePersonalityScores(a.personality_scores, gA, b.personality_scores, gB),
    phase_accuracies: {
      opening: weightedAvg(a.phase_accuracies.opening, gA, b.phase_accuracies.opening, gB),
      middle: weightedAvg(a.phase_accuracies.middle, gA, b.phase_accuracies.middle, gB),
      endgame: weightedAvg(a.phase_accuracies.endgame, gA, b.phase_accuracies.endgame, gB),
    },
    primary_strengths: [...new Set([...a.primary_strengths, ...b.primary_strengths])],
    improvement_areas: [...new Set([...a.improvement_areas, ...b.improvement_areas])],
  }
}
