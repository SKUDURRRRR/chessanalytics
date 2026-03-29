-- Migration: Add SQL aggregate functions for comprehensive analytics
-- Purpose: Replace fetching 10,000+ rows with efficient GROUP BY queries
-- This reduces the comprehensive-analytics endpoint response time from 2-5s to <500ms

-- Function 1: Basic game stats (win/loss/draw, color stats, highest ELO)
CREATE OR REPLACE FUNCTION get_player_aggregate_stats(p_user_id TEXT, p_platform TEXT)
RETURNS JSON
LANGUAGE sql STABLE
AS $$
  SELECT json_build_object(
    'total_games', COUNT(*),
    'wins', COUNT(*) FILTER (WHERE result = 'win'),
    'losses', COUNT(*) FILTER (WHERE result = 'loss'),
    'draws', COUNT(*) FILTER (WHERE result = 'draw'),
    'white_games', COUNT(*) FILTER (WHERE color = 'white'),
    'white_wins', COUNT(*) FILTER (WHERE color = 'white' AND result = 'win'),
    'white_draws', COUNT(*) FILTER (WHERE color = 'white' AND result = 'draw'),
    'white_losses', COUNT(*) FILTER (WHERE color = 'white' AND result = 'loss'),
    'white_avg_elo', ROUND(AVG(my_rating) FILTER (WHERE color = 'white'))::int,
    'black_games', COUNT(*) FILTER (WHERE color = 'black'),
    'black_wins', COUNT(*) FILTER (WHERE color = 'black' AND result = 'win'),
    'black_draws', COUNT(*) FILTER (WHERE color = 'black' AND result = 'draw'),
    'black_losses', COUNT(*) FILTER (WHERE color = 'black' AND result = 'loss'),
    'black_avg_elo', ROUND(AVG(my_rating) FILTER (WHERE color = 'black'))::int,
    'highest_elo', MAX(my_rating),
    'avg_total_moves', ROUND(AVG(total_moves))::int
  )
  FROM games
  WHERE user_id = p_user_id AND platform = p_platform;
$$;

-- Function 2: Opening stats aggregated via GROUP BY
CREATE OR REPLACE FUNCTION get_player_opening_stats(p_user_id TEXT, p_platform TEXT)
RETURNS JSON
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(json_agg(row_to_json(stats) ORDER BY stats.games DESC), '[]'::json)
  FROM (
    SELECT
      COALESCE(NULLIF(opening_normalized, ''), NULLIF(opening, ''), 'Unknown') AS opening,
      COUNT(*)::int AS games,
      COUNT(*) FILTER (WHERE result = 'win')::int AS wins,
      COUNT(*) FILTER (WHERE result = 'draw')::int AS draws,
      COUNT(*) FILTER (WHERE result = 'loss')::int AS losses,
      ROUND((COUNT(*) FILTER (WHERE result = 'win')::numeric / NULLIF(COUNT(*), 0) * 100)::numeric, 1) AS "winRate",
      ROUND(AVG(my_rating))::int AS "averageElo"
    FROM games
    WHERE user_id = p_user_id AND platform = p_platform
    GROUP BY COALESCE(NULLIF(opening_normalized, ''), NULLIF(opening, ''), 'Unknown')
  ) stats;
$$;

-- Function 3: Game length distribution bucketed
CREATE OR REPLACE FUNCTION get_player_game_length_distribution(p_user_id TEXT, p_platform TEXT)
RETURNS JSON
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(json_object_agg(bucket, row_to_json(stats)), '{}'::json)
  FROM (
    SELECT
      CASE
        WHEN total_moves < 20 THEN 'under_20'
        WHEN total_moves < 40 THEN '20_39'
        WHEN total_moves < 60 THEN '40_59'
        WHEN total_moves < 80 THEN '60_79'
        WHEN total_moves < 100 THEN '80_99'
        ELSE '100_plus'
      END AS bucket,
      COUNT(*)::int AS games,
      COUNT(*) FILTER (WHERE result = 'win')::int AS wins,
      COUNT(*) FILTER (WHERE result = 'loss')::int AS losses,
      COUNT(*) FILTER (WHERE result = 'draw')::int AS draws
    FROM games
    WHERE user_id = p_user_id AND platform = p_platform
      AND total_moves IS NOT NULL AND total_moves > 0
    GROUP BY 1
  ) stats;
$$;

-- Function 4: Opening stats per color (for opening color performance)
-- Returns openings grouped by player color with identifiers
CREATE OR REPLACE FUNCTION get_player_opening_color_stats(p_user_id TEXT, p_platform TEXT)
RETURNS JSON
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(json_agg(row_to_json(stats)), '[]'::json)
  FROM (
    SELECT
      color,
      COALESCE(NULLIF(opening_normalized, ''), NULLIF(opening_family, ''), NULLIF(opening, ''), 'Unknown') AS opening,
      COUNT(*)::int AS games,
      COUNT(*) FILTER (WHERE result = 'win')::int AS wins,
      COUNT(*) FILTER (WHERE result = 'draw')::int AS draws,
      COUNT(*) FILTER (WHERE result = 'loss')::int AS losses,
      ROUND((COUNT(*) FILTER (WHERE result = 'win')::numeric / NULLIF(COUNT(*), 0) * 100)::numeric, 1) AS "winRate",
      ROUND(AVG(my_rating))::int AS "averageElo",
      -- Collect unique identifiers for filtering
      array_agg(DISTINCT opening_family) FILTER (WHERE opening_family IS NOT NULL AND opening_family != '') AS opening_families,
      array_agg(DISTINCT opening) FILTER (WHERE opening IS NOT NULL AND opening != '') AS openings
    FROM games
    WHERE user_id = p_user_id AND platform = p_platform
      AND color IN ('white', 'black')
    GROUP BY color, COALESCE(NULLIF(opening_normalized, ''), NULLIF(opening_family, ''), NULLIF(opening, ''), 'Unknown')
    ORDER BY color, COUNT(*) DESC
  ) stats;
