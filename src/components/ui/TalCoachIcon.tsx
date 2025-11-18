/**
 * Tal Coach Icon Component
 * Visual representation of Tal Coach based on Mikhail Tal's portrait
 */

interface TalCoachIconProps {
  size?: number
  className?: string
}

export function TalCoachIcon({ size = 40, className = '' }: TalCoachIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Background circle - dark blue */}
      <circle cx="50" cy="50" r="50" fill="#1E3A5F" />

      {/* Face shape - light brown, simplified */}
      <ellipse cx="50" cy="58" rx="26" ry="30" fill="#C9A882" />

      {/* Hair - grey, longer on sides, completely bald on top */}
      {/* Left side hair - longer */}
      <path
        d="M 25 32 Q 20 28 18 35 Q 20 42 25 50 Q 28 62 32 70 Q 35 78 33 82 Q 30 80 28 78 Q 26 76 24 74"
        fill="#9E9E9E"
      />
      <path
        d="M 25 32 Q 22 30 20 35 Q 22 40 25 48 Q 28 58 30 65 Q 32 72 30 78 Q 28 76 26 74"
        fill="#757575"
      />
      {/* Additional left side hair layer for more volume */}
      <path
        d="M 23 35 Q 20 32 18 38 Q 20 45 23 52 Q 26 60 28 68 Q 30 75 28 80 Q 26 78 24 76"
        fill="#B0B0B0"
        opacity="0.7"
      />
      {/* Right side hair - longer */}
      <path
        d="M 75 32 Q 80 28 82 35 Q 80 42 75 50 Q 72 62 68 70 Q 65 78 67 82 Q 70 80 72 78 Q 74 76 76 74"
        fill="#9E9E9E"
      />
      <path
        d="M 75 32 Q 78 30 80 35 Q 78 40 75 48 Q 72 58 70 65 Q 68 72 70 78 Q 72 76 74 74"
        fill="#757575"
      />
      {/* Additional right side hair layer for more volume */}
      <path
        d="M 77 35 Q 80 32 82 38 Q 80 45 77 52 Q 74 60 72 68 Q 70 75 72 80 Q 74 78 76 76"
        fill="#B0B0B0"
        opacity="0.7"
      />

      {/* Eyebrows - dark and bushy, simplified */}
      <ellipse cx="42" cy="50" rx="5" ry="2.5" fill="#3E2723" />
      <ellipse cx="58" cy="50" rx="5" ry="2.5" fill="#3E2723" />

      {/* Eyes - small dark dots */}
      <circle cx="42" cy="58" r="2.5" fill="#1A0F08" />
      <circle cx="58" cy="58" r="2.5" fill="#1A0F08" />

      {/* Nose - just a hint, very subtle */}
      <ellipse cx="50" cy="65" rx="2" ry="3" fill="#B8956A" opacity="0.4" />

      {/* Mouth - subtle hint */}
      <ellipse cx="50" cy="72" rx="4" ry="1.5" fill="#8B6F47" opacity="0.6" />

      {/* Clothing - dark blue/black suit, high-collared */}
      <path
        d="M 28 82 L 50 78 L 72 82 L 72 100 L 28 100 Z"
        fill="#1A1A2E"
      />
      {/* Shirt collar */}
      <path
        d="M 45 78 L 50 76 L 55 78"
        stroke="#E8E8E8"
        strokeWidth="1.5"
        fill="none"
        opacity="0.5"
      />
    </svg>
  )
}
