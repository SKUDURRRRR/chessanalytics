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

  const title = limitType === 'import'
    ? 'Import Limit Reached'
    : 'Analysis Limit Reached'

  const message = limitType === 'import'
    ? 'You\'ve reached your guest limit of 100 imports per 24 hours.'
    : 'You\'ve reached your guest limit of 5 analyses per 24 hours.'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="max-w-md rounded-xl bg-slate-800 p-6 shadow-2xl border border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-2xl font-bold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition"
            aria-label="Close"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="mb-4 text-slate-300">{message}</p>

        <div className="mb-6 rounded-lg bg-gradient-to-br from-sky-500/10 to-blue-500/10 border border-sky-400/30 p-4">
          <h3 className="mb-3 font-semibold text-sky-200 flex items-center gap-2">
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
              <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
            </svg>
            Create a free account to get:
          </h3>
          <ul className="space-y-2 text-sm text-slate-300">
            <li className="flex items-center gap-2">
              <svg className="h-4 w-4 text-emerald-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span><strong>100 imports</strong> per 24 hours</span>
            </li>
            <li className="flex items-center gap-2">
              <svg className="h-4 w-4 text-emerald-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span><strong>5 analyses</strong> per 24 hours</span>
            </li>
            <li className="flex items-center gap-2">
              <svg className="h-4 w-4 text-emerald-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>Auto-sync your latest games</span>
            </li>
            <li className="flex items-center gap-2">
              <svg className="h-4 w-4 text-emerald-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>Save your analysis history</span>
            </li>
            <li className="flex items-center gap-2 text-emerald-300 font-medium">
              <svg className="h-4 w-4 text-emerald-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>No credit card required</span>
            </li>
          </ul>
        </div>

        <div className="flex gap-3">
          <Link
            to="/signup"
            className="flex-1 rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-3 text-center font-semibold text-white hover:from-sky-600 hover:to-blue-700 transition shadow-lg"
          >
            Sign Up Free
          </Link>
          <Link
            to="/login"
            className="flex-1 rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-3 text-center font-semibold text-slate-200 hover:bg-slate-700 hover:border-slate-500 transition"
          >
            Log In
          </Link>
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full text-sm text-slate-400 hover:text-slate-300 transition"
        >
          Maybe later
        </button>
      </div>
    </div>
  )
}
