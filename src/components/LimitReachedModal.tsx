import { Link } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { useAuth } from '../contexts/AuthContext'

interface LimitReachedModalProps {
  isOpen: boolean
  onClose: () => void
  limitType: 'import' | 'analyze'
}

export default function LimitReachedModal({
  isOpen,
  onClose,
  limitType
}: LimitReachedModalProps) {
  const { user, usageStats } = useAuth()
  const isGuest = !user
  // Free user: authenticated but not pro/enterprise (or account_tier is 'free' or undefined)
  const isFreeUser = user && (usageStats?.account_tier === 'free' || !usageStats?.account_tier || (usageStats?.account_tier !== 'pro' && usageStats?.account_tier !== 'enterprise'))

  if (!isOpen) return null

  const actionText = limitType === 'import' ? 'import' : 'analyze'
  const actionPastTense = limitType === 'import' ? 'imported' : 'analyzed'
  const actionNoun = limitType === 'import' ? 'imports' : 'analyses'

  // Guest user content
  if (isGuest) {
    return createPortal(
      <>
        {/* Backdrop with blur */}
        <div className="fixed inset-0 z-[9999] bg-slate-950/95 backdrop-blur-md" onClick={onClose} />

        {/* Modal */}
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none">
          <div
            className="relative w-full max-w-md bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden transform transition-all flex flex-col max-h-[90vh] pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
            style={{
              boxShadow: '0 0 0 1px rgba(71, 85, 105, 0.3), 0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 80px -40px rgba(251, 191, 36, 0.1)'
            }}
          >
          {/* Animated gradient overlay - reduced opacity */}
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-yellow-500/5 to-orange-500/5 pointer-events-none animate-pulse" />

          {/* Header */}
          <div className="relative px-5 pt-5 pb-4 border-b border-slate-700/50 flex-shrink-0">
            <button
              onClick={onClose}
              className="absolute top-3 right-3 text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-700/30"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-2 leading-tight bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-400 bg-clip-text text-transparent">
              Level Up Your Chess Game! 🚀
            </h2>
              <p className="text-slate-300 text-sm leading-relaxed">
                You've reached your {actionText} limit. Create a <span className="text-emerald-400 font-semibold">free account</span> to unlock more power!
              </p>
            </div>
          </div>

          {/* Content - Scrollable */}
          <div className="relative px-5 py-4 overflow-y-auto flex-1 min-h-0">
            {/* Benefits list - no gray boxes */}
            <div className="mb-4">
              <h3 className="text-white font-semibold text-sm mb-3 text-center">
                ✨ What you'll get with a free account:
              </h3>

              <div className="space-y-2">
                {[
                  { text: '100 game imports per day', icon: '📥' },
                  { text: '5 game analyses per day', icon: '🔍' },
                  { text: 'Games auto-import', icon: '🔄' }
                ].map((feature, index) => (
                  <div key={index} className="flex items-center gap-2.5 text-slate-200">
                    <span className="text-base flex-shrink-0">{feature.icon}</span>
                    <span className="text-xs">{feature.text}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-center gap-2 mt-3 pt-3 border-t border-slate-700/50">
                <svg className="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-emerald-400 text-xs font-semibold">No credit card required!</span>
              </div>
            </div>

            {/* CTA buttons */}
            <div className="space-y-2.5">
            <Link
              to="/signup"
              onClick={onClose}
              className="block w-full px-5 py-3 bg-gradient-to-r from-amber-600 via-yellow-600 to-orange-600 hover:from-amber-500 hover:via-yellow-500 hover:to-orange-500 text-white rounded-xl font-bold text-center transition-all duration-300 shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 transform hover:scale-[1.02] active:scale-[0.98] text-sm"
            >
                Create Free Account Now! 🎉
              </Link>
              <div className="text-center">
                <Link
                  to="/login"
                  onClick={onClose}
                  className="text-slate-400 hover:text-white text-xs transition-colors"
                >
                  Already have an account? <span className="text-white font-semibold">Sign In</span>
                </Link>
              </div>
              <p className="text-center text-xs text-slate-500">
                💡 Upgrade to Pro later for unlimited {actionNoun}
              </p>
            </div>
          </div>

          {/* Bottom gradient accent */}
          <div className="h-1.5 bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-500" />
          </div>
        </div>
      </>,
      document.body
    )
  }

  // Free registered user content - encourage Pro upgrade
  return createPortal(
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[9999] bg-slate-950/95 backdrop-blur-md" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="relative w-full max-w-md bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden transform transition-all flex flex-col max-h-[90vh] pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
          style={{
            boxShadow: '0 0 0 1px rgba(71, 85, 105, 0.3), 0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 80px -40px rgba(251, 191, 36, 0.1)'
          }}
        >
        {/* Animated gradient overlay - reduced opacity */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-yellow-500/5 to-orange-500/5 pointer-events-none animate-pulse" />

        {/* Header */}
        <div className="relative px-5 pt-5 pb-4 border-b border-slate-700/50 flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-slate-700/30"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="text-center">
            <h2 className="text-2xl font-bold text-white mb-2 leading-tight bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-400 bg-clip-text text-transparent">
              Unlock Unlimited Power! ⚡
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              You've used all your free {actionNoun} for today. Upgrade to <span className="text-amber-400 font-semibold">Pro</span> for unlimited access!
            </p>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="relative px-5 py-4 overflow-y-auto flex-1 min-h-0">
          {/* Comparison - no gray boxes */}
          <div className="mb-4">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl mb-1.5">📊</div>
                <div className="text-slate-400 text-xs mb-1">Current (Free)</div>
                <div className="text-rose-400 font-bold text-lg">
                  {usageStats?.[limitType === 'import' ? 'imports' : 'analyses']?.used || 0} / {usageStats?.[limitType === 'import' ? 'imports' : 'analyses']?.limit || 0}
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl mb-1.5">🚀</div>
                <div className="text-slate-400 text-xs mb-1">With Pro</div>
                <div className="text-emerald-400 font-bold text-lg">∞</div>
              </div>
            </div>
          </div>

          {/* Pro features list - no boxes */}
          <div className="mb-4">
            <h3 className="text-white font-semibold text-sm mb-3 text-center">
              ⭐ Pro Features
            </h3>

            <div className="space-y-2">
              {[
                { text: 'Unlimited imports', icon: '📥' },
                { text: 'Unlimited analyses', icon: '🔍' },
                { text: 'Priority processing', icon: '⚡' }
              ].map((feature, index) => (
                <div key={index} className="flex items-center gap-2.5 text-slate-200">
                  <span className="text-base flex-shrink-0">{feature.icon}</span>
                  <span className="text-xs">{feature.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA buttons */}
          <div className="space-y-2.5">
            <Link
              to="/pricing"
              onClick={onClose}
              className="block w-full px-5 py-3 bg-gradient-to-r from-amber-600 via-yellow-600 to-orange-600 hover:from-amber-500 hover:via-yellow-500 hover:to-orange-500 text-white rounded-xl font-bold text-center transition-all duration-300 shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 transform hover:scale-[1.02] active:scale-[0.98] text-sm"
            >
              Upgrade to Pro Now! 👑
            </Link>
            <div className="text-center">
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white text-xs font-medium transition-colors"
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>

        {/* Bottom gradient accent */}
        <div className="h-1.5 bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-500" />
        </div>
      </div>
    </>,
    document.body
  )
}
