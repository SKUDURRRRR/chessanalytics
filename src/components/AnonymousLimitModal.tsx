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
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

      {/* Modal */}
      <div
        className="relative w-full max-w-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with icon */}
        <div className="relative px-8 pt-8 pb-6">
          <div className="absolute top-4 right-4">
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-700/50"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="text-center mb-6">
            <h2 className="text-3xl font-bold text-white mb-2 leading-tight">
              Your edge for improvement
            </h2>
            <p className="text-slate-300 text-base leading-relaxed">
              Tal coach commentary, Stockfish-powered analysis, and personalized insights to improve your game
            </p>
          </div>
        </div>

        {/* Content - Two Column Layout */}
        <div className="px-8 pb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column - Placeholder/Image Area */}
            <div className="hidden md:block bg-slate-800/30 rounded-xl border border-slate-700/50 min-h-[400px]">
              {/* Placeholder for image/video content */}
            </div>

            {/* Right Column - Main Content */}
            <div className="flex flex-col">
              {/* Intro text */}
              <p className="text-slate-300 text-[15px] leading-relaxed mb-6 text-left">
                Create a free account to unlock more features and continue improving your chess game.
              </p>

              {/* Features card */}
              <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-5 mb-5 border border-slate-700/50">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  </div>
                  <h3 className="text-white font-semibold text-base">
                    Free Account Includes
                  </h3>
                </div>

                <div className="space-y-3">
                  {[
                    '50 game imports per day',
                    '2 game analyses per day',
                    'Full access to chess analytics',
                    'Opening repertoire analysis',
                    'Personality insights & playstyle analysis'
                  ].map((feature, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <svg className="w-3 h-3 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="text-slate-300 text-sm leading-relaxed">{feature}</span>
                    </div>
                  ))}

                  <div className="flex items-center gap-3 pt-1">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500/30 flex items-center justify-center">
                      <svg className="w-3 h-3 text-emerald-300" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-emerald-300 text-sm font-medium">No credit card required</span>
                  </div>
                </div>
              </div>

              {/* Pro tip */}
              <div className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-xl p-4 mb-6 border border-blue-500/20">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mt-0.5">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 100 2H4a1 1 0 01-1-1V4a1 1 0 011-1h7z" />
                    </svg>
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed">
                    <span className="font-semibold text-white">Pro Tip:</span> Upgrade to Pro for unlimited access to all features, including unlimited imports and analyses!
                  </p>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="space-y-3">
                <Link
                  to="/signup"
                  className="block w-full px-6 py-3.5 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-500 hover:via-purple-500 hover:to-pink-500 text-white rounded-xl font-semibold text-center transition-all duration-300 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  Create Free Account
                  <span className="inline-block ml-2">→</span>
                </Link>

                <div className="text-center">
                  <Link
                    to="/login"
                    className="text-slate-300 hover:text-white text-sm transition-colors"
                  >
                    Already have an account? <span className="text-white font-semibold">Sign In</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
