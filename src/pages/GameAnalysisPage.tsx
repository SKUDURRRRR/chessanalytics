import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import { fetchGameAnalysisData } from '../services/gameAnalysisService'
import UnifiedAnalysisService from '../services/unifiedAnalysisService'
import { config } from '../lib/config'
import { getTimeControlCategory } from '../utils/timeControlUtils'
import { getOpeningNameWithFallback } from '../utils/openingIdentification'
import { EnhancedGameInsights } from '../components/debug/EnhancedGameInsights'
import { EnhancedMoveCoaching } from '../components/debug/EnhancedMoveCoaching'
import { UnifiedChessAnalysis } from '../components/debug/UnifiedChessAnalysis'
import { ActionMenu } from '../components/ui/ActionMenu'
import { useMobileOptimizations } from '../hooks/useResponsive'
import { CHESS_ANALYSIS_COLORS } from '../utils/chessColors'
import { getDarkChessBoardTheme } from '../utils/chessBoardTheme'
import { generateMoveArrows, generateModernMoveArrows, Arrow } from '../utils/chessArrows'
import { ModernChessArrows } from '../components/chess/ModernChessArrows'
import { buildHumanComment, CommentContext, HumanReasonContext } from '../utils/commentTemplates'
import { calculatePerformanceRating, MoveForRating } from '../utils/performanceRatingCalculator'
import type { MatchHistoryGameSummary, Platform } from '../types'

interface EvaluationInfo {
  type: 'cp' | 'mate'
  value: number
}

interface AnalysisMoveRecord {
  move: string
  move_san: string
  evaluation?: EvaluationInfo
  best_move?: string
  explanation?: string
  centipawn_loss?: number
  is_best?: boolean
  is_brilliant?: boolean
  is_great?: boolean  // NEW: Very strong moves (5-15cp loss)
  is_excellent?: boolean  // NEW: Nearly optimal moves (15-25cp loss)
  is_blunder?: boolean
  is_mistake?: boolean
  is_inaccuracy?: boolean
  is_good?: boolean
  is_acceptable?: boolean
}

interface ProcessedMove {
  index: number
  ply: number
  moveNumber: number
  player: 'white' | 'black'
  isUserMove: boolean
  san: string
  bestMoveSan: string | null
  evaluation: EvaluationInfo | null
  scoreForPlayer: number
  displayEvaluation: string
  centipawnLoss: number | null
  classification: MoveClassification
  explanation: string
  fenBefore: string
  fenAfter: string

  // Enhanced coaching fields
  coachingComment?: string
  whatWentRight?: string
  whatWentWrong?: string
  howToImprove?: string
  tacticalInsights?: string[]
  positionalInsights?: string[]
  risks?: string[]
  benefits?: string[]
  learningPoints?: string[]
  encouragementLevel?: number
  moveQuality?: string
  gamePhase?: string
}

type MoveClassification =
  | 'brilliant'
  | 'best'
  | 'great'  // NEW: Very strong moves (5-15cp loss)
  | 'excellent'  // NEW: Nearly optimal moves (15-25cp loss)
  | 'good'
  | 'acceptable'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'
  | 'uncategorized'

interface LocationState {
  from?: {
    pathname: string
    search?: string
  }
  game?: MatchHistoryGameSummary
}

const EVAL_CAP = 500 // centipawns

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const canonicalizePlatform = (platform: string | undefined): Platform | null => {
  if (platform === 'lichess' || platform === 'chess.com') {
    return platform
  }
  return null
}

const parseUciMove = (uci: string) => {
  const from = uci.slice(0, 2)
  const to = uci.slice(2, 4)
  const promotion = uci.length > 4 ? uci.slice(4) : undefined
  return { from, to, promotion }
}

const convertUciToSan = (fen: string, uci?: string | null): string | null => {
  if (!uci) {
    return null
  }
  try {
    const chess = new Chess(fen)
    const { from, to, promotion } = parseUciMove(uci)
    const result = chess.move({ from, to, promotion })
    return result ? result.san : null
  } catch (error) {
    console.warn('Unable to convert UCI to SAN', uci, error)
    return null
  }
}

const determineClassification = (move: AnalysisMoveRecord): MoveClassification => {
  if (move.is_brilliant) return 'brilliant'
  if (move.is_best) return 'best'
  if (move.is_great) return 'great'  // NEW category
  if (move.is_excellent) return 'excellent'  // NEW category
  if (move.is_blunder) return 'blunder'
  if (move.is_mistake) return 'mistake'
  if (move.is_inaccuracy) return 'inaccuracy'
  if (move.is_good) return 'good'
  if (move.is_acceptable) return 'acceptable'
  return 'uncategorized'
}

const formatEvaluation = (evaluation: EvaluationInfo | null, playerColor: 'white' | 'black') => {
  if (!evaluation) {
    return '--'
  }
  if (evaluation.type === 'mate') {
    const prefix = evaluation.value > 0 ? '#' : '#-'
    return `${prefix}${Math.abs(evaluation.value)}`
  }
  const score = evaluation.value / 100
  const adjusted = playerColor === 'white' ? score : -score
  return `${adjusted > 0 ? '+' : ''}${adjusted.toFixed(2)}`
}

const evaluationToScoreForPlayer = (
  evaluation: EvaluationInfo | null,
  playerColor: 'white' | 'black'
): number => {
  if (!evaluation) {
    return 0
  }
  if (evaluation.type === 'mate') {
    const mateScore = evaluation.value > 0 ? EVAL_CAP : -EVAL_CAP
    return playerColor === 'white' ? mateScore : -mateScore
  }
  const score = evaluation.value
  return playerColor === 'white' ? score : -score
}

