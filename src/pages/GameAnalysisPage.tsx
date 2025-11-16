import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import { fetchGameAnalysisData } from '../services/gameAnalysisService'
import UnifiedAnalysisService from '../services/unifiedAnalysisService'
import { config } from '../lib/config'
import { getTimeControlCategory } from '../utils/timeControlUtils'
import { getOpeningNameWithFallback } from '../utils/openingIdentification'
import { getPlayerPerspectiveOpeningShort } from '../utils/playerPerspectiveOpening'
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
import { generateChessComComment, formatChessComComment, type ChessComCommentContext } from '../utils/chessComStyleComments'
import { calculatePerformanceRating, MoveForRating } from '../utils/performanceRatingCalculator'
import { convertPvToSan } from '../utils/pvConverter'
import { useExplorationAnalysis } from '../hooks/useExplorationAnalysis'
import { useChessSound } from '../hooks/useChessSound'
import { useChessSoundSettings } from '../contexts/ChessSoundContext'
import { getMoveSoundSimple } from '../utils/chessSounds'
import type { MatchHistoryGameSummary, Platform } from '../types'
import LoadingModal from '../components/LoadingModal'
import LimitReachedModal from '../components/LimitReachedModal'

interface EvaluationInfo {
  type: 'cp' | 'mate'
  value: number
  pv?: string[]  // Principal Variation from Stockfish (UCI moves)
}

interface AnalysisMoveRecord {
  move: string
  move_san: string
  evaluation?: EvaluationInfo
  best_move?: string
  best_move_pv?: string[]  // PV for the best move line (UCI moves)
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

  // Enhanced coaching fields
  coaching_comment?: string
  what_went_right?: string
  what_went_wrong?: string
  how_to_improve?: string
  tactical_insights?: string[]
  positional_insights?: string[]
  risks?: string[]
  benefits?: string[]
  learning_points?: string[]
  encouragement_level?: number
  move_quality?: string
  game_phase?: string
  is_user_move?: boolean
  player_color?: string
}

export interface ProcessedMove {
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
  pvMoves?: string[]  // Principal Variation in SAN notation for follow-up display

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
  | 'excellent'  // Merged: great+excellent (5-25cp loss)
  | 'great'  // Kept for backward compatibility, maps to excellent
  | 'good'  // Merged: good+acceptable (25-100cp loss)
  | 'acceptable'  // Kept for backward compatibility, maps to good
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
  // Validate UCI format
  if (!uci || typeof uci !== 'string' || uci.length < 4) {
    throw new Error(`Invalid UCI format: ${uci}`)
  }

  const from = uci.slice(0, 2)
  const to = uci.slice(2, 4)
  const promotion = uci.length > 4 ? uci.slice(4) : undefined

