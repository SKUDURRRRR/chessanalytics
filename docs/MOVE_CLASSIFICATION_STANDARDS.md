# Move Classification Standards

## Overview

This document defines the move classification system used in the Chess Analytics application, following chess.com standards for consistency and user familiarity.

## Chess.com Standards

Our move classification system aligns with chess.com's terminology to provide a familiar experience for users:

| Classification | Display Name | Description | Centipawn Loss Range |
|---------------|--------------|-------------|---------------------|
| **brilliant** | Great | A move that altered the course of the game | 0-5 cp |
| **best** | Best | The chess engine's top choice | 0 cp |
| **great** | Great | A move that altered the course of the game | 0-5 cp |
| **excellent** | Excellent | Almost as good as the best move | 5-15 cp |
| **good** | Good | A decent move, but not the best | 15-25 cp |
| **acceptable** | Book | A conventional opening move | 25-50 cp |
| **inaccuracy** | Inaccuracy | A weak move | 50-100 cp |
| **mistake** | Mistake | A bad move that immediately worsens your position | 100-200 cp |
| **blunder** | Blunder | A very bad move that loses material or the game | 200+ cp |
| **uncategorized** | Move | Fallback for uncategorized moves | N/A |

## Implementation

### Frontend Components

The move classification labels are defined in two main locations:

1. **GameAnalysisPage.tsx** - Main game analysis component
2. **UnifiedChessAnalysis.tsx** - Move timeline component

Both components use the same `classificationLabel` mapping to ensure consistency.

### Color Coding

Each classification has associated colors for visual distinction:

- **Great/Brilliant**: Purple (`text-purple-200`, `bg-purple-500/20`)
- **Best**: Green (`text-emerald-200`, `bg-emerald-500/20`)
- **Excellent**: Cyan (`text-cyan-200`, `bg-cyan-500/20`)
- **Good**: Sky Blue (`text-sky-200`, `bg-sky-500/20`)
- **Book/Acceptable**: Slate (`text-slate-200`, `bg-slate-500/20`)
- **Inaccuracy**: Amber (`text-amber-200`, `bg-amber-500/20`)
- **Mistake**: Orange (`text-orange-200`, `bg-orange-500/20`)
- **Blunder**: Rose (`text-rose-200`, `bg-rose-500/20`)

### Backend Classification

The backend analysis engine classifies moves based on centipawn loss thresholds aligned with Chess.com standards:

```python
# Chess.com-aligned centipawn loss thresholds
is_best = centipawn_loss <= 5              # Best moves (0-5cp)
is_great = 5 < centipawn_loss <= 15        # Great moves (5-15cp)
is_excellent = 15 < centipawn_loss <= 25   # Excellent moves (15-25cp)
is_good = 25 < centipawn_loss <= 50        # Good moves (25-50cp)
is_acceptable = 25 < centipawn_loss <= 50  # Acceptable/Book moves (25-50cp)
is_inaccuracy = 50 < centipawn_loss <= 100 # Inaccuracies (50-100cp)
is_mistake = 100 < centipawn_loss <= 200   # Mistakes (100-200cp)
is_blunder = centipawn_loss > 200          # Blunders (200+cp)
```

**Key Points:**
- Thresholds match Chess.com and Lichess standards for consistency
- Inaccuracies start at 50cp loss, not 100cp
- Mistakes are 100-200cp, not 200-400cp
- Blunders are 200+cp, not 400+cp

## User Experience

### Move Analysis Display

When a move is analyzed, users see:

1. **Classification Badge**: Color-coded pill showing the move quality
2. **Detailed Explanation**: Contextual feedback explaining the move's quality
3. **Visual Indicators**: Arrows and highlights on the chessboard

### Consistency Across Components

All components that display move classifications use the same:
- Display names (matching chess.com)
- Color schemes
- Visual styling
- Classification logic

## Future Considerations

### Potential Additions

Chess.com also uses:
- **Miss**: A move that missed a tactical opportunity
- **Book**: Conventional opening moves (currently mapped to "acceptable")

These could be added in future updates if needed.

### Customization

The classification system is designed to be easily customizable:
- Display names can be changed in the `classificationLabel` objects
- Colors can be updated in the `classificationBadgeStyles` objects
- Thresholds can be adjusted in the backend analysis engine

## References

- [Chess.com Move Types Guide](https://www.chess.com/blog/chesstutorialshowtoplay/chess-guide-move-types)
- Internal documentation: `docs/UI_COLOR_SYSTEM.md`
- Implementation: `src/pages/GameAnalysisPage.tsx`, `src/components/debug/UnifiedChessAnalysis.tsx`