const buildFallbackExplanation = (
  classification: MoveClassification,
  centipawnLoss: number | null,
  bestMoveSan: string | null
) => {
  const loss = centipawnLoss != null ? Math.round(centipawnLoss) : null
  switch (classification) {
    case 'brilliant':
      return '🌟 Brilliant tactical resource that demonstrates exceptional chess understanding. This move likely involves a calculated sacrifice, devastating combination, or sophisticated positional maneuver that maximizes your advantage.'
    case 'best':
      return '✅ Strong move that kept the engine evaluation on track. This is optimal play that maintains your position and shows excellent chess understanding.'
    case 'good':
    case 'acceptable':
      return '👍 Solid move that maintained a playable position. This shows reasonable chess understanding and keeps your position healthy.'
    case 'inaccuracy':
      return '⚠️ Inaccuracy. This move weakens your position and allows your opponent to improve. Look for stronger moves that maintain your advantage better.'
    case 'mistake':
      return bestMoveSan
        ? `❌ Mistake. Consider ${bestMoveSan} next time - it would have been much stronger and maintained your advantage. This move creates difficulties for your position.`
        : '❌ Mistake. Position deteriorated noticeably and allows your opponent to improve their position. Look for moves that maintain your position better.'
    case 'blunder':
      return bestMoveSan
        ? `❌ Blunder. Engine preferred ${bestMoveSan}, which would have maintained your position much better. This is a significant error that could be game-changing.`
        : '❌ Blunder. Advantage swung heavily to your opponent. This move likely involves hanging material, weakening your king, or missing critical tactical threats.'
    default:
      return '📝 Played move recorded. Consider the position carefully and look for the best continuation.'
  }
}

const buildEnhancedFallbackExplanation = (
  classification: MoveClassification,
  centipawnLoss: number | null,
  bestMoveSan: string | null,
  move: any,
  isUserMove: boolean = true
) => {
  const loss = centipawnLoss != null ? Math.round(centipawnLoss) : null

  // Check if this is an opening move that should get educational treatment
  const moveNumber = move?.moveNumber || 0
  const isOpeningMove = moveNumber <= 10 && (classification === 'best' || classification === 'excellent' || classification === 'good')

  if (isOpeningMove) {
    // Simple book move comment for opening moves
    return 'Book move.'
  }

  if (!isUserMove) {
    // Opponent move analysis
    switch (classification) {
      case 'brilliant':
        return '🌟 Your opponent played a brilliant move! This shows exceptional tactical vision and demonstrates advanced chess understanding. Study this position carefully to understand the sophisticated tactics involved - this could involve a calculated sacrifice, devastating tactical combination, or sophisticated positional maneuver. This is the kind of move that wins games and shows real chess mastery.'
      case 'best':
        return '✅ Your opponent played the best move available. This is solid, accurate play that maintains their position well and shows strong chess fundamentals. They found the optimal continuation that keeps their position on track.'
      case 'great':
        // Check if this is an opening move or if evaluation shows minimal change
        const isOpponentOpeningMove = moveNumber <= 10
        const hasOpponentMinimalEvalChange = loss != null && loss < 20

        if (isOpponentOpeningMove) {
          return 'Book move.'
        } else if (hasOpponentMinimalEvalChange) {
          return '🎯 Your opponent played a great move! This is very strong play that shows excellent chess understanding. They\'re playing accurately and keeping the position well-balanced.'
        } else {
          return '🎯 Your opponent played a great move! This is very strong play that shows excellent chess understanding. They found a move that improves their position and demonstrates advanced tactical awareness.'
        }
      case 'excellent':
        return '⭐ Your opponent played an excellent move! This is nearly optimal play that shows strong chess fundamentals. They found a move that maintains their position well and demonstrates good tactical awareness.'
      case 'good':
        return '👍 Your opponent made a good move. This maintains a solid position and shows reasonable chess understanding with sound positional play. They\'re making solid decisions that keep their position balanced.'
      case 'acceptable':
        return '⚠️ Your opponent\'s move is acceptable, but not the strongest choice. Better options were available that could have improved their position more significantly. This gives you a small opportunity to gain an edge.'
      case 'inaccuracy':
        return '❌ Your opponent made an inaccuracy. This gives you an opportunity to improve your position and potentially gain an advantage. Look for ways to exploit this weakness.'
      case 'mistake':
        return bestMoveSan
          ? `❌ Your opponent made a mistake! They should have played ${bestMoveSan} instead. This creates tactical opportunities for you - look for ways to take advantage of their error and gain a significant advantage.`
          : '❌ Your opponent\'s move creates significant difficulties for them. Look for tactical opportunities to exploit this mistake and gain a substantial advantage. This could be a turning point in the game.'
      case 'blunder':
        return bestMoveSan
          ? `❌ Your opponent blundered! They should have played ${bestMoveSan}. This is a major tactical error - look for immediate opportunities to win material or deliver checkmate. This could be game-changing!`
          : '❌ Your opponent made a serious mistake that could be game-changing. This creates a major tactical opportunity - look for winning combinations and decisive tactics that could end the game.'
      default:
        return '📝 Opponent move recorded. Analyze the position carefully and look for the best response to maintain or improve your position.'
    }
  }

  // User move analysis with enhanced explanations
  switch (classification) {
    case 'brilliant':
      return '🌟 Outstanding! This move demonstrates exceptional chess understanding and tactical mastery. You\'ve found a brilliant resource that even strong players might miss - this could involve a calculated sacrifice, devastating tactical combination, or sophisticated positional maneuver. This is the kind of move that wins games and shows real chess mastery!'
    case 'best':
      return '✅ Perfect! This is exactly what the position demands. You\'ve found the strongest move available and kept your position on track with optimal play. This shows excellent chess understanding and tactical awareness. You\'re playing at a very high level!'
    case 'great':
      // Check if this is an opening move or if evaluation shows minimal change
      const isOpeningMove = moveNumber <= 10
      const hasMinimalEvalChange = loss != null && loss < 20

      if (isOpeningMove) {
        return 'Book move.'
      } else if (hasMinimalEvalChange) {
        return '🎯 Excellent work! This is a great move that shows strong chess understanding and tactical awareness. You\'re playing accurately and keeping the position well-balanced. This kind of play will help you win more games!'
      } else {
        return '🎯 Excellent work! This is a great move that shows strong chess understanding and tactical awareness. You\'ve found a move that improves your position and demonstrates advanced chess skills. This kind of play will help you win more games!'
      }
    case 'excellent':
      return '⭐ Very well played! This is an excellent move that shows good chess fundamentals and tactical awareness. You\'ve found a move that maintains your position well and demonstrates solid chess understanding. Keep up the good work!'
    case 'good':
      return '👍 Good move! This maintains a solid position and shows good chess understanding. You\'re making sound positional decisions and keeping your pieces well-coordinated. This is solid, reliable play that builds a strong foundation.'
    case 'acceptable':
      return '⚠️ This move is playable, but there were better options available that could have improved your position more significantly. Consider looking for moves that create more threats, improve piece coordination, or strengthen your position. Every move counts in chess!'
    case 'inaccuracy':
      return '❌ This move has some issues. It weakens your position and allows your opponent to improve. Look for moves that maintain your advantage better and avoid giving your opponent unnecessary opportunities. Take more time to calculate and consider all your options.'
    case 'mistake':
      return bestMoveSan
        ? `❌ This move has problems that weaken your position. Consider ${bestMoveSan} next time - it would have been much stronger and maintained your advantage. Learn from this to improve your tactical awareness and calculation. Always check for better moves before committing.`
        : '❌ This move creates difficulties and allows your opponent to improve their position. The position deteriorated noticeably - look for moves that maintain your position better and avoid tactical weaknesses. This is a learning opportunity to improve your game.'
    case 'blunder':
      return bestMoveSan
        ? `❌ This is a significant error that could be game-changing. The engine preferred ${bestMoveSan}, which would have maintained your position much better. This move likely involves hanging material, weakening your king, or missing a tactical threat. Don\'t worry - we all make blunders, but learn from this to avoid similar errors in the future.`
        : '❌ This move has serious consequences that could swing the advantage heavily to your opponent. This might involve hanging pieces, weakening your king\'s safety, or missing critical tactical threats. Take more time to calculate before moving and always check for hanging pieces and tactical threats.'
    default:
      return '📝 Move recorded. Consider the position carefully and look for the best continuation that improves your position or creates threats.'
  }
}

