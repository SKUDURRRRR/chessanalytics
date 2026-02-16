/**
 * Lessons Page
 * Displays all available lessons with filters
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LessonCard } from '../../components/coach/LessonCard'
import { useLessons } from '../../hooks/useCoachingData'
import LoadingModal from '../../components/LoadingModal'
import { useAuth } from '../../contexts/AuthContext'
import { useCoachUser } from '../../hooks/useCoachUser'

export default function LessonsPage() {
  const { usageStats } = useAuth()
  const { platform, platformUsername, authenticatedUserId } = useCoachUser()
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  if (!authenticatedUserId) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400">Please log in to access lessons</p>
      </div>
    )
  }

  if (!platformUsername) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Connect your chess account</h2>
          <p className="text-slate-300 mb-6">
            Link your Chess.com or Lichess account to get personalized lessons.
          </p>
          <Link
            to="/profile"
            className="inline-block bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            Go to Profile to Connect
          </Link>
        </div>
      </div>
    )
  }

  // Check coach lesson limits
  const coachLessons = usageStats?.coach_lessons
  const lessonsExhausted = coachLessons && !coachLessons.unlimited && (coachLessons.remaining ?? 0) <= 0

  return (
    <>
      {lessonsExhausted && (
        <div className="bg-amber-900/30 border-b border-amber-500/30 px-4 py-3 text-center">
          <p className="text-amber-200 text-sm">
            You've used your free lesson this week.{' '}
            <Link to="/pricing" className="text-amber-300 underline hover:text-amber-100 font-medium">
              Upgrade to Pro
            </Link>{' '}
            for unlimited lessons.
          </p>
        </div>
      )}
      <LessonsPageContent userId={platformUsername} platform={platform} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} />
    </>
  )
}

function LessonsPageContent({
  userId,
  platform,
  selectedCategory,
  setSelectedCategory,
}: {
  userId: string
  platform: 'lichess' | 'chess.com'
  selectedCategory: string
  setSelectedCategory: (cat: string) => void
}) {
  const category = selectedCategory === 'all' ? undefined : selectedCategory
  const { lessons, loading, error } = useLessons(userId, platform, category)

  const categories = [
    { id: 'all', label: 'All' },
    { id: 'opening', label: 'Opening' },
    { id: 'tactical', label: 'Tactical' },
    { id: 'positional', label: 'Positional' },
  ]

  if (loading) {
    return <LoadingModal isOpen={true} message="Loading lessons..." />
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Error</h2>
          <p className="text-slate-300 mb-6">{error.message}</p>
        </div>
      </div>
    )
  }

  // Sort lessons by priority
  const sortedLessons = [...lessons].sort((a, b) => {
    const priorityOrder = { critical: 0, important: 1, enhancement: 2 }
    return priorityOrder[a.priority] - priorityOrder[b.priority]
  })

  const recommendedLessons = sortedLessons.filter(l => l.priority === 'critical')
  const otherLessons = sortedLessons.filter(l => l.priority !== 'critical')

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Personalized Lessons</h1>
          <p className="text-slate-400">Lessons tailored to your playing style and weaknesses</p>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-xl font-semibold transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-emerald-500 text-white'
                  : 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.08]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Recommended Lessons */}
        {recommendedLessons.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">Recommended for You</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recommendedLessons.map(lesson => (
                <LessonCard key={lesson.id} lesson={lesson} />
              ))}
            </div>
          </div>
        )}

        {/* All Lessons */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-4">All Lessons</h2>
          {otherLessons.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {otherLessons.map(lesson => (
                <LessonCard key={lesson.id} lesson={lesson} />
              ))}
            </div>
          ) : (
            <p className="text-slate-400">No lessons available. Complete some game analyses to generate personalized lessons.</p>
          )}
        </div>
      </div>
    </div>
  )
}
