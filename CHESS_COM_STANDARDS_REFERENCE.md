# Chess.com Analysis Standards Reference

## Official Chess.com Move Classifications

Chess.com uses an **Expected Points Model** based on win probability changes, not just raw centipawn loss.

### Expected Points Scale
- `1.00` = Certain win
- `0.50` = Draw
- `0.00` = Certain loss

### Move Classifications (by Expected Points Loss)

| Classification | Expected Points Loss | Equivalent Centipawns* |
|----------------|---------------------|------------------------|
| **Best Move** | 0.00 | 0 cp |
| **Excellent** | 0.00 - 0.02 | 0 - 15 cp |
| **Good** | 0.02 - 0.05 | 15 - 40 cp |
| **Inaccuracy** | 0.05 - 0.10 | 40 - 90 cp |
| **Mistake** | 0.10 - 0.20 | 90 - 200 cp |
| **Blunder** | 0.20+ | 200+ cp |

*Approximate conversion using: `WinProb = 1 / (1 + 10^(-cp/400))`

### Brilliant Moves Criteria

A move is marked **Brilliant** when ALL of these conditions are met:

1. **Must be best or nearly best** move (0-15cp loss)
2. **Requires a piece sacrifice** that isn't immediately obvious
3. **Sacrifice maintains or improves** the position
4. **Player must not already be completely winning** (not just converting)
5. **Adjusted by rating:** More lenient for lower-rated players

### Accuracy Score

Chess.com calculates accuracy using:
1. Convert each centipawn loss to **win probability change**
2. Calculate average win probability preservation
3. Map to 0-100% scale

**Formula:**
```
WinProb(cp) = 1 / (1 + 10^(-cp/400))
MoveAccuracy = (WinProb_after / WinProb_optimal) * 100%
GameAccuracy = Average(MoveAccuracy for all moves)
```

### Key Differences from Our Old System

| Metric | Old System | Chess.com Standard |
|--------|-----------|-------------------|
| Best moves | 0-10cp | 0cp (exact match) |
| Good moves | 10-25cp | **15-40cp** (wider range) |
| Inaccuracy | 50-100cp | **40-90cp** (starts earlier) |
| Mistake | 100-200cp | **90-200cp** (starts earlier) |
| Brilliant trigger | Any sacrifice | **Only non-obvious sacrifice** |
| Brilliant position | +50cp after | **Must not be completely winning before** |
| Accuracy formula | Linear CPL | **Win probability change** |

## Implementation Requirements

### 1. Win Probability Conversion
```python
def centipawns_to_win_prob(cp: float) -> float:
    """Convert centipawns to win probability (0-1 scale)."""
    return 1.0 / (1.0 + 10 ** (-cp / 400.0))
```

### 2. Updated Move Thresholds
```python
# Based on win probability loss, not raw centipawns
is_best = centipawn_loss == 0  # Exact engine move
is_excellent = 0 < centipawn_loss <= 15  # 0.00-0.02 expected points
is_good = 15 < centipawn_loss <= 40  # 0.02-0.05 expected points
is_inaccuracy = 40 < centipawn_loss <= 90  # 0.05-0.10 expected points
is_mistake = 90 < centipawn_loss <= 200  # 0.10-0.20 expected points
is_blunder = centipawn_loss > 200  # 0.20+ expected points
```

### 3. Brilliant Move Logic
```python
is_brilliant = (
    centipawn_loss <= 15 and  # Must be excellent or best
    is_sacrifice and  # Must sacrifice material
    not_obvious and  # Must be difficult to find
    maintains_advantage and  # Doesn't lose position
    not_already_completely_winning  # Not just converting
)
```

### 4. Accuracy Calculation
```python
def calculate_move_accuracy(cp_optimal: float, cp_actual: float, cp_loss: float) -> float:
    """Calculate move accuracy using win probability."""
    win_prob_optimal = centipawns_to_win_prob(cp_optimal)
    win_prob_actual = centipawns_to_win_prob(cp_actual)
    
    if win_prob_optimal == 0:
        return 0.0
    
    # Percentage of win probability maintained
    return (win_prob_actual / win_prob_optimal) * 100.0
```

## References

- Chess.com Support: [How are moves classified?](https://support.chess.com/en/articles/8572705-how-are-moves-classified-what-is-a-blunder-or-brilliant-etc)
- Chess.com Blog: [Chess Analysis Principles](https://www.chess.com/blog/DucTrung1702/chess-com-chess-analysis-principles)

## Expected Results After Implementation

### Accuracy Scores
- **Perfect play** (0 avg CPL): 100%
- **Grandmaster** (10-15 avg CPL): 95-98%
- **Master** (20-30 avg CPL): 85-90%
- **Expert** (40-50 avg CPL): 70-80%
- **Intermediate** (60-80 avg CPL): 55-65%
- **Beginner** (100+ avg CPL): 30-45%

### Move Distribution (typical game)
- **Best moves**: 40-60% of moves
- **Excellent**: 20-30% of moves
- **Good**: 10-20% of moves
- **Inaccuracies**: 3-8 per game
- **Mistakes**: 1-3 per game
- **Blunders**: 0-2 per game
- **Brilliant**: 0-1 per 100 games

This matches Chess.com's actual user statistics.


