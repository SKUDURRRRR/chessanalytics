"""Opening style compatibility profiles for personality-based opening recommendations.

Each opening maps to personality trait scores (0-100) across 4 dimensions:
- aggressive: How attacking/sharp the opening tends to be
- tactical: How much tactical calculation is typically required
- positional: How much positional/strategic understanding is needed
- patient: How much patience/long-term planning the opening demands
"""

from typing import Dict

OPENING_STYLES: Dict[str, Dict[str, int]] = {
    # Aggressive openings
    "King's Indian": {"aggressive": 80, "tactical": 70, "positional": 40, "patient": 30},
    "Sicilian Defense": {"aggressive": 75, "tactical": 80, "positional": 50, "patient": 40},
    "Dutch Defense": {"aggressive": 85, "tactical": 65, "positional": 35, "patient": 30},
    "Benoni Defense": {"aggressive": 80, "tactical": 75, "positional": 40, "patient": 35},
    "Dragon Variation": {"aggressive": 90, "tactical": 85, "positional": 30, "patient": 25},

    # Tactical openings
    "Scotch Game": {"aggressive": 65, "tactical": 80, "positional": 50, "patient": 45},
    "Italian Game": {"aggressive": 60, "tactical": 75, "positional": 55, "patient": 50},
    "Spanish Opening": {"aggressive": 50, "tactical": 70, "positional": 70, "patient": 60},

    # Positional openings
    "Queen's Gambit": {"aggressive": 40, "tactical": 55, "positional": 85, "patient": 70},
    "English Opening": {"aggressive": 35, "tactical": 50, "positional": 85, "patient": 75},
    "Ruy Lopez": {"aggressive": 45, "tactical": 65, "positional": 80, "patient": 70},
    "Catalan Opening": {"aggressive": 35, "tactical": 55, "positional": 90, "patient": 75},

    # Patient openings
    "French Defense": {"aggressive": 35, "tactical": 50, "positional": 75, "patient": 85},
    "Caro-Kann Defense": {"aggressive": 30, "tactical": 45, "positional": 80, "patient": 90},
    "Queen's Pawn Game": {"aggressive": 40, "tactical": 50, "positional": 70, "patient": 75},
    "Nimzo-Indian Defense": {"aggressive": 40, "tactical": 60, "positional": 80, "patient": 80},
    "London System": {"aggressive": 30, "tactical": 40, "positional": 75, "patient": 85},
}
