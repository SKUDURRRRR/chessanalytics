#!/usr/bin/env python3
"""Investigate if opening_normalized has too many variations"""
import sys
from pathlib import Path
from collections import Counter

PROJECT_ROOT = Path(__file__).resolve().parent
PYTHON_DIR = PROJECT_ROOT / 'python'
if str(PYTHON_DIR) not in sys.path:
    sys.path.insert(0, str(PYTHON_DIR))

SUPABASE_URL = "https://nhpsnvhvfscrmyniihdn.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ocHNudmh2ZnNjcm15bmlpaGRuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTg4MjMxNywiZXhwIjoyMDc1NDU4MzE3fQ.DStrQSLMktOibIkN8EJTiLlvvbSSNLQ0dzsBS2HHrd0"

from supabase import create_client

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

print("="*70)
print("OPENING GRANULARITY INVESTIGATION")
print("="*70)

for user_id in ['krecetas', 'skudurelis']:
    print(f"\n{'='*70}")
    print(f"{user_id.upper()}")
    print(f"{'='*70}")
    
    # Get ALL games
    response = supabase.table('games').select('opening_normalized').eq('user_id', user_id).eq('platform', 'lichess').execute()
    
    games = response.data if response.data else []
    print(f"\nTotal games: {len(games)}")
    
    if not games:
        continue
    
    # Count openings
    opening_values = [g.get('opening_normalized') or 'Unknown' for g in games]
    opening_counts = Counter(opening_values)
    
    print(f"\nUnique opening_normalized values: {len(opening_counts)}")
    print(f"\nAll openings (sorted by frequency):")
    for opening, count in opening_counts.most_common(40):
        percentage = (count / len(games)) * 100
        print(f"  {opening}: {count} games ({percentage:.1f}%)")
    
    # Look for potential groupings
    print(f"\n{'='*60}")
    print("POTENTIAL OVER-SPLITTING:")
    print("="*60)
    
    # Group by first word (e.g., "Italian", "Sicilian", etc.)
    first_word_counts = Counter()
    for opening in opening_values:
        first_word = opening.split()[0] if opening and opening != 'Unknown' else 'Unknown'
        first_word_counts[first_word] += 1
    
    print(f"\nGrouped by first word (rough family grouping):")
    for family, count in first_word_counts.most_common(20):
        percentage = (count / len(games)) * 100
        # Show which variations exist
        variations = [o for o in opening_counts.keys() if o.startswith(family)]
        if len(variations) > 1:
            print(f"\n  {family}: {count} games ({percentage:.1f}%)")
            print(f"    Variations: {len(variations)}")
            for var in sorted(variations)[:5]:
                var_count = opening_counts[var]
                print(f"      - {var}: {var_count}")
            if len(variations) > 5:
                print(f"      ... and {len(variations) - 5} more")

print(f"\n{'='*70}")
print("DIAGNOSIS")
print("="*70)
print("\nIf you see many variations of the same opening family:")
print("  → opening_normalized is too granular")
print("  → Should group variations together")
print("  → Example: 'Sicilian Defense: Najdorf' → 'Sicilian Defense'")

