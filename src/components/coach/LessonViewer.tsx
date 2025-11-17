/**
 * Lesson Viewer Component
 * Displays full lesson content with interactive board
 * Simplified version for Phase 1
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { CoachingService } from '../../services/coachingService'
import { LessonDetail } from '../../types'
import LoadingModal from '../LoadingModal'
import { Chessboard } from 'react-chessboard'
import { Chess } from 'chess.js'

export function LessonViewer() {
  const { lessonId } = useParams<{ lessonId: string }>()
  const navigate = useNavigate()
  const [lesson, setLesson] = useState<LessonDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [timeSpent, setTimeSpent] = useState(0)
  const [game] = useState(new Chess()) // Moved to top - hooks must be called before any returns

  const loadLesson = async () => {
    if (!lessonId) return

    try {
      setLoading(true)
      const data = await CoachingService.getLessonDetail(lessonId)
      setLesson(data)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load lesson'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (lessonId) {
      loadLesson()
    }

    // Track time spent
    const interval = setInterval(() => {
      setTimeSpent(prev => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]) // loadLesson is stable, doesn't need to be in deps

  const handleComplete = async () => {
    if (!lessonId) return

    try {
      await CoachingService.completeLesson(lessonId, timeSpent)
      navigate('/coach/lessons')
    } catch (err) {
      alert('Failed to mark lesson as complete')
    }
  }

  if (loading) {
    return <LoadingModal isOpen={true} message="Loading lesson..." />
  }

  if (error || !lesson) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Error</h2>
          <p className="text-slate-300 mb-6">{error?.message || 'Lesson not found'}</p>
          <button
            onClick={() => navigate('/coach/lessons')}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            Back to Lessons
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/coach/lessons')}
          className="mb-6 text-slate-400 hover:text-slate-300 transition-colors flex items-center gap-2"
        >
          ← Back to Lessons
        </button>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">{lesson.lesson_title}</h1>
          {lesson.lesson_description && (
            <p className="text-slate-300 mb-4">{lesson.lesson_description}</p>
          )}
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <span>{lesson.estimated_time_minutes} min</span>
            <span className="capitalize">{lesson.lesson_type}</span>
            {lesson.completion_percentage !== undefined && (
              <span>{lesson.completion_percentage}% complete</span>
            )}
          </div>
        </div>

        {/* Theory Section */}
        {lesson.lesson_content?.theory && (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 mb-6">
            <h2 className="text-2xl font-bold text-white mb-4">Theory</h2>
            <p className="text-slate-300 leading-relaxed whitespace-pre-line">
              {lesson.lesson_content.theory}
            </p>
          </div>
        )}

        {/* Your Games Examples */}
        {lesson.lesson_content?.common_mistakes && lesson.lesson_content.common_mistakes.length > 0 && (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 mb-6">
            <h2 className="text-2xl font-bold text-white mb-4">Your Games</h2>
            <div className="space-y-4">
              {lesson.lesson_content.common_mistakes.map((example, index) => (
                <div key={index} className="bg-slate-900/50 rounded-xl p-4">
                  <p className="text-slate-300 text-sm">
                    Game {index + 1}: {example.blunders || 0} blunders, {example.mistakes || 0} mistakes
                    {example.accuracy !== undefined && `, ${example.accuracy.toFixed(1)}% accuracy`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Items */}
        {lesson.lesson_content?.action_items && lesson.lesson_content.action_items.length > 0 && (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 mb-6">
            <h2 className="text-2xl font-bold text-white mb-4">Action Items</h2>
            <ul className="space-y-2">
              {lesson.lesson_content.action_items.map((item, index) => (
                <li key={index} className="flex items-start gap-3 text-slate-300">
                  <span className="text-emerald-400 mt-1">☐</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Complete Button */}
        <div className="flex justify-end">
          <button
            onClick={handleComplete}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-8 rounded-xl transition-colors"
          >
            Mark as Complete
          </button>
        </div>
      </div>
    </div>
  )
}
