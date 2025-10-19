#!/usr/bin/env python3
"""Seed opening metadata for a Lichess user by querying the Lichess API.

This script pulls games via the Lichess NDJSON export API, extracts the
opening name/ECO code, and updates the Supabase `games` table accordingly.

Example:
    python scripts/update_openings_from_lichess.py --user audingo
"""

from __future__ import annotations

import argparse
import json
import os
from dataclasses import dataclass
from typing import Iterable, Optional

import requests
from dotenv import load_dotenv
from supabase import Client, create_client


LICHESS_API_TEMPLATE = (
    "https://lichess.org/api/games/user/{user}?max={max_games}"
    "&opening=true&pgnInJson=true"
)


@dataclass
class OpeningRecord:
    provider_id: str
    opening: str
    opening_family: str


def load_supabase_client(dotenv_path: str) -> Client:
    """Create a Supabase client using credentials from a dotenv file."""

    if dotenv_path and os.path.exists(dotenv_path):
        load_dotenv(dotenv_path)
    else:
        # Fallback to default load if custom path missing
        load_dotenv()

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the environment"
        )

    return create_client(url, key)


def fetch_lichess_openings(user: str, max_games: int = 200) -> Iterable[OpeningRecord]:
    """Yield opening metadata records from Lichess for the given user."""

    url = LICHESS_API_TEMPLATE.format(user=user, max_games=max_games)
    headers = {
        "Accept": "application/x-ndjson",
        "User-Agent": "ChessAnalytics/1.0 (Contact: support@chessanalytics.app)",
    }

    response = requests.get(url, headers=headers, timeout=60)
    response.raise_for_status()

    for raw_line in response.text.splitlines():
        raw_line = raw_line.strip()
        if not raw_line:
            continue

        try:
            payload = json.loads(raw_line)
        except json.JSONDecodeError:
            continue

        provider_id: Optional[str] = payload.get("id")
        opening_info = payload.get("opening") or {}
        opening_name: Optional[str] = opening_info.get("name")
        opening_family: Optional[str] = opening_info.get("eco")

        if not provider_id or not opening_name:
            continue

        yield OpeningRecord(
            provider_id=provider_id,
            opening=opening_name,
            opening_family=opening_family or "Unknown",
        )


def update_openings(
    client: Client,
    user: str,
    platform: str,
    records: Iterable[OpeningRecord],
) -> int:
    """Update Supabase with opening metadata for the supplied records."""

    updated = 0
    for record in records:
        update_payload = {
            "opening": record.opening,
            "opening_family": record.opening_family,
        }
        client.table("games").update(update_payload)\
            .eq("user_id", user)\
            .eq("platform", platform)\
            .eq("provider_game_id", record.provider_id)\
            .execute()
        updated += 1
    return updated


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--user", required=True, help="Lichess username to update")
    parser.add_argument(
        "--platform",
        default="lichess",
        help="Platform name stored in Supabase (default: lichess)",
    )
    parser.add_argument(
        "--max-games",
        type=int,
        default=200,
        help="Maximum games to fetch from Lichess API",
    )
    parser.add_argument(
        "--dotenv",
        default=os.path.join("python", ".env"),
        help="Path to dotenv file containing Supabase credentials",
    )
    args = parser.parse_args()

    client = load_supabase_client(args.dotenv)
    records = list(fetch_lichess_openings(args.user, max_games=args.max_games))

    if not records:
        print(f"No openings found for user {args.user}")
        return

    updated = update_openings(client, args.user, args.platform, records)
    print(f"Updated openings for {updated} games (user={args.user})")


if __name__ == "__main__":
    main()
