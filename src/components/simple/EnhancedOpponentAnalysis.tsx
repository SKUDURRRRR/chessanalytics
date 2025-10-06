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
    if (winRate >= 70) return 'text-green-600'
    if (winRate >= 55) return 'text-blue-600'
    if (winRate >= 45) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center">
        <span className="text-2xl mr-2">Opponents</span>
        Opponent Analysis
      </h3>

      {/* Basic Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="text-center p-4 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600 mb-1">Avg Opponent</div>
          <div className="text-2xl font-bold text-gray-800">{opponentStats.averageOpponentRating}</div>
        </div>
        <div className="text-center p-4 bg-red-50 rounded-lg">
          <div className="text-sm text-gray-600 mb-1">Highest Opponent</div>
          <div className="text-2xl font-bold text-red-600">{opponentStats.highestOpponentRating}</div>
        </div>
        <div className="text-center p-4 bg-green-50 rounded-lg">
          <div className="text-sm text-gray-600 mb-1">Lowest Opponent</div>
          <div className="text-2xl font-bold text-green-600">{opponentStats.lowestOpponentRating}</div>
        </div>
        <div className="text-center p-4 bg-blue-50 rounded-lg">
          <div className="text-sm text-gray-600 mb-1">Rating Diff</div>
          <div className={`text-2xl font-bold ${opponentStats.ratingDifference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {opponentStats.ratingDifference > 0 ? '+' : ''}{opponentStats.ratingDifference}
          </div>
        </div>
      </div>

      {/* Highest Opponent Games */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Highest Rated Opponent Game */}
        {opponentStats.highestOpponentGame && (
          <div className="p-4 bg-gradient-to-r from-red-50 to-orange-50 rounded-lg border border-red-200">
            <h4 className="text-md font-semibold text-red-800 mb-3">
              Highest Rated Opponent
            </h4>
            <div className="flex items-center space-x-4">
              <MiniChessBoard
                gameId={opponentStats.highestOpponentGame.gameId}
                result={opponentStats.highestOpponentGame.result}
                opening={opponentStats.highestOpponentGame.opening}
                totalMoves={opponentStats.highestOpponentGame.totalMoves}
              />
              <div className="flex-1">
                <div className="flex items-center space-x-4 mb-2">
                  <div className="text-lg font-bold text-red-600">
                    {opponentStats.highestOpponentGame.opponentName || opponentStats.highestOpponentGame.opponentRating}
                  </div>
                  <div className={`px-2 py-1 rounded text-sm font-medium ${
                    opponentStats.highestOpponentGame.result === 'win' ? 'bg-green-100 text-green-800' :
                    opponentStats.highestOpponentGame.result === 'loss' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {opponentStats.highestOpponentGame.result.toUpperCase()}
                  </div>
                </div>
                <div className="text-sm text-gray-600 mb-2">
                  {opponentStats.highestOpponentGame.opening && opponentStats.highestOpponentGame.opening !== 'Unknown' && (
                    <span className="mr-4">Opening: {opponentStats.highestOpponentGame.opening}</span>
                  )}
                  {opponentStats.highestOpponentGame.totalMoves && (
                    <span className="mr-4">{opponentStats.highestOpponentGame.totalMoves} moves</span>
                  )}
                  {opponentStats.highestOpponentGame.color && (
                    <span className={`mr-4 px-2 py-1 rounded text-xs font-medium ${
                      opponentStats.highestOpponentGame.color === 'white' 
                        ? 'bg-gray-100 text-gray-800' 
                        : 'bg-gray-800 text-white'
                    }`}>
                      {opponentStats.highestOpponentGame.color.toUpperCase()}
                    </span>
                  )}
                  {opponentStats.highestOpponentGame.accuracy && (
                    <span className="text-blue-600 font-medium">
                      {opponentStats.highestOpponentGame.accuracy.toFixed(1)}% accuracy
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-500">
                  {formatDate(opponentStats.highestOpponentGame.playedAt)}
                </div>
              </div>
              <div>
                <button
                  onClick={() => handleGameClick(opponentStats.highestOpponentGame.gameId)}
                  className="inline-flex items-center px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
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
          <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
            <h4 className="text-md font-semibold text-green-800 mb-3">
              Highest Rated Win
            </h4>
            <div className="flex items-center space-x-4">
              <MiniChessBoard
                gameId={opponentStats.highestOpponentWin.gameId}
                result={opponentStats.highestOpponentWin.result}
                opening={opponentStats.highestOpponentWin.opening}
                totalMoves={opponentStats.highestOpponentWin.totalMoves}
              />
              <div className="flex-1">
                <div className="flex items-center space-x-4 mb-2">
                  <div className="text-lg font-bold text-green-600">
                    {opponentStats.highestOpponentWin.opponentName || opponentStats.highestOpponentWin.opponentRating}
                  </div>
                  <div className="px-2 py-1 rounded text-sm font-medium bg-green-100 text-green-800">
                    WIN
                  </div>
                </div>
                <div className="text-sm text-gray-600 mb-2">
                  {opponentStats.highestOpponentWin.opening && opponentStats.highestOpponentWin.opening !== 'Unknown' && (
                    <span className="mr-4">Opening: {opponentStats.highestOpponentWin.opening}</span>
                  )}
                  {opponentStats.highestOpponentWin.totalMoves && (
                    <span className="mr-4">{opponentStats.highestOpponentWin.totalMoves} moves</span>
                  )}
                  {opponentStats.highestOpponentWin.color && (
                    <span className={`mr-4 px-2 py-1 rounded text-xs font-medium ${
                      opponentStats.highestOpponentWin.color === 'white' 
                        ? 'bg-gray-100 text-gray-800' 
                        : 'bg-gray-800 text-white'
                    }`}>
                      {opponentStats.highestOpponentWin.color.toUpperCase()}
                    </span>
                  )}
                  {opponentStats.highestOpponentWin.accuracy && (
                    <span className="text-blue-600 font-medium">
                      {opponentStats.highestOpponentWin.accuracy.toFixed(1)}% accuracy
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-500">
                  {formatDate(opponentStats.highestOpponentWin.playedAt)}
                </div>
              </div>
              <div>
                <button
                  onClick={() => handleGameClick(opponentStats.highestOpponentWin.gameId)}
                  className="inline-flex items-center px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Toughest Opponents */}
        {opponentStats.toughestOpponents.length > 0 && (
          <div>
            <h4 className="text-md font-semibold text-gray-700 mb-4 flex items-center">
              <span className="mr-2">Tough</span>
              Toughest Opponents
            </h4>
            <div className="space-y-3">
              {opponentStats.toughestOpponents.map((opponent, index) => (
                <div 
                  key={index} 
                  className={`flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200 ${onOpponentClick && opponent.opponentName ? 'cursor-pointer hover:bg-red-100 transition-colors' : ''}`}
                  onClick={() => onOpponentClick && opponent.opponentName && onOpponentClick(opponent.opponentName)}
                >
                  <div className="flex items-center space-x-3">
                    <div className="text-sm font-medium text-gray-800">
                      {opponent.opponentName || `~${opponent.opponentRating} rating`}
                    </div>
                    <div className="text-xs text-gray-600">
                      {opponent.games} games
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <div className={`text-lg font-bold ${getWinRateColor(opponent.winRate)}`}>
                        {opponent.winRate}%
                      </div>
                      <div className="text-xs text-gray-500">
                        {opponent.wins}W-{opponent.losses}L-{opponent.draws}D
                      </div>
                    </div>
                    <button
                      onClick={() => handleGameClick(opponent.recentGameId)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
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
            <h4 className="text-md font-semibold text-gray-700 mb-4 flex items-center">
              <span className="mr-2">Familiar</span>
              Favorite Opponents
            </h4>
            <div className="space-y-3">
              {opponentStats.favoriteOpponents.map((opponent, index) => (
                <div 
                  key={index} 
                  className={`flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200 ${onOpponentClick && opponent.opponentName ? 'cursor-pointer hover:bg-green-100 transition-colors' : ''}`}
                  onClick={() => onOpponentClick && opponent.opponentName && onOpponentClick(opponent.opponentName)}
                >
                  <div className="flex items-center space-x-3">
                    <div className="text-sm font-medium text-gray-800">
                      {opponent.opponentName || `~${opponent.opponentRating} rating`}
                    </div>
                    <div className="text-xs text-gray-600">
                      {opponent.games} games
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <div className={`text-lg font-bold ${getWinRateColor(opponent.winRate)}`}>
                        {opponent.winRate}%
                      </div>
                      <div className="text-xs text-gray-500">
                        {opponent.wins}W-{opponent.losses}L-{opponent.draws}D
                      </div>
                    </div>
                    <button
                      onClick={() => handleGameClick(opponent.recentGameId)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
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
