# Famous Players Database

This directory contains data-driven personality profiles for famous chess players.

## Files

- `famous_players_profiles.json` - Validated player profiles with personality scores

## Profile Structure

Each profile contains:

```json
{
  "name": "Player Name",
  "era": "1960s-1970s",
  "description": "Brief description of playing style",
  "strengths": ["Strength 1", "Strength 2", "Strength 3"],
  "games_analyzed": 50,
  "profile": {
    "tactical": 85.0,
    "positional": 90.0,
    "aggressive": 70.0,
    "patient": 80.0,
    "novelty": 65.0,
    "staleness": 55.0
  },
  "confidence": 85.0,
  "metadata": {
    "total_moves": 1250,
    "source": "lichess.org/masters",
    "date_analyzed": "2025-01-13"
  }
}
```

## Generating Profiles

To analyze a famous player from PGN files:

```bash
python scripts/analyze_famous_players.py \
  --input games/tal.pgn \
  --output data/famous_players_profiles.json \
  --player "Mikhail Tal" \
  --era "1950s-1990s" \
  --description "The Magician from Riga - known for brilliant tactical combinations" \
  --strengths "Tactical vision,Sacrificial attacks,Complex calculations" \
  --append
```

## Data Sources

Recommended sources for PGN collections:
- [lichess.org/masters](https://lichess.org/masters) - Database of master games
- [pgnmentor.com](http://www.pgnmentor.com/) - Free PGN collections
- [chessgames.com](https://www.chessgames.com/) - Extensive game database

## Validation

Profiles should ideally be based on:
- **Minimum**: 20 games, 400 moves (confidence: 75%)
- **Good**: 50 games, 1000 moves (confidence: 85%)
- **Excellent**: 100+ games, 2000+ moves (confidence: 90-95%)

## Current Database

The system currently uses **26 famous players** spanning different eras, styles, and demographics:

- **Romantic Era**: Morphy, Anderssen
- **Classical Era**: Lasker, Capablanca, Alekhine
- **Soviet School**: Botvinnik, Smyslov, Petrosian, Tal, Karpov, Kasparov
- **Modern Era**: Kramnik, Anand, Carlsen, Nakamura, Caruana, Ding, Firouzja
- **Creative Players**: Bronstein, Nimzowitsch, Larsen, Aronian
- **Female Players**: Judit Polgar, Hou Yifan
- **Specialists**: Rubinstein (endgames), Korchnoi (fighting), Fischer (universal)

## Methodology

Profiles are calculated using the standardized `PersonalityScorer` which analyzes:

1. **Move-level metrics**: best moves, mistakes, blunders, centipawn loss
2. **Tactical patterns**: forcing moves, checks, captures, combinations
3. **Positional play**: quiet moves, strategic accuracy, structure
4. **Style indicators**: aggression, patience, creativity, consistency

The same scoring algorithm used for user analysis is applied to famous players, ensuring fair comparisons.

## Future Improvements

- [ ] Analyze more players to reach 40+ database
- [ ] Use Stockfish analysis on historical games for accurate move classifications
- [ ] Add era-specific normalization (chess evolution over time)
- [ ] Include opening repertoire fingerprints
- [ ] Add time control preferences
- [ ] Link to example games showcasing each player's style
