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
  if (!isOpen) return null

  const actionText = limitType === 'import' ? 'import' : 'analyze'
  const actionPastTense = limitType === 'import' ? 'imports' : 'analyses'

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-md w-full p-6">
        <h2 className="text-2xl font-bold text-white mb-4">
          {isAuthenticated ? 'Limit Reached' : 'Sign Up to Continue'}
        </h2>

        {isAuthenticated ? (
          <>
            <p className="text-slate-300 mb-4">
              {currentUsage?.unlimited
                ? `You've used ${currentUsage?.used ?? 0} ${actionPastTense} today. Your plan is unlimited.`
                : `You've used ${currentUsage?.used || 0} of your ${currentUsage?.limit || 0} daily ${actionPastTense}.`
              }
            </p>
            <p className="text-slate-300 mb-6">
              Upgrade to Pro for unlimited access to all features, or wait for your limits to reset.
            </p>
            <div className="flex flex-col gap-3">
              <a
                href="/pricing"
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold text-center"
              >
                Upgrade to Pro
              </a>
              <button
                onClick={onClose}
                className="w-full px-4 py-3 bg-slate-700 text-white rounded-md hover:bg-slate-600"
              >
                Maybe Later
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-slate-300 mb-4">
              Create a free account to {actionText} up to:
            </p>
            <ul className="list-disc list-inside text-slate-300 mb-6 space-y-2">
              <li>100 game imports per day</li>
              <li>5 game analyses per day</li>
              <li>Full access to chess analytics</li>
              <li>Opening analysis & personality scores</li>
            </ul>
            <div className="flex flex-col gap-3">
              <a
                href="/signup"
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold text-center"
              >
                Sign Up for Free
              </a>
              <a
                href="/login"
                className="w-full px-4 py-3 bg-slate-700 text-white rounded-md hover:bg-slate-600 text-center"
              >
                Already have an account? Login
              </a>
              <button
                onClick={onClose}
                className="w-full px-4 py-2 text-slate-400 hover:text-white text-sm"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
