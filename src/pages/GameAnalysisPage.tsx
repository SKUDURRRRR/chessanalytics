import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import { fetchGameAnalysisData } from '../services/gameAnalysisService'
import { config } from '../lib/config'
import { getTimeControlCategory } from '../utils/timeControlUtils'
import { getOpeningNameWithFallback } from '../utils/openingIdentification'
import { EnhancedGameInsights } from '../components/debug/EnhancedGameInsights'
import { EnhancedMoveCoaching } from '../components/debug/EnhancedMoveCoaching'
import { CHESS_ANALYSIS_COLORS } from '../utils/chessColors'
import { getDarkChessBoardTheme } from '../utils/chessBoardTheme'
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
      return 'Brilliant resource that maximized your advantage.'
    case 'best':
      return 'Strong move that kept the engine evaluation on track.'
    case 'good':
    case 'acceptable':
      return 'Solid move that maintained a playable position.'
    case 'inaccuracy':
      return loss != null
        ? `Inaccuracy. You dropped roughly ${loss} centipawns.`
        : 'Inaccuracy. Better play was available.'
    case 'mistake':
      return bestMoveSan
        ? `Mistake. Consider ${bestMoveSan} next time.`
        : 'Mistake. Position deteriorated noticeably.'
    case 'blunder':
      return bestMoveSan
        ? `Blunder. Engine preferred ${bestMoveSan}.`
        : 'Blunder. Advantage swung heavily.'
    default:
      return 'Played move recorded.'
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
  
  if (!isUserMove) {
    // Opponent move analysis
    switch (classification) {
      case 'brilliant':
        return '🌟 Your opponent played a brilliant move! This shows strong tactical vision. Study this position to understand the tactics.'
      case 'best':
        return '✅ Your opponent played the best move available. This is solid, accurate play that maintains their position well.'
      case 'good':
        return '👍 Your opponent made a good move. This maintains a solid position and shows reasonable chess understanding.'
      case 'acceptable':
        return '⚠️ Your opponent\'s move is acceptable, but not the strongest choice. Better options were available.'
      case 'inaccuracy':
        return loss != null
          ? `❌ Your opponent made an inaccuracy. They dropped roughly ${loss} centipawns - this gives you an opportunity to improve your position.`
          : '❌ Your opponent\'s move isn\'t optimal. Look for ways to exploit this and improve your position.'
      case 'mistake':
        return bestMoveSan
          ? `❌ Your opponent made a mistake! They should have played ${bestMoveSan}. Look for tactical opportunities to take advantage.`
          : '❌ Your opponent\'s move creates difficulties for them. Look for ways to exploit this mistake.'
      case 'blunder':
        return bestMoveSan
          ? `❌ Your opponent blundered! They should have played ${bestMoveSan}. Look for immediate tactical opportunities to win material or checkmate.`
          : '❌ Your opponent made a serious mistake. This could be game-changing - look for winning tactics.'
      default:
        return '📝 Opponent move recorded. Analyze the position and look for the best response.'
    }
  }
  
  // User move analysis (original logic)
  switch (classification) {
    case 'brilliant':
      return '🌟 Outstanding! This move demonstrates exceptional chess understanding. You\'ve found a move that even strong players might miss. This is the kind of move that wins games!'
    case 'best':
      return '✅ Perfect! This is exactly what the position demands. You\'ve found the strongest move available and kept your position on track. Well done!'
    case 'good':
      return '👍 Good move! This maintains a solid position and shows good chess understanding. You\'re making progress in your game.'
    case 'acceptable':
      return '⚠️ This move is playable, but there were better options available. Consider looking for moves that improve your position more significantly.'
    case 'inaccuracy':
      return loss != null
        ? `❌ This move has some issues. You dropped roughly ${loss} centipawns compared to optimal play. Look for moves that maintain your advantage better.`
        : '❌ This move isn\'t optimal. There\'s a better way to handle this position. Take time to consider all your options.'
    case 'mistake':
      return bestMoveSan
        ? `❌ This move has problems. Consider ${bestMoveSan} next time - it would have been much stronger. Learn from this to improve your play.`
        : '❌ This move creates difficulties. The position deteriorated noticeably. Look for moves that maintain your position better.'
    case 'blunder':
      return bestMoveSan
        ? `❌ This is a significant error. The engine preferred ${bestMoveSan}. Don\'t worry - we all make blunders. Learn from this mistake to avoid similar errors.`
        : '❌ This move has serious consequences. The advantage swung heavily to your opponent. Take more time to calculate before moving.'
    default:
      return '📝 Move recorded. Consider the position carefully and look for the best continuation.'
  }
}

