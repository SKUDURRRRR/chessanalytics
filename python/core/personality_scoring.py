#!/usr/bin/env python3
"""
Standardized Personality Scoring Module
Provides consistent personality trait calculations across the chess analytics platform.
"""

from typing import Dict, List, Any, Optional
from dataclasses import dataclass
import math


@dataclass
class PersonalityMetrics:
    """Standardized metrics for personality scoring."""
    total_moves: int
    blunders: int
    mistakes: int
    inaccuracies: int
    best_moves: int
    forcing_moves: int
    forcing_best: int
    checks: int
    captures: int
    quiet_moves: int
    quiet_best: int
    quiet_safe: int
    creative_moves: int
    inaccurate_creative_moves: int
    consecutive_repeat_count: int
    forcing_streak_max: int
    forcing_streaks: int
    quiet_streak_max: int
    safe_streak_max: int
    endgame_moves: int
    endgame_best: int
    early_moves: int
    early_creative_moves: int
    opening_moves_count: int
    centipawn_mean: float
    centipawn_std: float
    pattern_diversity: float
    piece_type_count: int
    opening_unique_count: int
    unique_san_count: int
    time_management_score: float = 0.0
    pressure_moves: int = 0
    pressure_gain: float = 0.0
    pressure_advantage_sum: float = 0.0
    risk_moves: int = 0
    risk_severe_moves: int = 0
    risk_loss: float = 0.0
    initiative_gain: float = 0.0
    initiative_bursts: int = 0
    initiative_streak_max: int = 0
    king_pressure_moves: int = 0
    endgame_grind_moves: int = 0
    endgame_liquidation_moves: int = 0


