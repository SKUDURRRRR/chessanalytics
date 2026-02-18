/**
 * Puzzles Page - Puzzle Trainer with rating, daily challenges, and gamification
 */

import { useNavigate, Link } from 'react-router-dom'
import { usePuzzles, useDailyChallenge, usePuzzleStats } from '../../hooks/useCoachingData'
import { useDailyPuzzle } from '../../hooks/useCoachingData'
import LoadingModal from '../../components/LoadingModal'
import { useAuth } from '../../contexts/AuthContext'
import { useCoachUser } from '../../hooks/useCoachUser'
import type { BankPuzzle, PuzzleStats } from '../../types'

export default function PuzzlesPage() {
  const { usageStats } = useAuth()
  const { platform, platformUsername, authenticatedUserId } = useCoachUser()

  if (!authenticatedUserId) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400">Please log in to access puzzles</p>
      </div>
    )
  }

  return (
    <>
      <PuzzlesPageContent
        userId={platformUsername}
        platform={platform}
        authUserId={authenticatedUserId}
        hasLinkedAccount={!!platformUsername}
      />
    </>
  )
}

// Theme display names
const THEME_LABELS: Record<string, string> = {
  fork: 'Fork',
  pin: 'Pin',
  skewer: 'Skewer',
  discoveredAttack: 'Discovery',
  doubleCheck: 'Double Check',
  mate: 'Checkmate',
  mateIn1: 'Mate in 1',
  mateIn2: 'Mate in 2',
  mateIn3: 'Mate in 3',
  sacrifice: 'Sacrifice',
  deflection: 'Deflection',
  backRankMate: 'Back Rank',
  hangingPiece: 'Hanging Piece',
  trappedPiece: 'Trapped Piece',
  crushing: 'Crushing',
  advantage: 'Advantage',
  endgame: 'Endgame',
  middlegame: 'Middlegame',
  short: 'Short',
  long: 'Long',
}

