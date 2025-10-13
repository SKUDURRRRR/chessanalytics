#!/usr/bin/env python3
"""Check how many games each player has"""
import requests

BACKEND_URL = "http://localhost:8002"

def get_stats(user_id, platform):
    url = f"{BACKEND_URL}/api/v1/stats/{user_id}/{platform}?analysis_type=stockfish"
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            return response.json()
        return None
    except:
        return None

players = [("krecetas", "lichess"), ("skudurelis", "lichess")]

print("="*60)
print("GAMES ANALYZED PER PLAYER")
print("="*60)

for user_id, platform in players:
    stats = get_stats(user_id, platform)
    if stats:
        total = stats.get('total_games_analyzed', 0)
        print(f"\n{user_id.upper()}:")
        print(f"  Total games analyzed: {total}")
        print(f"  Re-analyzing 5 games = {5/total*100:.1f}% of data" if total > 0 else "  No games")
    else:
        print(f"\n{user_id.upper()}: Could not fetch stats")

print(f"\n{'='*60}")
print("RECOMMENDATION")
print("="*60)
print("\nTo see significant changes in Patient scores:")
print("1. Need to re-analyze ALL games (not just 5)")
print("2. Or wait until enough new games accumulate")
print("\nWould you like to re-analyze all games? (~1-2 minutes)")

