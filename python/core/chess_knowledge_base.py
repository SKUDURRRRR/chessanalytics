"""
Comprehensive Chess Knowledge Base for AI Teaching

This module provides structured chess knowledge including:
- Tactical patterns with detailed explanations
- Positional concepts with teaching principles
- Endgame knowledge and techniques
- Opening principles and common patterns
- Common mistakes and learning points
- Teaching methodology for different skill levels

The knowledge base is designed to be injected into AI prompts to enhance
the quality and educational value of chess commentary.
"""

from typing import Dict, List, Optional, Tuple
from enum import Enum
import chess


class SkillLevel(Enum):
    """Player skill levels for tailoring explanations."""
    BEGINNER = "beginner"  # 400-800 ELO
    INTERMEDIATE = "intermediate"  # 800-1400 ELO
    ADVANCED = "advanced"  # 1400-1800 ELO
    EXPERT = "expert"  # 1800+ ELO


class ChessKnowledgeBase:
    """
    Comprehensive chess knowledge base for AI teaching.

    Provides structured knowledge that can be injected into AI prompts
    to enhance the quality and educational value of chess commentary.
    """

    def __init__(self):
        """Initialize the chess knowledge base."""
        self._initialize_tactical_patterns()
        self._initialize_positional_concepts()
        self._initialize_endgame_principles()
        self._initialize_opening_principles()
        self._initialize_common_mistakes()
        self._initialize_teaching_methodology()

    def _initialize_tactical_patterns(self):
        """Initialize comprehensive tactical pattern knowledge."""
        self.tactical_patterns = {
            "pin": {
                "name": "Pin",
                "description": "A pin occurs when a piece cannot move without exposing a more valuable piece behind it to attack.",
                "teaching_points": [
                    "Pins are powerful because they immobilize pieces",
                    "Absolute pins (against the king) are especially strong",
                    "Look for pins when your opponent's pieces are on the same line",
                    "Breaking pins often requires moving the pinned piece or blocking the line"
                ],
                "examples": [
                    "Bishop pins knight to king: Bg5 pinning Nf6",
                    "Rook pins queen to king: Re1 pinning Qe7",
                    "Queen pins piece to king: Qd1 pinning Nd4"
                ],
                "skill_level": SkillLevel.BEGINNER
            },
            "fork": {
                "name": "Fork",
                "description": "A fork is when one piece attacks two or more enemy pieces simultaneously.",
                "teaching_points": [
                    "Knights are excellent forking pieces due to their unique movement",
                    "Pawns can fork pieces on adjacent squares",
                    "Forks often win material when the opponent can't defend both pieces",
                    "Watch for fork opportunities, especially with knights and pawns"
                ],
                "examples": [
                    "Knight fork: Nf7 attacking king and rook",
                    "Pawn fork: e5 attacking knight and bishop",
                    "Queen fork: Qd5 attacking two rooks"
                ],
                "skill_level": SkillLevel.BEGINNER
            },
            "skewer": {
                "name": "Skewer",
                "description": "A skewer is like a pin in reverse - a more valuable piece is attacked and must move, exposing a less valuable piece behind it.",
                "teaching_points": [
                    "Skewers work on the same principle as pins but in reverse",
                    "Rooks and queens are excellent for skewers on ranks, files, and diagonals",
                    "The attacked piece must move, leaving the piece behind vulnerable",
                    "Look for pieces aligned on the same line"
                ],
                "examples": [
                    "Rook skewer: Re1 attacking queen, which must move, exposing rook behind",
                    "Bishop skewer: Bg5 attacking queen, exposing rook",
                    "Queen skewer: Qd1 attacking king, exposing rook"
                ],
                "skill_level": SkillLevel.INTERMEDIATE
            },
            "discovered_attack": {
                "name": "Discovered Attack",
                "description": "A discovered attack occurs when moving one piece reveals an attack by another piece behind it.",
                "teaching_points": [
                    "Discovered attacks are powerful because they create two threats at once",
                    "The moving piece can attack one target while revealing an attack on another",
                    "Discovered checks are especially strong - the opponent must address the check",
                    "Look for pieces that can move to reveal attacks by rooks, bishops, or queens"
                ],
                "examples": [
                    "Knight moves, revealing bishop attack on queen",
                    "Pawn advances, revealing rook attack on queen",
                    "Piece moves, revealing discovered check"
                ],
                "skill_level": SkillLevel.INTERMEDIATE
            },
            "double_attack": {
                "name": "Double Attack",
                "description": "A double attack is when one move creates two simultaneous threats.",
                "teaching_points": [
                    "Double attacks force the opponent to choose which threat to address",
                    "Often leads to winning material",
                    "Can be created by moving a piece to attack two targets",
                    "Watch for opportunities to create multiple threats with one move"
                ],
                "examples": [
                    "Queen moves to attack king and rook simultaneously",
                    "Knight moves to attack queen and bishop",
                    "Piece moves to create check and attack on another piece"
                ],
                "skill_level": SkillLevel.INTERMEDIATE
            },
            "deflection": {
                "name": "Deflection",
                "description": "Deflection is a tactic that forces an opponent's piece to leave an important square or duty.",
                "teaching_points": [
                    "Deflection works by attacking a piece that must respond",
                    "The deflected piece leaves its important post",
                    "Often used to break defenses or create mating nets",
                    "Look for pieces that are crucial to the opponent's defense"
                ],
                "examples": [
                    "Attacking a defending piece to force it away",
                    "Sacrificing to deflect a piece from defending a key square",
                    "Using a threat to force a piece to abandon its post"
                ],
                "skill_level": SkillLevel.ADVANCED
            },
            "decoy": {
                "name": "Decoy",
                "description": "A decoy is a sacrifice that lures an opponent's piece to a bad square.",
                "teaching_points": [
                    "Decoys are sacrifices that lead to bigger gains",
                    "The decoyed piece is forced to a square where it's vulnerable",
                    "Often used in combination with other tactics",
                    "Requires calculation to ensure the sacrifice is worth it"
                ],
                "examples": [
                    "Sacrificing a piece to lure the king to a vulnerable square",
                    "Offering material to draw a piece away from defense",
                    "Luring a piece to a square where it can be forked or pinned"
                ],
                "skill_level": SkillLevel.ADVANCED
            },
            "overloading": {
                "name": "Overloading",
                "description": "Overloading occurs when a piece is given too many defensive duties and cannot fulfill them all.",
                "teaching_points": [
                    "Overloaded pieces are vulnerable to tactics",
                    "Attack multiple targets defended by the same piece",
                    "The overloaded piece cannot defend everything",
                    "Look for pieces defending multiple important squares or pieces"
                ],
                "examples": [
                    "Rook defending both a pawn and a piece - attack both",
                    "Queen defending king and rook - attack both",
                    "Piece defending multiple squares - create threats on multiple squares"
                ],
                "skill_level": SkillLevel.ADVANCED
            },
            "interference": {
                "name": "Interference",
                "description": "Interference is placing a piece between two enemy pieces to disrupt their coordination.",
                "teaching_points": [
                    "Interference breaks the connection between pieces",
                    "Often involves sacrifices to block lines",
                    "Can disrupt defensive coordination",
                    "Look for pieces that coordinate along lines (ranks, files, diagonals)"
                ],
                "examples": [
                    "Placing a piece between two rooks to break coordination",
                    "Blocking a line between a piece and its defender",
                    "Interfering with piece coordination to create tactics"
                ],
                "skill_level": SkillLevel.ADVANCED
            },
            "zwischenzug": {
                "name": "Zwischenzug (In-Between Move)",
                "description": "A zwischenzug is an unexpected move inserted in an apparently forced sequence of moves.",
                "teaching_points": [
                    "Zwischenzugs are counter-intuitive - they delay the expected move",
                    "Often involve checks or threats that must be addressed",
                    "Can turn a losing sequence into a winning one",
                    "Look for opportunities to insert moves in forced sequences"
                ],
                "examples": [
                    "Instead of recapturing, play a check first",
                    "Before taking a piece, create a threat",
                    "Insert a move that improves the position before continuing the sequence"
                ],
                "skill_level": SkillLevel.ADVANCED
            },
            "clearance": {
                "name": "Clearance",
                "description": "Clearance is moving a piece to clear a square or line for another piece.",
                "teaching_points": [
                    "Clearance sacrifices material to open lines or squares",
                    "The sacrificed piece clears the way for a stronger attack",
                    "Often used in mating combinations",
                    "Look for pieces blocking powerful pieces (rooks, queens, bishops)"
                ],
                "examples": [
                    "Sacrificing a piece to clear a diagonal for the queen",
                    "Moving a piece to open a file for a rook",
                    "Clearing a square for a piece to deliver mate"
                ],
                "skill_level": SkillLevel.ADVANCED
            },
            "removal_of_defender": {
                "name": "Removal of Defender",
                "description": "Removing the defender is a tactic that eliminates or drives away a piece that defends a target.",
                "teaching_points": [
                    "First remove the defender, then capture the target",
                    "Can be done by capturing, attacking, or deflecting the defender",
                    "A fundamental tactical pattern",
                    "Look for pieces that are defended by only one piece"
                ],
                "examples": [
                    "Capturing a piece that defends another piece",
                    "Attacking a defender to force it away",
                    "Deflecting a defender from its post"
                ],
                "skill_level": SkillLevel.INTERMEDIATE
            }
        }

    def _initialize_positional_concepts(self):
        """Initialize comprehensive positional concept knowledge."""
        self.positional_concepts = {
            "center_control": {
                "name": "Center Control",
                "description": "Controlling the center with pawns and pieces is a fundamental chess principle.",
                "teaching_points": [
                    "Central pawns (e4, e5, d4, d5) control important squares",
                    "Pieces in the center have more mobility and options",
                    "Central control provides space and flexibility",
                    "Many openings aim to control or challenge the center"
                ],
                "examples": [
                    "Playing e4 and d4 to control central squares",
                    "Placing knights on central squares (e5, d5, e4, d4)",
                    "Fighting for central control in the opening"
                ],
                "skill_level": SkillLevel.BEGINNER
            },
            "piece_activity": {
                "name": "Piece Activity",
                "description": "Active pieces have more influence and options than passive pieces.",
                "teaching_points": [
                    "Active pieces control more squares and create threats",
                    "Passive pieces are often targets for attack",
                    "Develop pieces to active squares, not just safe squares",
                    "Trade passive pieces for active opponent pieces"
                ],
                "examples": [
                    "Rooks on open files are more active than rooks behind pawns",
                    "Knights on outposts are more active than knights on the back rank",
                    "Bishops on long diagonals are more active than blocked bishops"
                ],
                "skill_level": SkillLevel.INTERMEDIATE
            },
            "king_safety": {
                "name": "King Safety",
                "description": "Keeping the king safe is crucial throughout the game.",
                "teaching_points": [
                    "Castling early is usually a good idea",
                    "Avoid moving pawns in front of the castled king unnecessarily",
                    "Keep defenders near the king when under attack",
                    "In the endgame, an active king is often an advantage"
                ],
                "examples": [
                    "Castling to get the king to safety",
                    "Keeping pawns in front of the king to prevent attacks",
                    "Activating the king in the endgame"
                ],
                "skill_level": SkillLevel.BEGINNER
            },
            "pawn_structure": {
                "name": "Pawn Structure",
                "description": "Pawn structure affects the entire game and determines piece placement.",
                "teaching_points": [
                    "Doubled pawns are often weak but can control squares",
                    "Isolated pawns need piece support",
                    "Passed pawns are strong, especially in the endgame",
                    "Pawn chains provide support but limit mobility"
                ],
                "examples": [
                    "Doubled pawns on the c-file after a capture",
                    "Isolated d-pawn that needs constant defense",
                    "Passed pawn that can promote"
                ],
                "skill_level": SkillLevel.INTERMEDIATE
            },
            "space_advantage": {
                "name": "Space Advantage",
                "description": "Having more space gives your pieces more room to maneuver.",
                "teaching_points": [
                    "Space advantage allows pieces to move freely",
                    "Can be used to restrict opponent's pieces",
                    "Often leads to attacking opportunities",
                    "Space without piece activity is less valuable"
                ],
                "examples": [
                    "Controlling more squares with pawns",
                    "Pieces have more squares to choose from",
                    "Opponent's pieces are cramped"
                ],
                "skill_level": SkillLevel.INTERMEDIATE
            },
            "piece_coordination": {
                "name": "Piece Coordination",
                "description": "Pieces working together are stronger than pieces working alone.",
                "teaching_points": [
                    "Coordinated pieces create threats and defend effectively",
                    "Look for ways to make pieces work together",
                    "Avoid placing pieces where they don't support each other",
                    "Coordination is key to successful attacks"
                ],
                "examples": [
                    "Rooks doubling on a file",
                    "Bishop and knight working together",
                    "Queen and rook coordinating on the same target"
                ],
                "skill_level": SkillLevel.INTERMEDIATE
            },
            "weak_squares": {
                "name": "Weak Squares",
                "description": "Weak squares are squares that cannot be defended by pawns and can be occupied by enemy pieces.",
                "teaching_points": [
                    "Weak squares are often color complexes",
                    "Pieces on weak squares (outposts) are very strong",
                    "Weak squares near the king are especially dangerous",
                    "Look for ways to create and exploit weak squares"
                ],
                "examples": [
                    "Weak dark squares around the king",
                    "Outpost for a knight on a weak square",
                    "Weak squares that can be occupied by pieces"
                ],
                "skill_level": SkillLevel.ADVANCED
            },
            "outpost": {
                "name": "Outpost",
                "description": "An outpost is a square (usually for a knight) that cannot be attacked by enemy pawns.",
                "teaching_points": [
                    "Outposts are excellent squares for knights",
                    "Knights on outposts are very strong",
                    "Outposts are usually on weak squares",
                    "Look for opportunities to establish outposts"
                ],
                "examples": [
                    "Knight on d5, supported by pawns, cannot be attacked by pawns",
                    "Knight on e6, deep in enemy territory",
                    "Knight on an outpost controlling key squares"
                ],
                "skill_level": SkillLevel.ADVANCED
            },
            "pawn_breaks": {
                "name": "Pawn Breaks",
                "description": "Pawn breaks are pawn advances that open up the position.",
                "teaching_points": [
                    "Pawn breaks can open files and diagonals",
                    "Timing of pawn breaks is crucial",
                    "Pawn breaks can create weaknesses",
                    "Look for opportunities to break with pawns"
                ],
                "examples": [
                    "Playing d4 to break open the center",
                    "Playing f5 to break in the center",
                    "Pawn break to open lines for pieces"
                ],
                "skill_level": SkillLevel.ADVANCED
            },
            "piece_placement": {
                "name": "Piece Placement",
                "description": "Placing pieces on good squares is fundamental to good chess.",
                "teaching_points": [
                    "Pieces should be placed where they have maximum influence",
                    "Avoid placing pieces where they can be easily attacked",
                    "Centralized pieces are usually stronger",
                    "Consider the pawn structure when placing pieces"
                ],
                "examples": [
                    "Knights on central squares",
                    "Bishops on long diagonals",
                    "Rooks on open files"
                ],
                "skill_level": SkillLevel.BEGINNER
            }
        }

    def _initialize_endgame_principles(self):
        """Initialize endgame knowledge and principles."""
        self.endgame_principles = {
            "king_activity": {
                "name": "King Activity",
                "description": "In the endgame, the king becomes a strong piece and should be activated.",
                "teaching_points": [
                    "The king should be activated in the endgame",
                    "An active king can support pawns and attack enemy pawns",
                    "King activity is often the deciding factor in endgames",
                    "Centralize the king in the endgame"
                ],
                "skill_level": SkillLevel.INTERMEDIATE
            },
            "pawn_promotion": {
                "name": "Pawn Promotion",
                "description": "Promoting a pawn to a queen (or other piece) is a key endgame goal.",
                "teaching_points": [
                    "Passed pawns are very strong in the endgame",
                    "Support passed pawns with the king",
                    "Stop opponent's passed pawns",
                    "Promotion often decides endgames"
                ],
                "skill_level": SkillLevel.BEGINNER
            },
            "opposition": {
                "name": "Opposition",
                "description": "Opposition is when two kings face each other with one square between them.",
                "teaching_points": [
                    "The player who doesn't have to move has the opposition",
                    "Opposition is crucial in king and pawn endgames",
                    "Use opposition to advance pawns or stop opponent's pawns",
                    "Distant opposition can be converted to direct opposition"
                ],
                "skill_level": SkillLevel.ADVANCED
            },
            "zugzwang": {
                "name": "Zugzwang",
                "description": "Zugzwang is when any move worsens the position.",
                "teaching_points": [
                    "Zugzwang is common in endgames",
                    "The player to move is at a disadvantage",
                    "Can be used to win material or promote pawns",
                    "Look for positions where the opponent has no good moves"
                ],
                "skill_level": SkillLevel.ADVANCED
            },
            "piece_vs_pawns": {
                "name": "Piece vs Pawns Endgames",
                "description": "Understanding how pieces interact with pawns in the endgame.",
                "teaching_points": [
                    "Rooks belong behind passed pawns (yours or opponent's)",
                    "Bishops are good at stopping passed pawns on the same color",
                    "Knights can be tricky - they can stop pawns but may be slow",
                    "Queens can easily stop pawns but must be careful of stalemate"
                ],
                "skill_level": SkillLevel.ADVANCED
            }
        }

    def _initialize_opening_principles(self):
        """Initialize opening principles and knowledge."""
        self.opening_principles = {
            "development": {
                "name": "Development",
                "description": "Develop pieces quickly and efficiently in the opening.",
                "teaching_points": [
                    "Develop knights and bishops before moving the same piece twice",
                    "Castle early to get the king to safety",
                    "Don't bring the queen out too early",
                    "Connect the rooks by moving pieces in between"
                ],
                "skill_level": SkillLevel.BEGINNER
            },
            "center_control_opening": {
                "name": "Center Control in Opening",
                "description": "Control or challenge the center in the opening.",
                "teaching_points": [
                    "Central pawns (e4, e5, d4, d5) are important",
                    "Pieces should support central control",
                    "Many openings revolve around central control",
                    "Central control provides space and options"
                ],
                "skill_level": SkillLevel.BEGINNER
            },
            "king_safety_opening": {
                "name": "King Safety in Opening",
                "description": "Get the king to safety early in the game.",
                "teaching_points": [
                    "Castling is usually a priority in the opening",
                    "Avoid moving pawns in front of the castled king",
                    "Keep defenders near the king",
                    "Don't leave the king in the center too long"
                ],
                "skill_level": SkillLevel.BEGINNER
            },
            "piece_coordination_opening": {
                "name": "Piece Coordination in Opening",
                "description": "Develop pieces so they work together.",
                "teaching_points": [
                    "Pieces should support each other",
                    "Avoid developing pieces to squares where they don't help",
                    "Look for ways to make pieces work together",
                    "Coordination is key to successful openings"
                ],
                "skill_level": SkillLevel.INTERMEDIATE
            }
        }

    def _initialize_common_mistakes(self):
        """Initialize common mistakes and how to avoid them."""
        self.common_mistakes = {
            "moving_same_piece_twice": {
                "name": "Moving the Same Piece Twice",
                "description": "Moving the same piece multiple times in the opening wastes time.",
                "teaching_points": [
                    "Develop different pieces instead of moving the same piece twice",
                    "Each move should develop a new piece when possible",
                    "Moving the same piece twice gives the opponent time to develop",
                    "Exception: if there's a tactical reason, it's okay"
                ],
                "skill_level": SkillLevel.BEGINNER
            },
            "bringing_queen_out_early": {
                "name": "Bringing Queen Out Early",
                "description": "Bringing the queen out too early makes it a target.",
                "teaching_points": [
                    "Develop minor pieces (knights, bishops) first",
                    "The queen can be attacked by minor pieces",
                    "Early queen moves waste time and expose the queen",
                    "Bring the queen out when it has a clear purpose"
                ],
                "skill_level": SkillLevel.BEGINNER
            },
            "ignoring_development": {
                "name": "Ignoring Development",
                "description": "Not developing pieces quickly enough.",
                "teaching_points": [
                    "Develop pieces to active squares",
                    "Don't make too many pawn moves",
                    "Get castled early",
                    "Connect the rooks"
                ],
                "skill_level": SkillLevel.BEGINNER
            },
            "hanging_pieces": {
                "name": "Hanging Pieces",
                "description": "Leaving pieces undefended or insufficiently defended.",
                "teaching_points": [
                    "Always check if your pieces are defended",
                    "Before moving, check what you're leaving undefended",
                    "Hanging pieces are the most common mistake",
                    "Develop the habit of checking for hanging pieces"
                ],
                "skill_level": SkillLevel.BEGINNER
            },
            "weak_king_safety": {
                "name": "Weak King Safety",
                "description": "Not keeping the king safe or weakening the king's position.",
                "teaching_points": [
                    "Castle early to get the king to safety",
                    "Avoid moving pawns in front of the castled king",
                    "Keep defenders near the king",
                    "Don't leave the king exposed"
                ],
                "skill_level": SkillLevel.BEGINNER
            },
            "poor_piece_placement": {
                "name": "Poor Piece Placement",
                "description": "Placing pieces on passive or bad squares.",
                "teaching_points": [
                    "Place pieces on active squares",
                    "Centralized pieces are usually stronger",
                    "Avoid placing pieces where they can be easily attacked",
                    "Consider the pawn structure when placing pieces"
                ],
                "skill_level": SkillLevel.INTERMEDIATE
            }
        }

    def _initialize_teaching_methodology(self):
        """Initialize teaching methodology for different skill levels."""
        self.teaching_methodology = {
            SkillLevel.BEGINNER: {
                "explanation_style": "Use simple language, avoid jargon, explain basic concepts clearly",
                "focus_points": [
                    "Basic principles: development, center control, king safety",
                    "Common mistakes and how to avoid them",
                    "Simple tactical patterns (pins, forks)",
                    "Encouragement and positive reinforcement"
                ],
                "avoid": [
                    "Complex positional concepts",
                    "Advanced tactical patterns",
                    "Deep theoretical knowledge",
                    "Overwhelming detail"
                ]
            },
            SkillLevel.INTERMEDIATE: {
                "explanation_style": "Explain concepts clearly with examples, introduce more advanced ideas gradually",
                "focus_points": [
                    "Tactical patterns and combinations",
                    "Positional concepts and piece placement",
                    "Opening principles and common plans",
                    "Endgame basics"
                ],
                "avoid": [
                    "Overly complex analysis",
                    "Deep theoretical lines",
                    "Advanced endgame techniques"
                ]
            },
            SkillLevel.ADVANCED: {
                "explanation_style": "Provide detailed analysis, explain advanced concepts, discuss strategic plans",
                "focus_points": [
                    "Advanced tactical patterns",
                    "Complex positional concepts",
                    "Strategic planning",
                    "Endgame technique"
                ],
                "avoid": [
                    "Overly simplistic explanations",
                    "Condescending tone"
                ]
            },
            SkillLevel.EXPERT: {
                "explanation_style": "Provide deep analysis, discuss subtle nuances, explain advanced concepts",
                "focus_points": [
                    "Advanced strategic concepts",
                    "Subtle positional nuances",
                    "Complex endgame techniques",
                    "Theoretical knowledge"
                ],
                "avoid": [
                    "Over-explaining basic concepts",
                    "Patronizing tone"
                ]
            }
        }

    def get_relevant_tactical_patterns(
        self,
        detected_patterns: List[str],
        skill_level: SkillLevel = SkillLevel.INTERMEDIATE
    ) -> List[Dict]:
        """
        Get relevant tactical pattern knowledge for detected patterns.

        Args:
            detected_patterns: List of tactical pattern names detected in the position
            skill_level: Player's skill level for filtering appropriate patterns

        Returns:
            List of tactical pattern knowledge dictionaries
        """
        relevant = []
        for pattern_name in detected_patterns:
            pattern_name_lower = pattern_name.lower()
            # Try exact match first
            if pattern_name_lower in self.tactical_patterns:
                pattern = self.tactical_patterns[pattern_name_lower]
                # Only include if appropriate for skill level
                if self._is_appropriate_for_skill_level(pattern["skill_level"], skill_level):
                    relevant.append(pattern)
            else:
                # Try partial match
                for key, pattern in self.tactical_patterns.items():
                    if key in pattern_name_lower or pattern_name_lower in key:
                        if self._is_appropriate_for_skill_level(pattern["skill_level"], skill_level):
                            relevant.append(pattern)
                            break
        return relevant

    def get_relevant_positional_concepts(
        self,
        detected_concepts: List[str],
        skill_level: SkillLevel = SkillLevel.INTERMEDIATE
    ) -> List[Dict]:
        """
        Get relevant positional concept knowledge for detected concepts.

        Args:
            detected_concepts: List of positional concept names detected in the position
            skill_level: Player's skill level for filtering appropriate concepts

        Returns:
            List of positional concept knowledge dictionaries
        """
        relevant = []
        for concept_name in detected_concepts:
            concept_name_lower = concept_name.lower().replace(" ", "_")
            # Try exact match first
            if concept_name_lower in self.positional_concepts:
                concept = self.positional_concepts[concept_name_lower]
                if self._is_appropriate_for_skill_level(concept["skill_level"], skill_level):
                    relevant.append(concept)
            else:
                # Try partial match
                for key, concept in self.positional_concepts.items():
                    if key in concept_name_lower or concept_name_lower in key:
                        if self._is_appropriate_for_skill_level(concept["skill_level"], skill_level):
                            relevant.append(concept)
                            break
        return relevant

    def get_endgame_knowledge(
        self,
        game_phase: str,
        skill_level: SkillLevel = SkillLevel.INTERMEDIATE
    ) -> Optional[Dict]:
        """
        Get relevant endgame knowledge for the current phase.

        Args:
            game_phase: Current game phase (opening, middlegame, endgame)
            skill_level: Player's skill level

        Returns:
            Endgame knowledge dictionary or None if not in endgame
        """
        if game_phase.lower() != "endgame":
            return None

        # Return general endgame principles appropriate for skill level
        relevant = {}
        for key, principle in self.endgame_principles.items():
            if self._is_appropriate_for_skill_level(principle["skill_level"], skill_level):
                relevant[key] = principle

        return relevant if relevant else None

    def get_opening_knowledge(
        self,
        game_phase: str,
        move_number: int,
        skill_level: SkillLevel = SkillLevel.INTERMEDIATE
    ) -> Optional[Dict]:
        """
        Get relevant opening knowledge for the current phase.

        Args:
            game_phase: Current game phase
            move_number: Current move number
            skill_level: Player's skill level

        Returns:
            Opening knowledge dictionary or None if not in opening
        """
        if game_phase.lower() != "opening" or move_number > 15:
            return None

        # Return general opening principles appropriate for skill level
        relevant = {}
        for key, principle in self.opening_principles.items():
            if self._is_appropriate_for_skill_level(principle["skill_level"], skill_level):
                relevant[key] = principle

        return relevant if relevant else None

    def get_teaching_guidance(
        self,
        skill_level: SkillLevel
    ) -> Dict:
        """
        Get teaching methodology guidance for a specific skill level.

        Args:
            skill_level: Player's skill level

        Returns:
            Teaching methodology dictionary
        """
        return self.teaching_methodology.get(skill_level, self.teaching_methodology[SkillLevel.INTERMEDIATE])

    def get_common_mistakes_context(
        self,
        move_quality: str,
        skill_level: SkillLevel = SkillLevel.INTERMEDIATE
    ) -> List[Dict]:
        """
        Get relevant common mistakes context based on move quality.

        Args:
            move_quality: Quality of the move (blunder, mistake, inaccuracy, etc.)
            skill_level: Player's skill level

        Returns:
            List of relevant common mistakes
        """
        if move_quality in ["blunder", "mistake", "inaccuracy"]:
            # Return all common mistakes appropriate for skill level
            relevant = []
            for mistake in self.common_mistakes.values():
                if self._is_appropriate_for_skill_level(mistake["skill_level"], skill_level):
                    relevant.append(mistake)
            return relevant
        return []

    def format_knowledge_for_prompt(
        self,
        tactical_patterns: List[Dict] = None,
        positional_concepts: List[Dict] = None,
        endgame_knowledge: Dict = None,
        opening_knowledge: Dict = None,
        common_mistakes: List[Dict] = None,
        teaching_guidance: Dict = None
    ) -> str:
        """
        Format chess knowledge into a string suitable for injection into AI prompts.

        Args:
            tactical_patterns: List of tactical pattern knowledge
            positional_concepts: List of positional concept knowledge
            endgame_knowledge: Endgame knowledge dictionary
            opening_knowledge: Opening knowledge dictionary
            common_mistakes: List of common mistakes
            teaching_guidance: Teaching methodology guidance

        Returns:
            Formatted string with chess knowledge
        """
        sections = []

        if teaching_guidance:
            sections.append("**TEACHING METHODOLOGY:**")
            sections.append(f"- Explanation style: {teaching_guidance.get('explanation_style', 'Clear and instructive')}")
            sections.append(f"- Focus on: {', '.join(teaching_guidance.get('focus_points', []))}")
            sections.append("")

        if tactical_patterns:
            sections.append("**TACTICAL PATTERNS IN THIS POSITION:**")
            for pattern in tactical_patterns:
                sections.append(f"- {pattern['name']}: {pattern['description']}")
                if pattern.get('teaching_points'):
                    sections.append(f"  Teaching points: {'; '.join(pattern['teaching_points'][:2])}")  # Limit to 2 points
            sections.append("")

        if positional_concepts:
            sections.append("**POSITIONAL CONCEPTS RELEVANT HERE:**")
            for concept in positional_concepts:
                sections.append(f"- {concept['name']}: {concept['description']}")
                if concept.get('teaching_points'):
                    sections.append(f"  Teaching points: {'; '.join(concept['teaching_points'][:2])}")  # Limit to 2 points
            sections.append("")

        if endgame_knowledge:
            sections.append("**ENDGAME PRINCIPLES:**")
            for key, principle in endgame_knowledge.items():
                sections.append(f"- {principle['name']}: {principle['description']}")
                if principle.get('teaching_points'):
                    sections.append(f"  Key point: {principle['teaching_points'][0]}")
            sections.append("")

        if opening_knowledge:
            sections.append("**OPENING PRINCIPLES:**")
            for key, principle in opening_knowledge.items():
                sections.append(f"- {principle['name']}: {principle['description']}")
                if principle.get('teaching_points'):
                    sections.append(f"  Key point: {principle['teaching_points'][0]}")
            sections.append("")

        if common_mistakes:
            sections.append("**COMMON MISTAKES TO AVOID:**")
            for mistake in common_mistakes[:3]:  # Limit to 3 mistakes
                sections.append(f"- {mistake['name']}: {mistake['description']}")
                if mistake.get('teaching_points'):
                    sections.append(f"  How to avoid: {mistake['teaching_points'][0]}")
            sections.append("")

        return "\n".join(sections) if sections else ""

    def _is_appropriate_for_skill_level(
        self,
        concept_level: SkillLevel,
        player_level: SkillLevel
    ) -> bool:
        """
        Determine if a concept is appropriate for a player's skill level.

        Args:
            concept_level: Skill level required for the concept
            player_level: Player's skill level

        Returns:
            True if the concept is appropriate, False otherwise
        """
        level_order = [
            SkillLevel.BEGINNER,
            SkillLevel.INTERMEDIATE,
            SkillLevel.ADVANCED,
            SkillLevel.EXPERT
        ]

        concept_index = level_order.index(concept_level)
        player_index = level_order.index(player_level)

        # Concept is appropriate if player level is at or above concept level
        return player_index >= concept_index

    def get_skill_level_from_elo(self, elo: int) -> SkillLevel:
        """
        Convert ELO rating to SkillLevel enum.

        Args:
            elo: Player's ELO rating

        Returns:
            SkillLevel enum value
        """
        if elo < 800:
            return SkillLevel.BEGINNER
        elif elo < 1400:
            return SkillLevel.INTERMEDIATE
        elif elo < 1800:
            return SkillLevel.ADVANCED
        else:
            return SkillLevel.EXPERT
