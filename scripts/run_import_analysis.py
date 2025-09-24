#!/usr/bin/env python3
"""Utility script to import a sample Lichess game and run Stockfish analysis."""

import asyncio
import io
import json
import os
from datetime import datetime
from typing import Any, Dict

import requests
import chess.pgn

from supabase import create_client

# Ensure project root on sys.path
import sys
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(ROOT_DIR)
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from python.core.unified_api_server import (  # noqa: E402
    _canonical_user_id,
    _save_stockfish_analysis,
)
from python.core.analysis_engine import (  # noqa: E402
    ChessAnalysisEngine,
    AnalysisType,
    AnalysisConfig,
)
from python.core import config as backend_config  # noqa: E402

PLAYER = os.environ.get("IMPORT_ANALYSIS_USER", "drnykterstein")
PLATFORM = "lichess"
MAX_GAMES = int(os.environ.get("IMPORT_ANALYSIS_MAX", "1"))
ANALYSIS_DEPTH = int(os.environ.get("IMPORT_ANALYSIS_DEPTH", "5"))
ANALYSIS_SKILL = int(os.environ.get("IMPORT_ANALYSIS_SKILL", "5"))

SUPABASE_URL = os.environ.get("SUPABASE_URL") or backend_config.get_config().database.url
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or backend_config.get_config().database.service_role_key


def create_supabase_service_client():
    if not SUPABASE_URL or not SERVICE_ROLE_KEY:
        raise RuntimeError("Supabase credentials missing; ensure .env files are loaded")
    return create_client(SUPABASE_URL, SERVICE_ROLE_KEY)


def fetch_lichess_games(username: str, max_games: int = 1):
    url = f"https://lichess.org/api/games/user/{username}"
    params = {
        "max": max_games,
        "pgnInJson": "true",
        "moves": "true",
        "opening": "true",
        "clock": "false",
    }
    headers = {"Accept": "application/x-ndjson"}
    response = requests.get(url, params=params, headers=headers, timeout=30)
    response.raise_for_status()
    games = []
    for line in response.text.strip().splitlines():
        if not line:
            continue
        data = json.loads(line)
        games.append(data)
    if not games:
        raise RuntimeError(f"No games returned for user {username}")
    return games


def build_game_row(game_json: Dict[str, Any], canonical_user_id: str) -> Dict[str, Any]:
    game_id = game_json.get("id")
    opening = (game_json.get("opening") or {}).get("name")
    speed = game_json.get("speed")
    players = game_json.get("players", {})
    created_at = game_json.get("createdAt")
    played_at = None
    if created_at:
        played_at = datetime.utcfromtimestamp(created_at / 1000).isoformat() + "Z"
    color = "white"
    opponent_rating = None
    my_rating = None
    result = "draw"
    for side in ("white", "black"):
        side_info = players.get(side, {})
        user_info = side_info.get("user", {})
        name = user_info.get("name")
        if name and name.lower() == canonical_user_id.lower():
            color = side
            my_rating = side_info.get("rating")
            result = side_info.get("result") or result
        else:
            opponent_rating = side_info.get("rating", opponent_rating)
    return {
        "user_id": canonical_user_id,
        "platform": PLATFORM,
        "provider_game_id": game_id,
        "result": result,
        "color": color,
        "time_control": speed,
        "opening": opening,
        "opening_family": opening,
        "opponent_rating": opponent_rating,
        "my_rating": my_rating,
        "played_at": played_at,
    }


def build_games_pgn_row(game_json: Dict[str, Any], canonical_user_id: str) -> Dict[str, Any]:
    game_id = game_json.get("id")
    pgn = game_json.get("pgn")
    return {
        "user_id": canonical_user_id,
        "platform": PLATFORM,
        "provider_game_id": game_id,
        "pgn": pgn,
    }


def ensure_profile(supabase_service, canonical_user_id: str, sample_rating: int | None):
    display_name = canonical_user_id
    if sample_rating is None:
        sample_rating = 1200
    payload = {
        "user_id": canonical_user_id,
        "platform": PLATFORM,
        "display_name": display_name,
        "current_rating": sample_rating,
        "total_games": 0,
        "last_accessed": datetime.utcnow().isoformat() + "Z",
    }
    supabase_service.table("user_profiles").upsert(payload, on_conflict="user_id,platform").execute()


def parse_first_pgn(game_json: Dict[str, Any]):
    pgn = game_json.get("pgn")
    if not pgn:
        raise RuntimeError("Game JSON missing PGN data")
    return pgn


async def analyze_and_save(engine: ChessAnalysisEngine, game_json: Dict[str, Any], canonical_user_id: str):
    game_id = game_json.get("id")
    pgn = parse_first_pgn(game_json)
    game_io = io.StringIO(pgn)
    chess.pgn.read_game(game_io)  # Validate PGN parses; raises if malformed
    analysis = await engine.analyze_game(pgn, canonical_user_id, PLATFORM, AnalysisType.STOCKFISH, game_id)
    if analysis is None:
        raise RuntimeError("Analysis returned None")
    saved = await _save_stockfish_analysis(analysis)
    if not saved:
        raise RuntimeError("Failed to persist Stockfish analysis")
    return analysis


async def main():
    canonical_user = _canonical_user_id(PLAYER, PLATFORM)
    supabase_service = create_supabase_service_client()

    print(f"Fetching games for {PLAYER} ({canonical_user})...")
    games = fetch_lichess_games(PLAYER, MAX_GAMES)
    primary_game = games[0]

    print("Upserting profile and game records in Supabase...")
    ensure_profile(supabase_service, canonical_user, primary_game.get("players", {}).get("white", {}).get("rating"))
    games_payload = build_game_row(primary_game, canonical_user)
    pgn_payload = build_games_pgn_row(primary_game, canonical_user)
    supabase_service.table("games").upsert(games_payload, on_conflict="user_id,platform,provider_game_id").execute()
    supabase_service.table("games_pgn").upsert(pgn_payload, on_conflict="user_id,platform,provider_game_id").execute()

    print("Running Stockfish analysis...")
    engine = ChessAnalysisEngine(AnalysisConfig(
        analysis_type=AnalysisType.STOCKFISH,
        depth=ANALYSIS_DEPTH,
        skill_level=ANALYSIS_SKILL
    ))
    analysis = await analyze_and_save(engine, primary_game, canonical_user)

    print(f"Analysis complete for game {analysis.game_id}. Accuracy: {analysis.accuracy}")


if __name__ == "__main__":
    asyncio.run(main())