const classificationBadgeStyles: Record<MoveClassification, string> = {
  brilliant: 'border border-purple-400/40 bg-purple-500/20 text-purple-200',
  best: 'border border-emerald-400/40 bg-emerald-500/20 text-emerald-200',
  good: 'border border-sky-400/40 bg-sky-500/20 text-sky-200',
  acceptable: 'border border-slate-400/40 bg-slate-500/20 text-slate-200',
  inaccuracy: 'border border-amber-400/40 bg-amber-500/20 text-amber-200',
  mistake: 'border border-orange-400/40 bg-orange-500/20 text-orange-200',
  blunder: 'border border-rose-400/40 bg-rose-500/20 text-rose-200',
  uncategorized: 'border border-slate-400/30 bg-slate-500/10 text-slate-200',
}

const classificationLabel: Record<MoveClassification, string> = {
  brilliant: 'Brilliant',
  best: 'Best',
  good: 'Good',
  acceptable: 'Ok',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
  uncategorized: 'Move',
}

const MoveClassificationBadge = ({ classification }: { classification: MoveClassification }) => {
  // Use more padding for longer text classifications
  const getPaddingClass = (classification: MoveClassification) => {
    const longTextClassifications = ['mistake', 'blunder', 'inaccuracy', 'uncategorized']
    return longTextClassifications.includes(classification) ? 'px-3 py-1' : 'px-3 py-1'
  }
  
  return (
    <span className={`inline-flex items-center gap-1 rounded-full ${getPaddingClass(classification)} text-[10px] font-semibold whitespace-nowrap ${classificationBadgeStyles[classification]}`}>
      {classificationLabel[classification]}
    </span>
  )
}

const EvaluationBar = ({
  score,
  playerColor,
}: {
  score: number
  playerColor: 'white' | 'black'
}) => {
  const clampedScore = clamp(score, -EVAL_CAP, EVAL_CAP)
  const percent = ((clampedScore + EVAL_CAP) / (EVAL_CAP * 2)) * 100
  const markerPosition = playerColor === 'white' ? 100 - percent : percent

  return (
    <div className="relative h-full w-8 overflow-hidden rounded-xl border border-slate-200 bg-slate-900 shadow-inner">
      <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-white" />
      <div className="absolute top-1/2 left-0 right-0 h-1/2 bg-slate-900" />
      <div
        className="absolute left-0 right-0 flex justify-center transition-all duration-700 ease-out"
        style={{ top: `${clamp(markerPosition, 2, 98)}%` }}
      >
        <span className="block h-1 w-10 rounded-full bg-orange-500 ring-2 ring-white/70 transition-all duration-500 ease-out" />
      </div>
      <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/40" />
    </div>
  )
}

const NAVIGATION_ICONS: Record<'first' | 'prev' | 'next' | 'last', string> = {
  first: '<<',
  prev: '<',
  next: '>',
  last: '>>',
}

