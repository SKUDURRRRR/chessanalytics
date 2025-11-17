/**
 * Lessons Page
 * Displays all available lessons with filters
 */

import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PremiumGate } from '../../components/coach/PremiumGate'
import { LessonCard } from '../../components/coach/LessonCard'
import { useLessons } from '../../hooks/useCoachingData'
import LoadingModal from '../../components/LoadingModal'
import { useAuth } from '../../contexts/AuthContext'

export default function LessonsPage() {
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const platformUsername = searchParams.get('userId') || ''
  const platform = (searchParams.get('platform') || 'lichess') as 'lichess' | 'chess.com'
  const authenticatedUserId = user?.id || ''
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  if (!authenticatedUserId) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400">Please log in to access lessons</p>
      </div>
    )
  }

  // Use platform username for data lookup, authenticated UUID for premium check
  const userIdForData = platformUsername || authenticatedUserId

  return (
    <PremiumGate>
      <LessonsPageContent userId={userIdForData} platform={platform} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} />
    </PremiumGate>
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
