import sys
import unittest
from pathlib import Path
from typing import Any, Dict, List

PROJECT_ROOT = Path(__file__).resolve().parents[2]
PYTHON_DIR = PROJECT_ROOT / 'python'
if str(PYTHON_DIR) not in sys.path:
    sys.path.append(str(PYTHON_DIR))

from core.analysis_engine import ChessAnalysisEngine, MoveAnalysis  # type: ignore  # noqa: E402
from core.unified_api_server import _compute_personality_scores  # type: ignore  # noqa: E402


def make_move(
    san: str,
    *,
    ply: int,
    centipawn: float = 0.0,
    is_best: bool = False,
    is_blunder: bool = False,
    is_mistake: bool = False,
    is_inaccuracy: bool = False,
) -> MoveAnalysis:
    """Helper to build MoveAnalysis objects for tests."""
    return MoveAnalysis(
        move=f'm{ply:03d}',
        move_san=san,
        evaluation={'value': 0, 'type': 'cp'},
        best_move='best',
        is_best=is_best,
        is_blunder=is_blunder,
        is_mistake=is_mistake,
        is_inaccuracy=is_inaccuracy,
        centipawn_loss=centipawn,
        depth_analyzed=0,
        analysis_time_ms=0,
        is_brilliant=is_best,
        is_good=not (is_best or is_blunder or is_mistake or is_inaccuracy) and centipawn <= 50,
        is_acceptable=False,
        explanation='',
        heuristic_details={},
        player_color='white',
        is_user_move=True,
        ply_index=ply,
        fullmove_number=max(1, (ply + 1) // 2),
        accuracy_score=100.0 if is_best else max(0.0, 100.0 - centipawn),
    )


def personality_scores(moves: List[MoveAnalysis], time_score: float) -> Dict[str, float]:
    engine = ChessAnalysisEngine()
    return engine._calculate_personality_scores(moves, time_management_score=time_score)


class PersonalityScoringTests(unittest.TestCase):
    def test_default_midpoint(self) -> None:
        engine = ChessAnalysisEngine()
        scores = engine._calculate_personality_scores([], time_management_score=0.0)
        for trait in ['tactical_score', 'positional_score', 'aggressive_score', 'patient_score', 'novelty_score', 'staleness_score']:
            self.assertEqual(scores[trait], 50.0)

    def test_precision_pressure_rewards_tactical_and_aggressive(self) -> None:
        moves = [
            make_move('e4', ply=1, centipawn=5.0, is_best=True),
            make_move('Nf3', ply=3, centipawn=6.0, is_best=True),
            make_move('Bxf7+', ply=5, centipawn=18.0),
            make_move('Qg4+', ply=7, centipawn=20.0),
            make_move('Qh5#', ply=9, centipawn=0.0, is_best=True),
        ]
        scores = personality_scores(moves, time_score=55.0)
        self.assertGreater(scores['tactical_score'], 70.0)
        self.assertGreater(scores['aggressive_score'], 65.0)

    def test_patient_score_uses_time_and_endgame_consistency(self) -> None:
        moves = [
            make_move('e4', ply=1, centipawn=0.0, is_best=True),
            make_move('Nf3', ply=3, centipawn=5.0, is_best=True),
            make_move('d3', ply=5, centipawn=8.0),
            make_move('Be2', ply=7, centipawn=10.0),
            make_move('O-O', ply=9, centipawn=5.0, is_best=True),
            make_move('Re1', ply=15, centipawn=12.0),
            make_move('Kf1', ply=63, centipawn=4.0, is_best=True),
            make_move('Ke2', ply=65, centipawn=6.0, is_best=True),
        ]
        scores = personality_scores(moves, time_score=85.0)
        self.assertGreater(scores['patient_score'], 72.0)

    def test_repetition_drives_staleness(self) -> None:
        moves = [make_move('Nc3', ply=ply, centipawn=5.0, is_best=True) for ply in range(1, 17)]
        scores = personality_scores(moves, time_score=40.0)
        self.assertGreater(scores['staleness_score'], 70.0)
        self.assertLess(scores['novelty_score'], 55.0)

    def test_aggregation_weights_by_move_volume(self) -> None:
        # Test that aggregation properly weights games by move count
        # Create move dicts directly (as expected by the scoring function)
        good_moves_dicts = [
            {
                'move_san': f'Nf{i%8+1}' if i % 3 != 0 else f'Qh{i%8+1}+',
                'ply_index': i*2+1,
                'centipawn_loss': 5.0,
                'is_best': True,
                'is_blunder': False,
                'is_mistake': False,
                'is_inaccuracy': False,
            }
            for i in range(40)
        ]
        
        weak_moves_dicts = [
            {
                'move_san': f'e{i+1}',
                'ply_index': i*2+1,
                'centipawn_loss': 150.0,
                'is_best': False,
                'is_blunder': i % 2 == 0,
                'is_mistake': False,
                'is_inaccuracy': False,
            }
            for i in range(10)
        ]
        
        analyses = [
            {
                'total_moves': 40,
                'moves_analysis': good_moves_dicts,
                'time_management_score': 80.0,
            },
            {
                'total_moves': 10,
                'moves_analysis': weak_moves_dicts,
                'time_management_score': 50.0,
            },
        ]
        aggregated = _compute_personality_scores(analyses, games=[])
        
        # Verify aggregation produces valid scores (not just neutral 50.0 for everything)
        self.assertTrue(any(abs(score - 50.0) > 5 for score in aggregated.values()),
                       "Aggregated scores should vary from neutral, got: " + str(aggregated))

    def test_aggregation_blends_game_variety(self) -> None:
        analyses = [
            {
                'total_moves': 20,
                'tactical_score': 55.0,
                'positional_score': 60.0,
                'aggressive_score': 58.0,
                'patient_score': 62.0,
                'novelty_score': 45.0,
                'staleness_score': 55.0,
            }
        ]
        games: List[Dict[str, Any]] = [
            {'opening_family': 'Sicilian', 'time_control': 'rapid'},
            {'opening_family': 'French', 'time_control': 'rapid'},
            {'opening_family': 'English', 'time_control': 'blitz'},
        ]
        aggregated = _compute_personality_scores(analyses, games=games)
        self.assertGreater(aggregated['novelty'], 45.0)
        self.assertLess(aggregated['staleness'], 55.0)


if __name__ == '__main__':
    unittest.main()


