/**
 * Coach Dashboard Page
 * Professional hub for Coach Tal features.
 *
 * Stats come from two lightweight endpoints that are already cached (3 min):
 *   - usePuzzleStats  → puzzle rating, level, streak, solve counts
 *   - useDailyChallenge → remaining daily puzzles
 * No heavy analysis or progress fetches on this page.
 */

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useCoachUser } from '../../hooks/useCoachUser'
import { usePuzzleStats, useDailyChallenge } from '../../hooks/useCoachingData'
import { CoachPageGuard } from '../../components/coach/CoachPageGuard'
import {
  Monitor,
  ClipboardList,
  TrendingUp,
  Smile,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react'

export default function CoachDashboardPage() {
  const { authenticatedUserId, platformUsername, isLoading, profileLoaded } = useCoachUser()

  return (
    <CoachPageGuard isLoading={isLoading} authenticatedUserId={authenticatedUserId} platformUsername={platformUsername} profileLoaded={profileLoaded}>
      <CoachDashboardContent username={platformUsername} />
    </CoachPageGuard>
  )
}

interface CoachDashboardContentProps {
  username: string | null
}

const TAL_QUOTES = [
  'The best move is always the one that tears the position open.',
  'You must take your opponent into a deep dark forest where 2+2=5.',
  'There are two types of sacrifices: correct ones and mine.',
  'If you wait for luck to turn up, life becomes very boring.',
  "When I'm asked which move I prefer, I say the unexpected one.",
  'A knight on the rim may be grim, but a knight in the attack is a heart attack.',
  'Every pawn is a potential queen — never forget that.',
  'The initiative is worth more than material. Always.',
  'Complications are not to be feared, they are to be created.',
  "Your opponent's time is just as important a target as their king.",
  'A well-timed sacrifice reveals the truth of the position.',
  'Precision wins endgames, but courage wins chess games.',
  'The player who takes risks will make mistakes — the player who doesn\'t will make none, and win nothing.',
  'Attack first, calculate later — your intuition knows more than you think.',
  'In chess, as in life, the most dangerous opponent is the one who has nothing to lose.',
]

function CoachDashboardContent({ username }: CoachDashboardContentProps) {
  const { stats: puzzleStats } = usePuzzleStats()
  const { challenge: dailyChallenge } = useDailyChallenge()

  // Pick a quote that changes daily based on the date
  const dailyQuote = useMemo(() => {
    const dayIndex = Math.floor(Date.now() / 86_400_000)
    return TAL_QUOTES[dayIndex % TAL_QUOTES.length]
  }, [])

  const dailyRemaining = dailyChallenge
    ? dailyChallenge.puzzles.length - dailyChallenge.completed_ids.length
    : null

  return (
    <div className="min-h-screen bg-surface-base">
      <div className="max-w-3xl mx-auto px-4 md:px-6 pt-8 pb-12">
        {/* Welcome header */}
        <div className="mb-6">
          <h1 className="text-title font-semibold text-white tracking-tight">
            Coach Tal
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {username
              ? `Welcome back, ${username}. What would you like to work on?`
              : 'Your personal chess coach. Choose a focus area below.'}
          </p>
        </div>

        {/* Status bar */}
        <div
          className="rounded-lg p-4 mb-8 flex items-center justify-between"
          style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 2px 4px rgba(0,0,0,0.2)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#232428] flex items-center justify-center">
              <CoachIcon />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">Coach Tal is ready</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/60" />
              </div>
              <p className="text-xs text-gray-500 italic mt-0.5">
&quot;{dailyQuote}&quot;
              </p>
            </div>
          </div>
          <Link
            to="/coach/play"
            className="px-4 py-1.5 rounded-md bg-[#e4e8ed] text-[#0c0d0f] text-xs font-medium hover:bg-[#f0f2f5] transition-colors whitespace-nowrap"
          >
            Start Session
          </Link>
        </div>

        {/* Training Modes */}
        <p className="text-[11px] font-medium text-gray-500 tracking-widest uppercase mb-3">
          Training Modes
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TrainingCard
            to="/coach/review"
            icon={Monitor}
            title="Game Review"
            description="Analyze your recent games with Coach Tal. Get move-by-move feedback and identify patterns."
            badge={puzzleStats && puzzleStats.puzzles_correct > 0 ? `${puzzleStats.puzzles_correct} solved` : 'New'}
            badgeVariant="success"
            footerContent={<span className="text-gray-400">Review your mistakes</span>}
          />
          <TrainingCard
            to="/coach/puzzles"
            icon={ClipboardList}
            title="Puzzles"
            description="Tactical puzzles generated from your own games. Train your weakest patterns."
            badge={dailyRemaining !== null && dailyRemaining > 0 ? `${dailyRemaining} today` : undefined}
            footerContent={
              puzzleStats
                ? <span className="text-gray-400">Rating <span className="font-medium text-white">{Math.round(puzzleStats.rating)}</span></span>
                : undefined
            }
          />
          <TrainingCard
            to="/coach/progress"
            icon={TrendingUp}
            title="Progress"
            description="Track your rating trends, accuracy improvements, and milestone achievements."
            badge={puzzleStats ? `${Math.round(puzzleStats.solve_rate)}% rate` : undefined}
            footerContent={
              puzzleStats && puzzleStats.puzzles_attempted > 0
                ? <span className="text-gray-400">Solved <span className="font-medium text-emerald-400/80">{puzzleStats.puzzles_correct}</span> of {puzzleStats.puzzles_attempted} puzzles</span>
                : <span className="text-gray-400">No puzzles attempted yet</span>
            }
          />
          <TrainingCard
            to="/coach/play"
            icon={Smile}
            title="Play Tal"
            description="Play against Coach Tal's signature aggressive style and learn from the experience."
            badge={puzzleStats ? `Lvl ${puzzleStats.level}` : undefined}
            footerContent={
              puzzleStats
                ? <span className="text-gray-400">{puzzleStats.current_streak > 0 ? <>Streak <span className="font-medium text-white">{puzzleStats.current_streak}</span></> : <>Best streak <span className="font-medium text-white">{puzzleStats.best_streak}</span></>}</span>
                : undefined
            }
          />
        </div>
      </div>
    </div>
  )
}

interface TrainingCardProps {
  to: string
  icon: LucideIcon
  title: string
  description: string
  badge?: string
  badgeVariant?: 'success' | 'default'
  footerContent?: React.ReactNode
}

function TrainingCard({
  to,
  icon: Icon,
  title,
  description,
  badge,
  badgeVariant = 'default',
  footerContent,
}: TrainingCardProps) {
  const badgeClasses = badgeVariant === 'success'
    ? 'bg-emerald-500/15 text-emerald-300/80'
    : 'bg-white/[0.06] text-gray-400'

  return (
    <Link
      to={to}
      className="group rounded-lg p-5 flex flex-col justify-between transition-colors hover:bg-white/[0.04]"
      style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 2px 4px rgba(0,0,0,0.2)' }}
    >
      {/* Top row: icon + badge */}
      <div>
        <div className="flex items-start justify-between mb-4">
          <div className="w-9 h-9 rounded-lg bg-[#232428] flex items-center justify-center">
            <Icon className="w-4 h-4 text-gray-400" />
          </div>
          {badge && (
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${badgeClasses}`}>
              {badge}
            </span>
          )}
        </div>

        {/* Title + description */}
        <h2 className="text-[15px] font-medium text-white mb-1.5">{title}</h2>
        <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
      </div>

      {/* Footer */}
      {footerContent && (
        <div className="flex items-center justify-between mt-5 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
          <span className="text-xs">{footerContent}</span>
          <ArrowRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400 transition-colors" />
        </div>
      )}
    </Link>
  )
}

function CoachIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 2C11 2 10 3 10 4C10 4.5 10.2 5 10.5 5.3C9 5.9 8 7.3 8 9C8 9 6 9.5 6 12C6 14 7 15 8 15.5V18H16V15.5C17 15 18 14 18 12C18 9.5 16 9 16 9C16 7.3 15 5.9 13.5 5.3C13.8 5 14 4.5 14 4C14 3 13 2 12 2ZM9 18.5V20C9 21.1 9.9 22 11 22H13C14.1 22 15 21.1 15 20V18.5H9Z"
        fill="#9ca3af"
      />
    </svg>
  )
}
