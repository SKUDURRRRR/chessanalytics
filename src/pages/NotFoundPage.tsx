import { Link } from 'react-router-dom'
import { Home, Search, BarChart } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div className="flex-1 flex items-center justify-center px-4 py-12">
      <div className="max-w-2xl w-full text-center">
        {/* 404 Error */}
        <div className="mb-8">
          <h1 className="text-9xl font-semibold text-blue-500 mb-2">404</h1>
          <div className="h-1 w-32 bg-blue-500 mx-auto rounded-full"></div>
        </div>

        {/* Error Message */}
        <h2 className="text-3xl font-semibold text-white mb-4">
          Page Not Found
        </h2>
        <p className="text-gray-500 text-lg mb-8">
          Oops! The page you're looking for doesn't exist. It might have been moved or deleted.
        </p>

        {/* Chess-themed Message */}
        <div className="bg-surface-2/50 shadow-card rounded-lg p-6 mb-8">
          <p className="text-gray-400">
            🏰 Looks like this move is illegal! Let's get you back on track.
          </p>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            to="/"
            className="flex flex-col items-center gap-2 p-6 bg-surface-2 hover:bg-surface-3 shadow-card rounded-lg transition-colors group"
          >
            <Home className="w-8 h-8 text-blue-500 group-hover:scale-110 transition-transform" />
            <span className="text-white font-medium">Home</span>
            <span className="text-gray-500 text-sm">Return to homepage</span>
          </Link>

          <Link
            to="/search"
            className="flex flex-col items-center gap-2 p-6 bg-surface-2 hover:bg-surface-3 shadow-card rounded-lg transition-colors group"
          >
            <Search className="w-8 h-8 text-blue-500 group-hover:scale-110 transition-transform" />
            <span className="text-white font-medium">Search</span>
            <span className="text-gray-500 text-sm">Find players</span>
          </Link>

          <Link
            to="/pricing"
            className="flex flex-col items-center gap-2 p-6 bg-surface-2 hover:bg-surface-3 shadow-card rounded-lg transition-colors group"
          >
            <BarChart className="w-8 h-8 text-blue-500 group-hover:scale-110 transition-transform" />
            <span className="text-white font-medium">Pricing</span>
            <span className="text-gray-500 text-sm">View plans</span>
          </Link>
        </div>

        {/* Help Text */}
        <p className="text-gray-500 text-sm mt-8">
          If you believe this is an error, please{' '}
          <Link to="/profile" className="text-blue-500 hover:text-blue-400 underline">
            contact support
          </Link>
        </p>
      </div>
    </div>
  )
}
