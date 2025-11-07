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
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" />

      {/* Modal */}
      <div
        className="relative w-full max-w-3xl bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/30 overflow-hidden transform transition-all"
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: '0 0 0 1px rgba(71, 85, 105, 0.2), 0 20px 40px -10px rgba(0, 0, 0, 0.5), 0 0 120px -40px rgba(56, 189, 248, 0.15)'
        }}
      >
        {/* Decorative gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-pink-500/5 pointer-events-none" />

        {/* Header */}
        <div className="relative px-8 pt-8 pb-6 border-b border-slate-700/30">
          <div className="absolute top-6 right-6">
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-700/30"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="text-center">
            {/* Chess piece icon */}
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20 border border-blue-500/20 mb-4">
              <span className="text-3xl">♟</span>
            </div>
            <h2 className="text-3xl font-bold text-white mb-3 leading-tight">
              Unlock Your Chess Potential
            </h2>
            <p className="text-slate-300 text-base leading-relaxed max-w-2xl mx-auto">
              Get Stockfish-powered analysis, personalized insights, and Tal-style commentary to elevate your game
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-8">
          <div className="max-w-2xl mx-auto">
            {/* Intro text */}
            <p className="text-slate-300 text-[15px] leading-relaxed mb-8 text-center">
              Create a free account to unlock powerful analytics and continue improving your chess game.
            </p>

            {/* Features card */}
            <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-6 mb-6 border border-slate-700/30">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center flex-shrink-0 border border-blue-500/20">
                  <svg className="w-4 h-4 text-blue-300" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                    <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-white font-semibold text-lg">
                  Free Account Features
                </h3>
              </div>

              <div className="space-y-3.5">
                {[
                  '50 game imports per day',
                  '2 game analyses per day',
                  'Full access to chess analytics',
                  'Opening repertoire analysis',
                  'Personality insights & playstyle analysis'
                ].map((feature, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                      <svg className="w-3 h-3 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-slate-300 text-sm leading-relaxed">{feature}</span>
                  </div>
                ))}

                <div className="flex items-center gap-3 pt-2 mt-3 border-t border-slate-700/30">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500/30 border border-emerald-500/40 flex items-center justify-center">
                    <svg className="w-3 h-3 text-emerald-300" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-emerald-300 text-sm font-medium">No credit card required</span>
                </div>
              </div>
            </div>

            {/* Pro tip */}
            <div className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-xl p-4 mb-8 border border-blue-500/20">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-lg bg-gradient-to-br from-amber-400/30 to-orange-500/30 border border-amber-400/20 flex items-center justify-center mt-0.5">
                  <svg className="w-3.5 h-3.5 text-amber-300" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 100 2H4a1 1 0 01-1-1V4a1 1 0 011-1h7z" />
                  </svg>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed">
                  <span className="font-semibold text-white">Pro Tip:</span> Upgrade to Pro for unlimited access to all features, including unlimited imports and analyses!
                </p>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="space-y-4">
              <Link
                to="/signup"
                className="block w-full px-6 py-4 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-500 hover:via-purple-500 hover:to-pink-500 text-white rounded-xl font-semibold text-center transition-all duration-300 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Create Free Account
                <span className="inline-block ml-2">→</span>
              </Link>

              <div className="text-center">
                <Link
                  to="/login"
                  className="text-slate-400 hover:text-white text-sm transition-colors"
                >
                  Already have an account? <span className="text-white font-semibold">Sign In</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
