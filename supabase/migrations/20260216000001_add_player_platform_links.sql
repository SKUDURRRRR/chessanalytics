-- Cross-platform player profile links
-- Maps Chess.com usernames to Lichess usernames for any player (not just authenticated users)

CREATE TABLE IF NOT EXISTS player_platform_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chess_com_username TEXT NOT NULL,
  lichess_username TEXT NOT NULL,
  source TEXT DEFAULT 'manual',  -- 'manual', 'user_linked', 'seed'
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Each username can only appear in one link (chess.com is case-insensitive, stored lowercase)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ppl_chess_com ON player_platform_links(LOWER(chess_com_username));
-- Lichess is case-sensitive
CREATE UNIQUE INDEX IF NOT EXISTS idx_ppl_lichess ON player_platform_links(lichess_username);

-- Seed well-known players
INSERT INTO player_platform_links (chess_com_username, lichess_username, source) VALUES
  ('hikaru', 'Hikaru', 'seed'),
  ('magnuscarlsen', 'DrNykterstein', 'seed'),
  ('danielnaroditsky', 'DanielNaroditsky', 'seed')
ON CONFLICT DO NOTHING;

-- Auto-populate from existing authenticated users who have both accounts linked
INSERT INTO player_platform_links (chess_com_username, lichess_username, source)
SELECT chess_com_username, lichess_username, 'user_linked'
FROM authenticated_users
WHERE chess_com_username IS NOT NULL AND lichess_username IS NOT NULL
ON CONFLICT DO NOTHING;