const classificationBadgeStyles: Record<MoveClassification, string> = {
  brilliant: 'border border-purple-400/40 bg-purple-500/20 text-purple-200',
  best: 'border border-emerald-400/40 bg-emerald-500/20 text-emerald-200',
  great: 'border border-teal-400/40 bg-teal-500/20 text-teal-200',  // NEW
  excellent: 'border border-cyan-400/40 bg-cyan-500/20 text-cyan-200',  // NEW
  good: 'border border-sky-400/40 bg-sky-500/20 text-sky-200',
  acceptable: 'border border-slate-400/40 bg-slate-500/20 text-slate-200',
  inaccuracy: 'border border-amber-400/40 bg-amber-500/20 text-amber-200',
  mistake: 'border border-orange-400/40 bg-orange-500/20 text-orange-200',
  blunder: 'border border-rose-400/40 bg-rose-500/20 text-rose-200',
  uncategorized: 'border border-slate-400/30 bg-slate-500/10 text-slate-200',
}

const classificationLabel: Record<MoveClassification, string> = {
  brilliant: 'Brilliant',  // Spectacular tactical move with sacrifice or forced mate
  best: 'Best',            // Chess.com: The chess engine's top choice
  great: 'Great',          // Very strong move, nearly optimal
  excellent: 'Excellent',  // Chess.com: Almost as good as the best move
  good: 'Good',            // Chess.com: A decent move, but not the best
  acceptable: 'Book',      // Chess.com: A conventional opening move
  inaccuracy: 'Inaccuracy', // Chess.com: A weak move
  mistake: 'Mistake',      // Chess.com: A bad move that immediately worsens your position
  blunder: 'Blunder',      // Chess.com: A very bad move that loses material or the game
  uncategorized: 'Move',   // Fallback for uncategorized moves
}