@dataclass
class PersonalityScores:
    """Standardized personality scores with consistent field names."""
    tactical: float
    positional: float
    aggressive: float
    patient: float
    novelty: float
    staleness: float

    def to_dict(self) -> Dict[str, float]:
        """Convert to dictionary with consistent field names."""
        return {
            'tactical': self.tactical,
            'positional': self.positional,
            'aggressive': self.aggressive,
            'patient': self.patient,
            'novelty': self.novelty,
            'staleness': self.staleness,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'PersonalityScores':
        """Create from dictionary with field mapping."""
        return cls(
            tactical=float(data.get('tactical', data.get('tactical_score', 50.0))),
            positional=float(data.get('positional', data.get('positional_score', 50.0))),
            aggressive=float(data.get('aggressive', data.get('aggressive_score', 50.0))),
            patient=float(data.get('patient', data.get('patient_score', 50.0))),
            novelty=float(data.get('novelty', data.get('novelty_score', 50.0))),
            staleness=float(data.get('staleness', data.get('staleness_score', 50.0))),
        )

    @classmethod
    def neutral(cls) -> 'PersonalityScores':
        """Create neutral scores (50.0 for all traits - standard neutral)."""
        return cls(
            tactical=50.0,
            positional=50.0,
            aggressive=50.0,
            patient=50.0,
            novelty=50.0,
            staleness=50.0,
        )



class PersonalityScorer:
    """Standardized personality scoring engine."""

    # Scoring constants - standard neutral baseline
    TACTICAL_BASE_SCORE = 50.0
    POSITIONAL_BASE_SCORE = 50.0
    AGGRESSIVE_BASE_SCORE = 50.0
    PATIENT_BASE_SCORE = 50.0
    NOVELTY_BASE_SCORE = 50.0
    STALENESS_BASE_SCORE = 50.0

    @staticmethod
    def clamp_score(value: float, minimum: float = 0.0, maximum: float = 100.0) -> float:
        """Clamp a score to valid range."""
        return max(minimum, min(maximum, value))

    @staticmethod
    def is_forcing_move(move_san: str) -> bool:
        """Determine if a move is forcing (capture, check, or castle)."""
        if not move_san:
            return False
        san = move_san.strip()
        return 'x' in san or '+' in san or '#' in san or san.startswith('O-O')

    @staticmethod
    def san_piece_type(move_san: str) -> str:
        """Get piece type from SAN string."""
        if not move_san:
            return '?'
        san = move_san.strip()
        if san.startswith('O-O'):
            return 'K'
        first = san[0]
        return first if first in ('K', 'Q', 'R', 'B', 'N') else 'P'

    def compute_metrics(self, moves: List[Dict[str, Any]]) -> PersonalityMetrics:
        """Compute standardized metrics from move analysis data."""
        if not moves:
            return PersonalityMetrics(
                total_moves=0, blunders=0, mistakes=0, inaccuracies=0, best_moves=0,
                forcing_moves=0, forcing_best=0, checks=0, captures=0, quiet_moves=0,
                quiet_best=0, quiet_safe=0, creative_moves=0, inaccurate_creative_moves=0,
                consecutive_repeat_count=0, forcing_streak_max=0, forcing_streaks=0,
                quiet_streak_max=0, safe_streak_max=0, endgame_moves=0, endgame_best=0,
                early_moves=0, early_creative_moves=0, opening_moves_count=0,
                centipawn_mean=0.0, centipawn_std=0.0, pattern_diversity=0.0,
                piece_type_count=0, opening_unique_count=0, unique_san_count=0,
                pressure_moves=0, pressure_gain=0.0, pressure_advantage_sum=0.0,
                risk_moves=0, risk_severe_moves=0, risk_loss=0.0,
                initiative_gain=0.0, initiative_bursts=0, initiative_streak_max=0,
                king_pressure_moves=0, endgame_grind_moves=0, endgame_liquidation_moves=0
            )

        # Sort moves by ply index
        sorted_moves = sorted(moves, key=lambda m: m.get('ply_index', 0))
        total = len(sorted_moves)

        # Initialize metrics
        metrics = PersonalityMetrics(
            total_moves=total, blunders=0, mistakes=0, inaccuracies=0, best_moves=0,
            forcing_moves=0, forcing_best=0, checks=0, captures=0, quiet_moves=0,
            quiet_best=0, quiet_safe=0, creative_moves=0, inaccurate_creative_moves=0,
            consecutive_repeat_count=0, forcing_streak_max=0, forcing_streaks=0,
            quiet_streak_max=0, safe_streak_max=0, endgame_moves=0, endgame_best=0,
            early_moves=0, early_creative_moves=0, opening_moves_count=0,
            centipawn_mean=0.0, centipawn_std=0.0, pattern_diversity=0.0,
            piece_type_count=0, opening_unique_count=0, unique_san_count=0,
            pressure_moves=0, pressure_gain=0.0, pressure_advantage_sum=0.0,
            risk_moves=0, risk_severe_moves=0, risk_loss=0.0,
            initiative_gain=0.0, initiative_bursts=0, initiative_streak_max=0,
            king_pressure_moves=0, endgame_grind_moves=0, endgame_liquidation_moves=0
        )

        piece_types = set()
        unique_san = set()
        opening_unique = set()
        loss_sum = 0.0
        loss_sq_sum = 0.0
        forcing_streak = 0
        quiet_streak = 0
        safe_streak = 0
        initiative_streak = 0
        prev_san = None
        endgame_boundary = max(total - 8, 0)

        for index, move in enumerate(sorted_moves):
            san = move.get('move_san', '').strip()
            ply_index = move.get('ply_index', index + 1)
            loss = max(0.0, float(move.get('centipawn_loss', 0.0)))
            eval_before = move.get('evaluation_before')
            eval_after = move.get('evaluation_after')

            loss_sum += loss
            loss_sq_sum += loss * loss

            # Move quality classification
            metrics.blunders += 1 if move.get('is_blunder', False) else 0
            metrics.mistakes += 1 if move.get('is_mistake', False) else 0
            metrics.inaccuracies += 1 if move.get('is_inaccuracy', False) else 0
            metrics.best_moves += 1 if move.get('is_best', False) else 0

            # Intensity metrics require evaluation data
            eval_available = eval_before is not None and eval_after is not None
            eval_before_cp = None
            eval_after_cp = None

            if eval_available:
                try:
                    eval_before_cp = float(eval_before)
                    eval_after_cp = float(eval_after)
                except (TypeError, ValueError):
                    eval_available = False

            eval_change = 0.0
            if eval_available:
                eval_change = eval_after_cp - eval_before_cp

                # Pressure: moves that increase evaluation significantly
                if eval_change >= 50.0:
                    metrics.pressure_moves += 1
                    metrics.pressure_gain += eval_change
                if eval_after_cp >= 50.0:
                    metrics.pressure_advantage_sum += eval_after_cp

                # Risk: self-inflicted evaluation drops
                if eval_change <= -50.0:
                    metrics.risk_moves += 1
                    metrics.risk_loss += abs(eval_change)
                    if eval_change <= -150.0:
                        metrics.risk_severe_moves += 1

            # Initiative bursts: streaks of positive evaluation gain
            if eval_available:
                if eval_change > 20.0:
                    initiative_streak = initiative_streak + 1
                    metrics.initiative_gain += eval_change
                    metrics.initiative_streak_max = max(metrics.initiative_streak_max, initiative_streak)
                else:
                    initiative_streak = 0

            # Forcing vs quiet moves
            is_forcing = self.is_forcing_move(san)
            if is_forcing:
                metrics.forcing_moves += 1
                if move.get('is_best', False) or loss <= 50.0:
                    metrics.forcing_best += 1
                forcing_streak += 1
                metrics.forcing_streak_max = max(metrics.forcing_streak_max, forcing_streak)
                quiet_streak = 0
            else:
                if forcing_streak >= 3:
                    metrics.forcing_streaks += 1
                forcing_streak = 0
                metrics.quiet_moves += 1
                quiet_streak += 1
                metrics.quiet_streak_max = max(metrics.quiet_streak_max, quiet_streak)
                if move.get('is_best', False) or loss <= 30.0:
                    metrics.quiet_best += 1
                if loss <= 40.0:
                    metrics.quiet_safe += 1

            # Safe streak tracking
            safe_streak = safe_streak + 1 if loss <= 30.0 and not move.get('is_blunder', False) else 0
            metrics.safe_streak_max = max(metrics.safe_streak_max, safe_streak)

            # Move type analysis
            if '+' in san or '#' in san:
                metrics.checks += 1
                metrics.king_pressure_moves += 1
            if 'x' in san:
                metrics.captures += 1

            # Creative moves: annotated moves that are also accurate
            if '!' in san or '?' in san:
                if move.get('is_best', False) or loss <= 50.0:
                    metrics.creative_moves += 1
                else:
                    metrics.inaccurate_creative_moves += 1

            # Pattern diversity
            piece_types.add(self.san_piece_type(san))
            if san:
                unique_san.add(san)
                if san == prev_san:
                    metrics.consecutive_repeat_count += 1
                prev_san = san

            # Phase analysis
            if ply_index <= 20:
                metrics.early_moves += 1
                metrics.opening_moves_count += 1
                if san:
                    opening_unique.add(san)
                if (not move.get('is_best', False) and
                    not move.get('is_blunder', False) and
                    not move.get('is_mistake', False) and
                    not move.get('is_inaccuracy', False) and
                    loss <= 35.0):
                    metrics.early_creative_moves += 1

            if index >= endgame_boundary or ply_index >= 60:
                metrics.endgame_moves += 1
                if move.get('is_best', False) or loss <= 40.0:
                    metrics.endgame_best += 1
                if eval_available:
                    if abs(eval_after_cp) >= 80.0 and loss <= 40.0:
                        metrics.endgame_grind_moves += 1
                    if eval_change < -60.0 and 'x' in san:
                        metrics.endgame_liquidation_moves += 1

        # Finalize streaks
        if forcing_streak >= 3:
            metrics.forcing_streaks += 1

        # Calculate statistics
        if total > 0:
            metrics.centipawn_mean = loss_sum / total
            variance = max(0.0, (loss_sq_sum / total) - (metrics.centipawn_mean ** 2))
            metrics.centipawn_std = math.sqrt(variance)
            metrics.pattern_diversity = len(unique_san) / total

            metrics.pressure_gain = metrics.pressure_gain / total
            metrics.pressure_advantage_sum = metrics.pressure_advantage_sum / total
            metrics.risk_loss = metrics.risk_loss / total
            metrics.initiative_gain = metrics.initiative_gain / total

        metrics.piece_type_count = len(piece_types)
        metrics.opening_unique_count = len(opening_unique)
        metrics.unique_san_count = len(unique_san)

        return metrics

    def score_tactical(self, metrics: PersonalityMetrics) -> float:
        """Calculate tactical score - accuracy in forcing sequences.

        GMs should score 80-92 based on their high accuracy in forcing moves.
        Elite GMs (95+) need 80%+ best move rate with minimal errors.
        """
        if metrics.total_moves == 0:
            return 50.0  # Standard neutral base

        blunder_rate = metrics.blunders / metrics.total_moves
        mistake_rate = metrics.mistakes / metrics.total_moves
        inaccuracy_rate = metrics.inaccuracies / metrics.total_moves
        best_rate = metrics.best_moves / metrics.total_moves
        forcing_accuracy = (metrics.forcing_best / metrics.forcing_moves) if metrics.forcing_moves > 0 else best_rate
        pressure_rate = metrics.forcing_moves / metrics.total_moves

        # Recalibrated: GMs score 80-92, exceptional players 93-97
        base = 30.0  # Reduced from 50.0 to lower ceiling

        # Significantly reduced multipliers to prevent ceiling hits
        error_penalty = (blunder_rate * 65.0) + (mistake_rate * 40.0) + (inaccuracy_rate * 20.0)
        pressure_bonus = pressure_rate * 12.0  # Reduced from 25.0
        accuracy_bonus = best_rate * 35.0  # Reduced from 60.0 - even 70% best moves = 24.5 pts
        forcing_bonus = forcing_accuracy * 12.0  # Reduced from 20.0
        streak_bonus = min(8.0, metrics.forcing_streak_max * 1.0)  # Capped at 8pts

        score = base - error_penalty + pressure_bonus + accuracy_bonus + forcing_bonus + streak_bonus
        return self.clamp_score(score)

    def score_positional(self, metrics: PersonalityMetrics) -> float:
        """Calculate positional score - accuracy in quiet play.

        GMs should score 80-92 based on their high accuracy in quiet positions.
        Elite GMs (95+) need 90%+ quiet accuracy with minimal drift.
        """
        if metrics.total_moves == 0:
            return 50.0  # Standard neutral base

        quiet_total = metrics.quiet_moves
        quiet_accuracy = (metrics.quiet_best / quiet_total) if quiet_total > 0 else (metrics.best_moves / metrics.total_moves)
        quiet_safety = (metrics.quiet_safe / quiet_total) if quiet_total > 0 else 0.5
        blunder_rate = metrics.blunders / metrics.total_moves
        mistake_rate = metrics.mistakes / metrics.total_moves

        # Recalibrated: GMs score 80-92, exceptional players 93-97
        base = 30.0  # Reduced from 50.0 to lower ceiling

        # Significantly reduced multipliers to prevent ceiling hits
        error_penalty = (blunder_rate * 65.0) + (mistake_rate * 40.0)
        drift_penalty = min(15.0, metrics.centipawn_mean / 12.0)  # Capped to prevent over-penalization
        quiet_bonus = quiet_accuracy * 35.0  # Reduced from 60.0
        safety_bonus = quiet_safety * 15.0  # Reduced from 25.0
        streak_bonus = min(8.0, metrics.quiet_streak_max * 1.0)  # Capped at 8pts

        score = base - error_penalty - drift_penalty + quiet_bonus + safety_bonus + streak_bonus
        return self.clamp_score(score)

    def score_aggressive(self, metrics: PersonalityMetrics) -> float:
        """Calculate aggressive score - willingness to create pressure.

        Natural opposition with Patient through shared forcing/quiet ratio.
        Aggressive increases with forcing moves, decreases with quiet moves.

        Range: 25 (Caruana/passive) to 95 (Nepo/Firouzja/ultra-aggressive)
        """
        if metrics.total_moves == 0:
            return 50.0  # Standard neutral base

        total = max(1, metrics.total_moves)
        forcing_ratio = metrics.forcing_moves / total
        quiet_ratio = metrics.quiet_moves / total
        forcing_accuracy = (metrics.forcing_best / metrics.forcing_moves) if metrics.forcing_moves > 0 else forcing_ratio
        check_density = metrics.checks / total
        capture_density = metrics.captures / total

        # New signals
        pressure_density = metrics.pressure_gain  # average eval gain per move
        advantage_density = metrics.pressure_advantage_sum
        king_pressure = metrics.king_pressure_moves / total
        initiative_gain = metrics.initiative_gain
        risk_ratio = metrics.risk_moves / total

        base = 10.0  # Lowered to make room for bigger spread
        # Amplify forcing component to create 20-30pt spread from 20-50% forcing ratios
        forcing_component = forcing_ratio * 120.0 + forcing_accuracy * 30.0
        pressure_component = pressure_density * 0.3 + advantage_density * 0.08  # Bonus if eval data present
        initiative_component = initiative_gain * 0.4 + metrics.initiative_streak_max * 2.5
        king_component = king_pressure * 60.0 + check_density * 80.0  # Amplified

        quiet_penalty = quiet_ratio * 50.0  # Increased penalty for quiet play
        risk_penalty = risk_ratio * 40.0  # Reduced - aggression involves risk

        score = base + forcing_component + pressure_component + initiative_component + king_component - quiet_penalty - risk_penalty
        return self.clamp_score(score)

    def score_patient(self, metrics: PersonalityMetrics) -> float:
        """Calculate patient score - disciplined, consistent play.

        Natural opposition with Aggressive through shared forcing/quiet ratio.
        Patient increases with quiet moves, decreases with forcing moves.

        Range: 25 (Nepo/impatient) to 95 (Magnus/Caruana/patient)
        """
        if metrics.total_moves == 0:
            return 50.0  # Standard neutral base

        total = max(1, metrics.total_moves)
        forcing_ratio = metrics.forcing_moves / total
        quiet_ratio = metrics.quiet_moves / total
        quiet_accuracy = (metrics.quiet_best / metrics.quiet_moves) if metrics.quiet_moves > 0 else 0.5
        quiet_safety = (metrics.quiet_safe / metrics.quiet_moves) if metrics.quiet_moves > 0 else 0.5
        endgame_accuracy = (metrics.endgame_best / metrics.endgame_moves) if metrics.endgame_moves > 0 else quiet_safety
        time_factor = metrics.time_management_score / 100.0

        risk_ratio = metrics.risk_moves / total
        severe_risk_ratio = metrics.risk_severe_moves / total
        grind_ratio = metrics.endgame_grind_moves / max(1, metrics.endgame_moves or 1)
        liquidation_ratio = metrics.endgame_liquidation_moves / max(1, metrics.endgame_moves or 1)

        # Cap quiet play impact using logistic curve centered at 60%
        quiet_curve = 1.0 / (1.0 + math.exp(-12.0 * (quiet_ratio - 0.6)))

        base = 15.0  # Reduced from 25.0
        quiet_component = quiet_curve * 40.0 + quiet_accuracy * 18.0 + quiet_safety * 20.0  # Reduced from 70+28+32

        advantage_density = metrics.pressure_advantage_sum
        endgame_component = (
            endgame_accuracy * 25.0  # Reduced from 45.0
            + grind_ratio * quiet_safety * 35.0  # Reduced from 60.0
        )
        liquidation_penalty = liquidation_ratio * (25.0 + max(0.0, advantage_density * 0.2))  # Reduced from 40

        time_component = time_factor * 20.0  # Reduced from 35.0

        # Risk penalties (quadratic scaling so repeated risk matters)
        risk_penalty = (risk_ratio ** 2) * 250.0 + severe_risk_ratio * 80.0 + metrics.risk_loss * 0.15  # Reduced

        forcing_penalty = forcing_ratio * 55.0  # Reduced from 95.0

        score = base + quiet_component + endgame_component + time_component - liquidation_penalty - risk_penalty - forcing_penalty
        return self.clamp_score(score)

    def score_novelty(self, metrics: PersonalityMetrics) -> float:
        """Calculate novelty score - creativity and variety.

        Natural opposition with Staleness through shared diversity/repetition metrics.
        Novelty increases with diversity, decreases with repetition.

        FIXED: Centered around 50 (neutral) with proper distribution
        Range: 30 (repetitive/prepared) to 70 (creative/novel)
        """
        if metrics.total_moves == 0:
            return 50.0  # Standard neutral base

        pattern_diversity = metrics.pattern_diversity  # 0.0 to 1.0
        piece_diversity = min(1.0, metrics.piece_type_count / 6.0)
        total = max(1, metrics.total_moves)
        accurate_creative_ratio = metrics.creative_moves / total
        early_creative_ratio = (metrics.early_creative_moves / metrics.early_moves) if metrics.early_moves > 0 else 0
        initiative_gain = metrics.initiative_gain
        king_pressure = metrics.king_pressure_moves / max(1, metrics.total_moves)
        advantage_density = metrics.pressure_advantage_sum

        inaccurate_creative_ratio = metrics.inaccurate_creative_moves / total

        # FIXED FORMULA: Centered around 50
        # Expected:
        # - Normal diversity (0.4-0.6 pattern, 0.5-0.7 piece) → 50
        # - High diversity + creativity → 65-75
        # - Low diversity, repetitive → 35-45
        base = 50.0

        # Diversity components - centered around typical values (0.5)
        pattern_component = (pattern_diversity - 0.5) * 30.0  # ±15 for ±0.5 deviation
        piece_component = (piece_diversity - 0.6) * 20.0  # ±12 for ±0.6 deviation

        # Creativity components - reward creative play
        creativity_component = accurate_creative_ratio * 25.0 + early_creative_ratio * 15.0
        initiative_component = initiative_gain * 0.15 + king_pressure * 15.0 + advantage_density * 0.05

        # Penalties for repetition and inaccurate creativity
        penalty_component = inaccurate_creative_ratio * 15.0 + metrics.consecutive_repeat_count * 2.0

        score = base + pattern_component + piece_component + creativity_component + initiative_component - penalty_component
        return self.clamp_score(score)

    def score_staleness(self, metrics: PersonalityMetrics) -> float:
        """Calculate staleness score - tendency toward repetitive, structured play patterns.

        Natural opposition with Novelty through shared diversity/repetition metrics.
        Staleness increases with repetition, decreases with diversity.

        FIXED: Centered around 50 (neutral) with proper distribution
        Range: 30 (creative/varied) to 70 (repetitive/structured)
        """
        if metrics.total_moves == 0:
            return 50.0  # Standard neutral base

        pattern_diversity = metrics.pattern_diversity
        piece_diversity = min(1.0, metrics.piece_type_count / 6.0)
        total = max(1, metrics.total_moves)
        quiet_ratio = metrics.quiet_moves / total
        creative_ratio = metrics.creative_moves / total
        risk_ratio = metrics.risk_moves / total
        grind_ratio = metrics.endgame_grind_moves / max(1, metrics.endgame_moves or 1)
        liquidation_ratio = metrics.endgame_liquidation_moves / max(1, metrics.endgame_moves or 1)

        # FIXED FORMULA: Centered around 50 (natural opposition to novelty)
        # Expected:
        # - Normal repetition (0.5 pattern diversity, moderate repeats) → 50
        # - High repetition (low diversity, many repeats) → 60-70
        # - Low repetition (high diversity, few repeats) → 35-45
        base = 50.0

        # Repetition components - reward repetition
        repetition_component = metrics.consecutive_repeat_count * 3.0
        quiet_component = (quiet_ratio - 0.5) * 25.0  # Centered around 50% quiet moves

        # Structured play indicators
        stability_component = metrics.safe_streak_max * 0.8 - risk_ratio * 20.0
        liquidation_component = liquidation_ratio * 15.0 - grind_ratio * 10.0

        # Diversity penalties - high variety reduces staleness
        diversity_penalty = (pattern_diversity - 0.5) * 25.0 + (piece_diversity - 0.6) * 15.0

        # Creativity penalty - creative play reduces staleness
        creativity_penalty = creative_ratio * 15.0 + metrics.initiative_gain * 0.1

        score = base + repetition_component + quiet_component + stability_component + liquidation_component - diversity_penalty - creativity_penalty
        return self.clamp_score(score)

    def calculate_scores(self, moves: List[Dict[str, Any]], time_management_score: float = 0.0, skill_level: str = 'intermediate') -> PersonalityScores:
        """Calculate all personality scores from move data with skill level awareness."""
        if not moves:
            return PersonalityScores.neutral()

        metrics = self.compute_metrics(moves)
        metrics.time_management_score = time_management_score

        # Calculate base scores
        tactical = self.score_tactical(metrics)
        positional = self.score_positional(metrics)
        aggressive = self.score_aggressive(metrics)
        patient = self.score_patient(metrics)
        novelty = self.score_novelty(metrics)
        staleness = self.score_staleness(metrics)

        # Apply skill level scaling with relative adjustment
        skill_multiplier = self._get_skill_multiplier(skill_level)

        # Apply relative scoring based on skill level expectations
        tactical = self._apply_relative_scoring(tactical, skill_level, 'tactical')
        positional = self._apply_relative_scoring(positional, skill_level, 'positional')
        aggressive = self._apply_relative_scoring(aggressive, skill_level, 'aggressive')
        patient = self._apply_relative_scoring(patient, skill_level, 'patient')
        novelty = self._apply_relative_scoring(novelty, skill_level, 'novelty')
        staleness = self._apply_relative_scoring(staleness, skill_level, 'staleness')

        return PersonalityScores(
            tactical=self._scale_score(tactical, skill_multiplier, skill_level, 'tactical'),
            positional=self._scale_score(positional, skill_multiplier, skill_level, 'positional'),
            aggressive=self._scale_score(aggressive, skill_multiplier, skill_level, 'aggressive'),
            patient=self._scale_score(patient, skill_multiplier, skill_level, 'patient'),
            novelty=self._scale_score(novelty, skill_multiplier, skill_level, 'novelty'),
            staleness=self._scale_score(staleness, skill_multiplier, skill_level, 'staleness'),
        )

    def _get_skill_multiplier(self, skill_level: str) -> float:
        """Get skill level multiplier for score scaling."""
        multipliers = {
            'beginner': 1.0,
            'intermediate': 1.03,
            'advanced': 1.06,
            'expert': 1.08,
            'master': 1.1,
        }
        return multipliers.get(skill_level.lower(), 1.0)

    def _get_skill_offset(self, skill_level: str) -> float:
        """Lightweight additive adjustment based on reported skill level."""
        offsets = {
            'beginner': 0.0,
            'intermediate': 3.0,
            'advanced': 6.0,
            'expert': 9.0,
            'master': 12.0,
        }
        return offsets.get(skill_level.lower(), 0.0)

    def _scale_score(self, base_score: float, multiplier: float, skill_level: str, trait: str) -> float:
        """Apply scaling/offsets, but only for skill-based traits."""
        if trait in ('aggressive', 'patient', 'novelty', 'staleness'):
            # Style traits should remain in the raw range produced by formulas
            return self.clamp_score(base_score, 0.0, 100.0)

        scaled = base_score * multiplier
        adjusted = scaled + self._get_skill_offset(skill_level)
        return self.clamp_score(adjusted, 0.0, 100.0)

    def _apply_relative_scoring(self, base_score: float, skill_level: str, trait: str) -> float:
        """Apply relative scoring based on skill level expectations."""
        # Skill level expectations (what's considered "good" for each level) - much more realistic
        expectations = {
            'beginner': {
                'tactical': 35, 'positional': 30, 'aggressive': 40,
                'patient': 35, 'novelty': 25, 'staleness': 55
            },
            'intermediate': {
                'tactical': 45, 'positional': 40, 'aggressive': 45,
                'patient': 40, 'novelty': 35, 'staleness': 50
            },
            'advanced': {
                'tactical': 55, 'positional': 50, 'aggressive': 50,
                'patient': 50, 'novelty': 45, 'staleness': 45
            },
            'expert': {
                'tactical': 65, 'positional': 60, 'aggressive': 55,
                'patient': 60, 'novelty': 55, 'staleness': 40
            },
            'master': {
                'tactical': 75, 'positional': 70, 'aggressive': 60,
                'patient': 70, 'novelty': 65, 'staleness': 35
            }
        }

        expected = expectations.get(skill_level, expectations['intermediate']).get(trait, 50)

        # Adjust score relative to expectations - more conservative
        if trait in ('aggressive', 'patient', 'novelty', 'staleness'):
            # Style traits should reflect raw personality without expectation compression
            return self.clamp_score(base_score, 0.0, 100.0)

        if base_score >= expected:
            # Above expectations - allow more differentiation
            relative_score = expected + (base_score - expected) * 1.3
        else:
            # Below expectations - apply lighter compression to show weaknesses
            relative_score = expected - (expected - base_score) * 0.5

        return self.clamp_score(relative_score, 0.0, 100.0)

    def aggregate_scores(self, score_lists: List[PersonalityScores], weights: List[float]) -> PersonalityScores:
        """Aggregate multiple personality scores with weights."""
        if not score_lists or not weights or len(score_lists) != len(weights):
            return PersonalityScores.neutral()

        total_weight = sum(weights)
        if total_weight == 0:
            return PersonalityScores.neutral()

        aggregated = PersonalityScores(tactical=0.0, positional=0.0, aggressive=0.0, patient=0.0, novelty=0.0, staleness=0.0)
        for scores, weight in zip(score_lists, weights):
            aggregated.tactical += scores.tactical * weight
            aggregated.positional += scores.positional * weight
            aggregated.aggressive += scores.aggressive * weight
            aggregated.patient += scores.patient * weight
            aggregated.novelty += scores.novelty * weight
            aggregated.staleness += scores.staleness * weight

        # Normalize by total weight
        aggregated.tactical /= total_weight
        aggregated.positional /= total_weight
        aggregated.aggressive /= total_weight
        aggregated.patient /= total_weight
        aggregated.novelty /= total_weight
        aggregated.staleness /= total_weight

        # Clamp all scores
        aggregated.tactical = self.clamp_score(aggregated.tactical)
        aggregated.positional = self.clamp_score(aggregated.positional)
        aggregated.aggressive = self.clamp_score(aggregated.aggressive)
        aggregated.patient = self.clamp_score(aggregated.patient)
        aggregated.novelty = self.clamp_score(aggregated.novelty)
        aggregated.staleness = self.clamp_score(aggregated.staleness)

        return aggregated
