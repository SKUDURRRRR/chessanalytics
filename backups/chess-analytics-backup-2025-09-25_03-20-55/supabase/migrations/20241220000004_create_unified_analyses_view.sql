-- Create unified analyses view
-- This view merges game_analyses and move_analyses tables into a consistent format

CREATE OR REPLACE VIEW unified_analyses AS
SELECT 
    COALESCE(ga.game_id, ma.game_id) AS game_id,
    COALESCE(ga.user_id, ma.user_id) AS user_id,
    COALESCE(ga.platform, ma.platform) AS platform,
    CASE 
        WHEN lower(COALESCE(ga.analysis_type, ma.analysis_method, 'basic')) LIKE 'deep%' THEN 'deep'
        WHEN lower(COALESCE(ga.analysis_type, ma.analysis_method, 'basic')) LIKE 'stockfish%' THEN 'stockfish'
        WHEN lower(COALESCE(ga.analysis_type, ma.analysis_method, 'basic')) = 'basic' THEN 'basic'
        ELSE lower(COALESCE(ga.analysis_type, ma.analysis_method, 'basic'))
    END AS analysis_type,
    COALESCE(ga.accuracy, ma.best_move_percentage, 0) AS accuracy,
    COALESCE(ma.opponent_accuracy, ga.opponent_accuracy, 0) AS opponent_accuracy,
    COALESCE(ga.blunders, move_counts.blunders, 0) AS blunders,
    COALESCE(ga.mistakes, move_counts.mistakes, 0) AS mistakes,
    COALESCE(ga.inaccuracies, move_counts.inaccuracies, 0) AS inaccuracies,
    COALESCE(ga.brilliant_moves, ma.material_sacrifices, 0) AS brilliant_moves,
    COALESCE(ga.best_moves, move_counts.best_moves, 0) AS best_moves,
    COALESCE(ga.opening_accuracy, move_counts.opening_accuracy, 0) AS opening_accuracy,
    COALESCE(ga.middle_game_accuracy, ma.middle_game_accuracy, 0) AS middle_game_accuracy,
    COALESCE(ga.endgame_accuracy, ma.endgame_accuracy, 0) AS endgame_accuracy,
    COALESCE(ma.tactical_score, ga.tactical_score, 0) AS tactical_score,
    COALESCE(ma.positional_score, ga.positional_score, 0) AS positional_score,
    COALESCE(ma.aggressive_score, ga.aggressive_score, 0) AS aggressive_score,
    COALESCE(ma.patient_score, ga.patient_score, 0) AS patient_score,
    COALESCE(ma.endgame_score, ga.endgame_score, 0) AS endgame_score,
    COALESCE(ma.opening_score, ga.opening_score, 0) AS opening_score,
    COALESCE(ma.average_centipawn_loss, ga.average_centipawn_loss, 0) AS average_centipawn_loss,
    COALESCE(ma.worst_blunder_centipawn_loss, ga.worst_blunder_centipawn_loss, 0) AS worst_blunder_centipawn_loss,
    COALESCE(ma.time_management_score, ga.time_management_score, 0) AS time_management_score,
    COALESCE(ma.opponent_time_management_score, ga.opponent_time_management_score, 0) AS opponent_time_management_score,
    COALESCE(ma.material_sacrifices, 0) AS material_sacrifices,
    COALESCE(ma.aggressiveness_index, 0) AS aggressiveness_index,
    COALESCE(ma.average_evaluation, ga.average_evaluation, 0) AS average_evaluation,
    COALESCE(ma.tactical_patterns, ga.tactical_patterns, '[]'::jsonb) AS tactical_patterns,
    COALESCE(ma.positional_patterns, ga.positional_patterns, '[]'::jsonb) AS positional_patterns,
    COALESCE(ma.strategic_themes, ga.strategic_themes, '[]'::jsonb) AS strategic_themes,
    COALESCE(ma.moves_analysis, ga.moves_analysis, '[]'::jsonb) AS moves_analysis,
    COALESCE(ma.analysis_date, ga.analysis_date, NOW()) AS analysis_date,
    COALESCE(ma.processing_time_ms, ga.processing_time_ms, 0) AS processing_time_ms,
    COALESCE(ma.stockfish_depth, ga.stockfish_depth, 0) AS stockfish_depth
FROM game_analyses ga
FULL OUTER JOIN move_analyses ma
    ON ga.user_id = ma.user_id
   AND ga.platform = ma.platform
   AND ga.game_id = ma.game_id
CROSS JOIN LATERAL (
    SELECT
        COUNT(*) FILTER (WHERE move_elem.json->>'is_blunder' = 'true') AS blunders,
        COUNT(*) FILTER (WHERE move_elem.json->>'is_mistake' = 'true') AS mistakes,
        COUNT(*) FILTER (WHERE move_elem.json->>'is_inaccuracy' = 'true') AS inaccuracies,
        COUNT(*) FILTER (WHERE move_elem.json->>'is_best' = 'true') AS best_moves,
        COALESCE(
            (COUNT(*) FILTER (WHERE move_elem.json->>'is_best' = 'true' AND move_elem.opening_ply <= 15)::FLOAT /
             NULLIF(COUNT(*) FILTER (WHERE move_elem.opening_ply <= 15), 0) * 100),
            0
        ) AS opening_accuracy
    FROM (
        SELECT
            elem AS json,
            CASE
                WHEN (elem->>'opening_ply') ~ '^[0-9]+$' THEN (elem->>'opening_ply')::INT
                ELSE NULL
            END AS opening_ply
        FROM jsonb_array_elements(COALESCE(ma.moves_analysis, ga.moves_analysis, '[]'::jsonb)) elem
    ) move_elem
) move_counts
WHERE COALESCE(ga.game_id, ma.game_id) IS NOT NULL;

-- Grant permissions
GRANT SELECT ON unified_analyses TO authenticated;
GRANT SELECT ON unified_analyses TO anon;
