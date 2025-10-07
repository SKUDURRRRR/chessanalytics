import React, { useMemo } from 'react'
import { Chess } from 'chess.js'
import { identifyOpening } from '../../utils/openingIdentification'

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

interface OpeningTheoryAnalysisProps {
  moves: ProcessedMove[]
  playerColor: 'white' | 'black'
  gameRecord: any
}


interface OpeningVariation {
  name: string
  moves: string[]
  description: string
  popularity: 'common' | 'uncommon' | 'rare'
  evaluation: 'equal' | 'slight-advantage' | 'advantage' | 'disadvantage'
}

export function OpeningTheoryAnalysis({ moves, playerColor, gameRecord }: OpeningTheoryAnalysisProps) {
  const userMoves = moves.filter(move => move.isUserMove)
  const openingMoves = userMoves.slice(0, 15) // First 15 moves typically cover opening



  const identifiedVariation = useMemo(() => {
    const firstMoves = openingMoves.map(m => m.san)
    const openingResult = identifyOpening(gameRecord, firstMoves, playerColor)
    
    // Convert the result to the expected format
    return {
      name: openingResult.name,
      moves: firstMoves,
      description: openingResult.description,
      popularity: openingResult.popularity,
      evaluation: openingResult.evaluation
    }
  }, [openingMoves, gameRecord, playerColor])

  const openingAccuracy = useMemo(() => {
    if (openingMoves.length === 0) return 0
    const bestMoves = openingMoves.filter(move => 
      move.classification === 'best' || move.classification === 'brilliant'
    ).length
    return Math.round((bestMoves / openingMoves.length) * 100)
  }, [openingMoves])

  const theoryKnowledge = useMemo(() => {
    const totalMoves = openingMoves.length
    const inaccuracyMoves = openingMoves.filter(move => 
      move.classification === 'inaccuracy' || move.classification === 'mistake'
    ).length
    
    if (inaccuracyMoves === 0) return 'excellent'
    if (inaccuracyMoves <= totalMoves * 0.1) return 'good'
    if (inaccuracyMoves <= totalMoves * 0.2) return 'fair'
    return 'needs-improvement'
  }, [openingMoves])

  const getTheoryScore = (knowledge: string) => {
    switch (knowledge) {
      case 'excellent': return { score: 9, color: 'text-green-600', bg: 'bg-green-100' }
      case 'good': return { score: 7, color: 'text-blue-600', bg: 'bg-blue-100' }
      case 'fair': return { score: 5, color: 'text-yellow-600', bg: 'bg-yellow-100' }
      default: return { score: 3, color: 'text-red-600', bg: 'bg-red-100' }
    }
  }

  const scoreInfo = getTheoryScore(theoryKnowledge)

  return (
    <div className="space-y-6">
      {/* Opening Overview */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-200 shadow-xl shadow-black/40">
        <h3 className="mb-4 text-lg font-semibold text-white">Opening Analysis</h3>
        
        {identifiedVariation ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-lg font-semibold text-white">{identifiedVariation.name}</h4>
                <p className="text-sm text-slate-300">{identifiedVariation.description}</p>
              </div>
              <div className="text-right">
                <span className={`rounded-full px-3 py-1 text-sm font-medium ${
                  identifiedVariation.popularity === 'common'
                    ? 'border border-emerald-400/40 bg-emerald-500/20 text-emerald-200'
                    : identifiedVariation.popularity === 'uncommon'
                      ? 'border border-amber-400/40 bg-amber-500/20 text-amber-200'
                      : 'border border-slate-400/40 bg-slate-500/20 text-slate-200'
                }`}>
                  {identifiedVariation.popularity}
                </span>
              </div>
            </div>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h5 className="text-sm font-medium text-slate-300">Theory Knowledge</h5>
                <div className="mt-2 flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full border border-white/10 ${scoreInfo.bg.replace('bg-', 'bg-opacity-30 bg-')}`}>
                    <span className={`text-base font-semibold ${scoreInfo.color.replace('text-', 'text-')}`}>{scoreInfo.score}</span>
                  </div>
                  <span className="text-sm capitalize text-slate-200">{theoryKnowledge}</span>
                </div>
              </div>
              <div>
                <h5 className="text-sm font-medium text-slate-300">Opening Accuracy</h5>
                <div className="mt-2">
                  <span className={`text-xl font-semibold ${
                    openingAccuracy >= 80
                      ? 'text-emerald-300'
                      : openingAccuracy >= 60
                        ? 'text-amber-300'
                        : 'text-rose-300'
                  }`}>
                    {openingAccuracy}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-4 text-center text-sm text-slate-300">
            Unable to identify specific opening variation
          </div>
        )}
      </div>


      {/* Opening Recommendations */}
      <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-200 shadow-xl shadow-black/40">
        <h3 className="mb-4 text-lg font-semibold text-white">Study Recommendations</h3>
        <div className="space-y-3">
          {theoryKnowledge === 'needs-improvement' && (
            <div className="flex items-start gap-3 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4">
              <span className="text-lg">📚</span>
              <div>
                <p className="text-sm font-semibold text-white">Study Opening Theory</p>
                <p className="text-xs text-rose-100">
                  Consider studying the {identifiedVariation?.name || 'opening'} more deeply to improve your early game play
                </p>
              </div>
            </div>
          )}

          {openingMoves.some(move => 
            move.classification === 'mistake' && move.centipawnLoss && move.centipawnLoss > 100
          ) && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4">
              <span className="text-lg">⚠️</span>
              <div>
                <p className="text-sm font-semibold text-white">Avoid Major Mistakes</p>
                <p className="text-xs text-amber-100">
                  Major mistakes in the opening can lead to difficult positions. Focus on learning the main lines
                </p>
              </div>
            </div>
          )}

          {openingAccuracy >= 80 && (
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
              <span className="text-lg">🏆</span>
              <div>
                <p className="text-sm font-semibold text-white">Excellent Opening Play</p>
                <p className="text-xs text-emerald-100">
                  Your opening knowledge is strong. Consider expanding your repertoire with new variations
                </p>
              </div>
            </div>
          )}

          {identifiedVariation && (
            <div className="flex items-start gap-3 rounded-2xl border border-sky-400/30 bg-sky-500/10 p-4">
              <span className="text-lg">💡</span>
              <div>
                <p className="text-sm font-semibold text-white">Expand Your Repertoire</p>
                <p className="text-xs text-sky-100">
                  Learn alternative lines in the {identifiedVariation.name} to handle different responses
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
