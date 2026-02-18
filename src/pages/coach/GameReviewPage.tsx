/**
 * Game Review with Coach Page
 * Guided walkthrough of key mistakes in an analyzed game with Coach Tal.
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Chess } from 'chess.js'
import { PremiumGate } from '../../components/coach/PremiumGate'
import { UnifiedChessAnalysis } from '../../components/debug/UnifiedChessAnalysis'
import { fetchGameAnalysisData } from '../../services/gameAnalysisService'
import { useCoachChat } from '../../contexts/CoachChatContext'
import { useMobileOptimizations } from '../../hooks/useResponsive'
import { generateModernMoveArrows } from '../../utils/chessArrows'
import {
  buildProcessedMoves,
  identifyKeyMoments,
  classificationBadgeStyles,
  classificationLabel,
  type ProcessedMove,
  type KeyMoment,
} from '../../utils/moveProcessor'
import type { ChatPositionContext, Platform } from '../../types'

// ============================================================================
// Types
// ============================================================================

type ReviewPhase = 'loading' | 'error' | 'no-mistakes' | 'intro' | 'reviewing' | 'summary'

interface GameMeta {
  opponent: string
  result: 'win' | 'loss' | 'draw'
  opening: string
  playerColor: 'white' | 'black'
  playedAt: string
  accuracy: number | null
}

// ============================================================================
// Helpers
// ============================================================================

const canonicalizePlatform = (p: string | undefined): Platform | null => {
  if (p === 'lichess' || p === 'chess.com') return p
  return null
}

const extractOpponentFromPGN = (pgn: string, color: 'white' | 'black'): string => {
  try {
    const lines = pgn.split('\n')
    let white = ''
    let black = ''
    for (const line of lines) {
      if (line.startsWith('[White ')) white = line.split('"')[1] || ''
      else if (line.startsWith('[Black ')) black = line.split('"')[1] || ''
    }
    return color === 'white' ? black : white
  } catch {
    return 'Opponent'
  }
}

const extractResultFromRecord = (game: Record<string, unknown>): 'win' | 'loss' | 'draw' => {
  const r = String(game?.result || game?.game_result || '').toLowerCase()
  if (r.includes('win') || r === '1-0' || r === '0-1') {
    // Check if *this user* won
    const color = String(game?.color || '').toLowerCase()
    if (r === '1-0') return color === 'black' ? 'loss' : 'win'
    if (r === '0-1') return color === 'white' ? 'loss' : 'win'
    return 'win'
  }
  if (r.includes('draw') || r === '1/2-1/2') return 'draw'
  if (r.includes('loss') || r.includes('lose')) return 'loss'
  return 'draw'
}

const resultBadge = (result: 'win' | 'loss' | 'draw') => {
  const styles: Record<string, string> = {
    win: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
    loss: 'bg-rose-500/20 text-rose-300 border-rose-400/30',
    draw: 'bg-slate-500/20 text-slate-300 border-slate-400/30',
  }
  return styles[result]
}

const classificationIcon = (c: string) => {
  if (c === 'blunder') return '!!'
  if (c === 'mistake') return '?'
  if (c === 'inaccuracy') return '?!'
  return ''
}

// ============================================================================
// Component
// ============================================================================

function GameReviewContent() {
  const { platform: platformParam, userId: userParam, gameId: gameParam } = useParams()
  const platform = canonicalizePlatform(platformParam)
  const userId = userParam ? decodeURIComponent(userParam) : ''
  const gameId = gameParam ? decodeURIComponent(gameParam) : ''
  const navigate = useNavigate()

  // State
  const [phase, setPhase] = useState<ReviewPhase>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [currentMomentIndex, setCurrentMomentIndex] = useState(0)
  const [currentBoardIndex, setCurrentBoardIndex] = useState(0)
  const [boardWidth, setBoardWidth] = useState(500)

  // Data
  const [gameRecord, setGameRecord] = useState<Record<string, unknown> | null>(null)
  const [analysisRecord, setAnalysisRecord] = useState<Record<string, unknown> | null>(null)
  const [pgn, setPgn] = useState<string | null>(null)

  // Refs
  const layoutRef = useRef<HTMLDivElement>(null)

  // Hooks
  const mobileOpts = useMobileOptimizations()
  const { setPositionContext } = useCoachChat()

  // ---- Data Loading ----
  useEffect(() => {
    if (!platform || !userId || !gameId) {
      setLoadError('Invalid URL parameters.')
      setPhase('error')
      return
    }

    let cancelled = false

    async function load() {
      try {
        const data = await fetchGameAnalysisData(userId, platform!, gameId)
        if (cancelled) return

        if (!data.analysis?.moves_analysis?.length) {
          setLoadError('This game has not been analyzed yet.')
          setPhase('error')
          return
        }

        setGameRecord(data.game)
        setAnalysisRecord(data.analysis)
        setPgn(data.pgn)
      } catch (err) {
        if (cancelled) return
        setLoadError(err instanceof Error ? err.message : 'Failed to load game data.')
        setPhase('error')
      }
    }

    load()
    return () => { cancelled = true }
  }, [platform, userId, gameId])

  // ---- Derive player color ----
  const playerColor: 'white' | 'black' = useMemo(() => {
    const c = String(gameRecord?.color || '').toLowerCase()
    return c === 'black' ? 'black' : 'white'
  }, [gameRecord])

  // ---- Process moves ----
  const processedData = useMemo(() => {
    if (!analysisRecord?.moves_analysis || !Array.isArray((analysisRecord as Record<string, unknown>).moves_analysis)) {
      return { moves: [] as ProcessedMove[], positions: ['start'] as string[] }
    }
    return buildProcessedMoves(
      (analysisRecord as Record<string, unknown>).moves_analysis as Parameters<typeof buildProcessedMoves>[0],
      playerColor
    )
  }, [analysisRecord, playerColor])

  // ---- Key moments ----
  const keyMoments = useMemo(() => identifyKeyMoments(processedData.moves), [processedData.moves])

  // ---- Game meta ----
  const gameMeta: GameMeta = useMemo(() => {
    const opponent =
      (gameRecord?.opponent_name as string)?.trim() ||
      (pgn ? extractOpponentFromPGN(pgn, playerColor) : '') ||
      'Opponent'
    const result = gameRecord ? extractResultFromRecord(gameRecord) : 'draw'
    const opening = (gameRecord?.opening as string) || (analysisRecord?.opening as string) || 'Unknown Opening'
    const playedAt = (gameRecord?.played_at as string) || ''
    const accuracy = typeof analysisRecord?.accuracy === 'number' ? (analysisRecord.accuracy as number) : null

    return { opponent, result, opening, playerColor, playedAt, accuracy }
  }, [gameRecord, analysisRecord, pgn, playerColor])

  // ---- Transition to intro once data loaded ----
  useEffect(() => {
    if (processedData.moves.length > 0 && phase === 'loading') {
      if (keyMoments.length === 0) {
        setPhase('no-mistakes')
      } else {
        setPhase('intro')
      }
    }
  }, [processedData.moves.length, keyMoments.length, phase])

  // ---- Board sizing ----
  useEffect(() => {
    const update = () => {
      const el = layoutRef.current
      const w = el?.clientWidth ?? window.innerWidth
      const padding = 32

      if (mobileOpts.boardSize === 'small' || mobileOpts.boardSize === 'medium') {
        const cap = mobileOpts.boardSize === 'small' ? 320 : 400
        setBoardWidth(Math.min(w - padding, cap))
      } else {
        // Desktop: board takes roughly 50% of container
        setBoardWidth(Math.min((w - padding) * 0.5, 560))
      }
    }

    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [mobileOpts.boardSize])

  // ---- Current moment and move ----
  const currentMoment: KeyMoment | null = phase === 'reviewing' ? keyMoments[currentMomentIndex] ?? null : null
  const currentMove: ProcessedMove | null = currentBoardIndex > 0 ? processedData.moves[currentBoardIndex - 1] ?? null : null
  const currentPosition = processedData.positions[currentBoardIndex] || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

  // ---- Arrows ----
  const currentMoveArrows = useMemo(() => {
    if (!currentMove || processedData.moves.length === 0) return []

    try {
      const chess = new Chess()
      chess.load(currentMove.fenBefore)
      return generateModernMoveArrows({
        san: currentMove.san,
        bestMoveSan: currentMove.bestMoveSan,
        classification: currentMove.classification,
        isUserMove: currentMove.isUserMove,
      }, chess)
    } catch {
      return []
    }
  }, [currentMove, processedData.moves.length])

  // ---- Navigation ----
  const navigateToMove = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, processedData.moves.length))
    setCurrentBoardIndex(clamped)
  }, [processedData.moves.length])

  const goToMoment = useCallback((momentIdx: number) => {
    if (momentIdx < 0 || momentIdx >= keyMoments.length) return
    setCurrentMomentIndex(momentIdx)
    // Navigate board to show the position AFTER the mistake move
    const moveIdx = keyMoments[momentIdx].moveIndex
    setCurrentBoardIndex(moveIdx + 1) // +1 because positions[0] = start
  }, [keyMoments])

  const startReview = useCallback(() => {
    setPhase('reviewing')
    setCurrentMomentIndex(0)
    if (keyMoments.length > 0) {
      setCurrentBoardIndex(keyMoments[0].moveIndex + 1)
    }
  }, [keyMoments])

  const nextMoment = useCallback(() => {
    if (currentMomentIndex < keyMoments.length - 1) {
      goToMoment(currentMomentIndex + 1)
    } else {
      setPhase('summary')
    }
  }, [currentMomentIndex, keyMoments.length, goToMoment])

  const prevMoment = useCallback(() => {
    if (currentMomentIndex > 0) {
      goToMoment(currentMomentIndex - 1)
    }
  }, [currentMomentIndex, goToMoment])

  // ---- Coach Chat Position Context ----
  useEffect(() => {
    if (phase !== 'reviewing' || !currentMoment) {
      setPositionContext(null)
      return
    }

    const m = currentMoment.move
    const fen = m.fenBefore || currentPosition

    const ctx: ChatPositionContext = {
      fen,
      moveHistory: processedData.moves.slice(0, currentMoment.moveIndex).map(mv => mv.san),
      playerColor,
      moveNumber: m.moveNumber,
      lastMove: m.san,
      gamePhase: m.gamePhase?.toLowerCase() as ChatPositionContext['gamePhase'],
      contextType: 'game-review',
      moveClassification: m.classification,
      evaluation: m.displayEvaluation,
      bestMoveSan: m.bestMoveSan ?? undefined,
      centipawnLoss: m.centipawnLoss ?? undefined,
      coachingComment: m.coachingComment,
      tacticalInsights: m.tacticalInsights,
      positionalInsights: m.positionalInsights,
      learningPoints: m.learningPoints,
      keyMomentIndex: currentMomentIndex + 1,
      totalKeyMoments: keyMoments.length,
      gameResult: gameMeta.result,
      opponentName: gameMeta.opponent,
    }

    setPositionContext(ctx)
    return () => setPositionContext(null)
  }, [phase, currentMoment, currentMomentIndex, keyMoments.length, processedData.moves, playerColor, currentPosition, gameMeta, setPositionContext])

  // ---- Mistake stats for summary ----
  const mistakeStats = useMemo(() => {
    let blunders = 0
    let mistakes = 0
    let inaccuracies = 0
    for (const km of keyMoments) {
      if (km.classification === 'blunder') blunders++
      else if (km.classification === 'mistake') mistakes++
      else if (km.classification === 'inaccuracy') inaccuracies++
    }
    return { blunders, mistakes, inaccuracies, total: keyMoments.length }
  }, [keyMoments])

  // ---- Render: Loading ----
  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading game analysis...</p>
        </div>
      </div>
    )
  }

  // ---- Render: Error ----
  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center">
          <div className="text-4xl mb-4">&#9888;</div>
          <h2 className="text-xl font-bold text-white mb-2">Unable to Load Game</h2>
          <p className="text-slate-400 mb-6">{loadError}</p>
          <button
            onClick={() => navigate(-1)}
            className="text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  // ---- Render: No mistakes ----
  if (phase === 'no-mistakes') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center">
          <div className="text-4xl mb-4">&#9989;</div>
          <h2 className="text-xl font-bold text-white mb-2">Great Game!</h2>
          <p className="text-slate-400 mb-6">
            No significant mistakes found in this game. You played well!
          </p>
          <button
            onClick={() => navigate(-1)}
            className="text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  // ---- Desktop vs Mobile layout ----
  const isMobile = mobileOpts.boardSize === 'small' || mobileOpts.boardSize === 'medium'

  return (
    <div className="min-h-screen bg-slate-950 text-white" ref={layoutRef}>
      {/* Header */}
      <div className="border-b border-white/5 bg-white/[0.02] px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-slate-400 hover:text-white transition-colors"
            aria-label="Go back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold truncate">
              Game Review
              <span className="text-slate-400 font-normal ml-2 text-sm">
                vs {gameMeta.opponent}
              </span>
            </h1>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded border ${resultBadge(gameMeta.result)} uppercase font-semibold`}>
            {gameMeta.result}
          </span>
        </div>
      </div>

      {/* Main content */}
      <div className={`max-w-7xl mx-auto p-4 ${isMobile ? 'flex flex-col gap-4' : 'flex gap-6 items-start'}`}>
        {/* Board */}
        <div className={isMobile ? 'w-full flex justify-center' : 'flex-shrink-0'}>
          <UnifiedChessAnalysis
            currentPosition={currentPosition}
            currentMove={currentMove}
            allMoves={processedData.moves}
            playerColor={playerColor}
            currentIndex={currentBoardIndex}
            boardWidth={boardWidth}
            currentMoveArrows={currentMoveArrows}
            onMoveNavigation={navigateToMove}
            isLoadingAIComments={false}
          />
        </div>

        {/* Review Panel */}
        <div className={`${isMobile ? 'w-full' : 'flex-1 min-w-0 max-w-md'}`}>
          {phase === 'intro' && (
            <IntroPanel
              meta={gameMeta}
              stats={mistakeStats}
              onStart={startReview}
            />
          )}

          {phase === 'reviewing' && currentMoment && (
            <ReviewingPanel
              moment={currentMoment}
              momentIndex={currentMomentIndex}
              totalMoments={keyMoments.length}
              onPrev={prevMoment}
              onNext={nextMoment}
            />
          )}

          {phase === 'summary' && (
            <SummaryPanel
              stats={mistakeStats}
              meta={gameMeta}
              onReviewAgain={startReview}
              onBack={() => navigate(-1)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

interface IntroPanelProps {
  meta: GameMeta
  stats: { blunders: number; mistakes: number; inaccuracies: number; total: number }
  onStart: () => void
}

function IntroPanel({ meta, stats, onStart }: IntroPanelProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
      <h2 className="text-lg font-semibold mb-4">Game Overview</h2>

      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-400">Opponent</span>
          <span className="text-white font-medium">{meta.opponent}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Result</span>
          <span className={`font-medium capitalize ${
            meta.result === 'win' ? 'text-emerald-400' : meta.result === 'loss' ? 'text-rose-400' : 'text-slate-300'
          }`}>
            {meta.result}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Opening</span>
          <span className="text-white font-medium truncate ml-4">{meta.opening}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Playing as</span>
          <span className="text-white font-medium capitalize">{meta.playerColor}</span>
        </div>
        {meta.accuracy !== null && (
          <div className="flex justify-between">
            <span className="text-slate-400">Accuracy</span>
            <span className="text-white font-medium">{meta.accuracy.toFixed(1)}%</span>
          </div>
        )}
      </div>

      {/* Mistake summary */}
      <div className="mt-5 p-4 rounded-xl bg-white/[0.04] border border-white/5">
        <p className="text-sm text-slate-300 mb-3">
          We found <span className="text-white font-semibold">{stats.total} key moment{stats.total !== 1 ? 's' : ''}</span> to review:
        </p>
        <div className="flex gap-3 text-xs">
          {stats.blunders > 0 && (
            <span className="px-2 py-1 rounded border border-rose-400/30 bg-rose-500/10 text-rose-300">
              {stats.blunders} blunder{stats.blunders !== 1 ? 's' : ''}
            </span>
          )}
          {stats.mistakes > 0 && (
            <span className="px-2 py-1 rounded border border-orange-400/30 bg-orange-500/10 text-orange-300">
              {stats.mistakes} mistake{stats.mistakes !== 1 ? 's' : ''}
            </span>
          )}
          {stats.inaccuracies > 0 && (
            <span className="px-2 py-1 rounded border border-amber-400/30 bg-amber-500/10 text-amber-300">
              {stats.inaccuracies} inaccurac{stats.inaccuracies !== 1 ? 'ies' : 'y'}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={onStart}
        className="mt-6 w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
      >
        Start Review
      </button>
    </div>
  )
}

interface ReviewingPanelProps {
  moment: KeyMoment
  momentIndex: number
  totalMoments: number
  onPrev: () => void
  onNext: () => void
}

function ReviewingPanel({ moment, momentIndex, totalMoments, onPrev, onNext }: ReviewingPanelProps) {
  const m = moment.move
  const isLast = momentIndex === totalMoments - 1

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 space-y-4">
      {/* Progress */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>Moment {momentIndex + 1} of {totalMoments}</span>
        <div className="flex gap-1">
          {Array.from({ length: totalMoments }, (_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === momentIndex ? 'bg-emerald-400' : i < momentIndex ? 'bg-emerald-400/30' : 'bg-slate-600'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Move header */}
      <div className="flex items-center gap-2">
        <span className="text-white font-medium">Move {m.moveNumber}</span>
        <span className={`text-xs px-2 py-0.5 rounded ${classificationBadgeStyles[moment.classification]}`}>
          {classificationLabel[moment.classification]} {classificationIcon(moment.classification)}
        </span>
        {m.centipawnLoss !== null && m.centipawnLoss > 0 && (
          <span className="text-xs text-slate-500">
            ({Math.round(m.centipawnLoss)} cp)
          </span>
        )}
      </div>

      {/* Played vs Best */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <span className={`w-2 h-2 rounded-full ${
            moment.classification === 'blunder' ? 'bg-rose-400' :
            moment.classification === 'mistake' ? 'bg-orange-400' : 'bg-amber-400'
          }`} />
          <span className="text-slate-400">You played:</span>
          <span className="text-white font-mono font-semibold">{m.san}</span>
        </div>
        {m.bestMoveSan && (
          <div className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-slate-400">Better was:</span>
            <span className="text-emerald-300 font-mono font-semibold">{m.bestMoveSan}</span>
          </div>
        )}
      </div>

      {/* Explanation */}
      <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-sm text-slate-300 leading-relaxed">
        {m.coachingComment || m.explanation}
      </div>

      {/* Insights */}
      {((m.tacticalInsights && m.tacticalInsights.length > 0) || (m.positionalInsights && m.positionalInsights.length > 0)) && (
        <div className="space-y-2">
          {m.tacticalInsights && m.tacticalInsights.length > 0 && (
            <div className="text-xs">
              <span className="text-amber-300 font-medium">Tactical: </span>
              <span className="text-slate-400">{m.tacticalInsights.join(', ')}</span>
            </div>
          )}
          {m.positionalInsights && m.positionalInsights.length > 0 && (
            <div className="text-xs">
              <span className="text-sky-300 font-medium">Positional: </span>
              <span className="text-slate-400">{m.positionalInsights.join(', ')}</span>
            </div>
          )}
        </div>
      )}

      {/* Chat hint */}
      <p className="text-xs text-slate-500 italic">
        Ask Coach Tal for deeper analysis using the chat button.
      </p>

      {/* Navigation */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onPrev}
          disabled={momentIndex === 0}
          className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-medium transition-colors
            disabled:opacity-30 disabled:cursor-not-allowed
            hover:bg-white/5 text-slate-300"
        >
          Previous
        </button>
        <button
          onClick={onNext}
          className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors"
        >
          {isLast ? 'View Summary' : 'Next Moment'}
        </button>
      </div>
    </div>
  )
}

interface SummaryPanelProps {
  stats: { blunders: number; mistakes: number; inaccuracies: number; total: number }
  meta: GameMeta
  onReviewAgain: () => void
  onBack: () => void
}

function SummaryPanel({ stats, meta, onReviewAgain, onBack }: SummaryPanelProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 space-y-5">
      <h2 className="text-lg font-semibold">Review Complete</h2>

      <p className="text-sm text-slate-300">
        You reviewed {stats.total} key moment{stats.total !== 1 ? 's' : ''} from your game against{' '}
        <span className="text-white font-medium">{meta.opponent}</span>.
      </p>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-center">
          <div className="text-2xl font-bold text-rose-300">{stats.blunders}</div>
          <div className="text-xs text-rose-400 mt-1">Blunders</div>
        </div>
        <div className="rounded-xl border border-orange-400/20 bg-orange-500/10 p-3 text-center">
          <div className="text-2xl font-bold text-orange-300">{stats.mistakes}</div>
          <div className="text-xs text-orange-400 mt-1">Mistakes</div>
        </div>
        <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-center">
          <div className="text-2xl font-bold text-amber-300">{stats.inaccuracies}</div>
          <div className="text-xs text-amber-400 mt-1">Inaccuracies</div>
        </div>
      </div>

      {meta.accuracy !== null && (
        <div className="text-center text-sm text-slate-400">
          Overall accuracy: <span className="text-white font-semibold">{meta.accuracy.toFixed(1)}%</span>
        </div>
      )}

      <div className="space-y-3 pt-2">
        <button
          onClick={onReviewAgain}
          className="w-full py-2.5 rounded-xl border border-emerald-400/30 text-emerald-400 hover:bg-emerald-500/10 text-sm font-medium transition-colors"
        >
          Review Again
        </button>
        <button
          onClick={onBack}
          className="w-full py-2.5 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 text-sm font-medium transition-colors"
        >
          Back to Games
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// Export with PremiumGate wrapper
// ============================================================================

export default function GameReviewPage() {
  return (
    <PremiumGate>
      <GameReviewContent />
    </PremiumGate>
  )
}
