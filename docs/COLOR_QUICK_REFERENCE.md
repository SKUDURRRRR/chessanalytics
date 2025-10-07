# Color System Quick Reference

## Quick Usage

```typescript
import { CHESS_ANALYSIS_COLORS, getChessColor, getChessBgColor } from '../utils/chessColors'

// Direct color usage
<span className={CHESS_ANALYSIS_COLORS.accuracy}>75.4%</span>

// Helper function usage
<span className={getChessColor('blunder')}>5</span>

// Background colors for badges
<span className={getChessBgColor('brilliant')}>Brilliant</span>
```

## Color Cheat Sheet

| Term | Text Color | Background Color | Usage |
|------|------------|------------------|-------|
| **Accuracy** | `text-emerald-400` | `bg-emerald-500/20 text-emerald-200` | High performance |
| **Best Moves** | `text-emerald-400` | `bg-emerald-500/20 text-emerald-200` | Strong moves |
| **Brilliants** | `text-cyan-400` | `bg-cyan-500/20 text-cyan-200` | Exceptional moves |
| **Blunders** | `text-red-400` | `bg-red-500/20 text-red-200` | Severe mistakes |
| **Mistakes** | `text-orange-400` | `bg-orange-500/20 text-orange-200` | Moderate errors |
| **Inaccuracies** | `text-yellow-400` | `bg-yellow-500/20 text-yellow-200` | Minor errors |

## Common Patterns

### Stats Display
```typescript
const stats = [
  { label: 'Accuracy', value: '75.4%', color: CHESS_ANALYSIS_COLORS.accuracy },
  { label: 'Blunders', value: '5', color: CHESS_ANALYSIS_COLORS.blunders },
  { label: 'Brilliants', value: '2', color: CHESS_ANALYSIS_COLORS.brilliants },
]
```

### Move Classification
```typescript
<span className={`badge ${getChessBgColor(move.classification)}`}>
  {move.classification}
</span>
```

### Conditional Styling
```typescript
<span className={`font-semibold ${
  accuracy >= 90 ? CHESS_ANALYSIS_COLORS.accuracy :
  accuracy >= 70 ? CHESS_ANALYSIS_COLORS.inaccuracies :
  CHESS_ANALYSIS_COLORS.blunders
}`}>
  {accuracy}%
</span>
```

## Do's and Don'ts

### ✅ Do
- Use centralized color constants
- Use helper functions for dynamic terms
- Test color changes across all components
- Maintain semantic meaning

### ❌ Don't
- Hardcode colors in components
- Use colors without semantic meaning
- Mix different color systems
- Ignore accessibility requirements

## Migration Guide

### Before (Hardcoded)
```typescript
<span className="text-red-400">Blunders</span>
<span className="text-green-600">Accuracy</span>
```

### After (Centralized)
```typescript
<span className={CHESS_ANALYSIS_COLORS.blunders}>Blunders</span>
<span className={CHESS_ANALYSIS_COLORS.accuracy}>Accuracy</span>
```

---

**Quick Reference** | **Full Documentation**: [UI Color System](./UI_COLOR_SYSTEM.md)
