#!/usr/bin/env python3
"""Analyze Patient trait scoring to understand why scores are high"""
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
PYTHON_DIR = PROJECT_ROOT / 'python'
if str(PYTHON_DIR) not in sys.path:
    sys.path.insert(0, str(PYTHON_DIR))

from core.personality_scoring import PersonalityScorer, PersonalityMetrics

def test_patient_scenarios():
    """Test different player scenarios to see what Patient scores result"""
    
    scorer = PersonalityScorer()
    
    print("="*70)
    print("PATIENT TRAIT SCORING ANALYSIS")
    print("="*70)
    print("\nTesting different player profiles to understand Patient scoring\n")
    
    scenarios = [
        {
            "name": "Perfect Player (impossible)",
            "total_moves": 40,
            "forcing_moves": 5,
            "quiet_moves": 35,
            "blunders": 0,
            "mistakes": 0,
            "inaccuracies": 0,
            "quiet_safe": 35,
            "endgame_moves": 10,
            "endgame_best": 10,
            "safe_streak_max": 20,
            "time_score": 90
        },
        {
            "name": "Excellent Player (1800-2000 rated)",
            "total_moves": 40,
            "forcing_moves": 10,
            "quiet_moves": 30,
            "blunders": 1,
            "mistakes": 2,
            "inaccuracies": 4,
            "quiet_safe": 25,
            "endgame_moves": 10,
            "endgame_best": 8,
            "safe_streak_max": 12,
            "time_score": 75
        },
        {
            "name": "Good Player (1500-1700)",
            "total_moves": 40,
            "forcing_moves": 15,
            "quiet_moves": 25,
            "blunders": 2,
            "mistakes": 4,
            "inaccuracies": 6,
            "quiet_safe": 18,
            "endgame_moves": 10,
            "endgame_best": 6,
            "safe_streak_max": 8,
            "time_score": 60
        },
        {
            "name": "Average Player (1200-1400)",
            "total_moves": 40,
            "forcing_moves": 18,
            "quiet_moves": 22,
            "blunders": 3,
            "mistakes": 5,
            "inaccuracies": 8,
            "quiet_safe": 14,
            "endgame_moves": 10,
            "endgame_best": 4,
            "safe_streak_max": 6,
            "time_score": 50
        },
        {
            "name": "Fast/Aggressive Player",
            "total_moves": 40,
            "forcing_moves": 25,
            "quiet_moves": 15,
            "blunders": 4,
            "mistakes": 6,
            "inaccuracies": 8,
            "quiet_safe": 8,
            "endgame_moves": 8,
            "endgame_best": 3,
            "safe_streak_max": 4,
            "time_score": 35
        },
        {
            "name": "Very Aggressive/Risky",
            "total_moves": 40,
            "forcing_moves": 30,
            "quiet_moves": 10,
            "blunders": 6,
            "mistakes": 7,
            "inaccuracies": 10,
            "quiet_safe": 4,
            "endgame_moves": 6,
            "endgame_best": 2,
            "safe_streak_max": 3,
            "time_score": 25
        }
    ]
    
    for scenario in scenarios:
        print(f"\n{'-'*70}")
        print(f"Scenario: {scenario['name']}")
        print(f"{'-'*70}")
        
        # Create metrics
        metrics = PersonalityMetrics(
            total_moves=scenario['total_moves'],
            blunders=scenario['blunders'],
            mistakes=scenario['mistakes'],
            inaccuracies=scenario['inaccuracies'],
            best_moves=0,
            forcing_moves=scenario['forcing_moves'],
            forcing_best=0,
            checks=0,
            captures=0,
            quiet_moves=scenario['quiet_moves'],
            quiet_best=0,
            quiet_safe=scenario['quiet_safe'],
            creative_moves=0,
            inaccurate_creative_moves=0,
            consecutive_repeat_count=0,
            forcing_streak_max=0,
            forcing_streaks=0,
            quiet_streak_max=0,
            safe_streak_max=scenario['safe_streak_max'],
            endgame_moves=scenario['endgame_moves'],
            endgame_best=scenario['endgame_best'],
            early_moves=0,
            early_creative_moves=0,
            opening_moves_count=0,
            centipawn_mean=0.0,
            centipawn_std=0.0,
            pattern_diversity=0.0,
            piece_type_count=0,
            opening_unique_count=0,
            unique_san_count=0,
            time_management_score=scenario['time_score']
        )
        
        # Calculate Patient score
        patient_score = scorer.score_patient(metrics)
        
        # Show breakdown
        forcing_ratio = metrics.forcing_moves / metrics.total_moves
        quiet_ratio = metrics.quiet_moves / metrics.total_moves
        blunder_rate = metrics.blunders / metrics.total_moves
        mistake_rate = metrics.mistakes / metrics.total_moves
        inaccuracy_rate = metrics.inaccuracies / metrics.total_moves
        quiet_safety = (metrics.quiet_safe / metrics.quiet_moves) if metrics.quiet_moves > 0 else 0.5
        endgame_accuracy = (metrics.endgame_best / metrics.endgame_moves) if metrics.endgame_moves > 0 else quiet_safety
        time_factor = metrics.time_management_score / 100.0
        
        # Calculate components (must match PersonalityScorer.score_patient())
        base = 35.0
        quiet_bonus = quiet_ratio * 25.0
        forcing_penalty = forcing_ratio * 75.0
        stability_bonus = min(8.0, quiet_safety * 20.0)
        endgame_bonus = min(7.0, endgame_accuracy * 18.0)
        time_bonus = min(12.0, time_factor * 28.0)
        streak_bonus = min(4.0, metrics.safe_streak_max * 1.0)
        discipline_penalty = (blunder_rate * 50.0) + (mistake_rate * 32.0) + (inaccuracy_rate * 20.0)
        
        print(f"\nInput Stats:")
        print(f"  Forcing moves: {scenario['forcing_moves']}/{scenario['total_moves']} ({forcing_ratio*100:.1f}%)")
        print(f"  Quiet moves: {scenario['quiet_moves']}/{scenario['total_moves']} ({quiet_ratio*100:.1f}%)")
        print(f"  Blunders: {scenario['blunders']} ({blunder_rate*100:.1f}%)")
        print(f"  Mistakes: {scenario['mistakes']} ({mistake_rate*100:.1f}%)")
        print(f"  Inaccuracies: {scenario['inaccuracies']} ({inaccuracy_rate*100:.1f}%)")
        print(f"  Time management: {scenario['time_score']}")
        
        print(f"\nScore Components:")
        print(f"  Base score:        +{base:.1f}")
        print(f"  Quiet bonus:       +{quiet_bonus:.1f} ({quiet_ratio*100:.0f}% quiet × 25)")
        print(f"  Forcing penalty:   -{forcing_penalty:.1f} ({forcing_ratio*100:.0f}% forcing × 75)")
        print(f"  Stability bonus:   +{stability_bonus:.1f} (quiet safety × 20)")
        print(f"  Endgame bonus:     +{endgame_bonus:.1f} (endgame accuracy × 18)")
        print(f"  Time bonus:        +{time_bonus:.1f} (time mgmt {scenario['time_score']} × 28)")
        print(f"  Streak bonus:      +{streak_bonus:.1f} (max streak × 1.0)")
        print(f"  Discipline penalty:-{discipline_penalty:.1f} (blunders×50 + mistakes×32 + inaccuracies×20)")
        
        calculated = base + quiet_bonus - forcing_penalty + stability_bonus + endgame_bonus + time_bonus + streak_bonus - discipline_penalty
        
        print(f"\n  CALCULATED: {calculated:.1f}")
        print(f"  FINAL (clamped): {patient_score:.1f}")
        print(f"\n  → {'HIGH' if patient_score >= 70 else 'MEDIUM' if patient_score >= 50 else 'LOW'} Patient")

    print(f"\n{'='*70}")
    print("OBSERVATIONS")
    print(f"{'='*70}\n")
    print("Look at which components contribute most to scores:")
    print("- Quiet bonus can add up to 25 points (100% quiet × 25)")
    print("- Forcing penalty can subtract up to 75 points (100% forcing × 75)")
    print("- Time bonus can add up to 12 points")
    print("- Stability + endgame can add 15 points")
    print("- Discipline penalty is significant (errors really hurt)")
    print("\nBalancing notes:")
    print("1. Natural opposition with Aggressive through forcing/quiet ratio")
    print("2. Strong forcing penalty creates clear differentiation")
    print("3. Discipline penalty is substantial to separate patient vs sloppy play")
    print("4. Base of 35 requires earning the patient label")

if __name__ == "__main__":
    test_patient_scenarios()

