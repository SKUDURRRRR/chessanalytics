#!/usr/bin/env python3
"""Check actual opening variety in database"""
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
print("ACTUAL OPENING VARIETY CHECK")
print("="*70)

for user_id in ['krecetas', 'skudurelis']:
    print(f"\n{'='*70}")
    print(f"{user_id.upper()}")
    print(f"{'='*70}")
    
    # Get ALL games
    response = supabase.table('games').select('opening, opening_family, opening_normalized').eq('user_id', user_id).eq('platform', 'lichess').execute()
    
    games = response.data if response.data else []
    print(f"\nTotal games: {len(games)}")
    
    if not games:
        continue
    
    # Count by each field
    opening_counts = Counter(g.get('opening') or 'Empty' for g in games)
    family_counts = Counter(g.get('opening_family') or 'Empty' for g in games)
    normalized_counts = Counter(g.get('opening_normalized') or 'Empty' for g in games)
    
    print(f"\n1. OPENING FIELD:")
    print(f"   Unique values: {len(opening_counts)}")
    for opening, count in opening_counts.most_common(10):
        print(f"   {opening}: {count} ({count/len(games)*100:.1f}%)")
    
    print(f"\n2. OPENING_FAMILY (ECO):")
    print(f"   Unique values: {len(family_counts)}")
    for family, count in family_counts.most_common(10):
        print(f"   {family}: {count} ({count/len(games)*100:.1f}%)")
    
    print(f"\n3. OPENING_NORMALIZED:")
    print(f"   Unique values: {len(normalized_counts)}")
    for normalized, count in normalized_counts.most_common(10):
        print(f"   {normalized}: {count} ({count/len(games)*100:.1f}%)")
    
    # Calculate diversity metrics (same as personality code)
    opening_family_values = [g.get('opening_family') or g.get('opening') or 'Unknown' for g in games]
    opening_family_counter = Counter(opening_family_values)
    
    unique_openings = len(opening_family_counter)
    diversity_ratio = unique_openings / len(games)
    most_common = opening_family_counter.most_common(1)[0] if opening_family_counter else ('None', 0)
    repetition_ratio = most_common[1] / len(games)
    
    print(f"\n4. PERSONALITY CALCULATION (using opening_family or opening):")
    print(f"   Unique openings: {unique_openings}")
    print(f"   Diversity ratio: {diversity_ratio:.2f}")
    print(f"   Most common: {most_common[0]} ({most_common[1]} games, {repetition_ratio*100:.1f}%)")
    
    print(f"\n5. EXPECTED PERSONALITY SCORES:")
    if diversity_ratio > 0.5:
        print(f"   Novelty: HIGH (70-90)")
        print(f"   Staleness: LOW (30-50)")
    elif diversity_ratio > 0.3:
        print(f"   Novelty: MODERATE (50-70)")
        print(f"   Staleness: MODERATE (50-70)")
    else:
        print(f"   Novelty: LOW (30-50)")
        print(f"   Staleness: HIGH (70-90)")
    
    if repetition_ratio > 0.7:
        print(f"   → Very repetitive player (plays same opening {repetition_ratio*100:.0f}% of time)")
    elif repetition_ratio > 0.5:
        print(f"   → Somewhat repetitive player")
    else:
        print(f"   → Varied opening repertoire")

print(f"\n{'='*70}")
print("DIAGNOSIS")
print("="*70)
print("\nIf Krecetas has high repetition (>70%):")
print("  → He IS a repetitive player")
print("  → Novelty should be LOW (30-50)")
print("  → Staleness should be HIGH (70-90)")
print("\nIf Skudurelis has high diversity (>50%):")
print("  → He IS a varied player")
print("  → Novelty should be HIGH (70-90)")
print("  → Staleness should be LOW (30-50)")

