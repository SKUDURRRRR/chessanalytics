-- Identify specific A00 openings from PGN moves
-- This breaks down "Uncommon Opening" into specific openings like:
-- Polish Opening, Van Geet Opening, Anderssen's Opening, etc.

-- Strategy:
-- 1. Find games with ECO code A00 that have "Unknown" or "Uncommon Opening"
-- 2. Identify the specific opening from the first move in the PGN
-- 3. Update both opening and opening_normalized fields

BEGIN;

-- Create a temporary function to identify A00 openings
CREATE OR REPLACE FUNCTION identify_a00_opening(pgn_text TEXT) RETURNS TEXT AS $$
DECLARE
    first_move TEXT;
    opening_name TEXT;
BEGIN
    -- Extract first move from PGN
    -- Match pattern like "1. b4" or "1.Nc3" or just the moves section
    first_move := (
        SELECT substring(pgn_text FROM '1\.\s*([a-hNBRQK][a-h1-8x+#=NBRQ-]+)')
    );

    IF first_move IS NULL THEN
        RETURN 'Uncommon Opening';
    END IF;

    -- Remove check/capture symbols for matching
    first_move := regexp_replace(first_move, '[x+#]', '', 'g');

    -- Map first moves to specific openings
    opening_name := CASE first_move
        WHEN 'b4' THEN 'Polish Opening'
        WHEN 'Nc3' THEN 'Van Geet Opening'
        WHEN 'a3' THEN 'Anderssen''s Opening'
        WHEN 'a4' THEN 'Ware Opening'
        WHEN 'g3' THEN 'Hungarian Opening'
        WHEN 'g4' THEN 'Grob Opening'
        WHEN 'Nh3' THEN 'Amar Opening'
        WHEN 'Na3' THEN 'Durkin Opening'
        WHEN 'e3' THEN 'Van''t Kruijs Opening'
        WHEN 'h3' THEN 'Clemenz Opening'
        WHEN 'h4' THEN 'Desprez Opening'
        WHEN 'f3' THEN 'Barnes Opening'
        WHEN 'c3' THEN 'Saragossa Opening'
        WHEN 'd3' THEN 'Mieses Opening'
        WHEN 'b3' THEN 'Nimzowitsch-Larsen Attack'
        WHEN 'Nf3' THEN 'Zukertort Opening'
        ELSE 'Uncommon Opening'
    END;

    RETURN opening_name;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update games with identified A00 openings
UPDATE public.games g
SET
    opening = identify_a00_opening(p.pgn),
    opening_normalized = identify_a00_opening(p.pgn)
FROM public.games_pgn p
WHERE g.user_id = p.user_id
  AND g.platform = p.platform
  AND g.provider_game_id = p.provider_game_id
  AND g.opening_family = 'A00'
  AND (g.opening = 'Unknown' OR g.opening = 'Uncommon Opening')
  AND p.pgn IS NOT NULL;

-- Log the results
DO $$
DECLARE
    updated_count INTEGER;
    opening_breakdown RECORD;
BEGIN
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % A00 games with specific opening names', updated_count;

    -- Show breakdown of identified openings
    RAISE NOTICE '';
    RAISE NOTICE 'Breakdown of identified A00 openings:';
    FOR opening_breakdown IN
        SELECT opening_normalized, COUNT(*) as count
        FROM public.games
        WHERE opening_family = 'A00'
        GROUP BY opening_normalized
        ORDER BY count DESC
    LOOP
        RAISE NOTICE '  %: % games', opening_breakdown.opening_normalized, opening_breakdown.count;
    END LOOP;
END $$;

-- Drop the temporary function
DROP FUNCTION IF EXISTS identify_a00_opening(TEXT);

COMMIT;
