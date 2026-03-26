import { Link } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { useAuth } from '../contexts/AuthContext'
import { Download, Search, RefreshCw, Sparkles, Lightbulb, Crown, BarChart3, Rocket, Zap, Star, X } from 'lucide-react'

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
        {/* Backdrop */}
        <div className="fixed inset-0 z-50 bg-[#0c0d0f]/90" onClick={onClose} />

        {/* Modal */}
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
          <div
            className="relative w-full max-w-sm bg-surface-1 rounded-lg shadow-card overflow-hidden transition-colors flex flex-col max-h-[90vh] pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
          {/* Header */}
          <div className="relative px-5 pt-5 pb-4 border-b border-white/[0.04] flex-shrink-0">
            <button
              onClick={onClose}
              className="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-surface-3/30"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

          <div className="text-center">
            <h2 className="text-2xl font-semibold text-white mb-2 leading-tight">
              Level Up Your Chess Game!
            </h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                You've reached your {actionText} limit. Create a <span className="text-[#e4e8ed] font-semibold">free account</span> to unlock more power!
              </p>
            </div>
          </div>

          {/* Content - Scrollable */}
          <div className="relative px-5 py-4 overflow-y-auto flex-1 min-h-0">
            {/* Benefits list */}
            <div className="mb-4">
              <h3 className="text-white font-semibold text-sm mb-3 text-center">
                What you'll get with a free account:
              </h3>

              <div className="space-y-2">
                {[
                  { text: '100 game imports per day', icon: Download },
                  { text: '5 game analyses per day', icon: Search },
                  { text: 'Games auto-import', icon: RefreshCw }
                ].map((feature, index) => (
                  <div key={index} className="flex items-center gap-2.5 text-gray-300">
                    <feature.icon className="w-4 h-4 flex-shrink-0 text-gray-400" />
                    <span className="text-xs">{feature.text}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-center gap-2 mt-3 pt-3 border-t border-white/[0.04]">
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
              className="block w-full px-5 py-3 bg-[#e4e8ed] hover:bg-[#f0f2f5] text-[#111] rounded-lg font-semibold text-center transition-colors text-sm"
              style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3)' }}
            >
                Create Free Account Now
              </Link>
              <div className="text-center">
                <Link
                  to="/login"
                  onClick={onClose}
                  className="text-gray-500 hover:text-gray-400 text-xs transition-colors"
                >
                  Already have an account? <span className="text-white font-semibold">Sign In</span>
                </Link>
              </div>
              <p className="text-center text-xs text-gray-500 flex items-center justify-center gap-1">
                <Lightbulb className="w-3 h-3" /> Upgrade to Pro later for unlimited {actionNoun}
              </p>
            </div>
          </div>
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
      <div className="fixed inset-0 z-50 bg-[#0c0d0f]/90" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="relative w-full max-w-sm bg-surface-1 rounded-lg shadow-card overflow-hidden transition-colors flex flex-col max-h-[90vh] pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >

        {/* Header */}
        <div className="relative px-5 pt-5 pb-4 border-b border-white/[0.04] flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-surface-3/30"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="text-center">
            <h2 className="text-2xl font-semibold text-white mb-2 leading-tight">
              Unlock Unlimited Power!
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              You've used all your free {actionNoun} for today. Upgrade to <span className="text-[#e4e8ed] font-semibold">Pro</span> for unlimited access!
            </p>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="relative px-5 py-4 overflow-y-auto flex-1 min-h-0">
          {/* Comparison */}
          <div className="mb-4">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center">
                <BarChart3 className="w-6 h-6 mx-auto mb-1.5 text-gray-400" />
                <div className="text-gray-500 text-xs mb-1">Current (Free)</div>
                <div className="text-rose-400 font-semibold text-lg">
                  {usageStats?.[limitType === 'import' ? 'imports' : 'analyses']?.used || 0} / {usageStats?.[limitType === 'import' ? 'imports' : 'analyses']?.limit || 0}
                </div>
              </div>
              <div className="text-center">
                <Rocket className="w-6 h-6 mx-auto mb-1.5 text-gray-400" />
                <div className="text-gray-500 text-xs mb-1">With Pro</div>
                <div className="text-emerald-400 font-semibold text-lg">∞</div>
              </div>
            </div>
          </div>

          {/* Pro features list */}
          <div className="mb-4">
            <h3 className="text-white font-semibold text-sm mb-3 text-center flex items-center justify-center gap-1.5">
              <Star className="w-4 h-4 text-gray-400" /> Pro Features
            </h3>

            <div className="space-y-2">
              {[
                { text: 'Unlimited imports', icon: Download },
                { text: 'Unlimited analyses', icon: Search },
                { text: 'Priority processing', icon: Zap }
              ].map((feature, index) => (
                <div key={index} className="flex items-center gap-2.5 text-gray-300">
                  <feature.icon className="w-4 h-4 flex-shrink-0 text-gray-400" />
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
              className="flex items-center justify-center gap-2 w-full px-5 py-3 bg-[#e4e8ed] hover:bg-[#f0f2f5] text-[#111] rounded-lg font-semibold text-center transition-colors text-sm"
              style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3)' }}
            >
              <Crown className="w-4 h-4" /> Upgrade to Pro Now
            </Link>
            <div className="text-center">
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-400 text-xs font-medium transition-colors"
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
        </div>
      </div>
    </>,
    document.body
  )
}
