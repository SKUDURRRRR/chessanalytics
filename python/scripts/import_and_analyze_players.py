#!/usr/bin/env python3
"""Import and analyze calibration players using backend APIs.

For each configured player, this script:
1. Triggers smart import (fetches games from platform if available).
2. Launches Stockfish analysis for the most recent games.
3. Fetches deep-analysis personality scores for verification.
4. Saves a summary report under logs/.
"""

import json
import os
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Dict, List

import requests
from dotenv import load_dotenv


PLAYERS: List[Dict[str, str]] = [
    {"user_id": "MagnusCarlsen", "platform": "chess.com", "display": "Magnus Carlsen"},
    {"user_id": "FabianoCaruana", "platform": "chess.com", "display": "Fabiano Caruana"},
    {"user_id": "Chefshouse", "platform": "chess.com", "display": "Ding Liren"},
    {"user_id": "Firouzja2003", "platform": "chess.com", "display": "Alireza Firouzja"},
    {"user_id": "LevonAronian", "platform": "chess.com", "display": "Levon Aronian"},
    {"user_id": "lachesisQ", "platform": "chess.com", "display": "Ian Nepomniachtchi"},
    {"user_id": "GukeshDommaraju", "platform": "chess.com", "display": "Dommaraju Gukesh"},
    {"user_id": "rpragchess", "platform": "chess.com", "display": "Rameshbabu Praggnanandhaa"},
    {"user_id": "GHANDEEVAM2003", "platform": "chess.com", "display": "Arjun Erigaisi"},
    {"user_id": "Hikaru", "platform": "chess.com", "display": "Hikaru Nakamura"},
    {"user_id": "veteran75", "platform": "lichess", "display": "Vladimir Kramnik"},
]

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8002")
ANALYSIS_LIMIT = int(os.getenv("CALIBRATION_ANALYSIS_LIMIT", "40"))
SLEEP_AFTER_ANALYSIS = int(os.getenv("CALIBRATION_ANALYSIS_SLEEP", "15"))
RUN_IN_PARALLEL = os.getenv("CALIBRATION_ANALYSIS_PARALLEL", "false").lower() == "true"
REPORT_DIR = Path(os.getenv("CALIBRATION_LOG_DIR", "logs/calibration_runs"))


def load_environment() -> None:
    """Load environment variables from standard .env locations."""
    root = Path(__file__).resolve().parents[2]
    load_dotenv(root / '.env')
    load_dotenv(root / '.env.local', override=False)
    load_dotenv(root / 'python' / '.env', override=False)
    load_dotenv(root / 'python' / '.env.local', override=False)


def post(url: str, payload: Dict[str, Any], timeout: int = 600) -> Dict[str, Any]:
    response = requests.post(url, json=payload, timeout=timeout)
    response.raise_for_status()
    return response.json()


def get(url: str, timeout: int = 60) -> Dict[str, Any]:
    response = requests.get(url, timeout=timeout)
    response.raise_for_status()
    return response.json()


def import_games(player: Dict[str, str]) -> Dict[str, Any]:
    url = f"{BACKEND_URL}/api/v1/import-games-smart"
    payload = {"user_id": player['user_id'], "platform": player['platform']}
    return post(url, payload, timeout=600)


def analyze_games(player: Dict[str, str]) -> Dict[str, Any]:
    payload = {
        "user_id": player['user_id'],
        "platform": player['platform'],
        "analysis_type": "stockfish",
        "limit": ANALYSIS_LIMIT,
    }
    params = "?use_parallel=true" if RUN_IN_PARALLEL else "?use_parallel=false"
    url = f"{BACKEND_URL}/api/v1/analyze{params}"
    return post(url, payload, timeout=900)


def fetch_personality(player: Dict[str, str]) -> Dict[str, Any]:
    url = f"{BACKEND_URL}/api/v1/deep-analysis/{player['user_id']}/{player['platform']}"
    return get(url, timeout=120)


def process_player(player: Dict[str, str]) -> Dict[str, Any]:
    print(f"\n=== Processing {player['display']} ({player['user_id']}@{player['platform']}) ===")
    result: Dict[str, Any] = {"player": player, "import": None, "analysis": None, "deep": None, "error": None}
    try:
        import_result = import_games(player)
        print("Import message:", import_result.get("message"))
        result["import"] = import_result

        analysis_result = analyze_games(player)
        print("Analysis message:", analysis_result.get("message"))
        result["analysis"] = analysis_result

        print(f"Waiting {SLEEP_AFTER_ANALYSIS}s for analysis to settle...")
        time.sleep(SLEEP_AFTER_ANALYSIS)

        deep_result = fetch_personality(player)
        scores = deep_result.get("personality_scores")
        print("Personality scores:", scores)
        result["deep"] = deep_result
    except Exception as exc:  # pragma: no cover - runtime logging only
        print("! Error:", exc)
        result["error"] = str(exc)
    return result


def write_report(results: List[Dict[str, Any]]) -> Path:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    dest = REPORT_DIR / f"import_analysis_{datetime.now(UTC).strftime('%Y%m%d_%H%M%S')}.json"
    with dest.open("w", encoding="utf-8") as f:
        json.dump(
            {
                "generated_at": datetime.now(UTC).isoformat(),
                "backend_url": BACKEND_URL,
                "analysis_limit": ANALYSIS_LIMIT,
                "results": results,
            },
            f,
            indent=2,
        )
    return dest


def main() -> None:
    load_environment()
    print(f"Using backend: {BACKEND_URL}")
    print(f"Analysis limit per player: {ANALYSIS_LIMIT} (parallel={RUN_IN_PARALLEL})")
    results: List[Dict[str, Any]] = []
    for player in PLAYERS:
        results.append(process_player(player))
    report_path = write_report(results)
    print(f"\nSummary report written to {report_path}")


if __name__ == "__main__":
    main()
