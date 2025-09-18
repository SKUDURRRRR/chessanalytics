// Home Page - Entry point with player search
import { PlayerSearch } from '../components/simple/PlayerSearch'

export default function HomePage() {
  const handlePlayerSelect = (userId: string, platform: 'lichess' | 'chess.com') => {
    // Redirect directly to the full user profile page
    window.location.href = `/simple-analytics?user=${userId}&platform=${platform}`
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-gray-800">Chess Analytics</h1>
        <p className="text-xl text-gray-600">Analyze any chess player's games and performance</p>
        <p className="text-gray-500">Search for players on Lichess or Chess.com to get started</p>
      </div>

      {/* Player Search */}
      <PlayerSearch onPlayerSelect={handlePlayerSelect} />

      {/* Features Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Search Players</h3>
          <p className="text-gray-600">Find any chess player by username on Lichess or Chess.com</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Quick Stats</h3>
          <p className="text-gray-600">
            Get instant insights into win rates, ratings, and playing patterns
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <div className="text-4xl mb-4">⚡</div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Fast Analysis</h3>
          <p className="text-gray-600">
            No registration required - just search and analyze immediately
          </p>
        </div>
      </div>
    </div>
  )
}
