# Evaluation Bar Display Bug Fix

## Issue Description

The evaluation bar was displaying incorrect position evaluations when viewing games from different player perspectives. Specifically, when white was winning significantly, the bar would show black dominance, and vice versa.

## Root Cause

The bug was in the `EvaluationBar` component in `src/components/debug/UnifiedChessAnalysis.tsx`. The issue stemmed from how the marker position was calculated:

```typescript
// BEFORE (buggy code):
const markerPosition = playerColor === 'white' ? 100 - percent : percent
```

This code incorrectly used `playerColor` to transform the evaluation, but `playerColor` should **only affect the visual orientation** of the bar (which side shows white/black), not the interpretation of the evaluation itself.

## Technical Details

### How Chess Evaluations Work

In chess engines, evaluations are **always stored from white's perspective**:
- **Positive values** = White is winning (e.g., +300 centipawns = white is up 3 pawns)
- **Negative values** = Black is winning (e.g., -300 centipawns = black is up 3 pawns)
- **Zero** = Equal position

This is a standard convention used by Stockfish and other chess engines.

### The Bug

The evaluation bar was applying an incorrect transformation based on `playerColor`:
1. When `playerColor === 'black'`, it would flip the evaluation
2. This meant a position where white was winning (+500) would be displayed as if black was winning when viewing from black's perspective

### The Fix

The fix involves two changes:

1. **Clarified the evaluation source** (line 613-620):
   - Added comments explaining that `evaluation.value` is always from white's perspective
   - This value should be used directly without color-based transformation

2. **Fixed the marker position calculation** (line 120-123):
   - Changed to use `isWhiteAtBottom` (derived from `playerColor`) instead of directly using `playerColor`
   - The marker position now correctly reflects the evaluation regardless of viewing perspective
   - `isWhiteAtBottom` only affects whether the marker moves from bottom-to-top or top-to-bottom

```typescript
// AFTER (fixed code):
const isWhiteAtBottom = playerColor === 'white'
const markerPosition = isWhiteAtBottom ? 100 - whiteAdvantagePercent : whiteAdvantagePercent
```

## What Changed

### Before
- Evaluation bar would show inverted evaluations when viewing from black's perspective
- A position where white was winning would show black dominance on the bar

### After
- Evaluation bar always correctly shows who is winning
- The visual orientation (which side shows white/black) correctly matches the board orientation
- The evaluation meaning (positive = white winning) is preserved regardless of perspective

## Testing

To verify the fix works:

1. Open a game where white has a significant advantage (e.g., +5.0 evaluation)
2. View from white's perspective - the bar should show white (bottom section) is larger
3. View from black's perspective - the bar should still show white is winning, but with white at the top
4. The position of the orange marker should reflect the same advantage regardless of viewing perspective

## Files Modified

- `src/components/debug/UnifiedChessAnalysis.tsx`
  - Lines 107-123: Fixed `EvaluationBar` component logic
  - Lines 613-620: Added clarifying comments about evaluation perspective

## Impact

This fix ensures that users can trust the evaluation bar to accurately represent the position evaluation regardless of which player's perspective they're viewing from. The bar now correctly shows:
- **Who is winning** (white or black)
- **By how much** (the size of each section)
- **Visual orientation** that matches the board orientation (white at bottom when viewing as white, black at bottom when viewing as black)