$$;

-- Function 5: Performance trends per time control (recent 50 games each)
-- Returns recent win rate, average ELO, and trend per time control
CREATE OR REPLACE FUNCTION get_player_performance_trends(p_user_id TEXT, p_platform TEXT)
RETURNS JSON
LANGUAGE sql STABLE
AS $$
  WITH ranked_games AS (
    SELECT
      result,
      my_rating,
      time_control,
      played_at,
      ROW_NUMBER() OVER (PARTITION BY time_control ORDER BY played_at DESC) AS rn,
      COUNT(*) OVER (PARTITION BY time_control) AS tc_total
    FROM games
    WHERE user_id = p_user_id AND platform = p_platform
      AND time_control IS NOT NULL AND time_control != ''
  ),
  recent_stats AS (
    SELECT
      time_control,
      tc_total,
      COUNT(*)::int AS sample_size,
      ROUND((COUNT(*) FILTER (WHERE result = 'win')::numeric / NULLIF(COUNT(*), 0) * 100)::numeric, 1) AS recent_win_rate,
      ROUND(AVG(my_rating) FILTER (WHERE my_rating IS NOT NULL))::int AS recent_avg_elo
    FROM ranked_games
    WHERE rn <= 50
    GROUP BY time_control, tc_total
  ),
  -- For ELO trend: compare games 21-40 vs games 1-20 (most recent)
  trend_data AS (
    SELECT
      time_control,
      ROUND(AVG(my_rating) FILTER (WHERE rn BETWEEN 1 AND 20 AND my_rating IS NOT NULL))::int AS recent_20_avg,
      ROUND(AVG(my_rating) FILTER (WHERE rn BETWEEN 21 AND 40 AND my_rating IS NOT NULL))::int AS older_20_avg
    FROM ranked_games
    WHERE rn <= 40
    GROUP BY time_control
    HAVING COUNT(*) FILTER (WHERE rn <= 40) >= 40
  )
  SELECT json_build_object(
    'per_time_control', COALESCE((
      SELECT json_object_agg(
        rs.time_control,
        json_build_object(
          'recentWinRate', rs.recent_win_rate,
          'recentAverageElo', COALESCE(rs.recent_avg_elo, 0),
          'eloTrend', CASE
            WHEN td.recent_20_avg IS NOT NULL AND td.older_20_avg IS NOT NULL
              AND td.recent_20_avg > td.older_20_avg + 10 THEN 'improving'
            WHEN td.recent_20_avg IS NOT NULL AND td.older_20_avg IS NOT NULL
              AND td.recent_20_avg < td.older_20_avg - 10 THEN 'declining'
            ELSE 'stable'
          END,
          'sampleSize', rs.sample_size
        )
      )
      FROM recent_stats rs
      LEFT JOIN trend_data td ON td.time_control = rs.time_control
    ), '{}'::json),
    'most_played_time_control', (
      SELECT time_control FROM recent_stats ORDER BY sample_size DESC LIMIT 1
    )
  );
$$;

-- Function 6: Highest ELO with time control, and current ELO per time control
CREATE OR REPLACE FUNCTION get_player_elo_summary(p_user_id TEXT, p_platform TEXT)
RETURNS JSON
LANGUAGE sql STABLE
AS $$
  WITH highest AS (
    SELECT my_rating, time_control
    FROM games
    WHERE user_id = p_user_id AND platform = p_platform AND my_rating IS NOT NULL
    ORDER BY my_rating DESC
    LIMIT 1
  ),
  current_per_tc AS (
    SELECT DISTINCT ON (time_control)
      time_control,
      my_rating
    FROM games
    WHERE user_id = p_user_id AND platform = p_platform AND my_rating IS NOT NULL
    ORDER BY time_control, played_at DESC
  ),
  current_overall AS (
    SELECT my_rating
    FROM games
    WHERE user_id = p_user_id AND platform = p_platform AND my_rating IS NOT NULL
    ORDER BY played_at DESC
    LIMIT 1
  )
  SELECT json_build_object(
    'highestElo', (SELECT my_rating FROM highest),
    'timeControlWithHighestElo', (SELECT time_control FROM highest),
    'currentElo', (SELECT my_rating FROM current_overall),
    'currentEloPerTimeControl', COALESCE((
      SELECT json_object_agg(time_control, my_rating) FROM current_per_tc
    ), '{}'::json)
  );
$$;

-- Grant execute permissions to authenticated and anon roles
GRANT EXECUTE ON FUNCTION get_player_aggregate_stats(TEXT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_player_opening_stats(TEXT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_player_game_length_distribution(TEXT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_player_opening_color_stats(TEXT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_player_performance_trends(TEXT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_player_elo_summary(TEXT, TEXT) TO authenticated, anon;
