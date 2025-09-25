-- Restrict games_pgn permissions to avoid unauthorised writes
REVOKE ALL ON public.games_pgn FROM anon;
GRANT SELECT ON public.games_pgn TO anon;