  // Validate square format (should be like 'e2', 'a1', etc.)
  const squareRegex = /^[a-h][1-8]$/
  if (!squareRegex.test(from) || !squareRegex.test(to)) {
    throw new Error(`Invalid square format in UCI: ${uci}`)
  }

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
      return bestMoveSan
        ? `⚠️ Inaccuracy. The engine suggests ${bestMoveSan} would have been a stronger choice. This move slightly weakens your position, but the game remains competitive.`
        : '⚠️ Inaccuracy. This move weakens your position and allows your opponent to improve. Look for stronger moves that maintain your advantage better.'
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
  isUserMove: boolean = true,
  playerColor: string = 'white'
) => {
  const loss = centipawnLoss != null ? Math.round(centipawnLoss) : null
  const colorName = playerColor.charAt(0).toUpperCase() + playerColor.slice(1) // "White" or "Black"

  // Check if this is an opening move that should get educational treatment
  const moveNumber = move?.moveNumber || 0
  const isOpeningMove = moveNumber <= 10 && (classification === 'best' || classification === 'excellent' || classification === 'good')

  if (isOpeningMove) {
    // First move - keep it short and Tal'ish to cheer up the player
    // Check if this is the first move of the game (move 1 for either player)
    if (moveNumber === 1) {
      if (isUserMove) {
        return 'The adventure begins! Time to bring out your forces and claim the center.'
      } else {
        return `The game begins! ${colorName} makes the first move. The adventure is underway!`
      }
    }
    // Simple book move comment for other opening moves
    return 'Book move.'
  }

  if (!isUserMove) {
    // Opponent move analysis using color-based references
    switch (classification) {
      case 'brilliant':
        return `🌟 ${colorName} played a brilliant move! This shows exceptional tactical vision and demonstrates advanced chess understanding. Study this position carefully to understand the sophisticated tactics involved - this could involve a calculated sacrifice, devastating tactical combination, or sophisticated positional maneuver. This is the kind of move that wins games and shows real chess mastery.`
      case 'best':
        return `✅ ${colorName} played the best move available. This is solid, accurate play that maintains their position well and shows strong chess fundamentals. They found the optimal continuation that keeps their position on track.`
      case 'great':
        // Check if this is an opening move or if evaluation shows minimal change
        const isOpponentOpeningMove = moveNumber <= 10
        const hasOpponentMinimalEvalChange = loss != null && loss < 20

        if (isOpponentOpeningMove) {
          return 'Book move.'
        } else if (hasOpponentMinimalEvalChange) {
          return `🎯 ${colorName} played a great move! This is very strong play that shows excellent chess understanding. They're playing accurately and keeping the position well-balanced.`
        } else {
          return `🎯 ${colorName} played a great move! This is very strong play that shows excellent chess understanding. They found a move that improves their position and demonstrates advanced tactical awareness.`
        }
      case 'excellent':
        return `⭐ ${colorName} played an excellent move! This is nearly optimal play that shows strong chess fundamentals. They found a move that maintains their position well and demonstrates good tactical awareness.`
      case 'good':
        return `👍 ${colorName} made a good move. This maintains a solid position and shows reasonable chess understanding with sound positional play. They're making solid decisions that keep their position balanced.`
      case 'acceptable':
        return `⚠️ ${colorName}'s move is acceptable, but not the strongest choice. Better options were available that could have improved their position more significantly. This creates an opportunity.`
      case 'inaccuracy':
        return bestMoveSan
          ? `⚠️ ${colorName} made an inaccuracy. The engine suggests ${bestMoveSan} would have been stronger. This creates a small opportunity to improve the position.`
          : `❌ ${colorName} made an inaccuracy. This creates an opportunity to improve the position. Look for ways to exploit this weakness.`
      case 'mistake':
        return bestMoveSan
          ? `❌ ${colorName} made a mistake! They should have played ${bestMoveSan} instead. This creates tactical opportunities - look for ways to take advantage of their error and gain a significant advantage.`
          : `❌ ${colorName}'s move creates significant difficulties for them. Look for tactical opportunities to exploit this mistake and gain a substantial advantage. This could be a turning point in the game.`
      case 'blunder':
        return bestMoveSan
          ? `❌ ${colorName} blundered! They should have played ${bestMoveSan}. This is a major tactical error - look for immediate opportunities to win material or deliver checkmate. This could be game-changing!`
          : `❌ ${colorName} made a serious mistake that could be game-changing. This creates a major tactical opportunity - look for winning combinations and decisive tactics that could end the game.`
      default:
        return '📝 Opponent move recorded. Analyze the position carefully and look for the best response to maintain or improve the position.'
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
  excellent: 'border border-cyan-400/40 bg-cyan-500/20 text-cyan-200',  // Merged great+excellent
  great: 'border border-cyan-400/40 bg-cyan-500/20 text-cyan-200',  // Alias for excellent
  good: 'border border-sky-400/40 bg-sky-500/20 text-sky-200',  // Merged good+acceptable
  acceptable: 'border border-sky-400/40 bg-sky-500/20 text-sky-200',  // Alias for good
  inaccuracy: 'border border-amber-400/40 bg-amber-500/20 text-amber-200',
  mistake: 'border border-orange-400/40 bg-orange-500/20 text-orange-200',
  blunder: 'border border-rose-400/40 bg-rose-500/20 text-rose-200',
  uncategorized: 'border border-slate-400/30 bg-slate-500/10 text-slate-200',
}

const classificationLabel: Record<MoveClassification, string> = {
  brilliant: 'Brilliant',  // Spectacular tactical move with sacrifice or forced mate
  best: 'Best',            // Chess.com: The chess engine's top choice
  excellent: 'Excellent',  // Merged: Nearly optimal (5-25cp loss)
  great: 'Excellent',      // Alias: Maps to excellent
  good: 'Good',            // Merged: Solid play (25-100cp loss)
  acceptable: 'Good',      // Alias: Maps to good
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
  const [searchParams] = useSearchParams()
  const locationState = (location.state ?? {}) as LocationState
  const mobileOpts = useMobileOptimizations()
  const layoutContainerRef = useRef<HTMLDivElement | null>(null)

  // Chess sound support
  const { soundEnabled, volume } = useChessSoundSettings()
  const { playSound } = useChessSound({ enabled: soundEnabled, volume })

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
  const [isLoadingAIComments, setIsLoadingAIComments] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gameRecord, setGameRecord] = useState<any | null>(locationState.game ?? null)
  const [analysisRecord, setAnalysisRecord] = useState<any | null>(null)
  const [pgn, setPgn] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [autoAnalyzing, setAutoAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [isReanalyzing, setIsReanalyzing] = useState(false)
  const [reanalyzeSuccess, setReanalyzeSuccess] = useState(false)

  // Follow-up exploration state
  const [isExploringFollowUp, setIsExploringFollowUp] = useState(false)
  const [explorationMoves, setExplorationMoves] = useState<string[]>([])
  const [explorationBaseIndex, setExplorationBaseIndex] = useState<number | null>(null)
  const [isFreeExploration, setIsFreeExploration] = useState(false) // New: track free exploration mode
  const [showLimitModal, setShowLimitModal] = useState(false)
  const [limitType, setLimitType] = useState<'import' | 'analyze'>('analyze')

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
      return
    }

    setAutoAnalyzing(true)
    setAnalysisError(null)

    try {
      const { baseUrl } = config.getApi()
      // If providerGameId is an event object (from onClick), ignore it
      const providedGameId = (typeof providerGameId === 'string') ? providerGameId : undefined
      const gameIdToUse = providedGameId || gameRecord?.provider_game_id || decodedGameId

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

        // Check if it's a 429 error (rate limit / usage limit)
        if (response.status === 429) {
          setLimitType('analyze')
          setShowLimitModal(true)
          setAutoAnalyzing(false)
          return
        }

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
        const result = await fetchGameAnalysisData(decodedUserId, platform, decodedGameId)

        if (isCancelled) {
          return
        }

        if (result.analysis && result.analysis.moves_analysis && result.analysis.moves_analysis.length > 0) {
          // Analysis is complete
          setAnalysisRecord(result.analysis)
          setGameRecord(prev => prev ?? result.game)
          setPgn(result.pgn ?? null)
          setAutoAnalyzing(false)
          setAnalysisError(null)
          // Force a full page reload to ensure all data is fresh
          window.location.reload()
          return
        }

        // Continue polling
        attempts++
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

  // Simple polling: Check if moves have coaching_comment
  // If analysis exists but no comments yet, poll until they appear
  const pollForAIComments = () => {
    if (!decodedUserId || !decodedGameId || !platform) return

    const maxAttempts = 20 // Poll for up to 100 seconds (20 * 5 seconds)
    let attempts = 0
    let isCancelled = false

    // Set loading state to true when polling starts
    setIsLoadingAIComments(true)

    // Wait 5 seconds before starting to poll (give AI generation time to start)
    console.log('⏳ Waiting 5 seconds before starting AI comment polling...')

    const poll = async () => {
      if (isCancelled || attempts >= maxAttempts) {
        console.log(`🛑 Polling stopped. Attempts: ${attempts}, Cancelled: ${isCancelled}`)
        setIsLoadingAIComments(false)
        return
      }

      attempts++
      console.log(`🔄 Polling attempt ${attempts}/${maxAttempts} for AI comments...`)

      try {
        // Force fresh data fetch by invalidating cache
        ;(window as any)._forceRefreshGameAnalysis = true
        const result = await fetchGameAnalysisData(decodedUserId, platform, decodedGameId)

        if (result.analysis?.moves_analysis) {
          // Check if moves beyond the first move have coaching_comment
          // (First move has instant greeting, we need to check if AI comments are generated for other significant moves)
          const movesWithComments = result.analysis.moves_analysis.filter(
            (move: any) => move.coaching_comment && move.coaching_comment.trim()
          )

          // Count user moves to see how many could potentially have comments
          const userMoves = result.analysis.moves_analysis.filter((move: any) => move.is_user_move)

          // Consider comments ready if we have at least 2 comments (greeting + at least one AI comment)
          // OR if we've been polling and have some comments (meaning background generation completed)
          const hasComments = movesWithComments.length >= 2

          if (hasComments) {
            // AI comments are ready!
            console.log(`✅ AI comments ready! Found ${movesWithComments.length} moves with comments out of ${userMoves.length} user moves. Refreshing data...`)

            // Log sample comments for debugging
            const sampleComments = movesWithComments.slice(0, 3).map((m: any) => ({
              move: m.move_san,
              comment: m.coaching_comment?.substring(0, 50)
            }))
            console.log('Sample comments:', sampleComments)

            // Hide loading indicator
            setIsLoadingAIComments(false)

            // Show notification
            if (typeof window !== 'undefined' && (window as any).toast) {
              (window as any).toast.success('AI insights ready!')
            } else {
              // Fallback notification
              console.log('✅ AI insights ready!')
            }

            // Force a complete state update with new data
            // This ensures React detects the change and re-renders all components
            setGameRecord(prev => ({ ...prev, ...result.game }))
            setAnalysisRecord(result.analysis) // Set fresh analysis data
            setPgn(result.pgn ?? null)

            console.log('📝 Updated analysis record with AI comments')
            console.log('🔄 Triggering re-render...')

            // Force a small delay to ensure state propagates, then stop polling
            setTimeout(() => {
              isCancelled = true
            }, 100)
            return
          }
        }

        // Continue polling
        setTimeout(poll, 5000) // Poll every 5 seconds
      } catch (error) {
        console.error('Error polling for AI comments:', error)
        setIsLoadingAIComments(false)
        isCancelled = true
      }
    }

    // Start polling after a short delay
    setTimeout(poll, 5000)

    // Return cleanup function
    return () => {
      isCancelled = true
      setIsLoadingAIComments(false)
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

        // Check if analysis exists but no AI comments yet - start polling
        if (result.analysis?.moves_analysis) {
          const movesWithComments = result.analysis.moves_analysis.filter(
            (move: any) => move.coaching_comment && move.coaching_comment.trim()
          )

          // Count user moves to see how many could potentially have comments
          const userMoves = result.analysis.moves_analysis.filter((move: any) => move.is_user_move)

          // Start polling if we only have 0-1 comments (need to wait for AI generation)
          const hasComments = movesWithComments.length >= 2

          if (!hasComments) {
            // Analysis exists but no AI comments yet - start polling
            console.log(`📊 Analysis loaded with ${movesWithComments.length} commented moves out of ${userMoves.length} user moves, starting polling for AI comments...`)
            pollForAIComments()
          } else {
            console.log(`✅ Analysis already has ${movesWithComments.length} moves with AI comments, no polling needed`)
          }
        }

        // Auto-analysis disabled - users should click "Analyze" button in match history
        // This prevents automatic analysis when navigating to game details
        // Only "Analyze My Games" button should trigger batch analysis
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

  // Scroll to top when navigating to this page
  // Use location.pathname to detect route changes
  useEffect(() => {
    // Immediate scroll on navigation - run synchronously
    const scrollToTop = () => {
      window.scrollTo(0, 0)
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
      // Also try scrolling any scrollable containers
      const scrollableElements = document.querySelectorAll('[data-scroll-container]')
      scrollableElements.forEach(el => {
        if (el instanceof HTMLElement) {
          el.scrollTop = 0
        }
      })
    }

    // Scroll immediately
    scrollToTop()

    // Also scroll after a microtask to catch any async scroll behavior
    Promise.resolve().then(scrollToTop)

    // And after requestAnimationFrame
    requestAnimationFrame(scrollToTop)
  }, [location.pathname, decodedGameId, platform, decodedUserId])

  // Also scroll after loading completes to ensure we're at top
  useEffect(() => {
    if (!loading && !error) {
      const scrollToTop = () => {
        window.scrollTo(0, 0)
        document.documentElement.scrollTop = 0
        document.body.scrollTop = 0
      }

      // Try multiple times to ensure it sticks
      requestAnimationFrame(() => {
        scrollToTop()
        setTimeout(scrollToTop, 10)
        setTimeout(scrollToTop, 50)
        setTimeout(scrollToTop, 100)
      })
    }
  }, [loading, error])

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
      // Prefer fen_before from backend data if available (more reliable)
      // Fall back to calculated positions if not available
      const fenBefore = move.fen_before || positions[idx]

      // CRITICAL: Reset chess instance to the correct position before processing this move
      // This ensures we're always applying moves from the correct position, even if previous moves failed
      try {
        chess.load(fenBefore)
      } catch (err) {
        console.warn(`Failed to load fenBefore for move ${idx}, using calculated position:`, err)
        // Fallback to using the last calculated position
        if (positions[idx]) {
          try {
            chess.load(positions[idx])
          } catch (fallbackErr) {
            console.error(`Failed to load fallback position for move ${idx}:`, fallbackErr)
            // If all else fails, keep current position (shouldn't happen but prevents crash)
          }
        }
      }

      const moveNumber = Math.floor(idx / 2) + 1
      const player = idx % 2 === 0 ? 'white' : 'black'
      const moveIsUserFlag = typeof move.is_user_move === 'boolean' ? move.is_user_move : undefined
      // Also check if move has its own player_color field for additional verification
      const movePlayerColor = move.player_color?.toLowerCase()

      // Determine if this is a user move based on player color (from move index and/or move's player_color field)
      // Use move's player_color if available, otherwise use calculated player from index
      const effectivePlayerColor = movePlayerColor || player
      const isUserMoveByColor = userIsWhite ? effectivePlayerColor === 'white' : effectivePlayerColor === 'black'

      // Always trust the color-based logic over backend flag
      // This fixes cases where backend incorrectly sets is_user_move for opponent moves
      // We verify the backend flag against color logic and correct it if needed
      let isUserMove = isUserMoveByColor
      if (moveIsUserFlag != null && moveIsUserFlag !== isUserMoveByColor) {
        // Backend flag doesn't match color logic - trust color logic and log for debugging
        if (import.meta.env.DEV) {
          console.warn(`[GameAnalysis] Correcting is_user_move flag:`, {
            move: move.move_san,
            moveIndex: idx,
            backendFlag: moveIsUserFlag,
            colorBased: isUserMoveByColor,
            player,
            effectivePlayerColor,
            userIsWhite
          })
        }
        isUserMove = isUserMoveByColor
      } else if (moveIsUserFlag != null) {
        // Backend flag matches color logic - use it
        isUserMove = moveIsUserFlag
      }
      // Otherwise use isUserMoveByColor (already set)

      // Correct is_user_move flag if backend data is incorrect
      // (Debug logs removed - fix is working correctly)

      const evaluation: EvaluationInfo | null = move.evaluation ?? null
      const scoreForPlayer = isUserMove
        ? evaluationToScoreForPlayer(evaluation, playerColor)
        : evaluationToScoreForPlayer(evaluation, player === 'white' ? 'black' : 'white')

      // Use best_move_san from backend if available, otherwise convert UCI to SAN using the correct FEN
      // Don't fall back to UCI notation - if SAN conversion fails, use null
      // Treat empty strings as null (backend may send "" instead of null)
      const bestMoveSanRaw = move.best_move_san && move.best_move_san.trim() ? move.best_move_san : null
      const bestMoveSan = bestMoveSanRaw || (move.best_move ? convertUciToSan(fenBefore, move.best_move) : null) || null
      const classification = determineClassification(move)

      // Debug logging for all moves with centipawn loss or suboptimal moves
      if (import.meta.env.DEV && (
        (move.centipawn_loss && move.centipawn_loss > 50) ||
        move.is_inaccuracy || move.is_mistake || move.is_blunder
      )) {
        console.log(`[GameAnalysis] Move ${idx + 1} (${move.move_san}):`, {
          classification,
          is_inaccuracy_flag: move.is_inaccuracy,
          is_mistake_flag: move.is_mistake,
          is_blunder_flag: move.is_blunder,
          best_move_san_raw: move.best_move_san,
          best_move_uci: move.best_move,
          bestMoveSan_computed: bestMoveSan,
          bestMoveSan_isNull: bestMoveSan === null,
          bestMoveSan_isEmpty: bestMoveSan === '',
          centipawn_loss: move.centipawn_loss,
          is_user_move: isUserMove,
          fenBefore: fenBefore
        })
      }

      // Convert UCI move to SAN if move_san is not available or looks incorrect
      // This ensures we always show proper SAN notation like "Rxd5" instead of "exd5"
      let displaySan = move.move_san
      if (!displaySan || displaySan === move.move) {
        // If move_san is missing or is just the UCI move, convert it
        const convertedSan = convertUciToSan(fenBefore, move.move)
        if (convertedSan) {
          displaySan = convertedSan
        }
      }

      // Prioritize backend coaching_comment (Tal-style AI comments) if available
      // Only use Chess.com-style comments as fallback for moves without backend comments
      let explanation

      // First, check if backend provided a coaching comment (Tal-style AI-generated)
      if (move.coaching_comment && move.coaching_comment.trim() &&
          !move.coaching_comment.toLowerCase().includes('centipawn') &&
          !move.coaching_comment.toLowerCase().includes('cp')) {
        explanation = move.coaching_comment
        if (idx < 5) { // Debug: log first 5 moves
          console.log(`[AI_COMMENT] Move ${idx} (${move.move_san}): Using coaching_comment:`, move.coaching_comment.substring(0, 50) + '...')
        }
      } else {
        // Fallback to Chess.com-style comments for moves without backend comments
        try {
          const prevEvaluation: EvaluationInfo | null = idx > 0 && rawMoves[idx - 1]?.evaluation
            ? rawMoves[idx - 1].evaluation!
            : null

          const chessComContext: ChessComCommentContext = {
            classification,
            centipawnLoss: move.centipawn_loss ?? null,
            evaluation: evaluation,
            prevEvaluation: prevEvaluation,
            san: displaySan,
            bestMoveSan: bestMoveSan,
            isUserMove,
            player,
            fenBefore: fenBefore,
            fenAfter: '', // Will be set after move is applied
            tacticalInsights: move.tactical_insights,
            positionalInsights: move.positional_insights
          }

          // Apply move first to get fenAfter
          let moveApplied = false
          try {
            const { from, to, promotion } = parseUciMove(move.move)
            const moveResult = chess.move({ from, to, promotion })
            if (moveResult) {
              moveApplied = true
            }
          } catch (err) {
            console.warn('Failed to apply move, attempting SAN fallback', move.move, err)
            try {
              if (move.move_san) {
                const moveResult = chess.move(move.move_san)
                if (moveResult) {
                  moveApplied = true
                }
              }
            } catch (fallbackError) {
              console.error('Unable to apply move to board', move.move_san, fallbackError)
            }
          }

          // Only update fenAfter if move was successfully applied
          if (moveApplied) {
            chessComContext.fenAfter = chess.fen()
          } else {
            // Use fenBefore as fallback if move couldn't be applied
            chessComContext.fenAfter = fenBefore
          }

          const chessComComment = generateChessComComment(chessComContext)
          explanation = formatChessComComment(chessComComment, displaySan)
        } catch (error) {
          console.warn('Error generating Chess.com-style comment, falling back to standard comment', error)

          // Final fallback to template-based comments
          if (move.explanation) {
            explanation = move.explanation
          } else {
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
        }
      }

      // Apply move to board state
      // Note: We've already reset chess to fenBefore above, so we can safely apply the move
      let moveAppliedToBoard = false

      // Verify we're at the correct starting position
      const currentFenBeforeMove = chess.fen()
      if (currentFenBeforeMove !== fenBefore) {
        console.warn(`Position mismatch for move ${idx}:`, {
          expected: fenBefore,
          actual: currentFenBeforeMove
        })
        // Try to reload to correct position
        try {
          chess.load(fenBefore)
        } catch (err) {
          console.error(`Failed to reload fenBefore for move ${idx}:`, err)
        }
      }

      // Try to apply the move
      try {
        const { from, to, promotion } = parseUciMove(move.move)
        const moveResult = chess.move({ from, to, promotion })
        if (moveResult) {
          moveAppliedToBoard = true
        }
      } catch (err) {
        // Move might be invalid - try SAN fallback
        try {
          if (move.move_san) {
            const moveResult = chess.move(move.move_san)
            if (moveResult) {
              moveAppliedToBoard = true
            }
          }
        } catch (fallbackError) {
          // If both attempts fail, log warning
          console.warn(`Failed to apply move ${idx} to board state:`, {
            uci: move.move,
            san: move.move_san,
            error: fallbackError,
            currentFen: chess.fen(),
            expectedFenBefore: fenBefore,
            backendFenAfter: move.fen_after
          })
        }
      }

      // Determine final fenAfter - prefer calculated position if move was applied,
      // otherwise use backend fenAfter if available
      let fenAfter: string
      if (moveAppliedToBoard) {
        // Move was successfully applied, use calculated position
        fenAfter = chess.fen()
      } else if (move.fen_after) {
        // Move application failed, but we have backend fenAfter - use it
        fenAfter = move.fen_after
        // Update chess instance to match backend position for subsequent moves
        try {
          chess.load(fenAfter)
        } catch (err) {
          console.warn('Failed to load backend fenAfter, using current position:', err)
          fenAfter = chess.fen()
        }
      } else {
        // No move applied and no backend fenAfter - keep current position
        // This prevents positions array from getting out of sync
        console.warn(`Move ${idx} could not be applied and no backend fenAfter, keeping current position`)
        fenAfter = chess.fen()
      }

      positions.push(fenAfter)

      // Convert best move PV from UCI to SAN notation for follow-up display
      // This is the continuation AFTER the best move (not after the played move)
      let pvMoves: string[] | undefined
      if (move.best_move_pv && Array.isArray(move.best_move_pv) && move.best_move_pv.length > 0) {
        // The PV starts from the position BEFORE the move (fenBefore), not after
        // First move in PV is the best move itself
        pvMoves = convertPvToSan(fenBefore, move.best_move_pv)
      }

      moves.push({
        index: idx,
        ply: idx + 1,
        moveNumber,
        player,
        isUserMove,
        san: displaySan,
        bestMoveSan,
        evaluation,
        scoreForPlayer,
        displayEvaluation: formatEvaluation(evaluation, isUserMove ? playerColor : player === 'white' ? 'black' : 'white'),
        centipawnLoss: move.centipawn_loss ?? null,
        classification,
        explanation,
        fenBefore,
        fenAfter,
        pvMoves,  // Include converted PV moves for follow-up feature

        // Enhanced coaching fields
        coachingComment: move.coaching_comment || undefined,
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
      // Set to the starting position (beginning of game)
      setCurrentIndex(0)
    }
  }, [processedData.positions.length, processedData.moves.length])

  // Generate modern arrows for the current move
  const currentMoveArrows = useMemo(() => {
    // Check if we have moves and if currentIndex is valid
    if (!processedData.moves || processedData.moves.length === 0) {
      return []
    }

    // currentIndex refers to positions array (which includes starting position at index 0)
    // moves array is 0-indexed and corresponds to positions [1..]
    // So position index N shows the board AFTER move N-1
    // We need to show arrows for the move that LED TO this position
    const moveIndex = currentIndex - 1

    if (moveIndex < 0 || moveIndex >= processedData.moves.length) {
      return []
    }

    const currentMove = processedData.moves[moveIndex]
    if (!currentMove) {
      return []
    }

    // Use the stored fenBefore from the move data - this is more reliable than replaying moves
    // because it avoids issues with moves that fail to replay (e.g., ambiguous notation)
    let chess: Chess
    if (currentMove.fenBefore) {
      try {
        chess = new Chess(currentMove.fenBefore)
      } catch (err) {
        console.warn('[GameAnalysisPage] Invalid fenBefore, falling back to replay:', err)
        // Fallback to replaying moves if fenBefore is invalid
        chess = new Chess()
        for (let i = 0; i < moveIndex; i++) {
          const move = processedData.moves[i]
          if (move) {
            try {
              chess.move(move.san)
            } catch (err) {
              console.warn('Failed to apply move for arrow generation:', move.san, err)
            }
          }
        }
      }
    } else {
      // Fallback: replay moves if fenBefore is not available
      chess = new Chess()
      for (let i = 0; i < moveIndex; i++) {
        const move = processedData.moves[i]
        if (move) {
          try {
            chess.move(move.san)
          } catch (err) {
            console.warn('Failed to apply move for arrow generation:', move.san, err)
          }
        }
      }
    }

    // Verify the position is correct before generating arrows
    const expectedTurn = currentMove.player
    const actualTurn = chess.turn() === 'w' ? 'white' : 'black'
    if (expectedTurn !== actualTurn) {
      console.warn('[GameAnalysisPage] Position turn mismatch for move:', currentMove.san)
    }

    // Generate modern arrows for the current move
    // Debug logging to understand why best move arrows might not show
    if (import.meta.env.DEV && currentMove.classification !== 'best' && currentMove.classification !== 'brilliant') {
      console.log('[GameAnalysisPage] Generating arrows for move:', {
        moveNumber: currentMove.moveNumber,
        san: currentMove.san,
        bestMoveSan: currentMove.bestMoveSan,
        bestMoveSanType: typeof currentMove.bestMoveSan,
        bestMoveSanLength: currentMove.bestMoveSan?.length,
        classification: currentMove.classification,
        isUserMove: currentMove.isUserMove,
        fen: chess.fen()
      })
    }

    const arrows = generateModernMoveArrows({
      san: currentMove.san,
      bestMoveSan: currentMove.bestMoveSan,
      classification: currentMove.classification,
      isUserMove: currentMove.isUserMove
    }, chess)

    return arrows
  }, [currentIndex, processedData.moves])

  // Auto-scroll is now handled by UnifiedChessAnalysis component

  // Keyboard navigation for chessboard
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle keyboard navigation when not typing in input fields
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }

      // Handle keyboard navigation during follow-up exploration
      if (isExploringFollowUp) {
        // Compute currentMove inside the effect to avoid initialization order issues
        const currentMove = currentIndex > 0 ? processedData.moves[currentIndex - 1] : null

        if (currentMove) {
          const pvMoves = currentMove.pvMoves || []
          const maxExplorationIndex = pvMoves.length - 1 // -1 because pvMoves[0] is best move (already applied)

          switch (event.key) {
            case 'ArrowLeft':
              event.preventDefault()
              // Go backwards in exploration sequence
              if (explorationMoves.length > 0) {
                // Play sound for undo (use move sound)
                playSound('move')
                setExplorationMoves(prev => prev.slice(0, -1))
              }
              break
            case 'ArrowRight':
              event.preventDefault()
              // Go forwards in exploration sequence
              const nextMoveIndex = explorationMoves.length + 1 // +1 because pvMoves[0] is best move
              if (nextMoveIndex < pvMoves.length) {
                const nextMove = pvMoves[nextMoveIndex]
                // Play sound for the move being added
                const soundType = getMoveSoundSimple(nextMove)
                playSound(soundType)
                setExplorationMoves(prev => [...prev, nextMove])
              }
              break
            case 'Home':
              event.preventDefault()
              // Reset to start of exploration (just best move, no exploration moves)
              playSound('move')
              setExplorationMoves([])
              break
            case 'End':
              event.preventDefault()
              // Go to end of PV line (add all remaining moves)
              if (explorationMoves.length < maxExplorationIndex) {
                // Play sound for the first move being added (most important feedback)
                const firstNewMoveIndex = explorationMoves.length + 1
                if (firstNewMoveIndex < pvMoves.length) {
                  const firstNewMove = pvMoves[firstNewMoveIndex]
                  const soundType = getMoveSoundSimple(firstNewMove)
                  playSound(soundType)
                }
                // Add all remaining moves from PV in a single update
                const remainingMoves: string[] = []
                for (let i = explorationMoves.length + 1; i < pvMoves.length; i++) {
                  remainingMoves.push(pvMoves[i])
                }
                setExplorationMoves(prev => [...prev, ...remainingMoves])
              }
              break
          }
          return
        }
      }

      // Normal keyboard navigation for main game
      switch (event.key) {
        case 'ArrowLeft': {
          event.preventDefault()
          const clampedIndex = Math.max(0, currentIndex - 1)
          // If in any exploration mode, exit it first and then navigate
          if (isExploringFollowUp || isFreeExploration) {
            setIsExploringFollowUp(false)
            setIsFreeExploration(false)
            setExplorationMoves([])
            setExplorationBaseIndex(null)
          }
          // Sound will be played by UnifiedChessAnalysis component when currentIndex changes
          setCurrentIndex(clampedIndex)
          break
        }
        case 'ArrowRight': {
          event.preventDefault()
          const clampedIndex = Math.min(processedData.positions.length - 1, currentIndex + 1)
          // If in any exploration mode, exit it first and then navigate
          if (isExploringFollowUp || isFreeExploration) {
            setIsExploringFollowUp(false)
            setIsFreeExploration(false)
            setExplorationMoves([])
            setExplorationBaseIndex(null)
          }
          // Sound will be played by UnifiedChessAnalysis component when currentIndex changes
          setCurrentIndex(clampedIndex)
          break
        }
        case 'Home': {
          event.preventDefault()
          // If in any exploration mode, exit it first and then navigate
          if (isExploringFollowUp || isFreeExploration) {
            setIsExploringFollowUp(false)
            setIsFreeExploration(false)
            setExplorationMoves([])
            setExplorationBaseIndex(null)
          }
          // Sound will be played by UnifiedChessAnalysis component when currentIndex changes
          setCurrentIndex(0)
          break
        }
        case 'End': {
          event.preventDefault()
          const endIndex = processedData.positions.length - 1
          // If in any exploration mode, exit it first and then navigate
          if (isExploringFollowUp || isFreeExploration) {
            setIsExploringFollowUp(false)
            setIsFreeExploration(false)
            setExplorationMoves([])
            setExplorationBaseIndex(null)
          }
          // Sound will be played by UnifiedChessAnalysis component when currentIndex changes
          setCurrentIndex(endIndex)
          break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [currentIndex, processedData.positions.length, processedData.moves, isExploringFollowUp, isFreeExploration, explorationMoves, playSound])

  // Re-analyze handler
  const handleReanalyze = async () => {

    if (!pgn || !platform || !decodedUserId) {
      setAnalysisError('Missing required data for re-analysis. Please try refreshing the page.')
      return
    }
    setIsReanalyzing(true)
    setReanalyzeSuccess(false)
    setAnalysisError(null)

    try {

      // Call the analyzeGame API with DEEP analysis for better results
      const response = await UnifiedAnalysisService.analyzeGame(
        pgn,
        decodedUserId,
        platform,
        'deep'  // Use DEEP analysis for re-analysis
      )

      if (response.success) {
        setReanalyzeSuccess(true)

        // Wait a moment for the backend to save, then hard refresh the page
        setTimeout(() => {
          // Perform a hard refresh (Ctrl+Shift+R equivalent)
          window.location.reload()
        }, 2000)
      } else {
        throw new Error('Re-analysis failed')
      }
    } catch (error) {

      // Check if this is an AbortError (timeout or cancelled request)
      // The backend might have still completed the analysis successfully
      const isAbortError = error instanceof Error && (
        error.name === 'AbortError' ||
        error.message.includes('timeout') ||
        error.message.includes('aborted')
      )

      if (isAbortError) {
        // For abort errors, wait a bit then check if analysis was actually saved
        // This handles cases where the request timed out but backend completed

        // Wait a moment for backend to potentially finish
        await new Promise(resolve => setTimeout(resolve, 3000))

        // Try to verify if the analysis was saved by fetching the latest analysis
        try {
          const latestAnalysis = await fetchGameAnalysisData(decodedUserId, platform, decodedGameId)
          if (latestAnalysis.analysis && latestAnalysis.analysis.analysis_type === 'deep') {
            // Analysis was saved! Treat as success
            setReanalyzeSuccess(true)
            setTimeout(() => {
              window.location.reload()
            }, 1000)
            return
          }
        } catch (fetchError) {
          // If we can't verify, show the error
          console.error('Could not verify analysis completion:', fetchError)
        }
      }

      // If not an abort error, or verification failed, show error message
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

  // Calculate display position (normal or exploration)
  const displayPosition = useMemo(() => {
    // If exploring (either follow-up or free), calculate exploration position
    if (isExploringFollowUp || isFreeExploration) {
      try {
        // Start from the current displayed position
        let baseFen: string

        if (isExploringFollowUp && currentMove?.fenBefore) {
          // Follow-up mode: start from before the move, then apply best move
          baseFen = currentMove.fenBefore
        } else {
          // Free exploration: start from current position (after the move)
          baseFen = processedData.positions[currentIndex] || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
        }

        const game = new Chess(baseFen)

        // If in follow-up mode, apply best move first
        if (isExploringFollowUp && currentMove?.bestMoveSan) {
          game.move(currentMove.bestMoveSan)
        }

        // Apply exploration moves
        for (const move of explorationMoves) {
          game.move(move)
        }

        return game.fen()
      } catch (err) {
        console.warn('Error calculating exploration position:', err)
        return processedData.positions[currentIndex]
      }
    }

    return processedData.positions[currentIndex]
  }, [isExploringFollowUp, isFreeExploration, currentMove, explorationMoves, processedData.positions, currentIndex])

  // Live analysis for exploration positions
  const explorationAnalysis = useExplorationAnalysis(
    (isExploringFollowUp || isFreeExploration) ? displayPosition : null,
    isExploringFollowUp || isFreeExploration
  )

  const navigateToMove = (index: number) => {
    const clampedIndex = clamp(index, 0, processedData.positions.length - 1)

    // If in any exploration mode, exit it first and then navigate
    if (isExploringFollowUp || isFreeExploration) {
      setIsExploringFollowUp(false)
      setIsFreeExploration(false)
      setExplorationMoves([])
      setExplorationBaseIndex(null)
    }

    setCurrentIndex(clampedIndex)
  }

  // Handle follow-up exploration
  const handleExploringChange = (exploring: boolean) => {
    if (exploring && currentMove) {
      // Start guided follow-up exploration - apply the best move
      setIsExploringFollowUp(true)
      setIsFreeExploration(false) // Clear free exploration when starting guided
      setExplorationMoves([])
      setExplorationBaseIndex(currentIndex)
    } else {
      // Stop exploration - return to original position
      setIsExploringFollowUp(false)
      setIsFreeExploration(false)
      setExplorationMoves([])
      if (explorationBaseIndex !== null) {
        setCurrentIndex(explorationBaseIndex)
      }
      setExplorationBaseIndex(null)
    }
  }

  const handleResetExploration = () => {
    setExplorationMoves([])
  }

  const handleExitFreeExploration = () => {
    // Exit free exploration mode
    setIsFreeExploration(false)
    setExplorationMoves([])
    if (explorationBaseIndex !== null) {
      setCurrentIndex(explorationBaseIndex)
    }
    setExplorationBaseIndex(null)
  }

  const handleUndoExplorationMove = () => {
    if (explorationMoves.length > 0) {
      setExplorationMoves(explorationMoves.slice(0, -1))
    }
  }

  // Handle piece drop on main board during exploration
  const handlePieceDrop = (sourceSquare: string, targetSquare: string): boolean => {

    try {
      // Use the displayPosition which already accounts for all exploration moves
      // This ensures validation matches what's actually shown on the board
      const startingFen = displayPosition

      if (!startingFen) {
        // Fallback to standard chess starting position
        return false
      }

      // Create a chess instance with the starting position
      const game = new Chess(startingFen)

      // Try to make the new move
      // Only specify promotion if it's a pawn move to the 8th rank
      const piece = game.get(sourceSquare as any)
      const isPromotion = piece?.type === 'p' && (targetSquare[1] === '8' || targetSquare[1] === '1')

      const moveOptions: any = {
        from: sourceSquare,
        to: targetSquare
      }

      if (isPromotion) {
        moveOptions.promotion = 'q'
      }

      const move = game.move(moveOptions)

      if (move) {

        // Play sound for the move
        const soundType = getMoveSoundSimple(move.san)
        playSound(soundType)

        setExplorationMoves([...explorationMoves, move.san])

        // If not already exploring, enter free exploration mode
        if (!isExploringFollowUp && !isFreeExploration) {
          setIsFreeExploration(true)
          setExplorationBaseIndex(currentIndex)
        }

        return true
      } else {
        // Move is invalid - provide detailed feedback
        const targetPiece = game.get(targetSquare as any)
        const sourcePiece = game.get(sourceSquare as any)

        let errorReason = 'Unknown reason'
        if (!sourcePiece) {
          errorReason = `No piece found on ${sourceSquare}`
        } else if (targetPiece && targetPiece.color === sourcePiece.color) {
          errorReason = `Target square ${targetSquare} is occupied by a friendly ${targetPiece.type}`
        } else if (targetPiece && targetPiece.color !== sourcePiece.color) {
          errorReason = `Cannot capture ${targetPiece.type} on ${targetSquare} (illegal move pattern)`
        } else {
          errorReason = `Illegal move pattern for ${sourcePiece.type} from ${sourceSquare} to ${targetSquare}`
        }

        console.error(`❌ Invalid exploration move: ${sourceSquare} → ${targetSquare}. ${errorReason}`)
        console.error(`   Current position: ${game.fen()}`)
        console.error(`   Turn: ${game.turn() === 'w' ? 'White' : 'Black'}`)
      }
    } catch (err) {
      console.error('❌ Invalid exploration move:', err)
    }

    return false
  }

  // Handle adding exploration moves programmatically (for auto-play)
  const handleAddExplorationMove = (move: string) => {
    // Use functional update to avoid stale closure issues
    setExplorationMoves(prev => [...prev, move])
  }

  // Handle URL query parameter for move navigation
  useEffect(() => {
      const moveParam = searchParams.get('move')
    if (moveParam && !loading && processedData.moves.length > 0) {
      const moveNumber = parseInt(moveParam, 10)
      if (!isNaN(moveNumber) && moveNumber > 0) {
        // Convert move number to index (ply)
        // Move 1 = index 1 (ply 1), Move 2 = index 2 (ply 2), etc.
        const targetIndex = moveNumber
        if (targetIndex >= 0 && targetIndex <= processedData.positions.length - 1) {
          setCurrentIndex(targetIndex)
        }
      }
    }
  }, [searchParams, loading, processedData.positions.length, processedData.moves.length])

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
      <>
        <div className="min-h-screen bg-slate-950" />
        <LoadingModal
          isOpen={true}
          message="Loading analysis..."
          subtitle="Please wait"
        />
      </>
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
      <div ref={layoutContainerRef} className="container-responsive py-6 content-fade">
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

        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr,1fr]">
          <div className="rounded-2xl border border-white/5 bg-white/[0.06] p-4 shadow-xl shadow-black/40">
            <h1 className="text-2xl font-semibold text-white">Game Overview</h1>
            <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2 text-base text-slate-200">
              <div className="min-w-0">
                <span className="font-medium whitespace-nowrap">Result: </span>
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
              <div className="min-w-0">
                <span className="font-medium whitespace-nowrap">Time Control: </span>
                <span className="break-words">{gameRecord?.time_control ? getTimeControlCategory(gameRecord.time_control) : 'N/A'}</span>
              </div>
              <div className="min-w-0">
                <span className="font-medium whitespace-nowrap">Played as: </span>
                <span className="capitalize text-white">{playerColor}</span>
              </div>
              <div className="min-w-0">
                <span className="font-medium whitespace-nowrap">Opening: </span>
                {/*
                  🚨 CRITICAL: MUST use getPlayerPerspectiveOpeningShort, NOT getOpeningNameWithFallback!
                  - getOpeningNameWithFallback returns raw DB opening (board perspective)
                  - getPlayerPerspectiveOpeningShort converts to player's perspective
                  - Using the wrong function causes White vs Caro-Kann to show "Caro-Kann Defense" instead of "King's Pawn Opening"
                  - See docs/OPENING_DISPLAY_REGRESSION_PREVENTION.md
                  - Pass moves from processedData to enable move-based identification for generic openings
                */}
                <span className="break-words">{getPlayerPerspectiveOpeningShort(
                  gameRecord?.opening_family ?? gameRecord?.opening ?? gameRecord?.opening_normalized,
                  playerColor,
                  gameRecord,
                  (() => {
                    // Try to get moves from processedData first
                    if (processedData.moves.length > 0) {
                      return processedData.moves.slice(0, 6).map(m => m.san)
                    }
                    // Fallback: extract moves from analysisRecord if available
                    if (analysisRecord?.moves_analysis && Array.isArray(analysisRecord.moves_analysis)) {
                      return analysisRecord.moves_analysis
                        .slice(0, 6)
                        .map((m: any) => m.move_san)
                        .filter(Boolean)
                    }
                    return undefined
                  })() // Extract first 6 moves for opening identification if available
                )}</span>
              </div>
              <div className="min-w-0">
                <span className="font-medium whitespace-nowrap">Opponent: </span>
                <span className="text-white truncate inline-block max-w-full align-bottom">{opponentName}</span>
              </div>
              <div className="min-w-0">
                <span className="font-medium whitespace-nowrap">Moves: </span>
                <span>{processedData.moves.length > 0 ? processedData.moves.length : analysisRecord?.total_moves ?? 0}</span>
              </div>
               {performanceRating && (
                 <div className="min-w-0 col-span-2">
                   <span className="font-medium whitespace-nowrap">Performance Rating: </span>
                   <span className="text-yellow-300 font-semibold">
                     {performanceRating.rating}
                   </span>
                 </div>
               )}
            </div>
          </div>
          <div className="rounded-2xl border border-white/5 bg-white/[0.06] p-4 shadow-xl shadow-black/40">
            <h2 className="text-lg font-semibold text-white">Quick Stats</h2>
            <p className="mt-0.5 text-xs text-slate-300">Your performance highlights from Stockfish analysis.</p>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
              {summaryCards.map(card => (
                <div key={card.label} className="min-w-0 rounded-xl border border-white/10 bg-white/10 p-2.5 sm:p-3 text-center shadow-inner shadow-black/30">
                  <div className="text-[0.65rem] sm:text-xs uppercase tracking-wide text-slate-300 break-words hyphens-auto leading-tight">{card.label}</div>
                  <div className={`mt-1.5 text-lg sm:text-xl md:text-2xl font-bold ${card.color}`}>{card.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Unified Chess Analysis Component */}
        <UnifiedChessAnalysis
          currentPosition={displayPosition}
          currentMove={currentMove}
          allMoves={processedData.moves}
          playerColor={playerColor}
          currentIndex={currentIndex}
          boardWidth={boardWidth}
          currentMoveArrows={currentMoveArrows}
          onMoveNavigation={navigateToMove}
          isExploringFollowUp={isExploringFollowUp}
          isFreeExploration={isFreeExploration}
          explorationMoves={explorationMoves}
          explorationAnalysis={explorationAnalysis}
          onExploringChange={handleExploringChange}
          onExitFreeExploration={handleExitFreeExploration}
          onResetExploration={handleResetExploration}
          onUndoExplorationMove={handleUndoExplorationMove}
          onAddExplorationMove={handleAddExplorationMove}
          onPieceDrop={handlePieceDrop}
          isLoadingAIComments={isLoadingAIComments}
        />

        <div className="mt-8">
          <EnhancedGameInsights
            moves={processedData.moves}
            playerColor={playerColor}
            currentMove={currentMove}
            gameRecord={gameRecord}
            analysisRecord={analysisRecord}
          />
        </div>
      </div>

      {/* Limit Reached Modal */}
      <LimitReachedModal
        isOpen={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        limitType={limitType}
      />
    </div>
  )
}
