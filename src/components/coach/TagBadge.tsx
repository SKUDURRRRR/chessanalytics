/**
 * Tag Badge Component
 * Small colored badge for game tags
 */

interface TagBadgeProps {
  tag: string
  tagType: 'user' | 'system'
  onRemove?: () => void
}

export function TagBadge({ tag, tagType, onRemove }: TagBadgeProps) {
  const isSystem = tagType === 'system'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isSystem
          ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
          : 'bg-violet-500/15 text-violet-300 border border-violet-500/30'
      }`}
    >
      {tag}
      {onRemove && !isSystem && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="ml-0.5 hover:text-white transition-colors"
          aria-label={`Remove tag ${tag}`}
        >
          x
        </button>
      )}
    </span>
  )
}
