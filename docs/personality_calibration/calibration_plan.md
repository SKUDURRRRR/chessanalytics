# Calibration Iteration Plan

This guide outlines how to conduct trait calibration after sensitivity measurements. It focuses on tuning formula coefficients while keeping scores aligned with benchmark expectations.

## Workflow

1. **Baseline Snapshot**
   - Run `audit_personality_data.py` to ensure datasets remain healthy.
   - Collect current trait scores for all benchmark players (`python/core/unified_api_server._compute_personality_scores`).
   - Store results in `data/calibration_runs/run_<date>.json`.

2. **Adjustment Targets**
   - Compare actual scores against ranges listed in `benchmark_reference.md`.
   - Prioritize traits with largest deviations (>8 points out of band).
   - Document hypotheses (e.g., Aggressive base too low, Staleness repetition bonus too high).

3. **Formula Tweaks**
   - Modify constants in `python/core/personality_scoring.py` incrementally (≤10% per iteration).
   - For structural changes (new metrics), create experimental branches before merging.
   - Record change rationale in `calibration_log.md`.

4. **Recompute & Evaluate**
   - Re-run Stockfish analysis for affected players (ensure new data reflects formula changes).
   - Generate comparison tables summarizing before vs after scores.
   - Confirm that opposed traits remain negatively correlated.

5. **Regression Checks**
   - Execute existing tests (`test_personality_improvements.py`, `test_personality_demo.py`) plus any new unit tests for edge cases.
   - Ensure average user profiles do not drift outside 45–65 ranges unless justified.

6. **Iteration Criteria**
   - Stop when all benchmarks fall within target bands and qualitative review (next phase) agrees with outputs.
   - If not converging, revisit sensitivity assumptions or dataset composition.

## Documentation Requirements

- `calibration_log.md`: chronological list of changes, impact metrics, and reviewer notes.
- Updated `benchmark_reference.md` if ranges evolve based on expert feedback.
- Summary memo for stakeholders after each major iteration.
