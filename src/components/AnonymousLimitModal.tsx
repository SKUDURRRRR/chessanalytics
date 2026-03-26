import { Link } from 'react-router-dom'

interface AnonymousLimitModalProps {
  isOpen: boolean
  onClose: () => void
  limitType: 'import' | 'analyze'
}

export default function AnonymousLimitModal({
  isOpen,
  onClose,
  limitType
}: AnonymousLimitModalProps) {
  // Modal disabled - always return null
  return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-surface-base/95 backdrop-blur-sm" />

      {/* Modal Container - Properly constrained */}
      <div
        className="relative w-full max-w-lg bg-surface-1 rounded-lg shadow-card overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxHeight: 'calc(100vh - 2rem)'
        }}
      >
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 border-b border-white/[0.04]">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-surface-3/30"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="text-center pr-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-lg bg-surface-2 shadow-card mb-3">
              <span className="text-2xl">♟</span>
            </div>
            <h2 className="text-2xl font-semibold text-white mb-2 leading-tight">
              Unlock Your Chess Potential
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              Get Stockfish-powered analysis, personalized insights, and Tal-style commentary to elevate your game
            </p>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div
          className="relative px-6 py-5 overflow-y-auto"
          style={{ maxHeight: 'calc(100vh - 280px)' }}
        >
          <p className="text-gray-400 text-sm leading-relaxed mb-5 text-center">
            Create a free account to unlock powerful analytics and continue improving your chess game.
          </p>

          {/* Features card */}
          <div className="bg-surface-2/50 rounded-lg p-5 mb-4 shadow-card">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center flex-shrink-0 shadow-card">
                <svg className="w-4 h-4 text-blue-300" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                  <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-white font-semibold text-base">
                Free Account Features
              </h3>
            </div>

            <div className="space-y-2.5">
              {[
                '50 game imports per day',
                '2 game analyses per day',
                'Full access to chess analytics',
                'Opening repertoire analysis',
                'Personality insights & playstyle analysis'
              ].map((feature, index) => (
                <div key={index} className="flex items-center gap-2.5">
                  <div className="flex-shrink-0 w-4 h-4 rounded-full bg-emerald-500/20 shadow-card flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-gray-400 text-sm leading-relaxed">{feature}</span>
                </div>
              ))}

              <div className="flex items-center gap-2.5 pt-2 mt-2 border-t border-white/[0.04]">
                <div className="flex-shrink-0 w-4 h-4 rounded-full bg-emerald-500/30 shadow-card flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-emerald-300" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-emerald-300 text-sm font-medium">No credit card required</span>
              </div>
            </div>
          </div>

          {/* Pro tip */}
          <div className="bg-surface-2/50 rounded-lg p-3.5 mb-5 shadow-card">
            <div className="flex items-start gap-2.5">
              <div className="flex-shrink-0 w-5 h-5 rounded-lg bg-gradient-to-br from-amber-400/30 to-orange-500/30 shadow-card flex items-center justify-center mt-0.5">
                <svg className="w-3 h-3 text-amber-300" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 100 2H4a1 1 0 01-1-1V4a1 1 0 011-1h7z" />
                </svg>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">
                <span className="font-semibold text-white">Pro Tip:</span> Upgrade to Pro for unlimited access to all features, including unlimited imports and analyses!
              </p>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="space-y-3">
            <Link
              to="/signup"
              className="block w-full px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-center transition-colors"
            >
              Create Free Account
              <span className="inline-block ml-2">→</span>
            </Link>

            <div className="text-center">
              <Link
                to="/login"
                className="text-gray-500 hover:text-white text-sm transition-colors"
              >
                Already have an account? <span className="text-white font-semibold">Sign In</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom gradient accent */}
        <div className="h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
      </div>
    </div>
  )
}
