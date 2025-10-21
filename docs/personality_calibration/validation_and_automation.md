# Validation & Automation Plan

After calibration stabilizes, automation ensures score integrity over time. This plan covers drift monitoring, reporting, and change control.

## Automated Checks

1. **Nightly Drift Report**
   - Script: (to be reintroduced) `scripts/nightly_personality_drift.py`.
   - Inputs: top N active users + benchmark players.
   - Output: JSON and Markdown summaries comparing current scores vs expected ranges.
   - Alerts: trigger when any trait deviates >6 points from previous 7-day mean or leaves benchmark band.

2. **Regression Test Suite**
   - Expand `test_personality_*` to include regression fixtures keyed to benchmark ranges.
   - Add synthetic edge cases (e.g., 90% forcing moves, 95% quiet moves) to guard against formula regressions.

3. **Dashboard Hooks**
   - Expose summary statistics for internal admin panel (average trait values, standard deviation, correlation matrix).
   - Log recalibration events with timestamps and commit hashes.

## Change Management

- Maintain `calibration_log.md` documenting formula adjustments, rationale, and validation outcomes.
- Require calibration checklist before deployment: audit → sensitivity analysis → recalculation → human review → automated regression.
- Store historical reports under `logs/personality_drift/` for trend analysis.

## Future Enhancements

- Integrate with analytics pipeline (Supabase functions or scheduled jobs) to run directly in production environment.
- Link drift alerts to Slack/email using webhook when deviations occur.
- Evaluate ML-based anomaly detection once sufficient historical data accumulates.
