-- Simplified legacy unified analyses view to avoid missing column references
DROP VIEW IF EXISTS unified_analyses;

CREATE VIEW unified_analyses AS
SELECT
    ga.game_id,
    ga.user_id,
    ga.platform,
    COALESCE(ga.analysis_type, 'basic') AS analysis_type,
    ga.accuracy,
    ga.analysis_date
FROM game_analyses ga;

GRANT SELECT ON unified_analyses TO authenticated;
GRANT SELECT ON unified_analyses TO anon;
