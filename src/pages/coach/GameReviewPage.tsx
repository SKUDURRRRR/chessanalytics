/**
 * Game Review with Coach Page
 * Guided walkthrough of key mistakes in an analyzed game with Coach Tal.
 * Features a "Think First" mode where the user sees the decision position
 * before the mistake is revealed with arrows and coaching explanation.
 */

import { useState, useEffect, useMemo, useRef, useCallback, type CSSProperties } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Chessboard } from 'react-chessboard'
import { Chess, Square } from 'chess.js'
import { PremiumGate } from '../../components/coach/PremiumGate'
import { ModernChessArrows } from '../../components/chess/ModernChessArrows'
import { getDarkChessBoardTheme } from '../../utils/chessBoardTheme'
import { fetchGameAnalysisData } from '../../services/gameAnalysisService'
import { InlineCoachChat } from '../../components/coach/InlineCoachChat'
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
    draw: 'bg-white/[0.04] text-gray-500 border-white/[0.06]',
  }
  return styles[result]
}

const classificationIcon = (c: string) => {
  if (c === 'blunder') return '!!'
  if (c === 'mistake') return '?'
  if (c === 'inaccuracy') return '?!'
  return ''
}

const NAV_BTN_CLASS = 'min-h-[36px] min-w-[36px] rounded-full shadow-card bg-white/10 px-2.5 py-1.5 transition-colors hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed text-gray-400 text-sm font-mono'

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
  const [isRevealed, setIsRevealed] = useState(false)
  const [rightPanelTab, setRightPanelTab] = useState<'review' | 'coach'>('review')

  // User attempt state - lets users try their own move before reveal
  const [userAttemptSan, setUserAttemptSan] = useState<string | null>(null)
  const [userAttemptFen, setUserAttemptFen] = useState<string | null>(null)

  // Data
  const [gameRecord, setGameRecord] = useState<Record<string, unknown> | null>(null)
  const [analysisRecord, setAnalysisRecord] = useState<Record<string, unknown> | null>(null)
  const [pgn, setPgn] = useState<string | null>(null)

  // Refs
  const layoutRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // Hooks
  const mobileOpts = useMobileOptimizations()
  const [localPositionContext, setLocalPositionContext] = useState<ChatPositionContext | null>(null)

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

  // ---- Board sizing (viewport-fit) ----
  useEffect(() => {
    const update = () => {
      const content = contentRef.current
      const containerWidth = content?.clientWidth ?? window.innerWidth
      const containerHeight = content?.clientHeight ?? window.innerHeight

      if (mobileOpts.boardSize === 'small' || mobileOpts.boardSize === 'medium') {
        const cap = mobileOpts.boardSize === 'small' ? 320 : 400
        setBoardWidth(Math.min(containerWidth - 32, cap))
      } else {
        // containerHeight = the flex-1 content area (already excludes page header + site nav)
        // Subtract: container p-4 (32), nav bar (40), mt-6 gap (24), board border (2), safety (8)
        const heightBudget = containerHeight - 32 - 40 - 24 - 2 - 8
        // containerWidth = full content width
        // Subtract: right panel (360), gap (24), container p-4 (32), board border (2)
        const widthBudget = containerWidth - 360 - 24 - 32 - 2
        setBoardWidth(Math.max(280, Math.min(heightBudget, widthBudget, 520)))
      }
    }

    update()
    const el = contentRef.current
    if (!el) return
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [mobileOpts.boardSize])

  // ---- Current moment ----
  const currentMoment: KeyMoment | null = phase === 'reviewing' ? keyMoments[currentMomentIndex] ?? null : null
  const currentPosition = processedData.positions[currentBoardIndex] || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

  // ---- Arrows (only shown after reveal) ----
  const reviewArrows = useMemo(() => {
    if (phase !== 'reviewing' || !isRevealed || !currentMoment) return []

    const m = currentMoment.move
    try {
      const chess = new Chess()
      chess.load(m.fenBefore)
      return generateModernMoveArrows({
        san: m.san,
        bestMoveSan: m.bestMoveSan,
        classification: m.classification,
        isUserMove: m.isUserMove,
      }, chess)
    } catch {
      return []
    }
  }, [phase, isRevealed, currentMoment])

  // ---- Navigation ----
  const navigateToMove = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, processedData.moves.length))
    setCurrentBoardIndex(clamped)
    // Clear attempt fully so board follows normal navigation
    setUserAttemptSan(null)
    setUserAttemptFen(null)
  }, [processedData.moves.length])

  const goToMoment = useCallback((momentIdx: number) => {
    if (momentIdx < 0 || momentIdx >= keyMoments.length) return
    setCurrentMomentIndex(momentIdx)
    // Navigate board to show position BEFORE the mistake (decision point)
    const moveIdx = keyMoments[momentIdx].moveIndex
    setCurrentBoardIndex(moveIdx)
    setIsRevealed(false)
    setUserAttemptSan(null)
    setUserAttemptFen(null)
  }, [keyMoments])

  const startReview = useCallback(() => {
    setPhase('reviewing')
    setCurrentMomentIndex(0)
    setIsRevealed(false)
    setUserAttemptSan(null)
    setUserAttemptFen(null)
    if (keyMoments.length > 0) {
      setCurrentBoardIndex(keyMoments[0].moveIndex)
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

  // ---- User attempt: let user try a move before reveal ----
  const handlePieceDrop = useCallback((sourceSquare: string, targetSquare: string): boolean => {
    if (phase !== 'reviewing' || isRevealed || !currentMoment) return false

    try {
      const chess = new Chess(currentMoment.move.fenBefore)
      const piece = chess.get(sourceSquare as Square)

      // Handle pawn promotion
      const targetRank = targetSquare[1]
      const isPromotion =
        piece?.type === 'p' &&
        ((piece.color === 'w' && targetRank === '8') ||
          (piece.color === 'b' && targetRank === '1'))

      const move = chess.move({
        from: sourceSquare,
        to: targetSquare,
        ...(isPromotion && { promotion: 'q' }),
      })

      if (!move) return false

      setUserAttemptSan(move.san)
      setUserAttemptFen(chess.fen())
      return true
    } catch {
      return false
    }
  }, [phase, isRevealed, currentMoment])

  const clearUserAttempt = useCallback(() => {
    setUserAttemptSan(null)
    setUserAttemptFen(null)
  }, [])

  // Show user's attempt position if they made one (pre-reveal only), otherwise the navigated position
  const displayPosition = (!isRevealed && userAttemptFen) ? userAttemptFen : currentPosition

  // Highlight user attempt squares (only when attempt is active and pre-reveal)
  const userAttemptSquareStyles = useMemo((): Record<string, CSSProperties> => {
    if (!userAttemptSan || !userAttemptFen || !currentMoment || isRevealed) return {}
    try {
      const chess = new Chess(currentMoment.move.fenBefore)
      const move = chess.move(userAttemptSan)
      if (!move) return {}
      return {
        [move.from]: { backgroundColor: 'rgba(59, 130, 246, 0.3)' },
        [move.to]: { backgroundColor: 'rgba(59, 130, 246, 0.3)' },
      }
    } catch {
      return {}
    }
  }, [userAttemptSan, userAttemptFen, currentMoment, isRevealed])

  // ---- Keyboard navigation ----
  useEffect(() => {
    if (phase !== 'reviewing') return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        if (!isRevealed) {
          setIsRevealed(true)

        } else {
          nextMoment()
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (isRevealed && currentMomentIndex > 0) {
          prevMoment()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [phase, isRevealed, currentMomentIndex, nextMoment, prevMoment])

  // ---- Coach Chat Position Context ----
  useEffect(() => {
    if (phase !== 'reviewing' || !currentMoment) {
      setLocalPositionContext(null)
      return
    }

    const m = currentMoment.move
    const fen = m.fenBefore || currentPosition

    const ctx: ChatPositionContext = {
      fen,
      moveHistory: processedData.moves.slice(0, currentMoment.moveIndex).map(mv => mv.san),
      playerColor,
      moveNumber: m.moveNumber,
      lastMove: isRevealed ? m.san : undefined,
      gamePhase: m.gamePhase?.toLowerCase() as ChatPositionContext['gamePhase'],
      contextType: 'game-review',
      moveClassification: isRevealed ? m.classification : undefined,
      evaluation: isRevealed ? m.displayEvaluation : undefined,
      bestMoveSan: isRevealed ? (m.bestMoveSan ?? undefined) : undefined,
      centipawnLoss: isRevealed ? (m.centipawnLoss ?? undefined) : undefined,
      coachingComment: isRevealed ? m.coachingComment : undefined,
      tacticalInsights: isRevealed ? m.tacticalInsights : undefined,
      positionalInsights: isRevealed ? m.positionalInsights : undefined,
      learningPoints: isRevealed ? m.learningPoints : undefined,
      keyMomentIndex: currentMomentIndex + 1,
      totalKeyMoments: keyMoments.length,
      gameResult: gameMeta.result,
      opponentName: gameMeta.opponent,
      // Include user's attempted move so coach can discuss their decision
      userAttemptMove: userAttemptSan ?? undefined,
      isPreReveal: !isRevealed,
    }

    setLocalPositionContext(ctx)
  }, [phase, currentMoment, currentMomentIndex, keyMoments.length, processedData.moves, playerColor, currentPosition, gameMeta, isRevealed, userAttemptSan])

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
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading game analysis...</p>
        </div>
      </div>
    )
  }

  // ---- Render: Error ----
  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-lg shadow-card bg-surface-1 p-8 text-center">
          <div className="text-title mb-4">&#9888;</div>
          <h2 className="text-title font-semibold text-white mb-2">Unable to Load Game</h2>
          <p className="text-gray-500 mb-6">{loadError}</p>
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
      <div className="min-h-screen bg-surface-base flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-lg shadow-card bg-surface-1 p-8 text-center">
          <div className="text-title mb-4">&#9989;</div>
          <h2 className="text-title font-semibold text-white mb-2">Great Game!</h2>
          <p className="text-gray-500 mb-6">
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
    <div className="bg-surface-base text-white flex flex-col overflow-hidden" style={{ height: 'calc(100dvh - 56px)' }} ref={layoutRef}>
      {/* Header */}
      <div className="flex-shrink-0 border-b border-white/5 bg-white/[0.02] px-4 py-2">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-500 hover:text-white transition-colors"
            aria-label="Go back"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-section font-semibold truncate">
              Game Review
              <span className="text-gray-500 font-normal ml-2 text-sm">
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
      <div ref={contentRef} className={`flex-1 min-h-0 ${isMobile ? 'overflow-y-auto' : 'overflow-hidden'}`}>
        <div className={`max-w-5xl mx-auto p-4 h-full ${
          isMobile ? 'flex flex-col gap-4' : 'flex gap-6 items-start'
        }`}>
          {/* Board column */}
          <div className={`flex-shrink-0 ${isMobile ? 'w-full flex flex-col items-center' : 'flex flex-col'}`}>
            <div>
              <div className="relative" style={{ width: boardWidth + 2, height: boardWidth + 2, padding: 1 }}>
                <Chessboard
                  id="game-review-board"
                  position={displayPosition}
                  boardWidth={boardWidth}
                  boardOrientation={playerColor}
                  arePiecesDraggable={phase === 'reviewing' && !isRevealed && !userAttemptFen}
                  onPieceDrop={handlePieceDrop}
                  showBoardNotation={true}
                  customSquareStyles={userAttemptSquareStyles}
                  {...getDarkChessBoardTheme('default')}
                />
                <ModernChessArrows
                  arrows={reviewArrows}
                  boardWidth={boardWidth}
                  boardOrientation={playerColor}
                  boardId="game-review-board"
                />
              </div>
            </div>

            {/* Move navigation below board (only during reviewing) */}
            {phase === 'reviewing' && (
              <div className="flex items-center justify-center gap-1.5 mt-6 py-1.5 px-3 rounded-lg bg-white/[0.03] shadow-card self-center" style={{ width: boardWidth * 0.6 }}>
                <button
                  onClick={() => navigateToMove(0)}
                  disabled={currentBoardIndex === 0}
                  className={NAV_BTN_CLASS}
                  aria-label="First position"
                >
                  {'|<'}
                </button>
                <button
                  onClick={() => navigateToMove(currentBoardIndex - 1)}
                  disabled={currentBoardIndex === 0}
                  className={NAV_BTN_CLASS}
                  aria-label="Previous move"
                >
                  {'<'}
                </button>
                <span className="text-xs text-gray-500 px-2">
                  {currentBoardIndex} / {processedData.moves.length}
                </span>
                <button
                  onClick={() => navigateToMove(currentBoardIndex + 1)}
                  disabled={currentBoardIndex >= processedData.moves.length}
                  className={NAV_BTN_CLASS}
                  aria-label="Next move"
                >
                  {'>'}
                </button>
                <button
                  onClick={() => navigateToMove(processedData.moves.length)}
                  disabled={currentBoardIndex >= processedData.moves.length}
                  className={NAV_BTN_CLASS}
                  aria-label="Last position"
                >
                  {'>|'}
                </button>
              </div>
            )}
          </div>

          {/* Right panel: tabbed (Review / Coach Tal) */}
          <div className={`${
            isMobile ? 'w-full' : 'flex-1 min-w-0 max-w-[360px]'
          } flex flex-col`} style={isMobile ? undefined : { height: boardWidth + 2 }}>
            {phase === 'intro' && (
              <IntroPanel
                meta={gameMeta}
                stats={mistakeStats}
                onStart={startReview}
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

            {phase === 'reviewing' && currentMoment && (
              <div className="rounded-lg shadow-card bg-surface-1 overflow-hidden flex flex-col flex-1 min-h-0">
                {/* Tab header */}
                <div className="flex flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <button
                    onClick={() => setRightPanelTab('review')}
                    className={`flex-1 px-4 py-2.5 text-[12px] font-medium transition-colors ${
                      rightPanelTab === 'review' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                    }`}
                    style={rightPanelTab === 'review' ? { background: 'rgba(255,255,255,0.04)' } : undefined}
                  >
                    Review
                  </button>
                  <button
                    onClick={() => setRightPanelTab('coach')}
                    className={`flex-1 px-4 py-2.5 text-[12px] font-medium transition-colors ${
                      rightPanelTab === 'coach' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                    }`}
                    style={rightPanelTab === 'coach' ? { background: 'rgba(255,255,255,0.04)' } : undefined}
                  >
                    Coach Tal
                  </button>
                </div>

                {/* Tab content */}
                {rightPanelTab === 'coach' ? (
                  <div className="flex-1 min-h-0">
                    <InlineCoachChat positionContext={localPositionContext} />
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto">
                    <ReviewingPanel
                      moment={currentMoment}
                      momentIndex={currentMomentIndex}
                      totalMoments={keyMoments.length}
                      isRevealed={isRevealed}
                      userAttemptSan={userAttemptSan}
                      onReveal={() => { setIsRevealed(true); setUserAttemptFen(null) }}
                      onClearAttempt={clearUserAttempt}
                      onPrev={prevMoment}
                      onNext={nextMoment}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
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
    <div className="rounded-lg shadow-card bg-surface-1 p-6">
      <h2 className="text-section font-semibold mb-4">Game Overview</h2>

      <div className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Opponent</span>
          <span className="text-white font-medium">{meta.opponent}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Result</span>
          <span className={`font-medium capitalize ${
            meta.result === 'win' ? 'text-emerald-400' : meta.result === 'loss' ? 'text-rose-400' : 'text-gray-400'
          }`}>
            {meta.result}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Opening</span>
          <span className="text-white font-medium truncate ml-4">{meta.opening}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Playing as</span>
          <span className="text-white font-medium capitalize">{meta.playerColor}</span>
        </div>
        {meta.accuracy !== null && (
          <div className="flex justify-between">
            <span className="text-gray-500">Accuracy</span>
            <span className="text-white font-medium">{meta.accuracy.toFixed(1)}%</span>
          </div>
        )}
        {meta.playedAt && (
          <div className="flex justify-between">
            <span className="text-gray-500">Played</span>
            <span className="text-white font-medium">
              {new Date(meta.playedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        )}
      </div>

      {/* Mistake summary */}
      <div className="mt-5 p-4 rounded-lg bg-white/[0.04] shadow-card">
        <p className="text-sm text-gray-400 mb-3">
          We found <span className="text-white font-semibold">{stats.total} key moment{stats.total !== 1 ? 's' : ''}</span> to review:
        </p>
        <div className="flex gap-3 text-xs">
          {stats.blunders > 0 && (
            <span className="px-2 py-1 rounded shadow-card bg-rose-500/10 text-rose-300">
              {stats.blunders} blunder{stats.blunders !== 1 ? 's' : ''}
            </span>
          )}
          {stats.mistakes > 0 && (
            <span className="px-2 py-1 rounded shadow-card bg-amber-500/10 text-amber-300">
              {stats.mistakes} mistake{stats.mistakes !== 1 ? 's' : ''}
            </span>
          )}
          {stats.inaccuracies > 0 && (
            <span className="px-2 py-1 rounded shadow-card bg-amber-500/10 text-amber-300">
              {stats.inaccuracies} inaccurac{stats.inaccuracies !== 1 ? 'ies' : 'y'}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={onStart}
        className="mt-6 w-full bg-[#e4e8ed] hover:bg-[#f0f2f5] text-[#111] font-medium py-2 px-6 rounded-md text-body transition-colors shadow-btn-primary"
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
  isRevealed: boolean
  userAttemptSan: string | null
  onReveal: () => void
  onClearAttempt: () => void
  onPrev: () => void
  onNext: () => void
}

function ReviewingPanel({ moment, momentIndex, totalMoments, isRevealed, userAttemptSan, onReveal, onClearAttempt, onPrev, onNext }: ReviewingPanelProps) {
  const m = moment.move
  const isLast = momentIndex === totalMoments - 1

  // Check if user's attempt matches the best move
  const attemptMatchesBest = userAttemptSan && m.bestMoveSan &&
    userAttemptSan.replace(/[+#]/g, '') === m.bestMoveSan.replace(/[+#]/g, '')
  const attemptMatchesPlayed = userAttemptSan &&
    userAttemptSan.replace(/[+#]/g, '') === m.san.replace(/[+#]/g, '')

  return (
    <div className="px-4 py-3 space-y-3">
      {/* Header: moment counter + dots + move number + badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-white text-[13px] font-medium">Move {m.moveNumber}</span>
          {isRevealed && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${classificationBadgeStyles[moment.classification]}`}>
              {classificationLabel[moment.classification]} {classificationIcon(moment.classification)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-600">{momentIndex + 1}/{totalMoments}</span>
          <div className="flex gap-1">
            {Array.from({ length: totalMoments }, (_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${
                  i === momentIndex ? 'bg-emerald-400' : i < momentIndex ? 'bg-emerald-400/30' : 'bg-surface-3'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Pre-reveal */}
      {!isRevealed && (
        <div className="space-y-3">
          {!userAttemptSan ? (
            <div className="p-3 rounded-lg bg-amber-500/5 shadow-card text-center">
              <p className="text-amber-200 text-[13px] font-medium">
                {m.player === 'white' ? "White" : "Black"} to move — try yours on the board
              </p>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-emerald-500/5 shadow-card flex items-center justify-between">
              <div className="flex items-center gap-2 text-[13px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-gray-500">Your choice:</span>
                <span className="text-emerald-300 font-mono font-semibold">{userAttemptSan}</span>
              </div>
              <button onClick={onClearAttempt} className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors">
                Undo
              </button>
            </div>
          )}

          <button
            onClick={onReveal}
            className="w-full py-2 rounded-md bg-[#e4e8ed] hover:bg-[#f0f2f5] text-[#111] font-medium text-[13px] transition-colors shadow-btn-primary"
          >
            Reveal
          </button>
        </div>
      )}

      {/* Post-reveal */}
      {isRevealed && (
        <div className="space-y-3">
          {/* Moves comparison — compact grid */}
          <div className="space-y-1.5 text-[12px]">
            {userAttemptSan && (
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${attemptMatchesBest ? 'bg-emerald-400' : 'bg-gray-400'}`} />
                <span className="text-gray-500">You:</span>
                <span className={`font-mono font-semibold ${attemptMatchesBest ? 'text-emerald-300' : 'text-gray-300'}`}>{userAttemptSan}</span>
                {attemptMatchesBest && <span className="text-emerald-400 text-[10px]">Correct!</span>}
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${
                moment.classification === 'blunder' ? 'bg-rose-400' : 'bg-amber-400'
              }`} />
              <span className="text-gray-500">Played:</span>
              <span className="text-white font-mono font-semibold">{m.san}</span>
              {m.centipawnLoss !== null && m.centipawnLoss > 0 && (
                <span className="text-gray-600 text-[10px]">-{Math.round(m.centipawnLoss)}cp</span>
              )}
            </div>
            {m.bestMoveSan && (
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-gray-500">Best:</span>
                <span className="text-emerald-300 font-mono font-semibold">{m.bestMoveSan}</span>
              </div>
            )}
          </div>

          {/* Explanation — truncated */}
          {(m.coachingComment || m.explanation) && (
            <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-3">
              {m.coachingComment || m.explanation}
            </p>
          )}

          {/* Navigation */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onPrev}
              disabled={momentIndex === 0}
              className="flex-1 py-2 rounded-lg shadow-card text-[12px] font-medium transition-colors
                disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/5 text-gray-400"
            >
              Previous
            </button>
            <button
              onClick={onNext}
              className="flex-1 py-2 rounded-md bg-[#e4e8ed] hover:bg-[#f0f2f5] text-[#111] text-[12px] font-medium transition-colors shadow-btn-primary"
            >
              {isLast ? 'Summary' : 'Next'}
            </button>
          </div>
        </div>
      )}
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
    <div className="rounded-lg shadow-card bg-surface-1 p-6 space-y-5">
      <h2 className="text-section font-semibold">Review Complete</h2>

      <p className="text-sm text-gray-400">
        You reviewed {stats.total} key moment{stats.total !== 1 ? 's' : ''} from your game against{' '}
        <span className="text-white font-medium">{meta.opponent}</span>.
      </p>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg shadow-card bg-rose-500/10 p-3 text-center">
          <div className="text-title font-semibold text-rose-300">{stats.blunders}</div>
          <div className="text-xs text-rose-400 mt-1">Blunders</div>
        </div>
        <div className="rounded-lg shadow-card bg-amber-500/10 p-3 text-center">
          <div className="text-title font-semibold text-amber-300">{stats.mistakes}</div>
          <div className="text-xs text-amber-400 mt-1">Mistakes</div>
        </div>
        <div className="rounded-lg shadow-card bg-amber-500/10 p-3 text-center">
          <div className="text-title font-semibold text-amber-300">{stats.inaccuracies}</div>
          <div className="text-xs text-amber-400 mt-1">Inaccuracies</div>
        </div>
      </div>

      {meta.accuracy !== null && (
        <div className="text-center text-sm text-gray-500">
          Overall accuracy: <span className="text-white font-semibold">{meta.accuracy.toFixed(1)}%</span>
        </div>
      )}

      <div className="space-y-3 pt-2">
        <button
          onClick={onReviewAgain}
          className="w-full py-2.5 rounded-lg shadow-card text-emerald-400 hover:bg-emerald-500/10 text-sm font-medium transition-colors"
        >
          Review Again
        </button>
        <button
          onClick={onBack}
          className="w-full py-2.5 rounded-lg shadow-card text-gray-400 hover:bg-white/5 text-sm font-medium transition-colors"
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
