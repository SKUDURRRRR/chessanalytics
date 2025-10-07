import React from 'react'
import { useNavigate } from 'react-router-dom'
import { MiniChessBoard } from './MiniChessBoard'

interface EnhancedOpponentAnalysisProps {
  userId: string
  onOpponentClick?: (opponentName: string) => void
  opponentStats: {
    averageOpponentRating: number
    highestOpponentRating: number
    lowestOpponentRating: number
    ratingDifference: number
    highestOpponentGame: {
      opponentRating: number
      opponentName?: string
      result: 'win' | 'loss' | 'draw'
      gameId: string
      playedAt: string
      opening?: string
      totalMoves?: number
      color?: 'white' | 'black'
      accuracy?: number
    } | null
    highestOpponentWin: {
      opponentRating: number
      opponentName?: string
      result: 'win'
      gameId: string
      playedAt: string
      opening?: string
      totalMoves?: number
      color?: 'white' | 'black'
      accuracy?: number
    } | null
    toughestOpponents: Array<{
      opponentRating: number
      opponentName?: string
      games: number
      wins: number
      losses: number
      draws: number
      winRate: number
      recentGameId: string
      recentGameDate: string
    }>
    favoriteOpponents: Array<{
      opponentRating: number
      opponentName?: string
      games: number
      wins: number
      losses: number
      draws: number
      winRate: number
      recentGameId: string
      recentGameDate: string
    }>
    ratingRangeStats: Array<{
      range: string
      games: number
      wins: number
      losses: number
      draws: number
      winRate: number
      averageOpponentRating: number
    }>
  }
  platform: 'lichess' | 'chess.com'
}

