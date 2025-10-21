# Personality Trait Sensitivity Study

This document describes the approach for quantifying how each personality trait score reacts to underlying metrics. The objective is to locate coefficients that disproportionately influence outcomes and identify replacements where signals diverge from human expectations.

## Objectives

1. Measure elasticity of trait scores with respect to primary metrics (forcing ratio, quiet ratio, check density, opening diversity, repetition count, time management, etc.).
2. Highlight coefficients that produce unrealistic effects (e.g., minor changes in forcing ratio causing 15-point swings).
3. Propose alternative metrics or transformations that better correlate with expert assessments.

## Experiment Design

### Baseline Dataset
- Use the 15-player benchmark set established in `benchmark_reference.md`.
- For each player, gather 60 analyzed games spanning peak years (split equally by color where possible).
- Store move-level metrics using `PersonalityScorer.compute_metrics` and aggregate per trait.

### Perturbation Tests
For each trait, apply controlled adjustments to key inputs and recompute scores. Suggested perturbations:

- **Aggressive/Patient**: ±10% forcing ratio, ±10% quiet ratio, additional 0.2 check density.
- **Tactical/Positional**: ±5% best move rate, ±10% blunder rate, ±10 CPL mean increase.
- **Novelty/Staleness**: ±5 unique openings, doubling repetition count, clamp pattern diversity.
- **Time Management**: adjust to 45/65/85 to simulate fast vs slow play.

Record the score deltas for each perturbation, summarizing median, max, and expected direction.

### Output
- `sensitivity_results.json`: includes before/after trait values for each perturbation.
- `sensitivity_summary.md`: text report noting coefficients that might need adjustment.

## Success Criteria
- Opposed traits should maintain negative correlations under perturbations (Aggressive vs Patient, Novelty vs Staleness).
- Moderate metric changes (±10%) should move trait scores by ≤8 points unless the player’s style is genuinely extreme.
- Traits for different styles should spread according to benchmarks (e.g., Tal remains ≥90 aggressive even after modest penalties).

## Next Steps
1. Implement automated experimentation script using `personality_scoring.PersonalityScorer` and captured metrics.
2. Analyze results to prioritize formula adjustments before entering the calibration iteration phase.
