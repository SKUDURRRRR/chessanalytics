import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import { fetchGameAnalysisData } from '../services/gameAnalysisService'
import { config } from '../lib/config'
import { getTimeControlCategory } from '../utils/timeControlUtils'
import { normalizeOpeningName } from '../utils/openingUtils'
import { EnhancedGameInsights } from '../components/debug/EnhancedGameInsights'
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

const classificationBadgeStyles: Record<MoveClassification, string> = {
  brilliant: 'bg-purple-100 text-purple-700',
  best: 'bg-green-100 text-green-700',
  good: 'bg-blue-100 text-blue-700',
  acceptable: 'bg-slate-100 text-slate-700',
  inaccuracy: 'bg-yellow-100 text-yellow-700',
  mistake: 'bg-orange-100 text-orange-700',
  blunder: 'bg-red-100 text-red-700',
  uncategorized: 'bg-gray-100 text-gray-600',
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

const MoveClassificationBadge = ({ classification }: { classification: MoveClassification }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${classificationBadgeStyles[classification]}`}>
    {classificationLabel[classification]}
  </span>
)

const EvaluationBar = ({
  score,
  playerColor,
}: {
  score: number
  playerColor: 'white' | 'black'
}) => {
  const clampedScore = clamp(score, -EVAL_CAP, EVAL_CAP)
  const percent = ((clampedScore + EVAL_CAP) / (EVAL_CAP * 2)) * 100
  const position = playerColor === 'white' ? 100 - percent : percent

  return (
    <div className="relative h-48 w-6 rounded bg-gradient-to-b from-white to-gray-900">
      <div
        className="absolute left-0 right-0 flex justify-center"
        style={{ top: `${position}%` }}
      >
        <span className="mt-[-8px] block h-3 w-6 rounded bg-orange-500" />
      </div>
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
  const { platform: platformParam, userId: userParam, gameId: gameParam } = useParams()
  const platform = canonicalizePlatform(platformParam)
  const navigate = useNavigate()
  const location = useLocation()
  const locationState = (location.state ?? {}) as LocationState

  const decodedUserId = userParam ? decodeURIComponent(userParam) : ''
  const decodedGameId = gameParam ? decodeURIComponent(gameParam) : ''

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [gameRecord, setGameRecord] = useState<any | null>(locationState.game ?? null)
  const [analysisRecord, setAnalysisRecord] = useState<any | null>(null)
  const [pgn, setPgn] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
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
        throw new Error(text || `Analysis request failed: ${response.status}`)
      }

      const payload = await response.json()
      console.log('Analysis request successful:', payload)

      // Start polling for analysis completion
      const cleanup = pollForAnalysis()
      
      // Store cleanup function for later
      return cleanup
    } catch (error) {
      console.error('Failed to request analysis:', error)
      setAnalysisError(error instanceof Error ? error.message : 'Failed to request analysis.')
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
        console.error('Error polling for analysis:', error)
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
        console.error('Unable to load game analysis', err)
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
      const explanation = move.explanation ?? buildFallbackExplanation(classification, move.centipawn_loss ?? null, bestMoveSan)

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
      })
    })

    return { moves, positions }
  }, [analysisRecord, playerColor])

  useEffect(() => {
    if (processedData.positions.length > 0) {
      setCurrentIndex(processedData.positions.length - 1)
    }
  }, [processedData.positions.length])

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
  const currentScore = currentMove ? currentMove.scoreForPlayer : 0

  const navigateToMove = (index: number) => {
    setCurrentIndex(clamp(index, 0, processedData.positions.length - 1))
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
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center space-x-3">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-500" />
              <span className="text-gray-700">Loading analysis...</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-4xl px-4 py-10">
          <div className="bg-red-50 border border-red-200 p-6 rounded-lg">
            <div className="flex items-center space-x-3">
              <span className="text-red-500 text-xl">!</span>
              <div>
                <h2 className="text-lg font-semibold text-red-700">Analysis unavailable</h2>
                <p className="text-red-600">{error}</p>
              </div>
            </div>
            <button
              onClick={handleBack}
              className="mt-6 inline-flex items-center rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
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
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-4xl px-4 py-10">
          <div className="bg-white border border-gray-200 p-6 rounded-lg shadow-sm">
            {autoAnalyzing ? (
              <>
                <h2 className="text-lg font-semibold text-gray-800">Analyzing Game</h2>
                <p className="mt-2 text-gray-600">
                  We're automatically analyzing this game for you. This may take a few minutes...
                </p>
                <div className="mt-4 flex items-center space-x-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span className="text-sm text-gray-600">Analysis in progress...</span>
                </div>
                <button
                  onClick={handleBack}
                  className="mt-6 inline-flex items-center rounded bg-gray-600 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
                >
                  Back to profile
                </button>
              </>
            ) : analysisError ? (
              <>
                <h2 className="text-lg font-semibold text-red-800">Analysis Failed</h2>
                <p className="mt-2 text-red-600">{analysisError}</p>
                <div className="mt-4 space-x-3">
                  <button
                    onClick={requestGameAnalysis}
                    className="inline-flex items-center rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={handleBack}
                    className="inline-flex items-center rounded bg-gray-600 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
                  >
                    Back to profile
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-gray-800">No analysis available</h2>
                <p className="mt-2 text-gray-600">
                  We could not find detailed analysis for this game yet. Try running Stockfish analysis from the previous page.
                </p>
                <button
                  onClick={handleBack}
                  className="mt-6 inline-flex items-center rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Back to profile
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
    },
    {
      label: 'Best Moves',
      value: derivedStats.bestMoves ?? 0,
    },
    {
      label: 'Blunders',
      value: derivedStats.blunders ?? 0,
    },
    {
      label: 'Mistakes',
      value: derivedStats.mistakes ?? 0,
    },
    {
      label: 'Inaccuracies',
      value: derivedStats.inaccuracies ?? 0,
    },
    {
      label: 'Brilliants',
      value: derivedStats.brilliantMoves ?? 0,
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={handleBack}
            className="inline-flex items-center space-x-2 rounded bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow hover:bg-gray-100"
          >
            <span className="text-lg">&lt;</span>
            <span>Back</span>
          </button>
          <div className="text-right text-xs text-gray-500">
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
                className="rounded bg-gray-200 px-3 py-1 font-medium text-gray-700 hover:bg-gray-300"
              >
                Download PGN
              </button>
            )}
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <div className="bg-white p-5 rounded-lg shadow">
            <h1 className="text-xl font-semibold text-gray-900">Game Overview</h1>
            <div className="mt-4 grid gap-3 text-sm text-gray-700 md:grid-cols-2">
              <div>
                <span className="font-medium">Result: </span>
                <span className={
                  gameRecord?.result === 'win'
                    ? 'text-green-600'
                    : gameRecord?.result === 'loss'
                      ? 'text-red-600'
                      : gameRecord?.result === 'draw'
                        ? 'text-yellow-600'
                        : 'text-gray-700'
                }>
                  {gameRecord?.result ? gameRecord.result.toUpperCase() : 'Unknown'}
                </span>
              </div>
              <div>
                <span className="font-medium">Played as: </span>
                <span className="capitalize">{playerColor}</span>
              </div>
              <div>
                <span className="font-medium">Opponent: </span>
                <span>{opponentName}</span>
              </div>
              <div>
                <span className="font-medium">Time Control: </span>
                <span>{gameRecord?.time_control ? getTimeControlCategory(gameRecord.time_control) : 'N/A'}</span>
              </div>
              <div>
                <span className="font-medium">Opening: </span>
                <span>{normalizeOpeningName(gameRecord?.opening_family ?? gameRecord?.opening ?? 'N/A')}</span>
              </div>
              <div>
                <span className="font-medium">Moves: </span>
                <span>{processedData.moves.length > 0 ? processedData.moves.length : (analysisRecord?.total_moves ?? 0)}</span>
              </div>
            </div>
          </div>
          <div className="bg-white p-5 rounded-lg shadow">
            <h2 className="text-lg font-semibold text-gray-900">Stockfish Summary</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {summaryCards.map(card => (
                <div key={card.label} className="rounded border border-gray-200 p-3 text-center">
                  <div className="text-xs uppercase tracking-wide text-gray-500">{card.label}</div>
                  <div className="mt-2 text-lg font-semibold text-gray-900">{card.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,380px),1fr]">
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg shadow">
              <Chessboard
                id="analysis-board"
                position={processedData.positions[currentIndex]}
                arePiecesDraggable={false}
                boardOrientation={playerColor}
                boardWidth={360}
              />
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => navigateToMove(0)}
                    className="rounded bg-gray-200 px-2 py-1 text-sm hover:bg-gray-300"
                    aria-label="First move"
                  >
                    {NAVIGATION_ICONS.first}
                  </button>
                  <button
                    onClick={() => navigateToMove(currentIndex - 1)}
                    className="rounded bg-gray-200 px-2 py-1 text-sm hover:bg-gray-300"
                    aria-label="Previous move"
                  >
                    {NAVIGATION_ICONS.prev}
                  </button>
                  <button
                    onClick={() => navigateToMove(currentIndex + 1)}
                    className="rounded bg-gray-200 px-2 py-1 text-sm hover:bg-gray-300"
                    aria-label="Next move"
                  >
                    {NAVIGATION_ICONS.next}
                  </button>
                  <button
                    onClick={() => navigateToMove(processedData.positions.length - 1)}
                    className="rounded bg-gray-200 px-2 py-1 text-sm hover:bg-gray-300"
                    aria-label="Last move"
                  >
                    {NAVIGATION_ICONS.last}
                  </button>
                </div>
                <div className="text-sm text-gray-600">
                  {currentMove
                    ? `Move ${currentMove.moveNumber} ${currentMove.player === 'white' ? '(White)' : '(Black)'}`
                    : 'Start position'}
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="text-sm font-semibold text-gray-800">Evaluation</h3>
              <div className="mt-3 flex items-center space-x-4">
                <EvaluationBar score={currentScore} playerColor={playerColor} />
                <div>
                  <div className="text-xl font-semibold text-gray-900">
                    {currentMove ? formatEvaluation(currentMove.evaluation, playerColor) : 'N/A'}
                  </div>
                  {currentMove?.centipawnLoss != null && (
                    <div className="text-sm text-gray-600">
                      Centipawn loss: {Math.round(currentMove.centipawnLoss)}
                    </div>
                  )}
                  {currentMove?.bestMoveSan && (
                    <div className="text-sm text-gray-600">
                      Best move: <span className="font-medium">{currentMove.bestMoveSan}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="text-sm font-semibold text-gray-800">Move Insights</h3>
              {currentMove ? (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-base font-semibold text-gray-900">
                      {currentMove.player === 'white' ? 'White' : 'Black'} - {currentMove.moveNumber}
                    </div>
                    <MoveClassificationBadge classification={currentMove.classification} />
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{currentMove.san}</div>
                  <p className="text-sm text-gray-700">{currentMove.explanation}</p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-gray-600">Select a move from the list to view detailed feedback.</p>
              )}
            </div>

            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="text-sm font-semibold text-gray-800">Move List</h3>
              <div className="mt-3 max-h-[480px] overflow-y-auto pr-2 text-sm">
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-white">
                    <tr className="text-xs uppercase text-gray-500">
                      <th className="py-2">Move</th>
                      <th className="py-2">You</th>
                      <th className="py-2">Opponent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: Math.ceil(processedData.moves.length / 2) }).map((_, row) => {
                      const whiteMove = processedData.moves[row * 2]
                      const blackMove = processedData.moves[row * 2 + 1]
                      return (
                        <tr key={row} className="border-b border-gray-100">
                          <td className="py-2 pr-2 text-xs text-gray-500">{row + 1}</td>
                          <td className="py-2 pr-2">
                            {whiteMove ? (
                              <button
                                onClick={() => navigateToMove(whiteMove.index + 1)}
                                className={`flex w-full items-center justify-between rounded px-2 py-1 text-left ${
                                  currentIndex === whiteMove.index + 1 ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100'
                                }`}
                              >
                                <span>{whiteMove.san}</span>
                                <MoveClassificationBadge classification={whiteMove.classification} />
                              </button>
                            ) : (
                              <span className="text-gray-300">--</span>
                            )}
                          </td>
                          <td className="py-2 pr-2">
                            {blackMove ? (
                              <button
                                onClick={() => navigateToMove(blackMove.index + 1)}
                                className={`flex w-full items-center justify-between rounded px-2 py-1 text-left ${
                                  currentIndex === blackMove.index + 1 ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100'
                                }`}
                              >
                                <span>{blackMove.san}</span>
                                <MoveClassificationBadge classification={blackMove.classification} />
                              </button>
                            ) : (
                              <span className="text-gray-300">--</span>
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

        {/* Enhanced Insights Section */}
        <div className="mt-6">
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
