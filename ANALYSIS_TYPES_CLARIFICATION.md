# Analysis Types and Move Evaluation

## Question: Do the same move evaluation rules apply to both analysis types?

**Answer: YES ✅**

---

## Analysis Types in the System

Our system has **2 analysis types**:

1. **`AnalysisType.STOCKFISH`** - Standard Stockfish analysis
2. **`AnalysisType.DEEP`** - Deep Stockfish analysis

---

## Move Evaluation Rules

### Same Rules for Both Types

Both analysis types use **IDENTICAL** move evaluation logic:

```python
# python/core/analysis_engine.py

async def _analyze_move_stockfish(self, board: chess.Board, move: chess.Move, 
                                analysis_type: AnalysisType) -> MoveAnalysis:
    """
    Stockfish move analysis - used by BOTH AnalysisType.STOCKFISH and AnalysisType.DEEP
    
    The move classification thresholds are THE SAME for both types:
    - Best: 0-5cp
    - Great: 5-15cp
    - Excellent: 15-25cp
    - Good: 25-50cp
    - Acceptable: 50-100cp
    - Inaccuracy: 100-200cp
    - Mistake: 200-400cp
    - Blunder: 400+cp
    
    Brilliant move criteria are also IDENTICAL for both types.
    """
```

---

## What's Different Between STOCKFISH and DEEP?

| Feature | STOCKFISH | DEEP |
|---------|-----------|------|
| **Analysis Depth** | Standard (12 ply) | Higher (18+ ply) |
| **Time Per Move** | 0.5 seconds | 2.0+ seconds |
| **Accuracy** | Good | Better (especially in complex positions) |
| **Speed** | Faster | Slower |
| **Move Classification Thresholds** | **SAME** | **SAME** |
| **Brilliant Move Criteria** | **SAME** | **SAME** |
| **Category Labels** | **SAME** | **SAME** |

---

## Why the Same Rules?

### 1. Consistency

Users expect move classifications to be consistent regardless of analysis type. A "Brilliant" move should be brilliant whether analyzed with STOCKFISH or DEEP.

### 2. Simplicity

Having different thresholds for different analysis types would be confusing:
- ❌ "This move is 'Best' in STOCKFISH but 'Great' in DEEP" - Confusing!
- ✅ "This move is 'Best' in both STOCKFISH and DEEP" - Clear!

### 3. Centipawn Loss is Absolute

Centipawn loss is an objective measure relative to the optimal move. It doesn't change based on how deeply you analyze (though the accuracy of the measurement improves).

### 4. Chess.com Alignment

Chess.com uses the same thresholds regardless of analysis depth. We follow the same approach for consistency with industry standards.

---

## Example: Same Move, Different Analysis Types

### Position
```
rnbqkb1r/ppp2ppp/2n2n2/3pp1N1/2B1P3/8/PPPP1PPP/RNBQK2R w KQkq - 0 5
```

### Move: exd5

**With AnalysisType.STOCKFISH:**
- Centipawn loss: ~5cp
- Classification: **Best**
- Is Brilliant: No

**With AnalysisType.DEEP:**
- Centipawn loss: ~5cp (more accurate)
- Classification: **Best**
- Is Brilliant: No

**Result:** Same classification, just slightly more accurate centipawn calculation with DEEP.

---

## When to Use Which Analysis Type?

### Use STOCKFISH (Standard) When:
- ✅ Analyzing many games quickly
- ✅ Real-time analysis during gameplay
- ✅ Quick position evaluation
- ✅ Resource-constrained environments

### Use DEEP When:
- ✅ Detailed game review
- ✅ Critical position analysis
- ✅ Tournament game analysis
- ✅ Learning from mistakes (more accurate)
- ✅ Complex tactical positions

---

## Code Implementation

### Both Types Use Same Method

```python
# python/core/analysis_engine.py

async def analyze_move(self, board: chess.Board, move: chess.Move, 
                      analysis_type: Optional[AnalysisType] = None) -> MoveAnalysis:
    """Analyze a specific move in a position."""
    analysis_type = analysis_type or self.config.analysis_type
    
    # Both STOCKFISH and DEEP call the SAME method
    return await self._analyze_move_stockfish(board, move, analysis_type)
```

### The analysis_type Parameter

The `analysis_type` parameter is used **ONLY** to determine:
1. Analysis depth (`depth = 12` for STOCKFISH, `depth = 18+` for DEEP)
2. Time limit (`time = 0.5s` for STOCKFISH, `time = 2.0s+` for DEEP)

It does **NOT** affect:
- ❌ Move classification thresholds
- ❌ Brilliant move criteria
- ❌ Category labels or colors
- ❌ Badge display

---

## Testing

The test script has been updated to use the correct enum value:

```python
# test_move_evaluation_fix.py

# ✅ CORRECT
analysis = await engine._analyze_move_stockfish(
    board, move, AnalysisType.DEEP  # or AnalysisType.STOCKFISH
)

# ❌ WRONG (doesn't exist)
analysis = await engine._analyze_move_stockfish(
    board, move, AnalysisType.DEEP_ANALYSIS  # ❌ No such enum value
)
```

---

## Summary

### Key Points

1. ✅ **Same thresholds** for STOCKFISH and DEEP
2. ✅ **Same brilliant move criteria** for both types
3. ✅ **Same move categories** and labels
4. ✅ **Only difference**: depth and time (accuracy)
5. ✅ **Consistency** across all analysis modes

### Answer to Original Question

> "Can we apply same rules for both analysis?"

**YES!** The same move evaluation rules **already apply** to both `AnalysisType.STOCKFISH` and `AnalysisType.DEEP`. This is by design for consistency and simplicity.

---

## Related Documentation

- `MOVE_EVALUATION_STANDARDS.md` - Complete standards documentation
- `MOVE_EVALUATION_FIX_SUMMARY.md` - Summary of changes
- `test_move_evaluation_fix.py` - Test script (now fixed)

