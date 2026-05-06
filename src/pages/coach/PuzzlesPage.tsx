/**
 * Puzzles Page - Puzzle Trainer with rating, daily challenges, and gamification
 */

import { useNavigate, Link } from 'react-router-dom'
import { usePuzzles, useDailyChallenge, usePuzzleStats, useRecommendationProfile, useDailyPuzzle } from '../../hooks/useCoachingData'
import { useAuth } from '../../contexts/AuthContext'
import { useCoachUser } from '../../hooks/useCoachUser'
import { CoachPageGuard } from '../../components/coach/CoachPageGuard'
import { Star, Target, Zap, Flame, CheckCircle2 } from 'lucide-react'
import type { BankPuzzle, PuzzleStats, RecommendationProfile } from '../../types'

export default function PuzzlesPage() {
  const { usageStats } = useAuth()
  const { platform, platformUsername, authenticatedUserId, isLoading, profileLoaded } = useCoachUser()

  return (
    <CoachPageGuard isLoading={isLoading} authenticatedUserId={authenticatedUserId} platformUsername={platformUsername} profileLoaded={profileLoaded} requiresLinkedAccount={false}>
      <PuzzlesPageContent
        userId={platformUsername}
        platform={platform}
        authUserId={authenticatedUserId!}
        hasLinkedAccount={!!platformUsername}
      />
    </CoachPageGuard>
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
  const { profile: recProfile, loading: recLoading } = useRecommendationProfile()
  const { puzzleSet, loading: puzzlesLoading } = usePuzzles(userId, platform)

  const loading = statsLoading || challengeLoading

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
          <p className="text-sm text-gray-500">Loading puzzle trainer...</p>
        </div>
      </div>
    )
  }

  const completedCount = challenge?.completed_ids?.length ?? 0
  const totalChallenge = challenge?.puzzles?.length ?? 5

  return (
    <div className="min-h-screen bg-surface-base p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header with Stats */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-title font-semibold text-white mb-1">Puzzle Trainer</h1>
              <p className="text-gray-500">Solve tactical puzzles to sharpen your skills</p>
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

          {/* Recommended / Quick Play Card */}
          <SmartPlayCard
            profile={recProfile}
            profileLoading={recLoading}
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
            <ThemePerformance
              performance={stats.theme_performance}
              recommendedThemes={recProfile?.weaknesses?.flatMap(w => w.recommended_themes) ?? []}
            />
          </div>
        )}

        {/* Personalized Puzzles from Games */}
        {hasLinkedAccount && !puzzlesLoading && puzzleSet && puzzleSet.total > 0 && (
          <div className="mb-8">
            <h2 className="text-title font-semibold text-white mb-4">From Your Games</h2>
            <p className="text-gray-500 text-sm mb-4">
              Puzzles generated from your actual game mistakes
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(puzzleSet.categorized).map(([category, puzzles]) => {
                if (puzzles.length === 0) return null
                return (
                  <div
                    key={category}
                    className="rounded-lg shadow-card bg-surface-1 p-5 hover:bg-white/[0.04] transition-colors"
                  >
                    <h3 className="text-section font-semibold text-white mb-1 capitalize">{category}</h3>
                    <p className="text-gray-500 text-sm mb-3">{puzzles.length} puzzles</p>
                    <button
                      onClick={() =>
                        navigate('/coach/puzzles/solve', { state: { puzzles, category } })
                      }
                      className="w-full bg-[#e4e8ed] hover:bg-[#f0f2f5] text-[#111] font-medium py-2 px-4 rounded-md text-body transition-colors shadow-btn-primary"
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
          <div className="rounded-lg shadow-card bg-surface-1 p-8 text-center">
            <h2 className="text-title font-semibold text-white mb-4">Connect your chess account</h2>
            <p className="text-gray-400 mb-6">
              Link your Chess.com or Lichess account to get personalized puzzles from your game mistakes.
            </p>
            <Link
              to="/profile"
              className="inline-block bg-[#e4e8ed] hover:bg-[#f0f2f5] text-[#111] font-medium py-2 px-6 rounded-md text-body transition-colors shadow-btn-primary"
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
      <div className="flex items-center gap-2 bg-amber-500/10 shadow-card rounded-lg px-4 py-2">
        <span className="text-amber-400 text-sm font-medium">Rating</span>
        <span className="text-title font-semibold text-amber-300">{stats.rating}</span>
      </div>

      {/* Level & XP */}
      <div className="flex items-center gap-2 bg-rose-500/10 shadow-card rounded-lg px-4 py-2">
        <span className="text-rose-400 text-sm font-medium">Lvl {stats.level}</span>
        <div className="w-20 h-2 bg-rose-900/50 rounded-full overflow-hidden">
          <div
            className="h-full bg-rose-400 rounded-full transition-colors"
            style={{ width: `${xpProgress}%` }}
          />
        </div>
        <span className="text-rose-300 text-xs">{stats.xp} XP</span>
      </div>

      {/* Streak */}
      {stats.current_streak > 0 && (
        <div className="flex items-center gap-1 bg-amber-500/10 shadow-card rounded-lg px-4 py-2">
          <Flame size={16} className="text-amber-400" />
          <span className="text-amber-300 font-semibold">{stats.current_streak}</span>
          <span className="text-amber-400 text-sm">day streak</span>
        </div>
      )}

      {/* Solve Rate */}
      <div className="flex items-center gap-2 bg-emerald-500/10 shadow-card rounded-lg px-4 py-2">
        <span className="text-emerald-400 text-sm font-medium">Solved</span>
        <span className="text-emerald-300 font-semibold">{stats.solve_rate}%</span>
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
      className={`rounded-lg shadow-card p-6 ${
        allCompleted
          ? 'bg-surface-1 shadow-card-highlight'
          : 'bg-surface-1'
      }`}
    >
      <div className="flex items-center gap-2 mb-4">
        {allCompleted ? <CheckCircle2 size={20} className="text-emerald-400" /> : <Star size={20} className="text-amber-400" />}
        <h2 className="text-title font-semibold text-white">Daily Challenge</h2>
        <span className="ml-auto text-xs text-gray-500 bg-white/10 px-2 py-1 rounded-lg">
          FREE
        </span>
      </div>

      {/* Progress dots */}
      <div className="flex items-center gap-2 mb-4">
        {Array.from({ length: totalChallenge }).map((_, i) => (
          <div
            key={i}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
              i < completedCount
                ? 'bg-emerald-500 text-white'
                : i === completedCount
                  ? 'bg-emerald-500/30 border-2 border-emerald-400 text-emerald-300'
                  : 'bg-white/10 text-gray-500'
            }`}
          >
            {i < completedCount ? '\u2713' : i + 1}
          </div>
        ))}
        <span className="ml-2 text-gray-400 text-sm font-medium">
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
          <p className="text-gray-400 text-sm mb-3">
            Puzzle {completedCount + 1} of {totalChallenge} &middot; Rating ~{nextPuzzle.rating} &middot;{' '}
            {nextPuzzle.total_moves} move{nextPuzzle.total_moves > 1 ? 's' : ''}
          </p>
          <button
            onClick={() => onStartPuzzle(nextPuzzle)}
            className="bg-[#e4e8ed] hover:bg-[#f0f2f5] text-[#111] font-medium py-2 px-6 rounded-md text-body transition-colors shadow-btn-primary"
          >
            {completedCount > 0 ? 'Continue Challenge' : 'Start Challenge'}
          </button>
        </div>
      ) : (
        <p className="text-gray-500 text-sm">Loading challenge puzzles...</p>
      )}
    </div>
  )
}

/** Smart play card - shows personalized recommendations or quick play fallback */
function SmartPlayCard({
  profile,
  profileLoading,
  onStart,
}: {
  profile: RecommendationProfile | null
  profileLoading: boolean
  onStart: (theme?: string) => void
}) {
  const hasRecommendations = profile?.has_game_data && profile.weaknesses.length > 0
  const manualThemes = ['fork', 'pin', 'mate', 'sacrifice', 'discoveredAttack', 'backRankMate', 'endgame', 'hanging']

  if (hasRecommendations && profile) {
    return (
      <div className="rounded-lg shadow-card bg-white/[0.06] p-6">
        <div className="flex items-center gap-2 mb-4">
          <Target size={20} className="text-gray-300" />
          <h2 className="text-title font-semibold text-white">Recommended for You</h2>
        </div>
        <p className="text-gray-400 text-sm mb-4">
          Based on {profile.games_analyzed} analyzed games
        </p>

        {/* Start recommended button - backend auto-selects theme */}
        <button
          onClick={() => onStart()}
          className="w-full bg-[#e4e8ed] hover:bg-[#f0f2f5] text-[#111] font-medium py-2 px-6 rounded-md text-body transition-colors shadow-btn-primary mb-4"
        >
          Start Recommended Puzzle
        </button>

        {/* Weakness-based theme buttons with reasons */}
        <div className="space-y-2 mb-4">
          {profile.weaknesses.slice(0, 3).map((w) => {
            const topTheme = w.recommended_themes[0]
            if (!topTheme) return null
            return (
              <button
                key={w.category}
                onClick={() => onStart(topTheme)}
                className="w-full text-left rounded-lg bg-white/[0.06] hover:bg-white/[0.12] shadow-card p-3 transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-white text-sm font-medium">{w.title}</span>
                    {w.severity === 'critical' && (
                      <span className="ml-2 text-[10px] bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded-full">
                        Focus area
                      </span>
                    )}
                  </div>
                  <span className="text-gray-500 text-xs group-hover:text-gray-400">
                    {THEME_LABELS[topTheme] || topTheme}  &rarr;
                  </span>
                </div>
                <p className="text-gray-500 text-xs mt-1">{w.reason}</p>
              </button>
            )
          })}
        </div>

        {/* Manual theme picker as secondary option */}
        <p className="text-gray-500 text-xs mb-2">Or pick a theme:</p>
        <div className="flex flex-wrap gap-2">
          {manualThemes.map((theme) => (
            <button
              key={theme}
              onClick={() => onStart(theme)}
              className="text-xs bg-white/10 hover:bg-white/20 text-gray-400 px-3 py-1.5 rounded-lg transition-colors capitalize"
            >
              {THEME_LABELS[theme] || theme}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Fallback: standard Quick Play (no game data or still loading)
  return (
    <div className="rounded-lg shadow-card bg-white/[0.06] p-6">
      <div className="flex items-center gap-2 mb-4">
        <Zap size={20} className="text-gray-300" />
        <h2 className="text-title font-semibold text-white">Quick Play</h2>
      </div>
      <p className="text-gray-400 text-sm mb-4">
        {profileLoading
          ? 'Checking your game data...'
          : 'Solve rated puzzles matched to your skill level. Analyze games to get personalized recommendations!'
        }
      </p>

      <button
        onClick={() => onStart()}
        className="w-full bg-[#e4e8ed] hover:bg-[#f0f2f5] text-[#111] font-medium py-2 px-6 rounded-md text-body transition-colors shadow-btn-primary mb-4"
      >
        Start Rated Puzzle
      </button>

      <div className="flex flex-wrap gap-2">
        {manualThemes.map((theme) => (
          <button
            key={theme}
            onClick={() => onStart(theme)}
            className="text-xs bg-white/10 hover:bg-white/20 text-gray-400 px-3 py-1.5 rounded-lg transition-colors capitalize"
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
    <div className="rounded-lg shadow-card bg-surface-1 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-section font-semibold text-white">Rating Trend</h2>
        <span className={`text-sm font-semibold ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
          {isUp ? '+' : ''}{diff} pts
        </span>
      </div>
      <div className="flex items-end gap-1 h-16">
        {ratings.map((r, i) => {
          const height = ((r - min) / range) * 100
          return (
            <div
              key={i}
              className={`flex-1 rounded-t transition-colors ${
                isUp ? 'bg-emerald-500/60' : 'bg-rose-500/60'
              }`}
              style={{ height: `${Math.max(4, height)}%` }}
              title={`${history[i].date}: ${r}`}
            />
          )
        })}
      </div>
      <div className="flex justify-between mt-2 text-xs text-gray-500">
        <span>{history[0].date}</span>
        <span>{history[history.length - 1].date}</span>
      </div>
    </div>
  )
}

/** Theme performance grid */
function ThemePerformance({
  performance,
  recommendedThemes = [],
}: {
  performance: Record<string, { attempted: number; correct: number }>
  recommendedThemes?: string[]
}) {
  const themes = Object.entries(performance)
    .filter(([, data]) => data.attempted >= 2)
    .sort((a, b) => b[1].attempted - a[1].attempted)
    .slice(0, 8)

  if (themes.length === 0) return null

  const recommendedSet = new Set(recommendedThemes)

  return (
    <div className="rounded-lg shadow-card bg-surface-1 p-6">
      <h2 className="text-section font-semibold text-white mb-4">Theme Performance</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {themes.map(([theme, data]) => {
          const rate = Math.round((data.correct / data.attempted) * 100)
          const color =
            rate >= 75 ? 'emerald' : rate >= 50 ? 'amber' : 'rose'
          const isRecommended = recommendedSet.has(theme)
          return (
            <div
              key={theme}
              className={`rounded-lg bg-white/[0.04] p-3 ${
                isRecommended
                  ? 'shadow-[0_0_0_2px_rgba(168,85,247,0.5)]'
                  : 'shadow-card'
              }`}
            >
              <div className="flex items-center gap-1 mb-1">
                <p className="text-gray-400 text-sm capitalize">
                  {THEME_LABELS[theme] || theme}
                </p>
                {isRecommended && (
                  <span className="text-[9px] bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                    Train
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1">
                <span
                  className={`text-title font-semibold ${
                    color === 'emerald'
                      ? 'text-emerald-400'
                      : color === 'amber'
                        ? 'text-amber-400'
                        : 'text-rose-400'
                  }`}
                >
                  {rate}%
                </span>
                <span className="text-gray-500 text-xs">
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
