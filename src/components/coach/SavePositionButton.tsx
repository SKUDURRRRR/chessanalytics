/**
 * Save Position Button + Modal
 * Allows saving a chess position with title and notes
 */

import { useState } from 'react'
import { Platform } from '../../types'
import { CoachingService } from '../../services/coachingService'

interface SavePositionButtonProps {
  fen: string
  platform: Platform
  authUserId: string
  sourceGameId?: string
  sourceMoveNumber?: number
  onSaved?: () => void
}

export function SavePositionButton({
  fen,
  platform,
  authUserId,
  sourceGameId,
  sourceMoveNumber,
  onSaved,
}: SavePositionButtonProps) {
  const [showModal, setShowModal] = useState(false)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    try {
      await CoachingService.savePosition(
        {
          fen,
          platform,
          title: title || 'Saved Position',
          notes,
          source_game_id: sourceGameId,
          source_move_number: sourceMoveNumber,
        },
        authUserId
      )
      setShowModal(false)
      setTitle('')
      setNotes('')
      onSaved?.()
    } catch {
      alert('Failed to save position')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="text-xs text-gray-500 hover:text-emerald-400 transition-colors flex items-center gap-1"
        title="Save position"
      >
        <span>+</span> Save Position
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowModal(false)}>
          <div
            className="w-full max-w-md rounded-lg bg-surface-1 p-6 shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white mb-4">Save Position</h3>

            <div className="mb-3">
              <label className="block text-sm text-gray-500 mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Interesting endgame"
                className="w-full rounded-lg shadow-card bg-surface-1 px-3 py-2 text-sm text-white placeholder:text-gray-500 outline-none focus:ring-1 focus:ring-emerald-500/50"
              />
            </div>

            <div className="mb-3">
              <label className="block text-sm text-gray-500 mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What's interesting about this position?"
                rows={3}
                className="w-full rounded-lg shadow-card bg-surface-1 px-3 py-2 text-sm text-white placeholder:text-gray-500 outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
              />
            </div>

            <p className="text-xs text-gray-500 mb-4 font-mono truncate">{fen}</p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-500 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
