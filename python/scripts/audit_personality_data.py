#!/usr/bin/env python3
"""Audit calibration data quality for personality benchmarks.

This script validates that each reference player used in calibration has
sufficient, well-balanced game data (time controls, colors, opening coverage)
and flags issues to address before formula tuning.
"""

import os
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from supabase import Client, create_client


# Configuration -----------------------------------------------------------------
REFERENCE_PLAYERS = [
    {"user_id": "magnuscarlsen", "platform": "lichess", "display": "Magnus Carlsen"},
    {"user_id": "fabianocaruana", "platform": "lichess", "display": "Fabiano Caruana"},
    {"user_id": "hikaru", "platform": "chess.com", "display": "Hikaru Nakamura"},
    {"user_id": "vishy64theking", "platform": "lichess", "display": "Viswanathan Anand"},
    {"user_id": "dingliren", "platform": "lichess", "display": "Ding Liren"},
    {"user_id": "houshou", "platform": "lichess", "display": "Hou Yifan"},
    {"user_id": "garykasparov", "platform": "lichess", "display": "Garry Kasparov"},
    {"user_id": "mikhail_tal", "platform": "lichess", "display": "Mikhail Tal"},
    {"user_id": "bobbyfischer", "platform": "lichess", "display": "Bobby Fischer"},
    {"user_id": "capablanca", "platform": "lichess", "display": "José Raúl Capablanca"},
]

MIN_RECENT_YEARS = 15
MIN_GAMES = 40
MIN_OPENING_FAMILIES = 6


# Data models -------------------------------------------------------------------

@dataclass
class PlayerAudit:
    user_id: str
    platform: str
    display: str
    total_games: int
    analyzed_games: int
    classical_games: int
    rapid_games: int
    blitz_games: int
    white_games: int
    black_games: int
    unique_openings: int
    last_game: Optional[str]
    issues: List[str]

    def summary(self) -> Dict[str, Any]:
        return {
            "user_id": self.user_id,
            "platform": self.platform,
            "display": self.display,
            "total_games": self.total_games,
            "analyzed_games": self.analyzed_games,
            "classical_games": self.classical_games,
            "rapid_games": self.rapid_games,
            "blitz_games": self.blitz_games,
            "white_games": self.white_games,
            "black_games": self.black_games,
            "unique_openings": self.unique_openings,
            "last_game": self.last_game,
            "issues": self.issues,
        }


# Helpers ----------------------------------------------------------------------

def load_environment() -> None:
    load_dotenv()  # root .env
    project_root = Path(__file__).resolve().parents[2]
    load_dotenv(project_root / "python" / ".env", override=False)
    load_dotenv(project_root / ".env.local", override=False)
    load_dotenv(project_root / "python" / ".env.local", override=False)


def get_supabase_client() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_KEY"))
    if not url or not key:
        raise RuntimeError("Missing Supabase credentials; set SUPABASE_URL and service role key.")
    return create_client(url, key)


def fetch_games(client: Client, user_id: str, platform: str) -> List[Dict[str, Any]]:
    response = client.table("games") \
        .select("provider_game_id, time_control, played_at, color, opening_family") \
        .eq("user_id", user_id) \
        .eq("platform", platform) \
        .order("played_at", desc=True) \
        .limit(500) \
        .execute()
    return response.data or []


def fetch_analysis_count(client: Client, user_id: str, platform: str) -> int:
    response = client.table("game_analyses") \
        .select("id", count="exact", head=True) \
        .eq("user_id", user_id) \
        .eq("platform", platform) \
        .execute()
    return getattr(response, "count", 0) or 0


def classify_speed(time_control: Optional[str]) -> str:
    if not time_control:
        return "unknown"
    if time_control[0].isdigit():
        # Chess.com style (e.g., "600+0")
        try:
            base = int(time_control.split("+")[0])
            if base >= 900:
                return "classical"
            if base >= 300:
                return "rapid"
            return "blitz"
        except ValueError:
            pass
    speed = time_control.lower()
    if "classical" in speed or "standard" in speed:
        return "classical"
    if "rapid" in speed or "15|10" in speed:
        return "rapid"
    if "blitz" in speed or "bullet" in speed:
        return "blitz"
    return "unknown"


def audit_player(client: Client, player: Dict[str, str]) -> PlayerAudit:
    user_id = player["user_id"]
    platform = player["platform"]
    display = player["display"]

    games = fetch_games(client, user_id, platform)
    analyses = fetch_analysis_count(client, user_id, platform)

    classical_games = rapid_games = blitz_games = unknown_speed = 0
    white_games = black_games = 0
    opening_families = set()
    issues: List[str] = []
    last_game_date: Optional[str] = None

    for game in games:
        speed = classify_speed(game.get("time_control"))
        if speed == "classical":
            classical_games += 1
        elif speed == "rapid":
            rapid_games += 1
        elif speed == "blitz":
            blitz_games += 1
        else:
            unknown_speed += 1

        color = (game.get("color") or "").lower()
        if color == "white":
            white_games += 1
        elif color == "black":
            black_games += 1

        opening_family = game.get("opening_family") or game.get("opening")
        if opening_family:
            opening_families.add(opening_family)

        played_at = game.get("played_at")
        if played_at and not last_game_date:
            last_game_date = played_at

    total_games = len(games)
    unique_openings = len(opening_families)

    if total_games < MIN_GAMES:
        issues.append(f"Insufficient games ({total_games} < {MIN_GAMES})")
    if classical_games < MIN_GAMES // 2:
        issues.append("Too few classical games")
    if abs(white_games - black_games) > MIN_GAMES // 2:
        issues.append("Color imbalance detected")
    if unique_openings < MIN_OPENING_FAMILIES:
        issues.append("Limited opening diversity")
    if analyses < MIN_GAMES:
        issues.append("Not enough analyzed games; re-run Stockfish analysis")

    if last_game_date:
        try:
            cleaned = last_game_date.replace("Z", "")
            last_dt = datetime.fromisoformat(cleaned)
            if last_dt.tzinfo is None:
                last_dt = last_dt.replace(tzinfo=UTC)
            years_since = (datetime.now(UTC) - last_dt).days / 365.25
            if years_since > MIN_RECENT_YEARS:
                issues.append(f"Games are outdated ({years_since:.1f} years since last recorded game)")
        except ValueError:
            issues.append("Invalid played_at timestamp format")

    return PlayerAudit(
        user_id=user_id,
        platform=platform,
        display=display,
        total_games=total_games,
        analyzed_games=analyses,
        classical_games=classical_games,
        rapid_games=rapid_games,
        blitz_games=blitz_games,
        white_games=white_games,
        black_games=black_games,
        unique_openings=unique_openings,
        last_game=last_game_date,
        issues=issues or ["OK"],
    )


def main() -> None:
    load_environment()
    client = get_supabase_client()

    audits = [audit_player(client, player) for player in REFERENCE_PLAYERS]

    print("Personality calibration data audit")
    for audit in audits:
        print("\n===", audit.display, f"({audit.user_id}@{audit.platform}) ===")
        print(f"  Total games fetched: {audit.total_games}")
        print(f"  Analyzed games: {audit.analyzed_games}")
        print(f"  Classical/Rapid/Blitz: {audit.classical_games}/{audit.rapid_games}/{audit.blitz_games}")
        print(f"  Color split (W/B): {audit.white_games}/{audit.black_games}")
        print(f"  Opening families: {audit.unique_openings}")
        print(f"  Last game recorded: {audit.last_game}")
        print(f"  Issues: {', '.join(audit.issues)}")


if __name__ == "__main__":
    main()
