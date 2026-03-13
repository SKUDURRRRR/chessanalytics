"""Famous chess player personality profiles for player comparison matching.

Each profile contains personality trait scores (0-100) across 6 dimensions:
- tactical: Tactical calculation and combination ability
- aggressive: Attacking tendency and willingness to sacrifice
- positional: Positional understanding and strategic play
- patient: Patience and willingness to play long games
- novelty: Tendency toward creative/unconventional ideas
- staleness: Tendency toward repetitive opening choices

NOTE: Profiles are currently estimated - Priority 1 improvement is to calculate from real games.
"""

from typing import Any, Dict, List

FAMOUS_PLAYERS: List[Dict[str, Any]] = [
    {
        'name': 'Mikhail Tal',
        'description': 'The "Magician from Riga" - known for his brilliant tactical combinations and sacrifices',
        'era': '1950s-1990s',
        'strengths': ['Tactical vision', 'Sacrificial attacks', 'Complex calculations'],
        'profile': {'tactical': 85, 'aggressive': 90, 'positional': 55, 'patient': 45, 'novelty': 88, 'staleness': 35},
        'confidence': 80.0
    },
    {
        'name': 'Garry Kasparov',
        'description': 'Aggressive tactical player who dominated with dynamic, attacking chess',
        'era': '1980s-2000s',
        'strengths': ['Initiative', 'Tactical precision', 'Pressure play'],
        'profile': {'tactical': 90, 'aggressive': 85, 'positional': 75, 'patient': 60, 'novelty': 75, 'staleness': 45},
        'confidence': 85.0
    },
    {
        'name': 'Anatoly Karpov',
        'description': 'Master of positional chess and endgame technique',
        'era': '1970s-1990s',
        'strengths': ['Positional understanding', 'Endgame mastery', 'Prophylaxis'],
        'profile': {'tactical': 70, 'aggressive': 50, 'positional': 95, 'patient': 90, 'novelty': 45, 'staleness': 75},
        'confidence': 85.0
    },
    {
        'name': 'Magnus Carlsen',
        'description': 'Universal player with exceptional endgame skills and practical play',
        'era': '2000s-present',
        'strengths': ['Universal style', 'Endgame mastery', 'Practical play'],
        'profile': {'tactical': 85, 'aggressive': 70, 'positional': 90, 'patient': 80, 'novelty': 72, 'staleness': 50},
        'confidence': 90.0
    },
    {
        'name': 'Bobby Fischer',
        'description': 'Legendary American champion known for his fighting spirit and deep preparation',
        'era': '1960s-1970s',
        'strengths': ['Competitive spirit', 'Sharp tactics', 'Deep preparation'],
        'profile': {'tactical': 88, 'aggressive': 80, 'positional': 85, 'patient': 65, 'novelty': 70, 'staleness': 55},
        'confidence': 85.0
    },
    {
        'name': 'Tigran Petrosian',
        'description': 'Master of prophylaxis and defensive play',
        'era': '1950s-1980s',
        'strengths': ['Defensive mastery', 'Prophylaxis', 'Safety'],
        'profile': {'tactical': 65, 'aggressive': 40, 'positional': 90, 'patient': 95, 'novelty': 55, 'staleness': 65},
        'confidence': 80.0
    },
    {
        'name': 'José Raúl Capablanca',
        'description': 'Natural talent with exceptional endgame technique',
        'era': '1910s-1940s',
        'strengths': ['Technical precision', 'Endgame mastery', 'Natural talent'],
        'profile': {'tactical': 75, 'aggressive': 60, 'positional': 88, 'patient': 85, 'novelty': 50, 'staleness': 60},
        'confidence': 75.0
    },
    {
        'name': 'Alexander Alekhine',
        'description': 'Attacking genius known for complex combinations',
        'era': '1920s-1940s',
        'strengths': ['Attacking play', 'Initiative', 'Dynamic positions'],
        'profile': {'tactical': 90, 'aggressive': 88, 'positional': 75, 'patient': 50, 'novelty': 85, 'staleness': 40},
        'confidence': 75.0
    },
    {
        'name': 'Vladimir Kramnik',
        'description': 'Solid positional player with creative understanding',
        'era': '1990s-2010s',
        'strengths': ['Positional understanding', 'Endgame technique', 'Creative play'],
        'profile': {'tactical': 78, 'aggressive': 60, 'positional': 92, 'patient': 85, 'novelty': 68, 'staleness': 52},
        'confidence': 85.0
    },
    {
        'name': 'Hikaru Nakamura',
        'description': 'Modern attacking player known for rapid chess and initiative',
        'era': '2000s-present',
        'strengths': ['Modern attacks', 'Initiative', 'Practical play'],
        'profile': {'tactical': 88, 'aggressive': 82, 'positional': 72, 'patient': 60, 'novelty': 80, 'staleness': 42},
        'confidence': 85.0
    },
    {
        'name': 'Fabiano Caruana',
        'description': 'Universal player with deep opening preparation',
        'era': '2010s-present',
        'strengths': ['Universal style', 'Opening preparation', 'Technical precision'],
        'profile': {'tactical': 85, 'aggressive': 70, 'positional': 88, 'patient': 78, 'novelty': 65, 'staleness': 58},
        'confidence': 85.0
    },
    {
        'name': 'Paul Morphy',
        'description': 'Tactical genius of the romantic era',
        'era': '1850s',
        'strengths': ['Tactical genius', 'Natural talent', 'Attacking play'],
        'profile': {'tactical': 95, 'aggressive': 92, 'positional': 65, 'patient': 40, 'novelty': 82, 'staleness': 38},
        'confidence': 70.0
    },
    {
        'name': 'Judit Polgar',
        'description': 'Strongest female player ever, known for aggressive tactical play',
        'era': '1990s-2010s',
        'strengths': ['Tactical prowess', 'Aggressive style', 'Competitive spirit'],
        'profile': {'tactical': 88, 'aggressive': 85, 'positional': 75, 'patient': 58, 'novelty': 72, 'staleness': 48},
        'confidence': 80.0
    },
    {
        'name': 'Viswanathan Anand',
        'description': 'Speed chess specialist with universal style and deep preparation',
        'era': '1990s-2010s',
        'strengths': ['Universal play', 'Speed', 'Opening preparation'],
        'profile': {'tactical': 85, 'aggressive': 75, 'positional': 88, 'patient': 75, 'novelty': 70, 'staleness': 52},
        'confidence': 85.0
    },
    {
        'name': 'Aron Nimzowitsch',
        'description': 'Hypermodern pioneer who revolutionized chess understanding',
        'era': '1920s-1930s',
        'strengths': ['Hypermodern concepts', 'Prophylaxis', 'Strategic innovation'],
        'profile': {'tactical': 72, 'aggressive': 65, 'positional': 92, 'patient': 80, 'novelty': 95, 'staleness': 30},
        'confidence': 70.0
    },
    {
        'name': 'Mikhail Botvinnik',
        'description': 'Scientific approach to chess, founder of Soviet School',
        'era': '1940s-1960s',
        'strengths': ['Deep preparation', 'Scientific method', 'Endgame technique'],
        'profile': {'tactical': 75, 'aggressive': 60, 'positional': 90, 'patient': 88, 'novelty': 55, 'staleness': 68},
        'confidence': 80.0
    },
    {
        'name': 'Vasily Smyslov',
        'description': 'Harmonious style with exceptional endgame mastery',
        'era': '1950s-1980s',
        'strengths': ['Endgame mastery', 'Harmonious play', 'Technical precision'],
        'profile': {'tactical': 78, 'aggressive': 55, 'positional': 90, 'patient': 88, 'novelty': 52, 'staleness': 62},
        'confidence': 80.0
    },
    {
        'name': 'Viktor Korchnoi',
        'description': 'Fearless fighter known for resourcefulness and never giving up',
        'era': '1960s-2000s',
        'strengths': ['Fighting spirit', 'Resourcefulness', 'Universal style'],
        'profile': {'tactical': 82, 'aggressive': 75, 'positional': 85, 'patient': 68, 'novelty': 68, 'staleness': 52},
        'confidence': 80.0
    },
    {
        'name': 'Ding Liren',
        'description': 'Solid positional player with deep calculation and modern style',
        'era': '2010s-present',
        'strengths': ['Solid play', 'Deep calculation', 'Modern openings'],
        'profile': {'tactical': 85, 'aggressive': 68, 'positional': 90, 'patient': 82, 'novelty': 70, 'staleness': 50},
        'confidence': 85.0
    },
    {
        'name': 'Alireza Firouzja',
        'description': 'Young aggressive talent with dynamic attacking style',
        'era': '2020s-present',
        'strengths': ['Dynamic play', 'Aggression', 'Modern tactics'],
        'profile': {'tactical': 88, 'aggressive': 90, 'positional': 70, 'patient': 52, 'novelty': 85, 'staleness': 35},
        'confidence': 75.0
    },
    {
        'name': 'Hou Yifan',
        'description': "Multiple-time Women's World Champion with classical style",
        'era': '2010s-present',
        'strengths': ['Classical understanding', 'Solid technique', 'Endgame skill'],
        'profile': {'tactical': 78, 'aggressive': 65, 'positional': 88, 'patient': 80, 'novelty': 62, 'staleness': 55},
        'confidence': 75.0
    },
    {
        'name': 'Bent Larsen',
        'description': 'Creative player with unconventional openings and fighting spirit',
        'era': '1960s-1990s',
        'strengths': ['Creativity', 'Unconventional openings', 'Fighting chess'],
        'profile': {'tactical': 80, 'aggressive': 78, 'positional': 75, 'patient': 60, 'novelty': 88, 'staleness': 35},
        'confidence': 75.0
    },
    {
        'name': 'Akiba Rubinstein',
        'description': 'Endgame virtuoso and master of rook endgames',
        'era': '1900s-1930s',
        'strengths': ['Endgame mastery', 'Rook endgames', 'Technical precision'],
        'profile': {'tactical': 75, 'aggressive': 52, 'positional': 92, 'patient': 90, 'novelty': 48, 'staleness': 70},
        'confidence': 70.0
    },
    {
        'name': 'David Bronstein',
        'description': 'Creative genius who played beautiful, imaginative chess',
        'era': '1940s-1990s',
        'strengths': ['Creativity', 'Imagination', 'Sacrificial play'],
        'profile': {'tactical': 85, 'aggressive': 78, 'positional': 80, 'patient': 62, 'novelty': 92, 'staleness': 32},
        'confidence': 75.0
    },
    {
        'name': 'Levon Aronian',
        'description': 'Creative and imaginative with rich tactical vision',
        'era': '2000s-present',
        'strengths': ['Creativity', 'Tactical vision', 'Universal play'],
        'profile': {'tactical': 88, 'aggressive': 75, 'positional': 85, 'patient': 72, 'novelty': 82, 'staleness': 42},
        'confidence': 85.0
    },
    {
        'name': 'Emanuel Lasker',
        'description': 'Longest-reigning world champion, psychologist of chess',
        'era': '1890s-1920s',
        'strengths': ['Practical play', 'Psychology', 'Resourcefulness'],
        'profile': {'tactical': 80, 'aggressive': 70, 'positional': 85, 'patient': 80, 'novelty': 72, 'staleness': 48},
        'confidence': 70.0
    },
    {
        'name': 'Ian Nepomniachtchi',
        'description': 'Aggressive tactical player with dynamic attacking style',
        'era': '2010s-present',
        'strengths': ['Tactical aggression', 'Initiative', 'Complex positions'],
        'profile': {'tactical': 90, 'aggressive': 88, 'positional': 72, 'patient': 58, 'novelty': 75, 'staleness': 48},
        'confidence': 85.0
    },
    {
        'name': 'Maxime Vachier-Lagrave',
        'description': 'Universal player with strong tactics and solid technique',
        'era': '2010s-present',
        'strengths': ['Universal style', 'Tactical sharpness', 'Calculation'],
        'profile': {'tactical': 90, 'aggressive': 75, 'positional': 85, 'patient': 75, 'novelty': 68, 'staleness': 54},
        'confidence': 85.0
    },
    {
        'name': 'Richard Rapport',
        'description': 'Highly creative player known for unorthodox openings',
        'era': '2010s-present',
        'strengths': ['Creativity', 'Unconventional ideas', 'Surprising moves'],
        'profile': {'tactical': 82, 'aggressive': 80, 'positional': 70, 'patient': 60, 'novelty': 95, 'staleness': 25},
        'confidence': 80.0
    },
    {
        'name': 'Wesley So',
        'description': 'Solid positional player with exceptional technique',
        'era': '2010s-present',
        'strengths': ['Solid play', 'Technical precision', 'Endgame mastery'],
        'profile': {'tactical': 82, 'aggressive': 58, 'positional': 92, 'patient': 90, 'novelty': 52, 'staleness': 68},
        'confidence': 85.0
    },
    {
        'name': 'Anish Giri',
        'description': 'Solid positional player with deep opening preparation',
        'era': '2010s-present',
        'strengths': ['Positional understanding', 'Opening preparation', 'Defensive resources'],
        'profile': {'tactical': 85, 'aggressive': 55, 'positional': 92, 'patient': 88, 'novelty': 58, 'staleness': 65},
        'confidence': 85.0
    },
    {
        'name': 'Daniil Dubov',
        'description': 'Creative aggressive player with unconventional ideas',
        'era': '2015-present',
        'strengths': ['Creativity', 'Aggressive play', 'Surprising ideas'],
        'profile': {'tactical': 88, 'aggressive': 85, 'positional': 75, 'patient': 55, 'novelty': 92, 'staleness': 30},
        'confidence': 80.0
    },
    {
        'name': 'Shakhriyar Mamedyarov',
        'description': 'Dynamic player with aggressive style and tactical sharpness',
        'era': '2010s-present',
        'strengths': ['Dynamic play', 'Tactical aggression', 'Initiative'],
        'profile': {'tactical': 88, 'aggressive': 88, 'positional': 75, 'patient': 60, 'novelty': 78, 'staleness': 42},
        'confidence': 85.0
    },
    {
        'name': 'Teimour Radjabov',
        'description': 'Solid positional player with excellent defensive skills',
        'era': '2000s-present',
        'strengths': ['Defensive mastery', 'Positional play', 'Solid preparation'],
        'profile': {'tactical': 80, 'aggressive': 52, 'positional': 90, 'patient': 92, 'novelty': 55, 'staleness': 70},
        'confidence': 80.0
    },
    {
        'name': 'Alexander Grischuk',
        'description': 'Universal player with strong tactics and time pressure skills',
        'era': '2000s-present',
        'strengths': ['Universal play', 'Tactical vision', 'Time pressure'],
        'profile': {'tactical': 90, 'aggressive': 78, 'positional': 82, 'patient': 68, 'novelty': 72, 'staleness': 50},
        'confidence': 85.0
    },
    {
        'name': 'Boris Gelfand',
        'description': 'Solid positional player with deep opening knowledge',
        'era': '1990s-2010s',
        'strengths': ['Opening preparation', 'Solid play', 'Technical precision'],
        'profile': {'tactical': 82, 'aggressive': 58, 'positional': 90, 'patient': 88, 'novelty': 50, 'staleness': 72},
        'confidence': 85.0
    },
    {
        'name': 'Peter Leko',
        'description': 'Solid defensive player known for drawing ability',
        'era': '1990s-2010s',
        'strengths': ['Defensive resources', 'Solid play', 'Technical precision'],
        'profile': {'tactical': 78, 'aggressive': 48, 'positional': 92, 'patient': 95, 'novelty': 45, 'staleness': 75},
        'confidence': 80.0
    },
    {
        'name': 'Vassily Ivanchuk',
        'description': 'Creative genius with unpredictable style and brilliant ideas',
        'era': '1980s-2010s',
        'strengths': ['Creativity', 'Tactical brilliance', 'Unpredictability'],
        'profile': {'tactical': 92, 'aggressive': 80, 'positional': 82, 'patient': 60, 'novelty': 95, 'staleness': 28},
        'confidence': 85.0
    },
]
