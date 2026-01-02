#!/usr/bin/env python3
"""
Test script to verify AI style analysis is working.
"""

import sys
from pathlib import Path

# Add python directory to path
sys.path.insert(0, str(Path(__file__).parent))

print("=" * 60)
print("AI STYLE ANALYSIS TEST")
print("=" * 60)
print()

# Test AI setup
from core.ai_comment_generator import AIChessCommentGenerator

print("1. Testing AI Generator Initialization")
print("-" * 60)
ai_generator = AIChessCommentGenerator()

print(f"   AI Enabled: {ai_generator.enabled}")
print(f"   Client Available: {ai_generator.client is not None}")
print()

if not ai_generator.enabled:
    print("❌ AI is not enabled!")
    print("   Check:")
    print("   - ANTHROPIC_API_KEY in .env.local")
    print("   - AI_ENABLED=true in .env.local")
    print()
    sys.exit(1)

if not ai_generator.client:
    print("❌ AI client not initialized!")
    print("   Check ANTHROPIC_API_KEY in .env.local")
    print()
    sys.exit(1)

print("✅ AI Generator is ready")
print()

# Test style analysis generation
print("2. Testing Style Analysis Generation")
print("-" * 60)

# Sample test data
test_personality_scores = {
    'tactical': 65.0,
    'positional': 69.0,
    'aggressive': 55.0,
    'patient': 61.0,
    'novelty': 50.0,
    'staleness': 60.0
}

test_player_style = {
    'category': 'positional',
    'confidence': 75.0
}

test_phase_accuracies = {
    'opening': 84.3,
    'middle': 52.5,
    'endgame': 78.0
}

print("   Generating test style analysis...")
result = ai_generator.generate_style_analysis(
    personality_scores=test_personality_scores,
    player_style=test_player_style,
    player_level='advanced',
    total_games=85,
    average_accuracy=77.3,
    phase_accuracies=test_phase_accuracies
)

if result:
    print("✅ AI Style Analysis Generated Successfully!")
    print()
    print("   Style Summary:")
    print(f"   {result.get('style_summary', 'N/A')[:100]}...")
    print()
    print("   Characteristics:")
    print(f"   {result.get('characteristics', 'N/A')[:100]}...")
    print()
    print("   Full result keys:", list(result.keys()))
else:
    print("❌ AI Style Analysis Generation Failed!")
    print("   Check backend logs for errors")
    print()
    sys.exit(1)

print()
print("=" * 60)
print("✅ AI Style Analysis is working correctly!")
print("=" * 60)
print()
print("Next steps:")
print("1. Restart your backend server to load the new code")
print("2. Force refresh your deep analysis (add ?force_refresh=true to URL)")
print("3. Check backend logs for '[STYLE ANALYSIS]' messages")
