# Human Evaluation Loop

To align numerical personality scores with expert expectations, incorporate structured feedback from titled players/coaches after each calibration cycle.

## Participant Selection
- Target 3–5 reviewers across different playing styles (attackers, positional, universal).
- Provide each reviewer with radar summaries, representative games, and trait descriptions.
- Offer optional interview or survey format to capture qualitative impressions.

## Feedback Artifacts
- `feedback_sessions/<date>/<player>.md` — session notes with key observations, disagreements, and suggested adjustments.
- `feedback_summary_<date>.md` — consolidated report with action items prioritized by severity.

## Key Questions
1. Does the radar reflect this player’s historical style? If not, which trait feels off and by roughly how many points?
2. Are there openings or phases not represented in the analyzed sample that would change perception?
3. Are any trait pairs (e.g., Aggressive vs Patient) simultaneously high/low in ways that contradict expectations?
4. What alternative metrics would better capture the trait in question (initiative, pawn storms, fortress play, etc.)?

## Integration
- Feed review comments back into the calibration log.
- Correlate qualitative feedback with sensitivity results to identify numerical levers for adjustment.
- Track resolution status for each raised issue (Open → Investigating → Resolved → Verified).
