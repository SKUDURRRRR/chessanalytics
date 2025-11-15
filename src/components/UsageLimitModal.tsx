interface UsageLimitModalProps {
  isOpen: boolean
  onClose: () => void
  limitType: 'import' | 'analyze'
  isAuthenticated: boolean
  currentUsage?: {
    used: number
    limit: number | null
    remaining?: number | null
    unlimited?: boolean
  }
}

export default function UsageLimitModal({
  isOpen,
  onClose,
  limitType,
  isAuthenticated,
  currentUsage
}: UsageLimitModalProps) {
  // Modal disabled - always return null
  return null

  const actionText = limitType === 'import' ? 'import' : 'analyze'
  const actionPastTense = limitType === 'import' ? 'imports' : 'analyses'
  const usagePercentage = currentUsage?.limit
    ? Math.min(100, ((currentUsage?.used || 0) / currentUsage.limit) * 100)
    : 0

  // Calculate total games analyzed (for authenticated users)
  const analyzedGames = limitType === 'analyze' ? (currentUsage?.used || 0) : 0
  const totalGames = analyzedGames + 100 // Placeholder - would ideally come from API

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md" />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/30 overflow-hidden transform transition-all max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: '0 0 0 1px rgba(71, 85, 105, 0.2), 0 20px 40px -10px rgba(0, 0, 0, 0.5), 0 0 120px -40px rgba(56, 189, 248, 0.15)'
        }}
      >
        {/* Decorative gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-pink-500/5 pointer-events-none" />

        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 border-b border-slate-700/30">
          <div className="absolute top-4 right-4">
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
            {/* Analysis icon */}
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-blue-500/20 border border-purple-500/20 mb-3">
              <svg className="w-6 h-6 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13l8 0M3 6l8 0M3 20l8 0M13 6l8 0M13 13l8 0M13 20l8 0" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2 leading-tight">
              {isAuthenticated ? 'Unlock Complete Analysis' : 'Ready to Level Up?'}
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              {isAuthenticated
                ? `You've analyzed ${analyzedGames} games. Upgrade to unlock insights from your entire game history.`
                : 'Sign up to continue your chess journey with powerful analytics'}
            </p>
          </div>
        </div>

        <div className="px-6 py-5">
          {isAuthenticated ? (
            <>
              {/* Comparison Section */}
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-5 mb-4 border border-slate-700/30">
                <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-700/30">
                  <span className="text-slate-300 text-sm font-medium">Current Analysis:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-rose-400 font-bold text-sm">{analyzedGames} games</span>
                    <svg className="w-4 h-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 text-sm font-medium">With Pro:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 font-bold text-sm">ALL games!</span>
                    <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* What you're missing section */}
              <div className="mb-5">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500/30 to-pink-500/30 border border-purple-500/20 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-purple-300" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <h3 className="text-white font-semibold text-base">
                    What you're missing:
                  </h3>
                </div>

                <div className="space-y-2.5">
                  {[
                    `Complete game history analysis (${totalGames}+ games)`,
                    'Deep pattern recognition across ALL your games',
                    'Track your true improvement over time'
                  ].map((feature, index) => (
                    <div key={index} className="flex items-start gap-2.5">
                      <div className="flex-shrink-0 w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mt-0.5">
                        <svg className="w-2.5 h-2.5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="text-slate-300 text-sm leading-relaxed">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA buttons */}
              <div className="space-y-3">
                <a
                  href="/pricing"
                  className="flex items-center justify-center gap-2 w-full px-6 py-3.5 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-500 hover:via-purple-500 hover:to-pink-500 text-white rounded-xl font-semibold text-center transition-all duration-300 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  <svg className="w-5 h-5 text-yellow-300" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  Upgrade Now - See All Your Games!
                </a>
                <div className="text-center">
                  <button
                    onClick={onClose}
                    className="text-slate-400 hover:text-white text-sm font-medium transition-colors"
                  >
                    Maybe later
                  </button>
                </div>
                <p className="text-center text-xs text-slate-500">
                  7-day free trial available
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Value proposition for anonymous users */}
              <div className="mb-5">
                <p className="text-slate-300 text-sm leading-relaxed mb-5 text-center">
                  You've hit the free limit! Create a free account to unlock more features and continue improving your chess game.
                </p>

                <div className="bg-slate-800/40 backdrop-blur-sm rounded-xl p-5 mb-4 border border-slate-700/30">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500/30 to-purple-500/30 flex items-center justify-center flex-shrink-0 border border-blue-500/20">
                      <svg className="w-3.5 h-3.5 text-blue-300" fill="currentColor" viewBox="0 0 20 20">
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
                      '100 game imports per day',
                      '5 game analyses per day',
                      'Full access to chess analytics',
                      'Opening repertoire analysis',
                      'Personality insights & playstyle analysis'
                    ].map((feature, index) => (
                      <div key={index} className="flex items-center gap-2.5">
                        <div className="flex-shrink-0 w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <span className="text-slate-300 text-sm leading-relaxed">{feature}</span>
                      </div>
                    ))}

                    <div className="flex items-center gap-2.5 pt-2 mt-2 border-t border-slate-700/30">
                      <div className="flex-shrink-0 w-4 h-4 rounded-full bg-emerald-500/30 border border-emerald-500/40 flex items-center justify-center">
                        <svg className="w-2.5 h-2.5 text-emerald-300" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="text-emerald-300 text-sm font-medium">No credit card required</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-xl p-3.5 mb-5 border border-blue-500/20">
                  <div className="flex items-start gap-2.5">
                    <div className="flex-shrink-0 w-5 h-5 rounded-lg bg-gradient-to-br from-amber-400/30 to-orange-500/30 border border-amber-400/20 flex items-center justify-center mt-0.5">
                      <svg className="w-3 h-3 text-amber-300" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 100 2H4a1 1 0 01-1-1V4a1 1 0 011-1h7z" />
                      </svg>
                    </div>
                    <p className="text-slate-300 text-sm leading-relaxed">
                      <span className="font-semibold text-white">Pro Tip:</span> Upgrade to Pro for unlimited access to all features, including unlimited imports and analyses!
                    </p>
                  </div>
                </div>
              </div>

              {/* CTA buttons */}
              <div className="space-y-3">
                <a
                  href="/signup"
                  className="block w-full px-6 py-3.5 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-500 hover:via-purple-500 hover:to-pink-500 text-white rounded-xl font-semibold text-center transition-all duration-300 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  Create Free Account
                  <span className="inline-block ml-2">→</span>
                </a>
                <div className="text-center">
                  <a
                    href="/login"
                    className="text-slate-400 hover:text-white text-sm transition-colors"
                  >
                    Already have an account? <span className="text-white font-semibold">Sign In</span>
                  </a>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