function PuzzlesPageContent({
  userId,
  platform,
  authUserId,
  hasLinkedAccount,
}: {
  userId: string
  platform: 'lichess' | 'chess.com'
  authUserId: string
  hasLinkedAccount: boolean
}) {
  const navigate = useNavigate()
  const { stats, loading: statsLoading } = usePuzzleStats()
  const { challenge, loading: challengeLoading, refetch: refetchChallenge } = useDailyChallenge()
  const { puzzleSet, loading: puzzlesLoading } = usePuzzles(userId, platform)

  const loading = statsLoading || challengeLoading

  if (loading) {
    return <LoadingModal isOpen={true} message="Loading puzzle trainer..." />
  }

  const completedCount = challenge?.completed_ids?.length ?? 0
  const totalChallenge = challenge?.puzzles?.length ?? 5

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header with Stats */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold text-white mb-1">Puzzle Trainer</h1>
              <p className="text-slate-400">Solve tactical puzzles to sharpen your skills</p>
            </div>
            {stats && <StatsHeader stats={stats} />}
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Daily Challenge Card */}
          <DailyChallengeCard
            challenge={challenge}
            completedCount={completedCount}
            totalChallenge={totalChallenge}
            onStartPuzzle={(puzzle) =>
              navigate('/coach/puzzles/solve', {
                state: {
                  mode: 'bank',
                  bankPuzzle: puzzle,
                  dailyChallengeId: challenge?.challenge_date,
                },
              })
            }
          />

          {/* Quick Play Card */}
          <QuickPlayCard
            onStart={(theme) =>
              navigate('/coach/puzzles/solve', {
                state: { mode: 'bank', theme },
              })
            }
          />
        </div>

        {/* Rating Trend */}
        {stats && stats.rating_history.length > 1 && (
          <div className="mb-8">
            <RatingTrend history={stats.rating_history} />
          </div>
        )}

        {/* Theme Performance */}
        {stats && Object.keys(stats.theme_performance).length > 0 && (
          <div className="mb-8">
            <ThemePerformance performance={stats.theme_performance} />
          </div>
        )}

        {/* Personalized Puzzles from Games */}
        {hasLinkedAccount && !puzzlesLoading && puzzleSet && puzzleSet.total > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">From Your Games</h2>
            <p className="text-slate-400 text-sm mb-4">
              Puzzles generated from your actual game mistakes
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(puzzleSet.categorized).map(([category, puzzles]) => {
                if (puzzles.length === 0) return null
                return (
                  <div
                    key={category}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 hover:bg-white/[0.08] transition-colors"
                  >
                    <h3 className="text-lg font-semibold text-white mb-1 capitalize">{category}</h3>
                    <p className="text-slate-400 text-sm mb-3">{puzzles.length} puzzles</p>
                    <button
                      onClick={() =>
                        navigate('/coach/puzzles/solve', { state: { puzzles, category } })
                      }
                      className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2 px-4 rounded-xl transition-colors text-sm"
                    >
                      Practice
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Connect account prompt if no linked account */}
        {!hasLinkedAccount && (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-4">Connect your chess account</h2>
            <p className="text-slate-300 mb-6">
              Link your Chess.com or Lichess account to get personalized puzzles from your game mistakes.
            </p>
            <Link
              to="/profile"
              className="inline-block bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
            >
              Go to Profile to Connect
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

/** Stats header showing rating, XP, level, and streak */
function StatsHeader({ stats }: { stats: PuzzleStats }) {
  const xpInLevel = stats.xp - getXpForLevel(stats.level)
  const xpNeeded = stats.xp_to_next_level
  const xpProgress = xpNeeded > 0 ? Math.min(100, (xpInLevel / (xpInLevel + xpNeeded)) * 100) : 100

  return (
    <div className="flex items-center gap-4 flex-wrap">
      {/* Rating Badge */}
      <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-2xl px-4 py-2">
        <span className="text-amber-400 text-sm font-medium">Rating</span>
        <span className="text-2xl font-bold text-amber-300">{stats.rating}</span>
      </div>

      {/* Level & XP */}
      <div className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/30 rounded-2xl px-4 py-2">
        <span className="text-purple-400 text-sm font-medium">Lvl {stats.level}</span>
        <div className="w-20 h-2 bg-purple-900/50 rounded-full overflow-hidden">
          <div
            className="h-full bg-purple-400 rounded-full transition-all"
            style={{ width: `${xpProgress}%` }}
          />
        </div>
        <span className="text-purple-300 text-xs">{stats.xp} XP</span>
      </div>

      {/* Streak */}
      {stats.current_streak > 0 && (
        <div className="flex items-center gap-1 bg-orange-500/10 border border-orange-500/30 rounded-2xl px-4 py-2">
          <span className="text-orange-400 text-lg">&#x1F525;</span>
          <span className="text-orange-300 font-bold">{stats.current_streak}</span>
          <span className="text-orange-400 text-sm">day streak</span>
        </div>
      )}

      {/* Solve Rate */}
      <div className="flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl px-4 py-2">
        <span className="text-cyan-400 text-sm font-medium">Solved</span>
        <span className="text-cyan-300 font-bold">{stats.solve_rate}%</span>
      </div>
    </div>
  )
}

/** Daily Challenge card */
function DailyChallengeCard({
  challenge,
  completedCount,
  totalChallenge,
  onStartPuzzle,
}: {
  challenge: ReturnType<typeof useDailyChallenge>['challenge']
  completedCount: number
  totalChallenge: number
  onStartPuzzle: (puzzle: BankPuzzle) => void
}) {
  const allCompleted = completedCount >= totalChallenge && totalChallenge > 0

  // Find the next uncompleted puzzle
  const nextPuzzle = challenge?.puzzles?.find(
    (p) => !challenge.completed_ids.includes(p.puzzle_id)
  )

  return (
    <div
      className={`rounded-3xl border p-6 ${
        allCompleted
          ? 'border-emerald-500/50 bg-gradient-to-br from-emerald-500/10 to-green-500/10'
          : 'border-cyan-500/50 bg-gradient-to-br from-cyan-500/10 to-blue-500/10'
      }`}
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">{allCompleted ? '\u2705' : '\u2B50'}</span>
        <h2 className="text-xl font-bold text-white">Daily Challenge</h2>
        <span className="ml-auto text-xs text-slate-400 bg-white/10 px-2 py-1 rounded-lg">
          FREE
        </span>
      </div>

      {/* Progress dots */}
      <div className="flex items-center gap-2 mb-4">
        {Array.from({ length: totalChallenge }).map((_, i) => (
          <div
            key={i}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
              i < completedCount
                ? 'bg-emerald-500 text-white'
                : i === completedCount
                  ? 'bg-cyan-500/30 border-2 border-cyan-400 text-cyan-300'
                  : 'bg-white/10 text-slate-500'
            }`}
          >
            {i < completedCount ? '\u2713' : i + 1}
          </div>
        ))}
        <span className="ml-2 text-slate-300 text-sm font-medium">
          {completedCount}/{totalChallenge}
        </span>
      </div>

      {allCompleted ? (
        <div className="text-emerald-300 font-medium">
          All done for today! Come back tomorrow for more.
          {challenge?.total_xp ? (
            <span className="ml-2 text-emerald-400">+{challenge.total_xp} XP earned</span>
          ) : null}
        </div>
      ) : nextPuzzle ? (
        <div>
          <p className="text-slate-300 text-sm mb-3">
            Puzzle {completedCount + 1} of {totalChallenge} &middot; Rating ~{nextPuzzle.rating} &middot;{' '}
            {nextPuzzle.total_moves} move{nextPuzzle.total_moves > 1 ? 's' : ''}
          </p>
          <button
            onClick={() => onStartPuzzle(nextPuzzle)}
            className="bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-2.5 px-6 rounded-xl transition-colors"
          >
            {completedCount > 0 ? 'Continue Challenge' : 'Start Challenge'}
          </button>
        </div>
      ) : (
        <p className="text-slate-400 text-sm">Loading challenge puzzles...</p>
      )}
    </div>
  )
}

/** Quick Play card for rated puzzles */
function QuickPlayCard({ onStart }: { onStart: (theme?: string) => void }) {
  const themes = ['fork', 'pin', 'mate', 'sacrifice', 'discoveredAttack', 'backRankMate', 'endgame', 'hanging']

  return (
    <div className="rounded-3xl border border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-indigo-500/10 p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">&#x26A1;</span>
        <h2 className="text-xl font-bold text-white">Quick Play</h2>
      </div>
      <p className="text-slate-300 text-sm mb-4">
        Solve rated puzzles matched to your skill level.
      </p>

      <button
        onClick={() => onStart()}
        className="w-full bg-purple-500 hover:bg-purple-600 text-white font-semibold py-2.5 px-6 rounded-xl transition-colors mb-4"
      >
        Start Rated Puzzle
      </button>

      <div className="flex flex-wrap gap-2">
        {themes.map((theme) => (
          <button
            key={theme}
            onClick={() => onStart(theme)}
            className="text-xs bg-white/10 hover:bg-white/20 text-slate-300 px-3 py-1.5 rounded-lg transition-colors capitalize"
          >
            {THEME_LABELS[theme] || theme}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Simple rating trend sparkline */
function RatingTrend({ history }: { history: Array<{ date: string; rating: number }> }) {
  if (history.length < 2) return null

  const ratings = history.map((h) => h.rating)
  const min = Math.min(...ratings)
  const max = Math.max(...ratings)
  const range = max - min || 1

  const first = ratings[0]
  const last = ratings[ratings.length - 1]
  const diff = last - first
  const isUp = diff >= 0

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white">Rating Trend</h2>
        <span className={`text-sm font-bold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
          {isUp ? '+' : ''}{diff} pts
        </span>
      </div>
      <div className="flex items-end gap-1 h-16">
        {ratings.map((r, i) => {
          const height = ((r - min) / range) * 100
          return (
            <div
              key={i}
              className={`flex-1 rounded-t transition-all ${
                isUp ? 'bg-emerald-500/60' : 'bg-red-500/60'
              }`}
              style={{ height: `${Math.max(4, height)}%` }}
              title={`${history[i].date}: ${r}`}
            />
          )
        })}
      </div>
      <div className="flex justify-between mt-2 text-xs text-slate-500">
        <span>{history[0].date}</span>
        <span>{history[history.length - 1].date}</span>
      </div>
    </div>
  )
}

/** Theme performance grid */
function ThemePerformance({
  performance,
}: {
  performance: Record<string, { attempted: number; correct: number }>
}) {
  const themes = Object.entries(performance)
    .filter(([, data]) => data.attempted >= 2)
    .sort((a, b) => b[1].attempted - a[1].attempted)
    .slice(0, 8)

  if (themes.length === 0) return null

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
      <h2 className="text-lg font-bold text-white mb-4">Theme Performance</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {themes.map(([theme, data]) => {
          const rate = Math.round((data.correct / data.attempted) * 100)
          const color =
            rate >= 75 ? 'emerald' : rate >= 50 ? 'amber' : 'red'
          return (
            <div
              key={theme}
              className="rounded-xl bg-white/[0.04] border border-white/10 p-3"
            >
              <p className="text-slate-300 text-sm capitalize mb-1">
                {THEME_LABELS[theme] || theme}
              </p>
              <div className="flex items-baseline gap-1">
                <span
                  className={`text-xl font-bold ${
                    color === 'emerald'
                      ? 'text-emerald-400'
                      : color === 'amber'
                        ? 'text-amber-400'
                        : 'text-red-400'
                  }`}
                >
                  {rate}%
                </span>
                <span className="text-slate-500 text-xs">
                  ({data.correct}/{data.attempted})
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Calculate XP needed for a level (matches backend logic) */
function getXpForLevel(level: number): number {
  if (level <= 1) return 0
  let base = (level - 1) * 100
  if (level > 10) base += (level - 10) * 50
  return base
}
