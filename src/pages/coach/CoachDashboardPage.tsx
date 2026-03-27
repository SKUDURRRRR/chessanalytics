/**
 * Coach Dashboard Page
 * Professional hub for Coach Tal features
 */

import { Link } from 'react-router-dom'
import { useCoachUser } from '../../hooks/useCoachUser'
import { CoachPageGuard } from '../../components/coach/CoachPageGuard'
import {
  BookOpen,
  Puzzle,
  TrendingUp,
  Swords,
  FolderOpen,
  CalendarDays,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react'

export default function CoachDashboardPage() {
  const { authenticatedUserId, platformUsername, isLoading } = useCoachUser()

  return (
    <CoachPageGuard isLoading={isLoading} authenticatedUserId={authenticatedUserId} platformUsername={platformUsername}>
      <CoachDashboardContent username={platformUsername} />
    </CoachPageGuard>
  )
}

interface CoachDashboardContentProps {
  username: string | null
}

function CoachDashboardContent({ username }: CoachDashboardContentProps) {
  return (
    <div className="min-h-screen bg-surface-base">
      <div className="max-w-3xl mx-auto px-4 md:px-6 pt-8 pb-12">
        {/* Welcome header */}
        <div className="mb-8">
          <h1 className="text-title font-semibold text-white tracking-tight">
            Coach Tal
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {username
              ? `Welcome back, ${username}. What would you like to work on?`
              : 'Your personal chess coach. Choose a focus area below.'}
          </p>
        </div>

        {/* Primary features */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <FeatureCard
            to="/coach/review"
            icon={BookOpen}
            title="Game Review"
            description="Analyze your recent games with Coach Tal. Get move-by-move feedback and identify patterns."
            accent="emerald"
          />
          <FeatureCard
            to="/coach/puzzles"
            icon={Puzzle}
            title="Puzzles"
            description="Tactical puzzles generated from your own games. Train your weakest patterns."
            accent="amber"
          />
        </div>

        {/* Secondary features */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <FeatureCard
            to="/coach/progress"
            icon={TrendingUp}
            title="Progress"
            description="Track your rating trends, accuracy improvements, and milestone achievements."
          />
          <FeatureCard
            to="/coach/play"
            icon={Swords}
            title="Play Tal"
            description="Play against Coach Tal's signature aggressive style and learn from the experience."
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* <FeatureCard
            to="/coach/openings"
            icon={FolderOpen}
            title="Openings"
            description="Review your opening repertoire. See win rates and get recommendations for improvement."
          /> */}
          {/* <FeatureCard
            to="/coach/study-plan"
            icon={CalendarDays}
            title="Study Plan"
            description="A personalized training schedule based on your strengths and weaknesses."
          /> */}
        </div>
      </div>
    </div>
  )
}

interface FeatureCardProps {
  to: string
  icon: LucideIcon
  title: string
  description: string
  accent?: 'emerald' | 'amber'
}

function FeatureCard({ to, icon: Icon, title, description, accent }: FeatureCardProps) {
  const accentDot = accent === 'emerald'
    ? 'bg-emerald-400'
    : accent === 'amber'
      ? 'bg-amber-400'
      : null

  return (
    <Link
      to={to}
      className="group rounded-lg p-5 transition-colors hover:bg-white/[0.04]"
      style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 2px 4px rgba(0,0,0,0.2)' }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <Icon className="w-4 h-4 text-gray-400" />
          <h2 className="text-[15px] font-medium text-white">{title}</h2>
          {accentDot && <span className={`w-1.5 h-1.5 rounded-full ${accentDot}`} />}
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400 transition-colors mt-0.5" />
      </div>
      <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
    </Link>
  )
}
