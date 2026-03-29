#!/usr/bin/env python3
"""
Seed the puzzle_bank table with puzzles from the Lichess database.

Usage:
  python python/scripts/seed_puzzle_bank.py [--count 5000] [--min-rating 800] [--max-rating 2500] [--fallback-only]

Downloads from: https://database.lichess.org/lichess_db_puzzle.csv.zst
Falls back to python/data/fallback_puzzles.json if download fails.
"""

import argparse
import csv
import io
import json
import logging
import os
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root / "python"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

LICHESS_PUZZLE_URL = "https://database.lichess.org/lichess_db_puzzle.csv.zst"
FALLBACK_PATH = Path(__file__).parent.parent / "data" / "fallback_puzzles.json"
BATCH_SIZE = 500


def get_supabase_client():
    """Get Supabase service role client."""
    from dotenv import load_dotenv
    from supabase import create_client

    load_dotenv('.env.local')
    load_dotenv()

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        logger.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
        sys.exit(1)

    return create_client(url, key)


def parse_lichess_row(row: dict) -> dict:
    """Parse a Lichess CSV row into a puzzle_bank record."""
    moves = row["Moves"].split(" ")
    themes = row["Themes"].split(" ") if row.get("Themes") else []
    opening_tags = row["OpeningTags"].split(" ") if row.get("OpeningTags") else []

    return {
        "id": row["PuzzleId"],
        "fen": row["FEN"],
        "moves": moves,
        "rating": int(row["Rating"]),
        "rating_deviation": int(row["RatingDeviation"]),
        "popularity": int(row["Popularity"]),
        "nb_plays": int(row["NbPlays"]),
        "themes": themes,
        "game_url": row.get("GameUrl", ""),
        "opening_tags": opening_tags,
    }


def download_and_filter_puzzles(
    count: int = 5000,
    min_rating: int = 800,
    max_rating: int = 2500,
    min_popularity: int = 70,
) -> list[dict]:
    """Download Lichess puzzle CSV and filter a curated subset."""
    try:
        import zstandard
        import requests
    except ImportError:
        logger.error(
            "Required packages not installed. Run: pip install zstandard requests"
        )
        return []

    logger.info(f"Downloading Lichess puzzle database from {LICHESS_PUZZLE_URL}...")
    logger.info(
        f"Filtering: count={count}, rating={min_rating}-{max_rating}, popularity>={min_popularity}"
    )

    # Rating buckets for even distribution
    bucket_size = 100
    buckets: dict[int, list[dict]] = {}
    for r in range(min_rating, max_rating, bucket_size):
        buckets[r] = []

    per_bucket = max(1, count // len(buckets))

    try:
        response = requests.get(LICHESS_PUZZLE_URL, stream=True, timeout=30)
        response.raise_for_status()

        dctx = zstandard.ZstdDecompressor()
        reader = dctx.stream_reader(response.raw)
        text_reader = io.TextIOWrapper(reader, encoding="utf-8")
        csv_reader = csv.DictReader(text_reader)

        total_processed = 0
        total_kept = 0

        for row in csv_reader:
            total_processed += 1

            if total_processed % 100000 == 0:
                logger.info(f"Processed {total_processed} puzzles, kept {total_kept}...")

            rating = int(row["Rating"])
            popularity = int(row["Popularity"])

            if rating < min_rating or rating >= max_rating:
                continue
            if popularity < min_popularity:
                continue

            bucket_key = (rating // bucket_size) * bucket_size
            bucket_key = max(min_rating, min(bucket_key, max_rating - bucket_size))

            if len(buckets.get(bucket_key, [])) >= per_bucket:
                continue

            puzzle = parse_lichess_row(row)
            buckets.setdefault(bucket_key, []).append(puzzle)
            total_kept += 1

            if total_kept >= count:
                break

        logger.info(f"Downloaded {total_kept} puzzles from {total_processed} processed")
        all_puzzles = []
        for bucket_puzzles in buckets.values():
            all_puzzles.extend(bucket_puzzles)
        return all_puzzles

    except Exception as e:
        logger.error(f"Download failed: {e}")
        return []


def load_fallback_puzzles() -> list[dict]:
    """Load puzzles from bundled fallback JSON."""
    if not FALLBACK_PATH.exists():
        logger.error(f"Fallback file not found: {FALLBACK_PATH}")
        return []

    logger.info(f"Loading fallback puzzles from {FALLBACK_PATH}")
    with open(FALLBACK_PATH, "r", encoding="utf-8") as f:
        puzzles = json.load(f)

    logger.info(f"Loaded {len(puzzles)} fallback puzzles")
    return puzzles


def seed_database(puzzles: list[dict]) -> int:
    """Insert puzzles into puzzle_bank table."""
    if not puzzles:
        logger.warning("No puzzles to seed")
        return 0

    supabase = get_supabase_client()

    # Check existing count
    existing = supabase.table("puzzle_bank").select("id", count="exact").execute()
    existing_count = existing.count or 0
    logger.info(f"Existing puzzles in database: {existing_count}")

    # Get existing IDs to avoid duplicates
    existing_ids = set()
    if existing_count > 0:
        result = supabase.table("puzzle_bank").select("id").execute()
        existing_ids = {r["id"] for r in result.data}

    new_puzzles = [p for p in puzzles if p["id"] not in existing_ids]
    logger.info(f"New puzzles to insert: {len(new_puzzles)} (skipping {len(puzzles) - len(new_puzzles)} duplicates)")

    if not new_puzzles:
        return 0

    inserted = 0
    for i in range(0, len(new_puzzles), BATCH_SIZE):
        batch = new_puzzles[i : i + BATCH_SIZE]
        try:
            supabase.table("puzzle_bank").insert(batch).execute()
            inserted += len(batch)
            logger.info(f"Inserted batch {i // BATCH_SIZE + 1}: {len(batch)} puzzles")
        except Exception as e:
            logger.error(f"Batch insert failed: {e}")

    logger.info(f"Successfully seeded {inserted} puzzles")
    return inserted


def main():
    parser = argparse.ArgumentParser(description="Seed puzzle_bank with Lichess puzzles")
    parser.add_argument("--count", type=int, default=5000, help="Number of puzzles to seed")
    parser.add_argument("--min-rating", type=int, default=800, help="Minimum puzzle rating")
    parser.add_argument("--max-rating", type=int, default=2500, help="Maximum puzzle rating")
    parser.add_argument(
        "--fallback-only",
        action="store_true",
        help="Only use bundled fallback JSON (no download)",
    )
    args = parser.parse_args()

    if args.fallback_only:
        puzzles = load_fallback_puzzles()
    else:
        puzzles = download_and_filter_puzzles(
            count=args.count,
            min_rating=args.min_rating,
            max_rating=args.max_rating,
        )
        if not puzzles:
            logger.warning("Download failed, falling back to bundled puzzles")
            puzzles = load_fallback_puzzles()

    if puzzles:
        count = seed_database(puzzles)
        logger.info(f"Seeding complete: {count} new puzzles added")
    else:
        logger.error("No puzzles available to seed")
        sys.exit(1)


if __name__ == "__main__":
    main()
