/**
 * Lesson Card Component
 * Preview card for lesson in list
 */

import { Lesson } from '../../types'
import { useNavigate } from 'react-router-dom'

interface LessonCardProps {
  lesson: Lesson
}

export function LessonCard({ lesson }: LessonCardProps) {
  const navigate = useNavigate()

  const priorityColors = {
    critical: 'border-rose-500/50 bg-rose-500/10',
    important: 'border-amber-500/50 bg-amber-500/10',
    enhancement: 'border-blue-500/50 bg-blue-500/10',
  }

  const statusColors = {
    not_started: 'text-slate-400',
    in_progress: 'text-blue-400',
    completed: 'text-emerald-400',
  }

  const statusIcons = {
    not_started: '○',
    in_progress: '◐',
    completed: '✓',
  }

  const handleClick = () => {
    if (lesson.id) {
      navigate(`/coach/lessons/${lesson.id}`)
    }
  }

  return (
    <div
      className={`rounded-2xl border ${priorityColors[lesson.priority]} p-6 cursor-pointer transition-all hover:border-white/30 hover:bg-white/[0.08]`}
      onClick={handleClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white mb-1">{lesson.lesson_title}</h3>
          <p className="text-sm text-slate-400 capitalize">{lesson.lesson_type}</p>
        </div>
        <span className={`text-lg ${statusColors[lesson.status || 'not_started']}`}>
          {statusIcons[lesson.status || 'not_started']}
        </span>
      </div>

      {lesson.lesson_description && (
        <p className="text-slate-300 text-sm mb-4 line-clamp-2">{lesson.lesson_description}</p>
      )}

      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{lesson.estimated_time_minutes} min</span>
        {lesson.completion_percentage !== undefined && lesson.completion_percentage > 0 && (
          <span>{lesson.completion_percentage}% complete</span>
        )}
      </div>
    </div>
  )
}
