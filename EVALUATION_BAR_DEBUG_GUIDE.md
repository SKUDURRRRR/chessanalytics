# Evaluation Bar Debug Guide

## Problem
The evaluation bar is showing incorrect evaluations - specifically, it appears to show the evaluation "one move behind" (showing the previous position's evaluation instead of the current position's evaluation).

## Screenshots Analysis

### Screenshot 1 (Black Move 33 - Rd7 Mistake)
- **Move**: Rd7 (Black's move, classified as Mistake)
- **Expected**: White should be winning (eval bar should show white dominance)
- **Actual**: Eval bar shows black dominance ❌

### Screenshot 2 (White Move 33 - Qxa7 Best)
- **Move**: Qxa7 (White's move, classified as Best)
- **Expected**: White should be winning (eval bar should show white dominance)
- **Actual**: Eval bar correctly shows white dominance ✓

## Key Observation
The eval bar was correct for move 33 (white's Qxa7), but wrong for the next move (black's Rd7). This suggests the evaluation for Rd7 might be showing the evaluation from **before Rd7** (i.e., after Qxa7) instead of **after Rd7**.

## Debugging Steps

### 1. Check Console Logs
Open the browser console and navigate to the moves in question. You should see logs like:
```
🎯 Using current move eval (white perspective): {
  score: XXX,
  san: 'Rd7',
  player: 'black',
  evalValue: XXX,
  evalType: 'cp'
}
```

**Check**: What is the `evalValue` for Rd7?
- If it's **positive** (e.g., +500), white is winning (correct data, display bug)
- If it's **negative** (e.g., -500), black is winning (data bug)

### 2. Check the Evaluation Text Display
Look at the move analysis panel - what evaluation is shown in text form for Rd7?
- Does it match what the eval bar is showing?
- Does it match what you expect based on the position?

### 3. Potential Root Causes

#### A. Data Issue (Backend)
The `evaluation` field in the move data might be storing the wrong value:
- Storing evaluation **before** the move instead of **after**
- Storing evaluation from wrong perspective

**Check**: Look at the raw data from the API response for this game.

#### B. Display Issue (Frontend)
The evaluation bar might be displaying the wrong move's evaluation:
- Using `currentMove` evaluation when it should use `nextMove` or `previousMove`
- Index off-by-one error

**Check**: Verify that `currentMove` in the component matches the move shown on the board.

#### C. Perspective Issue (Frontend)
The evaluation value might be correct, but the bar is interpreting it wrong:
- Incorrectly applying color-based transformation
- Board orientation affecting evaluation display incorrectly

**Check**: Look at the `EvaluationBar` component logic - does it correctly handle `playerColor`?

## Testing the Fix

To test if the fix works:

1. **Navigate to move 32** (white's move before Qxa7)
   - Eval bar should show the position after white's move 32

2. **Navigate to move 33 white** (Qxa7)
   - Eval bar should show white winning
   - This currently works correctly ✓

3. **Navigate to move 33 black** (Rd7)
   - Eval bar should show white winning even more (since Rd7 is a mistake)
   - This currently shows wrong ❌

4. **Navigate to move 34 white** (next white move)
   - Eval bar should show the position after white's move 34

## Expected Behavior

The evaluation bar should **always** show the evaluation of the position **after** the currently displayed move has been played.

- When showing Qxa7: Display evaluation after Qxa7
- When showing Rd7: Display evaluation after Rd7
- When showing move N: Display evaluation after move N

The evaluation should be from **white's perspective**:
- Positive values = white winning (white section larger)
- Negative values = black winning (black section larger)
- Zero = equal position

The `playerColor` prop should **only** affect visual orientation (which side shows white vs black), not the meaning of the evaluation.

## Next Steps

1. Check the console logs for the actual evaluation values
2. Verify that `evaluation.value` in the backend represents position **after** the move
3. Verify that the frontend is displaying the correct move's evaluation
4. Test the fix by navigating through moves and checking the eval bar

## Files to Check

- **Backend**: `python/core/analysis_engine.py` (line 1414-1422) - where `evaluation` is set
- **Frontend Data Processing**: `src/pages/GameAnalysisPage.tsx` (line 695) - where evaluation is extracted from backend data
- **Frontend Display**: `src/components/debug/UnifiedChessAnalysis.tsx` (line 598-627) - where evaluation is passed to the bar
- **Evaluation Bar Component**: `src/components/debug/UnifiedChessAnalysis.tsx` (line 92-124) - where the bar is rendered