export default function GameAnalysisPage() {
  console.log('🚀 GameAnalysisPage component loaded - debugging version active!')
  const { platform: platformParam, userId: userParam, gameId: gameParam } = useParams()
  const platform = canonicalizePlatform(platformParam)
  const [boardWidth, setBoardWidth] = useState(700)
  const navigate = useNavigate()
  const location = useLocation()
  const locationState = (location.state ?? {}) as LocationState

  const decodedUserId = userParam ? decodeURIComponent(userParam) : ''

  // Handle responsive board sizing
  useEffect(() => {
    const updateBoardWidth = () => {
      if (window.innerWidth < 640) {
        setBoardWidth(260) // Small screens
      } else if (window.innerWidth < 768) {
        setBoardWidth(300) // Medium screens
      } else if (window.innerWidth < 1024) {
        setBoardWidth(380) // Large screens
      } else if (window.innerWidth < 1280) {
        setBoardWidth(480) // XL screens
      } else {
        setBoardWidth(580) // 2XL screens and up
      }
    }
    
    updateBoardWidth()
    window.addEventListener('resize', updateBoardWidth)
    return () => window.removeEventListener('resize', updateBoardWidth)
  }, [])
  const decodedGameId = gameParam ? decodeURIComponent(gameParam) : ''

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [gameRecord, setGameRecord] = useState<any | null>(locationState.game ?? null)
  const [analysisRecord, setAnalysisRecord] = useState<any | null>(null)
  const [pgn, setPgn] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [timelineScrollOffset, setTimelineScrollOffset] = useState(0)
  const [autoAnalyzing, setAutoAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)

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

  const requestGameAnalysis = async (providerGameId?: string) => {
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
      const gameIdToUse = providerGameId || gameRecord?.provider_game_id || decodedGameId
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

      const bestMoveSan = convertUciToSan(fenBefore, move.best_move)
      const classification = determineClassification(move)
      
      // Use enhanced coaching comment if available, otherwise fall back to explanation or build a better fallback
      const explanation = move.coaching_comment || 
                         move.explanation || 
                         buildEnhancedFallbackExplanation(classification, move.centipawn_loss ?? null, bestMoveSan, move, isUserMove)

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
      setCurrentIndex(processedData.positions.length - 1)
      setTimelineScrollOffset(0) // Reset timeline scroll when game changes
    }
  }, [processedData.positions.length])

  // Auto-scroll timeline to current move
  useEffect(() => {
    if (currentIndex > 0) {
      const currentMoveIndex = currentIndex - 1
      const moveRow = Math.floor(currentMoveIndex / 2)
      const totalRows = Math.ceil(processedData.moves.length / 2)
      
      console.log('📜 TIMELINE AUTO-SCROLL DEBUG:', {
        currentIndex,
        currentMoveIndex,
        moveRow,
        totalRows,
        currentTimelineOffset: timelineScrollOffset
      })
      console.log('📜 TIMELINE: Should scroll to show move', currentMoveIndex + 1)
      
      // Calculate the optimal scroll offset to show the current move
      let newOffset = timelineScrollOffset
      
      if (moveRow < timelineScrollOffset) {
        // Current move is above visible area, scroll up
        newOffset = Math.max(0, moveRow)
        console.log('Scrolling up to:', newOffset)
      } else if (moveRow >= timelineScrollOffset + 3) {
        // Current move is below visible area, scroll down
        newOffset = Math.min(totalRows - 3, moveRow - 2)
        console.log('Scrolling down to:', newOffset)
      }
      
      if (newOffset !== timelineScrollOffset) {
        console.log('Updating timeline offset from', timelineScrollOffset, 'to', newOffset)
        setTimelineScrollOffset(newOffset)
      }
    }
  }, [currentIndex, processedData.moves.length, timelineScrollOffset])

  // Keyboard navigation for chessboard
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle keyboard navigation when not typing in input fields
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }

      console.log('🎹 KEYBOARD EVENT:', event.key, 'currentIndex:', currentIndex)
      console.log('🎹 KEYBOARD DEBUG: Arrow keys should work now!')

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault()
          console.log('Arrow left - navigating to:', currentIndex - 1)
          navigateToMove(currentIndex - 1)
          break
        case 'ArrowRight':
          event.preventDefault()
          console.log('Arrow right - navigating to:', currentIndex + 1)
          navigateToMove(currentIndex + 1)
          break
        case 'Home':
          event.preventDefault()
          console.log('Home - navigating to: 0')
          navigateToMove(0)
          break
        case 'End':
          event.preventDefault()
          console.log('End - navigating to:', processedData.positions.length - 1)
          navigateToMove(processedData.positions.length - 1)
          break
      }
    }

    console.log('Adding keyboard event listener')
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      console.log('Removing keyboard event listener')
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [currentIndex, processedData.positions.length])

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
  const timelineContainerRef = useRef<HTMLDivElement | null>(null)

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
      <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={handleBack}
            className="inline-flex items-center space-x-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:border-white/30 hover:bg-white/20"
          >
            <span className="text-lg">&lt;</span>
            <span>Back</span>
          </button>
          <div className="text-right text-xs text-slate-300">
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

        <div className="mb-8 grid gap-4 md:grid-cols-[1.3fr,1fr]">
          <div className="rounded-2xl border border-white/5 bg-white/[0.06] p-5 shadow-xl shadow-black/40">
            <h1 className="text-2xl font-semibold text-white">Game Overview</h1>
            <div className="mt-5 grid gap-4 text-sm text-slate-200 sm:grid-cols-2">
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
            </div>
          </div>
          <div className="rounded-2xl border border-white/5 bg-white/[0.06] p-5 shadow-xl shadow-black/40">
            <h2 className="text-lg font-semibold text-white">Quick Stats</h2>
            <p className="mt-1 text-xs text-slate-300">Key highlights from Stockfish at a glance.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {summaryCards.map(card => (
                <div key={card.label} className="rounded-xl border border-white/10 bg-white/10 p-4 text-center shadow-inner shadow-black/30">
                  <div className="text-xs uppercase tracking-wide text-slate-300">{card.label}</div>
                  <div className={`mt-2 text-lg font-semibold ${card.color}`}>{card.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Symmetrical 3-Column Layout */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left Column: Evaluation Bar */}
          <div className="lg:col-span-1">
            <div className="sticky top-6">
              <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.08] p-4 shadow-xl shadow-black/40">
                <div className="h-[655px] w-8">
                  <EvaluationBar score={currentScore} playerColor={playerColor} />
                </div>
              </div>
            </div>
          </div>

          {/* Center Column: Chess Board */}
          <div className="lg:col-span-7">
            <div className="relative rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-4 shadow-2xl shadow-black/50">
              <div className="flex flex-col items-center justify-center py-4">
                <div className="w-full flex justify-center max-w-full">
                  <Chessboard
                    id="analysis-board"
                    position={processedData.positions[currentIndex]}
                    arePiecesDraggable={false}
                    boardOrientation={playerColor}
                    boardWidth={boardWidth}
                    showNotation={true}
                    {...getDarkChessBoardTheme('default')}
                  />
                </div>
                <div className="mt-8 flex flex-col items-center justify-center gap-2 text-sm text-slate-200">
                  <div className="text-xs text-slate-500">Use ← → arrow keys or click buttons to navigate</div>
                  <div className="flex flex-wrap items-center justify-center gap-4">
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => navigateToMove(0)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          navigateToMove(0)
                        }
                      }}
                      className="rounded-full border border-white/10 bg-white/10 px-2 py-1 transition hover:border-white/30 hover:bg-white/20"
                      aria-label="First move"
                    >
                      {NAVIGATION_ICONS.first}
                    </button>
                    <button
                      onClick={() => navigateToMove(currentIndex - 1)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          navigateToMove(currentIndex - 1)
                        }
                      }}
                      className="rounded-full border border-white/10 bg-white/10 px-2 py-1 transition hover:border-white/30 hover:bg-white/20"
                      aria-label="Previous move"
                    >
                      {NAVIGATION_ICONS.prev}
                    </button>
                    <button
                      onClick={() => navigateToMove(currentIndex + 1)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          navigateToMove(currentIndex + 1)
                        }
                      }}
                      className="rounded-full border border-white/10 bg-white/10 px-2 py-1 transition hover:border-white/30 hover:bg-white/20"
                      aria-label="Next move"
                    >
                      {NAVIGATION_ICONS.next}
                    </button>
                    <button
                      onClick={() => navigateToMove(processedData.positions.length - 1)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          navigateToMove(processedData.positions.length - 1)
                        }
                      }}
                      className="rounded-full border border-white/10 bg-white/10 px-2 py-1 transition hover:border-white/30 hover:bg-white/20"
                      aria-label="Last move"
                    >
                      {NAVIGATION_ICONS.last}
                    </button>
                  </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Analysis Panels */}
          <div className="lg:col-span-4 space-y-6">
            {/* Current Move Analysis Block */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-6 shadow-xl shadow-black/40">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Current Move</h3>
                  <div className="mt-2 text-3xl font-semibold text-white">
                    {currentMove ? currentMove.san : '—'}
                  </div>
                </div>
                {currentMove && <MoveClassificationBadge classification={currentMove.classification} />}
              </div>
              
              {currentMove ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
                    <span>{currentMove.player === 'white' ? 'White move' : 'Black move'}</span>
                    <span className="h-px w-8 bg-white/20" />
                    <span>Move {currentMove.moveNumber}</span>
                  </div>
                  
                  {/* Enhanced Coaching Display */}
                  <EnhancedMoveCoaching move={currentMove} className="text-sm" />
                </div>
              ) : (
                <p className="text-sm text-slate-300">Use the move timeline to explore Stockfish feedback for each position.</p>
              )}
            </div>

            {/* Move Timeline Block */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.08] p-6 shadow-xl shadow-black/40">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Move Timeline</h3>
                  <div className="text-xs text-slate-500 mt-1">← → to navigate moves</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setTimelineScrollOffset(Math.max(0, timelineScrollOffset - 1))}
                    disabled={timelineScrollOffset === 0}
                    className="rounded-full border border-white/10 bg-white/10 px-2 py-1 text-xs transition hover:border-white/30 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Previous moves"
                  >
                    ↑
                  </button>
                  <span className="text-xs text-slate-400">
                    {timelineScrollOffset + 1}-{Math.min(timelineScrollOffset + 3, Math.ceil(processedData.moves.length / 2))}
                  </span>
                  <button
                    onClick={() => setTimelineScrollOffset(Math.min(Math.ceil(processedData.moves.length / 2) - 3, timelineScrollOffset + 1))}
                    disabled={timelineScrollOffset >= Math.ceil(processedData.moves.length / 2) - 3}
                    className="rounded-full border border-white/10 bg-white/10 px-2 py-1 text-xs transition hover:border-white/30 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Next moves"
                  >
                    ↓
                  </button>
                </div>
              </div>
              <div className="max-h-[200px] overflow-y-auto pr-2 text-sm" ref={timelineContainerRef}>
                <table className="w-full table-fixed text-left">
                  <thead className="sticky top-0 bg-slate-950/95 backdrop-blur">
                    <tr className="text-xs uppercase text-slate-400">
                      <th className="w-14 py-2">Move</th>
                      <th className="w-1/2 py-2">You</th>
                      <th className="w-1/2 py-2">Opponent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: Math.min(3, Math.ceil(processedData.moves.length / 2)) }).map((_, row) => {
                      const actualRow = row + timelineScrollOffset
                      const whiteMove = processedData.moves[actualRow * 2]
                      const blackMove = processedData.moves[actualRow * 2 + 1]
                      return (
                        <tr key={actualRow} className="border-b border-white/10 last:border-b-0">
                          <td className="py-2 pr-2 text-xs text-slate-400">{actualRow + 1}</td>
                          <td className="py-2 pr-2">
                            {whiteMove ? (
                              <button
                                onClick={() => navigateToMove(whiteMove.index + 1)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    navigateToMove(whiteMove.index + 1)
                                  }
                                }}
                                className={`flex w-full items-center justify-between rounded-xl px-2 py-1.5 text-left transition gap-1 ${
                                  currentIndex === whiteMove.index + 1
                                    ? 'bg-white/25 text-white shadow-inner shadow-black/40'
                                    : 'bg-white/10 text-slate-200 hover:bg-white/20'
                                }`}
                              >
                                <span className="text-xs font-medium truncate">{whiteMove.san}</span>
                                <MoveClassificationBadge classification={whiteMove.classification} />
                              </button>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          <td className="py-2 pr-2">
                            {blackMove ? (
                              <button
                                onClick={() => navigateToMove(blackMove.index + 1)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    navigateToMove(blackMove.index + 1)
                                  }
                                }}
                                className={`flex w-full items-center justify-between rounded-xl px-2 py-1.5 text-left transition gap-1 ${
                                  currentIndex === blackMove.index + 1
                                    ? 'bg-white/25 text-white shadow-inner shadow-black/40'
                                    : 'bg-white/10 text-slate-200 hover:bg-white/20'
                                }`}
                              >
                                <span className="text-xs font-medium truncate">{blackMove.san}</span>
                                <MoveClassificationBadge classification={blackMove.classification} />
                              </button>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

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
