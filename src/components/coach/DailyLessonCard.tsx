/**
 * Daily Lesson Card Component
 * Featured daily lesson on dashboard
 */

import { Lesson } from '../../types'
import { useNavigate } from 'react-router-dom'

interface DailyLessonCardProps {
  lesson: Lesson | null
  loading?: boolean
}

export function DailyLessonCard({ lesson, loading }: DailyLessonCardProps) {
  const navigate = useNavigate()

  if (loading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 animate-pulse">
        <div className="h-6 bg-white/10 rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-white/10 rounded w-2/3 mb-2"></div>
        <div className="h-4 bg-white/10 rounded w-1/2"></div>
      </div>
    )
  }

  if (!lesson) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
        <p className="text-slate-400">No lessons available yet. Complete some game analyses to generate personalized lessons.</p>
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-cyan-500/50 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 p-8 cursor-pointer transition-all hover:border-cyan-400/70 hover:bg-cyan-500/15"
      onClick={() => navigate(`/coach/lessons/${lesson.id}`)}
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">📚</span>
        <h2 className="text-2xl font-bold text-white">Today's Lesson</h2>
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">{lesson.lesson_title}</h3>
      {lesson.lesson_description && (
        <p className="text-slate-300 mb-4">{lesson.lesson_description}</p>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-slate-400">
          <span>{lesson.estimated_time_minutes} min</span>
          <span className="capitalize">{lesson.lesson_type}</span>
        </div>
        {lesson.id && (
          <button
            onClick={() => navigate(`/coach/lessons/${lesson.id}`)}
            className="bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-2 px-6 rounded-xl transition-colors"
          >
            Start Lesson →
          </button>
        )}
      </div>
    </div>
  )
}