export default function GameAnalysisPage() {
  const { platform: platformParam, userId: userParam, gameId: gameParam } = useParams()
  const platform = canonicalizePlatform(platformParam)
  const [boardWidth, setBoardWidth] = useState(700)
  const navigate = useNavigate()
  const location = useLocation()
  const locationState = (location.state ?? {}) as LocationState
  const mobileOpts = useMobileOptimizations()
  const layoutContainerRef = useRef<HTMLDivElement | null>(null)

  const decodedUserId = userParam ? decodeURIComponent(userParam) : ''

  // Handle responsive board sizing with mobile optimizations
  useEffect(() => {
    const updateBoardWidth = () => {
      const containerElement = layoutContainerRef.current
      const measuredWidth = containerElement?.clientWidth ?? window.innerWidth

      let containerHorizontalPadding = 32
      if (containerElement) {
        const styles = window.getComputedStyle(containerElement)
        const paddingLeft = parseFloat(styles.paddingLeft || '0')
        const paddingRight = parseFloat(styles.paddingRight || '0')
        containerHorizontalPadding = paddingLeft + paddingRight || containerHorizontalPadding
      }

      const availableWidth = Math.max(measuredWidth - containerHorizontalPadding, 0)

      if (mobileOpts.boardSize === 'small' || mobileOpts.boardSize === 'medium') {
        const cardHorizontalPadding = 32 // Card uses p-4 on mobile (16px on each side)
        const boardCap = mobileOpts.boardSize === 'small' ? 320 : 400
        const evaluationBarWidth = Math.max(10, Math.round(boardCap * 0.04))
        const symmetrySpacerWidth = evaluationBarWidth
        const evaluationBarGap = 20 // gap-5 between elements in the flex container
        const totalGaps = evaluationBarGap * 2

        const boardSpace = Math.max(
          availableWidth - (cardHorizontalPadding + evaluationBarWidth + symmetrySpacerWidth + totalGaps),
          0
        )
        const computedWidth = Math.min(boardSpace, boardCap)

        if (computedWidth > 0) {
          setBoardWidth(computedWidth)
        } else {
          setBoardWidth(Math.min(boardCap, availableWidth))
        }
      } else {
        setBoardWidth(Math.min(availableWidth * 0.6, 600))
      }
    }

    updateBoardWidth()
    window.addEventListener('resize', updateBoardWidth)
    return () => window.removeEventListener('resize', updateBoardWidth)
  }, [mobileOpts.boardSize])
  const decodedGameId = gameParam ? decodeURIComponent(gameParam) : ''

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [gameRecord, setGameRecord] = useState<any | null>(locationState.game ?? null)
  const [analysisRecord, setAnalysisRecord] = useState<any | null>(null)
  const [pgn, setPgn] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [autoAnalyzing, setAutoAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [isReanalyzing, setIsReanalyzing] = useState(false)
  const [reanalyzeSuccess, setReanalyzeSuccess] = useState(false)

  const parseNumericValue = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
    if (typeof value === 'string') {
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : null
    }
    return null
  }

  const normalizePercent = (value: number | null) => {
    if (value == null) {
      return null
    }
    if (value <= 1 && value >= 0) {
      return value * 100
    }
    return value
  }

  const requestGameAnalysis = async (providerGameId?: string | React.MouseEvent) => {
    if (!decodedUserId || !decodedGameId || !platform) {
      return
    }

    // Prevent duplicate analysis requests
    if (autoAnalyzing) {
      console.log('Analysis already in progress, skipping duplicate request')
      return
    }

    setAutoAnalyzing(true)
    setAnalysisError(null)

    try {
      const { baseUrl } = config.getApi()
      // If providerGameId is an event object (from onClick), ignore it
      const providedGameId = (typeof providerGameId === 'string') ? providerGameId : undefined
      const gameIdToUse = providedGameId || gameRecord?.provider_game_id || decodedGameId
      console.log('Requesting analysis for game:', {
        user_id: decodedUserId,
        platform,
        game_id: gameIdToUse,
        provider_game_id: gameIdToUse
      })

      const response = await fetch(`${baseUrl}/api/v1/analyze?use_parallel=false`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: decodedUserId,
          platform,
          analysis_type: 'stockfish',
          game_id: gameIdToUse,
          provider_game_id: gameIdToUse,
        }),
      })

      if (!response.ok) {
        const text = await response.text()
        let errorMessage = `Analysis request failed: ${response.status}`

        // Try to extract error message from response
        try {
          const errorData = JSON.parse(text)
          if (errorData.message) {
            errorMessage = errorData.message
          } else if (errorData.detail) {
            errorMessage = errorData.detail
          }
        } catch {
          // If parsing fails, use the raw text if it's not too long
          if (text && text.length < 200) {
            errorMessage = text
          }
        }

        throw new Error(errorMessage)
      }

      const payload = await response.json()
      console.log('Analysis request successful:', payload)

      // Start polling for analysis completion
      const cleanup = pollForAnalysis()

      // Store cleanup function for later
      return cleanup
    } catch (error) {
      // Extract just the error message to avoid any circular reference issues
      const errorMessage = error instanceof Error ? error.message : 'Failed to request analysis.'
      console.error('Failed to request analysis:', errorMessage)
      setAnalysisError(errorMessage)
      setAutoAnalyzing(false)
    }
  }

  const pollForAnalysis = () => {
    const maxAttempts = 30 // Poll for up to 5 minutes (30 * 10 seconds)
    let attempts = 0
    let isCancelled = false

    const poll = async () => {
      if (isCancelled || attempts >= maxAttempts) {
        if (attempts >= maxAttempts) {
          setAnalysisError('Analysis is taking longer than expected. Please check back later.')
        }
        setAutoAnalyzing(false)
        return
      }

      try {
        console.log(`Polling for analysis (attempt ${attempts + 1}/${maxAttempts})...`)
        const result = await fetchGameAnalysisData(decodedUserId, platform, decodedGameId)

        if (isCancelled) {
          return
        }

        if (result.analysis && result.analysis.moves_analysis && result.analysis.moves_analysis.length > 0) {
          // Analysis is complete
          console.log('Analysis found! Updating UI...')
          setAnalysisRecord(result.analysis)
          setGameRecord(prev => prev ?? result.game)
          setPgn(result.pgn ?? null)
          setAutoAnalyzing(false)
          setAnalysisError(null)
          return
        }

        // Continue polling
        attempts++
        console.log(`No analysis yet, will retry in 10 seconds...`)
        setTimeout(poll, 10000) // Poll every 10 seconds
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error('Error polling for analysis:', errorMessage)
        if (!isCancelled) {
          setAnalysisError('Error checking analysis status.')
          setAutoAnalyzing(false)
        }
      }
    }

    // Start polling after a short delay to give the backend time to process
    setTimeout(poll, 5000)

    // Return cleanup function
    return () => {
      isCancelled = true
    }
  }

  useEffect(() => {
    if (!platform) {
      setError('Unsupported platform provided.')
      setLoading(false)
      return
    }
    if (!decodedUserId || !decodedGameId) {
      setError('Missing game information in the URL.')
      setLoading(false)
      return
    }

    let isMounted = true
    let cleanupPolling: (() => void) | undefined
    let hasTriggeredAnalysis = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const result = await fetchGameAnalysisData(decodedUserId, platform, decodedGameId)
        if (!isMounted) {
          return
        }

        setGameRecord(prev => prev ?? result.game)
        setAnalysisRecord(result.analysis)
        setPgn(result.pgn ?? null)

        // Auto-analysis disabled - users should click "Analyze" button in match history
        // This prevents automatic analysis when navigating to game details
        // Only "Analyze My Games" button should trigger batch analysis
        if (!result.analysis && result.game) {
          console.log('No analysis found for this game. User can click "Analyze" in match history to analyze it.')
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        console.error('Unable to load game analysis', errorMessage)
        if (isMounted) {
          setError('Unable to load analysis for this game.')
        }
      } finally {
        if (isMounted && !hasTriggeredAnalysis) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      isMounted = false
      if (cleanupPolling) {
        cleanupPolling()
      }
    }
  }, [decodedUserId, decodedGameId, platform])

  const resolvedPlayerColor = (gameRecord?.color ?? locationState.game?.color ?? '').toString().toLowerCase()
  const playerColor: 'white' | 'black' = resolvedPlayerColor === 'black' ? 'black' : 'white'

  // Helper function to extract opponent name from PGN if not available in database
  const extractOpponentNameFromPGN = (pgn: string, playerColor: 'white' | 'black'): string | null => {
    if (!pgn) return null

    try {
      const lines = pgn.split('\n')
      let whitePlayer = ''
      let blackPlayer = ''

      for (const line of lines) {
        if (line.startsWith('[White ')) {
          whitePlayer = line.split('"')[1] || ''
        } else if (line.startsWith('[Black ')) {
          blackPlayer = line.split('"')[1] || ''
        }
      }

      // Return the opponent's name based on player color
      return playerColor === 'white' ? blackPlayer : whitePlayer
    } catch (error) {
      console.error('Error extracting opponent name from PGN:', error)
      return null
    }
  }

  // Get opponent name with fallback to PGN parsing
  const opponentName = (gameRecord?.opponent_name?.trim()) ||
    (pgn ? extractOpponentNameFromPGN(pgn, playerColor)?.trim() : null) ||
    'N/A'

  const processedData = useMemo(() => {
    if (!analysisRecord?.moves_analysis || !Array.isArray(analysisRecord.moves_analysis)) {
      return { moves: [] as ProcessedMove[], positions: ['start'] as string[] }
    }

    const chess = new Chess()
    const startingFen = chess.fen()
    const positions: string[] = [startingFen]
    const moves: ProcessedMove[] = []
    const rawMoves: AnalysisMoveRecord[] = analysisRecord.moves_analysis
    const userIsWhite = playerColor === 'white'

    rawMoves.forEach((move, idx) => {
      const fenBefore = positions[idx]
      const moveNumber = Math.floor(idx / 2) + 1
      const player = idx % 2 === 0 ? 'white' : 'black'
      const moveIsUserFlag = typeof move.is_user_move === 'boolean' ? move.is_user_move : undefined
      const isUserMove = moveIsUserFlag != null ? moveIsUserFlag : (userIsWhite ? player === 'white' : player === 'black')

      const evaluation: EvaluationInfo | null = move.evaluation ?? null
      const scoreForPlayer = isUserMove
        ? evaluationToScoreForPlayer(evaluation, playerColor)
        : evaluationToScoreForPlayer(evaluation, player === 'white' ? 'black' : 'white')

      const bestMoveSan = convertUciToSan(fenBefore, move.best_move) || move.best_move || 'the best move'
      const classification = determineClassification(move)

      // Use enhanced coaching comment if available and doesn't contain centipawn references,
      // otherwise use enhanced templates for consistent human-friendly explanations
      let explanation
      if (move.coaching_comment && move.coaching_comment.trim() &&
          !move.coaching_comment.toLowerCase().includes('centipawn') &&
          !move.coaching_comment.toLowerCase().includes('cp')) {
        // Use coaching comment if available, not empty, and doesn't contain centipawn references
        explanation = move.coaching_comment
      } else {
        // Use enhanced comment templates for variety and insight
        const commentContext: HumanReasonContext = {
          classification,
          centipawnLoss: move.centipawn_loss ?? null,
          bestMoveSan: bestMoveSan,
          moveNumber: moveNumber,
          isUserMove,
          isOpeningMove: moveNumber <= 10 && (classification === 'best' || classification === 'excellent' || classification === 'good' || classification === 'great'),
          tacticalInsights: move.tactical_insights,
          positionalInsights: move.positional_insights,
          risks: move.risks,
          benefits: move.benefits,
          fenBefore: fenBefore,
          move: move.move_san,
        }
        explanation = buildHumanComment(commentContext)
      }

      try {
        const { from, to, promotion } = parseUciMove(move.move)
        chess.move({ from, to, promotion })
      } catch (err) {
        console.warn('Failed to apply move, attempting SAN fallback', move.move, err)
        try {
          chess.move(move.move_san)
        } catch (fallbackError) {
          console.error('Unable to apply move to board', move.move_san, fallbackError)
        }
      }

      const fenAfter = chess.fen()
      positions.push(fenAfter)

      moves.push({
        index: idx,
        ply: idx + 1,
        moveNumber,
        player,
        isUserMove,
        san: move.move_san,
        bestMoveSan,
        evaluation,
        scoreForPlayer,
        displayEvaluation: formatEvaluation(evaluation, isUserMove ? playerColor : player === 'white' ? 'black' : 'white'),
        centipawnLoss: move.centipawn_loss ?? null,
        classification,
        explanation,
        fenBefore,
        fenAfter,

        // Enhanced coaching fields
        coachingComment: move.coaching_comment,
        whatWentRight: move.what_went_right,
        whatWentWrong: move.what_went_wrong,
        howToImprove: move.how_to_improve,
        tacticalInsights: move.tactical_insights,
        positionalInsights: move.positional_insights,
        risks: move.risks,
        benefits: move.benefits,
        learningPoints: move.learning_points,
        encouragementLevel: move.encouragement_level,
        moveQuality: move.move_quality,
        gamePhase: move.game_phase,
      })
    })

    return { moves, positions }
  }, [analysisRecord, playerColor])

  useEffect(() => {
    if (processedData.positions.length > 0) {
      // Set to the last position index (after all moves)
      const lastPositionIndex = processedData.positions.length - 1
      setCurrentIndex(lastPositionIndex)
    }
  }, [processedData.positions.length, processedData.moves.length])

  // Generate modern arrows for the current move
  const currentMoveArrows = useMemo(() => {
    // Check if we have moves and if currentIndex is valid
    if (!processedData.moves || processedData.moves.length === 0) {
      return []
    }

    if (currentIndex < 0 || currentIndex >= processedData.moves.length) {
      return []
    }

    const currentMove = processedData.moves[currentIndex]
    if (!currentMove) {
      return []
    }

    // Create a chess instance to replay moves up to the current position
    const chess = new Chess()

    // Replay all moves up to (but not including) the current move
    for (let i = 0; i < currentIndex; i++) {
      const move = processedData.moves[i]
      if (move) {
        try {
          const { from, to, promotion } = parseUciMove(move.san)
          chess.move({ from, to, promotion })
        } catch (err) {
          try {
            chess.move(move.san)
          } catch (fallbackError) {
            console.warn('Failed to apply move for arrow generation:', move.san, fallbackError)
          }
        }
      }
    }

    // Generate modern arrows for the current move
    return generateModernMoveArrows({
      san: currentMove.san,
      bestMoveSan: currentMove.bestMoveSan,
      classification: currentMove.classification,
      isUserMove: currentMove.isUserMove
    }, chess)
  }, [currentIndex, processedData.moves])

  // Auto-scroll is now handled by UnifiedChessAnalysis component

  // Keyboard navigation for chessboard
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle keyboard navigation when not typing in input fields
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }


      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault()
          navigateToMove(currentIndex - 1)
          break
        case 'ArrowRight':
          event.preventDefault()
          navigateToMove(currentIndex + 1)
          break
        case 'Home':
          event.preventDefault()
          navigateToMove(0)
          break
        case 'End':
          event.preventDefault()
          navigateToMove(processedData.positions.length - 1)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [currentIndex, processedData.positions.length])

  // Re-analyze handler
  const handleReanalyze = async () => {
    if (!pgn || !platform || !decodedUserId) {
      console.error('Missing required data for re-analysis')
      return
    }

    setIsReanalyzing(true)
    setReanalyzeSuccess(false)
    setAnalysisError(null)

    try {
      console.log('🔄 Starting re-analysis...', {
        user: decodedUserId,
        platform,
        gameId: decodedGameId
      })

      // Call the analyzeGame API with DEEP analysis for better results
      const response = await UnifiedAnalysisService.analyzeGame(
        pgn,
        decodedUserId,
        platform,
        'deep'  // Use DEEP analysis for re-analysis
      )

      if (response.success) {
        console.log('✅ Re-analysis successful!')
        setReanalyzeSuccess(true)

        // Wait a moment for the backend to save, then reload the data
        setTimeout(async () => {
          const result = await fetchGameAnalysisData(decodedUserId, platform, decodedGameId)
          setGameRecord(prev => prev ?? result.game)
          setAnalysisRecord(result.analysis)
          setPgn(result.pgn)
          setReanalyzeSuccess(false)
        }, 2000)
      } else {
        throw new Error('Re-analysis failed')
      }
    } catch (error) {
      console.error('❌ Re-analysis error:', error)
      setAnalysisError('Failed to re-analyze game. Please try again.')
    } finally {
      setIsReanalyzing(false)
    }
  }

  const derivedStats = useMemo(() => {
    const userMoves = processedData.moves.filter(move => move.isUserMove)
    const opponentMoves = processedData.moves.filter(move => !move.isUserMove)
    const totalUserMoves = userMoves.length

  const countByClassification = (classification: MoveClassification) =>
    userMoves.filter(move => move.classification === classification).length

    const brilliantCount = countByClassification('brilliant')
    const bestCount = countByClassification('best')
    const blunderCount = countByClassification('blunder')
    const mistakeCount = countByClassification('mistake')
    const inaccuracyCount = countByClassification('inaccuracy')

    const providedAccuracy = parseNumericValue(analysisRecord?.accuracy)
    const fallbackAccuracy = parseNumericValue(gameRecord?.accuracy)
    const accuracy = normalizePercent(providedAccuracy ?? fallbackAccuracy)

    const providedBestPercentage = parseNumericValue(analysisRecord?.best_move_percentage)
    const derivedBestMovePercentage = totalUserMoves > 0 ? (bestCount / totalUserMoves) * 100 : null
    const bestMovePercentage = derivedBestMovePercentage ?? normalizePercent(providedBestPercentage)

    const blunders = blunderCount
    const mistakes = mistakeCount
    const inaccuracies = inaccuracyCount
    const brilliantMoves = brilliantCount

    return {
      accuracy,
      bestMovePercentage,
      bestMoves: bestCount,
      blunders,
      mistakes,
      inaccuracies,
      brilliantMoves,
    }
  }, [analysisRecord, gameRecord, processedData.moves])

  const currentMove = currentIndex > 0 ? processedData.moves[currentIndex - 1] : null

  const evaluationContainerRef = useRef<HTMLDivElement | null>(null)

  const currentScore = currentMove ? currentMove.scoreForPlayer : 0

  const navigateToMove = (index: number) => {
    const clampedIndex = clamp(index, 0, processedData.positions.length - 1)
    console.log('navigateToMove called:', { index, clampedIndex, currentIndex, totalPositions: processedData.positions.length })
    console.log('🔥 NAVIGATION DEBUG: Moving from', currentIndex, 'to', clampedIndex)
    setCurrentIndex(clampedIndex)
  }

  const handleBack = () => {
    if (locationState.from) {
      navigate(`${locationState.from.pathname}${locationState.from.search ?? ''}`)
    } else {
      navigate(-1)
    }
  }

  // Calculate performance rating - MOVED BEFORE EARLY RETURNS
  const performanceRating = useMemo(() => {
    if (!processedData.moves || processedData.moves.length === 0) {
      return null
    }

    // Convert processed moves to MoveForRating format for the calculator
    const movesForRating: MoveForRating[] = processedData.moves
      .filter(move => move.isUserMove)
      .map(move => ({
        classification: move.classification || 'acceptable',
        centipawn_loss: move.centipawnLoss || 0,
        san: move.san || '',
        move: move.san || '' // Use SAN as the move string
      }))

    return calculatePerformanceRating({
      opponentRating: gameRecord?.opponent_rating ? parseInt(gameRecord.opponent_rating) : undefined,
      myRating: gameRecord?.my_rating ? parseInt(gameRecord.my_rating) : undefined,
      result: gameRecord?.result,
      moves: movesForRating
    })
  }, [processedData.moves, gameRecord?.opponent_rating, gameRecord?.my_rating, gameRecord?.result])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-200 shadow-xl shadow-black/40">
            <div className="flex items-center space-x-3">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-sky-400" />
              <span>Loading analysis...</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950">
        <div className="mx-auto max-w-4xl px-4 py-10">
          <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-100 shadow-xl shadow-black/40">
            <div className="flex items-center space-x-3">
              <span className="text-xl">!</span>
              <div>
                <h2 className="text-lg font-semibold text-white">Analysis unavailable</h2>
                <p>{error}</p>
              </div>
            </div>
            <button
              onClick={handleBack}
              className="mt-6 inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/20"
            >
              Return
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!analysisRecord || !processedData.moves.length) {
    return (
      <div className="min-h-screen bg-slate-950">
        <div className="mx-auto max-w-4xl px-4 py-10">
          <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-200 shadow-xl shadow-black/40">
            {autoAnalyzing ? (
              <>
                <h2 className="text-lg font-semibold text-white">Analyzing Game</h2>
                <p className="mt-2 text-slate-300">
                  We're automatically analyzing this game for you. This may take a few minutes...
                </p>
                <div className="mt-4 flex items-center space-x-3">
                  <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-sky-400" />
                  <span className="text-sm text-slate-300">Analysis in progress...</span>
                </div>
                <button
                  onClick={handleBack}
                  className="mt-6 inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/20"
                >
                  Back to profile
                </button>
              </>
            ) : analysisError ? (
              <>
                <h2 className="text-lg font-semibold text-white">Analysis Failed</h2>
                <p className="mt-2 text-slate-300">{analysisError}</p>
                <div className="mt-4 space-x-3">
                  <button
                    onClick={requestGameAnalysis}
                    className="inline-flex items-center rounded-full border border-sky-400/40 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:border-sky-400/60 hover:bg-sky-500/20"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={handleBack}
                    className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/20"
                  >
                    Back to profile
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-white">No Analysis Available</h2>
                <p className="mt-2 text-slate-300">
                  This game hasn't been analyzed yet. Request analysis to see insights and recommendations.
                </p>
                <button
                  onClick={requestGameAnalysis}
                  className="mt-6 inline-flex items-center rounded-full border border-sky-400/40 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:border-sky-400/60 hover:bg-sky-500/20"
                >
                  Analyze this game
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  const summaryCards = [
    {
      label: 'Accuracy',
      value:
        derivedStats.accuracy != null
          ? `${Math.round((derivedStats.accuracy + Number.EPSILON) * 10) / 10}%`
          : '--',
      color: CHESS_ANALYSIS_COLORS.accuracy,
    },
    {
      label: 'Best Moves',
      value: derivedStats.bestMoves ?? 0,
      color: CHESS_ANALYSIS_COLORS.bestMoves,
    },
    {
      label: 'Blunders',
      value: derivedStats.blunders ?? 0,
      color: CHESS_ANALYSIS_COLORS.blunders,
    },
    {
      label: 'Mistakes',
      value: derivedStats.mistakes ?? 0,
      color: CHESS_ANALYSIS_COLORS.mistakes,
    },
    {
      label: 'Inaccuracies',
      value: derivedStats.inaccuracies ?? 0,
      color: CHESS_ANALYSIS_COLORS.inaccuracies,
    },
    {
      label: 'Brilliants',
      value: derivedStats.brilliantMoves ?? 0,
      color: CHESS_ANALYSIS_COLORS.brilliants,
    },
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div ref={layoutContainerRef} className="container-responsive py-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={handleBack}
            className="inline-flex items-center space-x-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:border-white/30 hover:bg-white/20"
          >
            <span className="text-lg">&lt;</span>
            <span>Back</span>
          </button>
          <div className="text-right text-xs text-slate-300">
            {/* Mobile: Action Menu */}
            <div className="block lg:hidden">
              <ActionMenu
                trigger={
                  <button className="btn-touch-sm rounded-full border border-white/10 bg-white/10 text-slate-300 hover:text-white hover:bg-white/20 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>
                }
                actions={[
                  {
                    id: 'reanalyze',
                    label: isReanalyzing ? 'Re-analyzing...' : reanalyzeSuccess ? 'Updated!' : 'Re-analyze',
                    icon: isReanalyzing ? '⏳' : reanalyzeSuccess ? '✅' : '🔄',
                    onClick: handleReanalyze,
                    disabled: isReanalyzing || !pgn
                  },
                  ...(pgn ? [{
                    id: 'download',
                    label: 'Download PGN',
                    icon: '📥',
                    onClick: () => {
                      const blob = new Blob([pgn], { type: 'application/x-chess-pgn' })
                      const url = URL.createObjectURL(blob)
                      const link = document.createElement('a')
                      link.href = url
                      link.download = `${decodedUserId}_${decodedGameId}.pgn`
                      link.click()
                      URL.revokeObjectURL(url)
                    }
                  }] : [])
                ]}
                title="Game Actions"
              />
            </div>

            {/* Desktop: Individual Buttons */}
            <div className="hidden lg:flex gap-2">
              {/* Re-analyze Button */}
              <button
                onClick={handleReanalyze}
                disabled={isReanalyzing || !pgn}
                className={`
                  rounded-full border px-4 py-1.5 font-medium transition
                  ${isReanalyzing
                    ? 'border-purple-400/30 bg-purple-500/10 text-purple-300 cursor-wait'
                    : reanalyzeSuccess
                    ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-purple-400/30 bg-purple-500/10 text-purple-300 hover:border-purple-400/50 hover:bg-purple-500/20'
                  }
                  ${!pgn ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                title="Re-analyze this game with the latest move evaluation logic"
              >
                {isReanalyzing ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Re-analyzing...
                  </span>
                ) : reanalyzeSuccess ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Updated!
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Re-analyze
                  </span>
                )}
              </button>

              {/* Download PGN Button */}
              {pgn && (
                <button
                  onClick={() => {
                    const blob = new Blob([pgn], { type: 'application/x-chess-pgn' })
                    const url = URL.createObjectURL(blob)
                    const link = document.createElement('a')
                    link.href = url
                    link.download = `${decodedUserId}_${decodedGameId}.pgn`
                    link.click()
                    URL.revokeObjectURL(url)
                  }}
                  className="rounded-full border border-white/10 bg-white/10 px-3 py-1 font-medium text-white transition hover:border-white/30 hover:bg-white/20"
                >
                  Download PGN
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Re-analysis Status Banner */}
        {analysisError && (
          <div className="mb-4 rounded-lg border border-rose-400/30 bg-rose-500/10 p-4 text-rose-300">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">{analysisError}</span>
            </div>
          </div>
        )}

        <div className="mb-8 grid-responsive lg:grid-cols-[1.3fr,1fr]">
          <div className="rounded-2xl border border-white/5 bg-white/[0.06] p-5 shadow-xl shadow-black/40">
            <h1 className="text-2xl font-semibold text-white">Game Overview</h1>
            <div className="mt-5 grid-responsive text-sm text-slate-200">
              <div>
                <span className="font-medium">Result: </span>
                <span className={
                  gameRecord?.result === 'win'
                    ? 'text-emerald-300'
                    : gameRecord?.result === 'loss'
                      ? 'text-rose-300'
                      : gameRecord?.result === 'draw'
                        ? 'text-amber-200'
                        : 'text-slate-200'
                }>
                  {gameRecord?.result ? gameRecord.result.toUpperCase() : 'Unknown'}
                </span>
              </div>
              <div>
                <span className="font-medium">Played as: </span>
                <span className="capitalize text-white">{playerColor}</span>
              </div>
              <div>
                <span className="font-medium">Opponent: </span>
                <span className="text-white">{opponentName}</span>
              </div>
              <div>
                <span className="font-medium">Time Control: </span>
                <span>{gameRecord?.time_control ? getTimeControlCategory(gameRecord.time_control) : 'N/A'}</span>
              </div>
              <div>
                <span className="font-medium">Opening: </span>
                <span>{getOpeningNameWithFallback(gameRecord?.opening_family ?? gameRecord?.opening, gameRecord)}</span>
              </div>
              <div>
                <span className="font-medium">Moves: </span>
                <span>{processedData.moves.length > 0 ? processedData.moves.length : analysisRecord?.total_moves ?? 0}</span>
              </div>
               {performanceRating && (
                 <div>
                   <span className="font-medium">Performance Rating: </span>
                   <span className="text-yellow-300 font-semibold">
                     {performanceRating.rating}
                   </span>
                 </div>
               )}
            </div>
          </div>
          <div className="rounded-2xl border border-white/5 bg-white/[0.06] p-5 shadow-xl shadow-black/40">
            <h2 className="text-lg font-semibold text-white">Quick Stats</h2>
            <p className="mt-1 text-xs text-slate-300">Key highlights from Stockfish at a glance.</p>
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3 sm:gap-4">
              {summaryCards.map(card => (
                <div key={card.label} className="flex-1 rounded-xl border border-white/10 bg-white/10 p-2 sm:p-3 md:p-4 text-center shadow-inner shadow-black/30">
                  <div className="text-xs sm:text-xs uppercase tracking-wide text-slate-300">{card.label}</div>
                  <div className={`mt-1 sm:mt-2 text-sm sm:text-base md:text-lg font-semibold ${card.color}`}>{card.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Unified Chess Analysis Component */}
        <UnifiedChessAnalysis
          currentPosition={processedData.positions[currentIndex]}
          currentMove={currentMove}
          allMoves={processedData.moves}
          playerColor={playerColor}
          currentIndex={currentIndex}
          boardWidth={boardWidth}
          currentMoveArrows={currentMoveArrows}
          onMoveNavigation={navigateToMove}
        />

        <div className="mt-8">
          <EnhancedGameInsights
            moves={processedData.moves}
            playerColor={playerColor}
            currentMove={currentMove}
            gameRecord={gameRecord}
          />
        </div>
      </div>
    </div>
  )
}
