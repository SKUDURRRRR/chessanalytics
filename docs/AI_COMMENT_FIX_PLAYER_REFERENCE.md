# FIX: Remove "Player 1200" References from Comments

## Issue Discovered (November 20, 2024)

The AI comments were including internal prompt context in the final user-facing comment:

### Example Error:
**Comment said:** "The move d4 is a strong positional play by **Player 1200**."

**Problem:** "Player 1200" is internal context (the player's ELO rating) and should NOT appear in the comment.

## Root Cause

The prompt started with:
```
Player {player_elo} ELO played {move_san} in {game_phase}...
```

The AI interpreted "Player 1200" as the subject and copied it into the response, treating it as a proper noun rather than context information.

## Fix Applied

### What Changed

**File:** `python/core/ai_comment_generator.py`

**Old Prompt Structure:**
```
Player {player_elo} ELO played {move_san}...
TASK: Write about {color_name}'s move...
```

**New Prompt Structure:**
```
CONTEXT: {color_name} (rated {player_elo}) just played {move_san}...
TASK: Write about {color_name}'s move...
Focus on chess principles - do NOT mention the player's rating or "Player {player_elo}".
```

### Key Changes:

1. **Labeled as CONTEXT** - Makes it clear this is background information
2. **Explicit instruction** - "do NOT mention the player's rating or 'Player {player_elo}'"
3. **Added rule** - "Refer to the player as '{color_name}' (never 'Player {player_elo}' or 'the player')"
4. **Reordered** - Put color name first: "{color_name} (rated {player_elo})" instead of "Player {player_elo}"

## Expected Result

**Before:**
> "The move d4 is a strong positional play by Player 1200."

**After:**
> "The move d4 is a strong positional play by White."
> OR
> "White's d4 controls the center and restricts Black's pieces."

## Why This Matters

- **User-facing quality:** Internal implementation details shouldn't leak into comments
- **Professionalism:** Comments should sound natural, not like debugging output
- **Clarity:** Focus on chess concepts, not meta-information

## Additional Safeguards

The prompt now explicitly states:
- ✅ Use "{color_name}" (White/Black) to refer to the player
- ✅ Never use "Player {elo}"
- ✅ Never use "the player"
- ✅ Start directly with chess analysis

## Testing

After this fix, verify that comments:
1. Never mention "Player [number]"
2. Never mention ELO ratings in the comment text
3. Always use "White" or "Black" to refer to players
4. Focus on chess concepts, not player identity

## Lesson Learned

**Prompt structure matters.** When giving context to the AI:
- Clearly label what is CONTEXT vs what should appear in OUTPUT
- Give explicit negative examples ("do NOT mention X")
- Structure prompts so the AI doesn't mistake context for content

This is the second critical fix today - both stemmed from over-aggressive prompt simplification that removed important safeguards.
