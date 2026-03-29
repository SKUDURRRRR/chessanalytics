/**
 * Tag Manager Component
 * Inline add/remove tags with autocomplete from existing tags
 */

import { useState, useRef, useEffect } from 'react'
import { GameTag, Platform } from '../../types'
import { CoachingService } from '../../services/coachingService'
import { TagBadge } from './TagBadge'

interface TagManagerProps {
  gameId: string
  platform: Platform
  authUserId: string
  existingTags: GameTag[]
  allUserTags: GameTag[]
  onTagsChanged: () => void
}

export function TagManager({
  gameId,
  platform,
  authUserId,
  existingTags,
  allUserTags,
  onTagsChanged,
}: TagManagerProps) {
  const [inputValue, setInputValue] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [adding, setAdding] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Get unique tag names for autocomplete, excluding already-applied tags
  const appliedTagNames = new Set(existingTags.map((t) => t.tag))
  const suggestions = [...new Set(allUserTags.map((t) => t.tag))]
    .filter((t) => !appliedTagNames.has(t))
    .filter((t) => t.toLowerCase().includes(inputValue.toLowerCase()))
    .slice(0, 5)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const addTag = async (tag: string) => {
    const trimmed = tag.trim()
    if (!trimmed || adding) return

    setAdding(true)
    try {
      await CoachingService.addTag(gameId, platform, trimmed, authUserId)
      setInputValue('')
      setShowSuggestions(false)
      onTagsChanged()
    } catch {
      // Silently fail - tag might already exist
    } finally {
      setAdding(false)
    }
  }

  const removeTag = async (tagId: string) => {
    try {
      await CoachingService.deleteTag(tagId, authUserId)
      onTagsChanged()
    } catch {
      // Silently fail
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag(inputValue)
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  return (
    <div ref={containerRef} className="flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      {existingTags.map((t) => (
        <TagBadge
          key={t.id}
          tag={t.tag}
          tagType={t.tag_type}
          onRemove={t.tag_type === 'user' ? () => removeTag(t.id) : undefined}
        />
      ))}

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value)
            setShowSuggestions(true)
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder="+ tag"
          className="w-16 bg-transparent text-xs text-gray-500 placeholder:text-gray-600 outline-none focus:w-24 transition-colors"
          disabled={adding}
        />

        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 mt-1 z-50 rounded-lg bg-surface-1 shadow-card py-1 min-w-[120px]">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => addTag(s)}
                className="block w-full text-left px-3 py-1.5 text-xs text-gray-400 hover:bg-white/10 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
