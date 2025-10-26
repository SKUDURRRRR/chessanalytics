# Personality Traits - Quick Reference Card

**Version:** 2.0 (Current)
**Last Updated:** October 26, 2025

---

## The 6 Modern Traits

| # | Trait | What It Measures | Example Players |
|---|-------|------------------|-----------------|
| 1 | **Tactical** | Accuracy in forcing sequences | Kasparov, Tal, Fischer |
| 2 | **Positional** | Accuracy in quiet positions | Karpov, Petrosian, Carlsen |
| 3 | **Aggressive** | Willingness to create pressure | Tal, Nepo, Kasparov |
| 4 | **Patient** | Disciplined play & consolidation | Carlsen, Caruana, Karpov |
| 5 | **Novelty** | Creativity & variety | Aronian, Ivanchuk |
| 6 | **Staleness** | Repetitive patterns | Ding Liren, Prepared Caruana |

---

## Score Interpretation

| Range | Meaning | Action |
|-------|---------|--------|
| **80-100** | Strong strength | Leverage this! |
| **65-79** | Reliable tendency | Keep developing |
| **36-64** | Neutral/balanced | No strong pattern |
| **0-35** | Improvement area | Focus here |

**Neutral = 50** (no particular strength or weakness)

---

## Natural Oppositions

```
Aggressive ↔ Patient
  - Based on forcing vs quiet move ratios
  - Inverse formulas, not forced to sum to 100

Novelty ↔ Staleness
  - Based on diversity vs repetition metrics
  - Inverse formulas, not forced to sum to 100
```

---

## Common Patterns

### The Universal Player (Magnus Carlsen)
```
Tactical:    87  (Strong execution)
Positional:  92  (Excellent structures)
Aggressive:  45  (Balanced, not passive)
Patient:     93  (Exceptional technique)
Novelty:     55  (Balanced exploration)
Staleness:   56  (Balanced preparation)
```

### The Attacker (Mikhail Tal)
```
Tactical:    85  (Sharp calculations)
Positional:  75  (Decent structures)
Aggressive:  90  (Extremely forcing)
Patient:     35  (Impatient style)
Novelty:     70  (Very creative)
Staleness:   35  (Unpredictable)
```

### The Prepared Player (Ding Liren)
```
Tactical:    90  (Excellent accuracy)
Positional:  93  (Deep understanding)
Aggressive:  48  (Balanced)
Patient:     94  (Technical mastery)
Novelty:     29  (Very low variety)
Staleness:   90  (Extremely prepared)
```

---

## Quick Diagnostics

**If scores are all near 50:**
- Not enough games analyzed yet
- Very balanced player
- Check sample size

**If Aggressive + Patient ≈ 100:**
- ✅ Normal (natural opposition)
- Shows clear style preference

**If Novelty + Staleness ≈ 100:**
- ✅ Normal (natural opposition)
- Shows clear approach preference

**If Tactical/Positional both < 40:**
- Player needs fundamental skill work
- Recommend puzzles + endgame study

**If Tactical/Positional both > 85:**
- Strong player (likely 2000+ rating)
- Focus on style refinement

---

## Database Columns

### ✅ Modern Tables (Use These)
```sql
-- game_analyses table
tactical_score, positional_score, aggressive_score,
patient_score, novelty_score, staleness_score

-- move_analyses table
tactical_score, positional_score, aggressive_score,
patient_score, novelty_score, staleness_score

-- game_features_modern view (recommended)
tactical_score, positional_score, aggressive_score,
patient_score, novelty_score, staleness_score
```

### ⚠️ Legacy Columns (Deprecated)
```sql
-- game_features table (old)
endgame_score  -- ❌ Use patient + positional instead
opening_score  -- ❌ Use tactical + novelty instead
```

---

## Code Examples

### Python
```python
from python.core.personality_scoring import PersonalityScorer

scorer = PersonalityScorer()
scores = scorer.calculate_scores(moves, time_score=75.0)

print(f"Tactical: {scores.tactical}")
print(f"Aggressive: {scores.aggressive}")
print(f"Novelty: {scores.novelty}")
```

### TypeScript
```typescript
import type { PersonalityScores } from '@/types'

const scores: PersonalityScores = {
  tactical: 87,
  positional: 92,
  aggressive: 45,
  patient: 93,
  novelty: 55,
  staleness: 56
}
```

### SQL
```sql
-- Get personality scores for a user
SELECT
  tactical_score,
  positional_score,
  aggressive_score,
  patient_score,
  novelty_score,
  staleness_score
FROM game_analyses
WHERE user_id = 'magnus_carlsen'
AND platform = 'lichess'
ORDER BY analysis_date DESC
LIMIT 20;
```

---

## Migration Notes

**From v1.0 to v2.0:**
- `endgame_score` → Use `patient_score + positional_score` / 2
- `opening_score` → Use `tactical_score + novelty_score` / 2
- Or better: Use phase-specific accuracy metrics

**Migration File:**
`supabase/migrations/20251026_migrate_game_features_to_modern_traits.sql`

---

## Learn More

📖 **Full Documentation:**
- `docs/PERSONALITY_TRAITS_CHANGELOG.md` - Complete evolution history
- `docs/PERSONALITY_MODEL.md` - Trait semantics and formulas
- `PERSONALITY_SCORING_AUDIT_2025.md` - System audit report

💻 **Source Code:**
- `python/core/personality_scoring.py` - All formulas
- `src/components/deep/PersonalityRadar.tsx` - Visualization

---

**Version:** 2.0
**Print this for your desk!** 📄