export function EnhancedOpponentAnalysis({ userId, onOpponentClick, opponentStats, platform }: EnhancedOpponentAnalysisProps) {
  const navigate = useNavigate()

  const handleGameClick = (gameId: string) => {
    const encodedUserId = encodeURIComponent(userId)
    const gameIdentifier = encodeURIComponent(gameId)
    const destination = `/analysis/${platform}/${encodedUserId}/${gameIdentifier}`
    navigate(destination)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getWinRateColor = (winRate: number) => {
    if (winRate >= 70) return 'text-emerald-300'
    if (winRate >= 55) return 'text-sky-300'
    if (winRate >= 45) return 'text-amber-300'
    return 'text-rose-300'
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 text-slate-100 shadow-xl shadow-black/40">
      <h3 className="mb-6 flex items-center text-lg font-semibold text-white">
        <span className="mr-2 text-2xl text-sky-300">Opponents</span>
        <span className="text-slate-300">Opponent Analysis</span>
      </h3>

      {/* Basic Stats Grid */}
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-center">
          <div className="text-xs uppercase tracking-wide text-slate-400">Avg Opponent</div>
          <div className="mt-1 text-2xl font-semibold text-white">{opponentStats.averageOpponentRating}</div>
        </div>
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-center">
          <div className="text-xs uppercase tracking-wide text-rose-100/80">Highest Opponent</div>
          <div className="mt-1 text-2xl font-semibold text-rose-200">{opponentStats.highestOpponentRating}</div>
        </div>
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-center">
          <div className="text-xs uppercase tracking-wide text-emerald-100/80">Lowest Opponent</div>
          <div className="mt-1 text-2xl font-semibold text-emerald-200">{opponentStats.lowestOpponentRating}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-center">
          <div className="text-xs uppercase tracking-wide text-slate-400">Rating Diff</div>
          <div className={`mt-1 text-2xl font-semibold ${opponentStats.ratingDifference >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
            {opponentStats.ratingDifference > 0 ? '+' : ''}
            {opponentStats.ratingDifference}
          </div>
        </div>
      </div>

      {/* Highest Opponent Games */}
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Highest Rated Opponent Game */}
        {opponentStats.highestOpponentGame && (
          <div
            className={`rounded-2xl border p-4 shadow-lg ${
              opponentStats.highestOpponentGame.result === 'win'
                ? 'border-emerald-400/40 bg-emerald-500/10'
                : opponentStats.highestOpponentGame.result === 'loss'
                  ? 'border-rose-400/40 bg-rose-500/10'
                  : 'border-amber-400/40 bg-amber-500/10'
            }`}
          >
            <h4 className="mb-3 text-sm font-semibold text-white">
              Highest Rated Opponent
            </h4>
            <div className="flex items-center gap-4">
              <MiniChessBoard
                gameId={opponentStats.highestOpponentGame.gameId}
                result={opponentStats.highestOpponentGame.result}
                opening={opponentStats.highestOpponentGame.opening}
                totalMoves={opponentStats.highestOpponentGame.totalMoves}
              />
              <div className="flex-1">
                <div className="mb-2 flex items-center gap-4">
                  <div className="text-lg font-semibold text-white">
                    {opponentStats.highestOpponentGame.opponentName || opponentStats.highestOpponentGame.opponentRating}
                  </div>
                  <div
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                      opponentStats.highestOpponentGame.result === 'win'
                        ? 'bg-emerald-500/20 text-emerald-200'
                        : opponentStats.highestOpponentGame.result === 'loss'
                          ? 'bg-rose-500/20 text-rose-200'
                          : 'bg-amber-500/20 text-amber-200'
                    }`}
                  >
                    {opponentStats.highestOpponentGame.result.toUpperCase()}
                  </div>
                </div>
                <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-slate-200">
                  {opponentStats.highestOpponentGame.opening && opponentStats.highestOpponentGame.opening !== 'Unknown' && (
                    <span className="text-slate-300">Opening: {opponentStats.highestOpponentGame.opening}</span>
                  )}
                  {opponentStats.highestOpponentGame.totalMoves && (
                    <span className="text-slate-300">{opponentStats.highestOpponentGame.totalMoves} moves</span>
                  )}
                  {opponentStats.highestOpponentGame.color && (
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                        opponentStats.highestOpponentGame.color === 'white'
                          ? 'bg-white/20 text-white'
                          : 'bg-black/40 text-slate-100'
                      }`}
                    >
                      {opponentStats.highestOpponentGame.color.toUpperCase()}
                    </span>
                  )}
                  {opponentStats.highestOpponentGame.accuracy && (
                    <span className="font-semibold text-sky-200">
                      {opponentStats.highestOpponentGame.accuracy.toFixed(1)}% accuracy
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400">
                  {formatDate(opponentStats.highestOpponentGame.playedAt)}
                </div>
              </div>
              <div>
                <button
                  onClick={() => handleGameClick(opponentStats.highestOpponentGame.gameId)}
                  className={`inline-flex items-center rounded-full px-4 py-2 text-xs font-semibold text-white transition ${
                    opponentStats.highestOpponentGame.result === 'win'
                      ? 'bg-emerald-500/70 hover:bg-emerald-500'
                      : opponentStats.highestOpponentGame.result === 'loss'
                        ? 'bg-rose-500/70 hover:bg-rose-500'
                        : 'bg-amber-500/70 hover:bg-amber-500'
                  }`}
                >
                  <span className="mr-1">Link</span>
                  View Game
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Highest Rated Opponent Win */}
        {opponentStats.highestOpponentWin && (
          <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4 shadow-lg">
            <h4 className="mb-3 text-sm font-semibold text-white">
              Highest Rated Win
            </h4>
            <div className="flex items-center gap-4">
              <MiniChessBoard
                gameId={opponentStats.highestOpponentWin.gameId}
                result={opponentStats.highestOpponentWin.result}
                opening={opponentStats.highestOpponentWin.opening}
                totalMoves={opponentStats.highestOpponentWin.totalMoves}
              />
              <div className="flex-1">
                <div className="mb-2 flex items-center gap-4">
                  <div className="text-lg font-semibold text-white">
                    {opponentStats.highestOpponentWin.opponentName || opponentStats.highestOpponentWin.opponentRating}
                  </div>
                  <div className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-200">
                    WIN
                  </div>
                </div>
                <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-slate-200">
                  {opponentStats.highestOpponentWin.opening && opponentStats.highestOpponentWin.opening !== 'Unknown' && (
                    <span className="text-slate-300">Opening: {opponentStats.highestOpponentWin.opening}</span>
                  )}
                  {opponentStats.highestOpponentWin.totalMoves && (
                    <span className="text-slate-300">{opponentStats.highestOpponentWin.totalMoves} moves</span>
                  )}
                  {opponentStats.highestOpponentWin.color && (
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                        opponentStats.highestOpponentWin.color === 'white'
                          ? 'bg-white/20 text-white'
                          : 'bg-black/40 text-slate-100'
                      }`}
                    >
                      {opponentStats.highestOpponentWin.color.toUpperCase()}
                    </span>
                  )}
                  {opponentStats.highestOpponentWin.accuracy && (
                    <span className="font-semibold text-sky-200">
                      {opponentStats.highestOpponentWin.accuracy.toFixed(1)}% accuracy
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400">
                  {formatDate(opponentStats.highestOpponentWin.playedAt)}
                </div>
              </div>
              <div>
                <button
                  onClick={() => handleGameClick(opponentStats.highestOpponentWin.gameId)}
                  className="inline-flex items-center rounded-full bg-emerald-500/70 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500"
                >
                  <span className="mr-1">Link</span>
                  View Game
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toughest vs Favorite Opponents */}
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Toughest Opponents */}
        {opponentStats.toughestOpponents.length > 0 && (
          <div>
            <h4 className="mb-4 flex items-center text-sm font-semibold text-rose-200">
              <span className="mr-2 text-xs uppercase tracking-wide text-rose-100">Tough</span>
              Toughest Opponents
            </h4>
            <div className="space-y-3">
              {opponentStats.toughestOpponents.map((opponent, index) => (
                <div 
                  key={index} 
                  className={`flex items-center justify-between rounded-2xl border border-rose-400/40 bg-rose-500/10 p-3 text-slate-100 ${onOpponentClick && opponent.opponentName ? 'cursor-pointer hover:border-rose-300/60 hover:bg-rose-500/20' : ''}`}
                  onClick={() => onOpponentClick && opponent.opponentName && onOpponentClick(opponent.opponentName)}
                >
                  <div className="flex items-center space-x-3">
                    <div className="text-sm font-semibold text-white">
                      {opponent.opponentName || `~${opponent.opponentRating} rating`}
                    </div>
                    <div className="text-xs text-rose-200/80">
                      {opponent.games} games
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <div className={`text-lg font-semibold ${getWinRateColor(opponent.winRate)}`}>
                        {opponent.winRate}%
                      </div>
                      <div className="text-xs text-rose-100/80">
                        {opponent.wins}W-{opponent.losses}L-{opponent.draws}D
                      </div>
                    </div>
                    <button
                      onClick={() => handleGameClick(opponent.recentGameId)}
                      className="text-xs font-semibold text-sky-200 hover:text-sky-100"
                    >
                      Link
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Favorite Opponents */}
        {opponentStats.favoriteOpponents.length > 0 && (
          <div>
            <h4 className="mb-4 flex items-center text-sm font-semibold text-emerald-200">
              <span className="mr-2 text-xs uppercase tracking-wide text-emerald-100">Familiar</span>
              Favorite Opponents
            </h4>
            <div className="space-y-3">
              {opponentStats.favoriteOpponents.map((opponent, index) => (
                <div 
                  key={index} 
                  className={`flex items-center justify-between rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-3 text-slate-100 ${onOpponentClick && opponent.opponentName ? 'cursor-pointer hover:border-emerald-300/60 hover:bg-emerald-500/20' : ''}`}
                  onClick={() => onOpponentClick && opponent.opponentName && onOpponentClick(opponent.opponentName)}
                >
                  <div className="flex items-center space-x-3">
                    <div className="text-sm font-semibold text-white">
                      {opponent.opponentName || `~${opponent.opponentRating} rating`}
                    </div>
                    <div className="text-xs text-emerald-200/80">
                      {opponent.games} games
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <div className={`text-lg font-semibold ${getWinRateColor(opponent.winRate)}`}>
                        {opponent.winRate}%
                      </div>
                      <div className="text-xs text-emerald-100/80">
                        {opponent.wins}W-{opponent.losses}L-{opponent.draws}D
                      </div>
                    </div>
                    <button
                      onClick={() => handleGameClick(opponent.recentGameId)}
                      className="text-xs font-semibold text-sky-200 hover:text-sky-100"
                    >
                      Link
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>


    </div>
  )
}
