# Unified Chess Analysis System

A comprehensive, unified chess analysis system that consolidates multiple scattered implementations into a clean, maintainable architecture.

## Overview

This system provides:
- **Single Core Analysis Engine** - Configurable analysis supporting basic heuristics and Stockfish engine
- **Unified API Server** - One endpoint for all analysis operations with real-time progress tracking
- **Centralized Configuration** - Environment-based and file-based configuration management
- **Comprehensive Analysis** - Position, move, and game analysis with personality scoring and pattern detection

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Unified API Server                       │
│                  (python/core/api_server.py)               │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                 Core Analysis Engine                        │
│                (python/core/analysis_engine.py)            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Basic     │  │  Stockfish  │  │      Deep           │ │
│  │  Analysis   │  │  Analysis   │  │    Analysis         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                Configuration Management                     │
│                  (python/core/config.py)                   │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Install Dependencies

```bash
pip install fastapi uvicorn supabase python-chess chess-engine
```

### 2. Set Environment Variables

```bash
export SUPABASE_URL="your_supabase_url"
export SUPABASE_ANON_KEY="your_anon_key"
export STOCKFISH_PATH="path_to_stockfish_executable"  # Optional
export API_PORT="8000"
```

### 3. Start the Server

```bash
python python/core/api_server.py
```

### 4. Test the API

```bash
curl http://localhost:8000/health
```

## API Endpoints

### Analysis Operations

- `POST /analyze-games` - Batch analysis of user's games
- `POST /analyze-position` - Analyze a chess position
- `POST /analyze-move` - Analyze a specific move
- `POST /analyze-game` - Analyze a single game from PGN

### Data Retrieval

- `GET /analysis/{user_id}/{platform}` - Get analysis results
- `GET /analysis-stats/{user_id}/{platform}` - Get analysis statistics
- `GET /analysis-progress/{user_id}/{platform}` - Get analysis progress

### System

- `GET /health` - Health check
- `GET /` - API information

## Analysis Types

### 1. Basic Analysis
- Fast heuristic-based analysis
- No external dependencies
- Good for quick insights

### 2. Stockfish Analysis
- Full Stockfish engine integration
- Configurable depth and skill level
- High-quality analysis

### 3. Deep Analysis
- High-depth Stockfish analysis
- Advanced pattern detection
- Comprehensive personality scoring

## Configuration

### Environment Variables

```bash
# Database
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # Optional

# Stockfish
STOCKFISH_PATH=path_to_stockfish_executable
STOCKFISH_DEPTH=15
STOCKFISH_SKILL_LEVEL=20
STOCKFISH_TIME_LIMIT=1.0

# Analysis
ANALYSIS_DEFAULT_TYPE=stockfish
ANALYSIS_BATCH_SIZE=10
ANALYSIS_MAX_GAMES=100
ANALYSIS_PARALLEL=true

# API
API_HOST=127.0.0.1
API_PORT=8000
API_WORKERS=1
API_TIMEOUT=300

# Logging
LOG_LEVEL=INFO
LOG_FILE=logs/analysis.log
```

### Configuration File

Create `config.json`:

```json
{
  "database": {
    "url": "your_supabase_url",
    "anon_key": "your_anon_key",
    "timeout": 30
  },
  "stockfish": {
    "path": "path_to_stockfish",
    "depth": 15,
    "skill_level": 20
  },
  "analysis": {
    "default_type": "stockfish",
    "batch_size": 10,
    "parallel_processing": true
  },
  "api": {
    "host": "127.0.0.1",
    "port": 8000,
    "cors_origins": ["http://localhost:3000"]
  }
}
```

## Usage Examples

### Python API Client

```python
import requests

# Analyze a position
response = requests.post("http://localhost:8000/analyze-position", json={
    "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "analysis_type": "stockfish"
})

print(response.json())
```

### Direct Engine Usage

```python
import asyncio
from core.analysis_engine import ChessAnalysisEngine, AnalysisConfig, AnalysisType

async def analyze_game():
    engine = ChessAnalysisEngine()
    config = AnalysisConfig(analysis_type=AnalysisType.STOCKFISH)
    engine.config = config
    
    pgn = "[Event \"Test Game\"]\n[Site \"test\"]\n[Date \"2024.01.01\"]\n[White \"Player1\"]\n[Black \"Player2\"]\n[Result \"1-0\"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 11. c4 c6 12. cxb5 axb5 13. Nc3 Bb7 14. Bg5 b4 15. Nb1 h6 16. Bh4 c5 17. dxe5 Nxe4 18. Bxe7 Qxe7 19. exd6 Qf6 20. Nbd2 Nxd6 21. Nc4 Nxc4 22. Bxc4 Nb6 23. Ne5 Rae8 24. Bxf7+ Rxf7 25. Nxf7 Rxe1+ 26. Qxe1 Kxf7 27. Qe3 Qg5 28. Qxg5 hxg5 29. b3 Ke6 30. a3 Kd6 31. axb4 cxb4 32. Ra5 Nd5 33. f3 Bc8 34. Kf2 Bf5 35. Ra7 g6 36. Ra6+ Kc5 37. Ke1 Nf4 38. g3 Nxh3 39. Kd2 Kb5 40. Rd6 Kc5 41. Ra6 Nf2 42. g4 Bd3 43. Re6 1-0"
    
    analysis = await engine.analyze_game(pgn, "player1", "lichess")
    print(f"Accuracy: {analysis.accuracy}%")
    print(f"Blunders: {analysis.blunders}")

asyncio.run(analyze_game())
```

## Migration from Old System

If you're migrating from the old scattered implementations:

1. Run the migration script:
   ```bash
   python python/migrate_to_unified.py
   ```

2. Review the migration guide: `MIGRATION_GUIDE.md`

3. Update your client code to use the new API

4. Test the new system thoroughly

## Database Schema

The system uses these Supabase tables:

### `game_analyses`
Stores comprehensive game analysis results including:
- Basic metrics (accuracy, blunders, mistakes, etc.)
- Phase analysis (opening, middle game, endgame)
- Personality scores (tactical, positional, aggressive, etc.)
- Patterns and themes
- Move-by-move analysis

### `games`
Stores game metadata and basic information.

### `games_pgn`
Stores PGN data for games.

## Performance

### Analysis Speed
- **Basic Analysis**: ~1-5ms per position
- **Stockfish Analysis**: ~100-1000ms per position (depending on depth)
- **Deep Analysis**: ~1000-5000ms per position

### Scalability
- Supports parallel analysis processing
- Configurable batch sizes
- Database connection pooling
- Progress tracking for long-running operations

## Error Handling

The system includes comprehensive error handling:
- Automatic fallback from Stockfish to basic analysis
- Graceful degradation when services are unavailable
- Detailed error messages and logging
- Progress tracking even during failures

## Logging

Configure logging via environment variables:
```bash
export LOG_LEVEL=INFO
export LOG_FILE=logs/analysis.log
```

Logs include:
- Analysis progress and timing
- Error details and stack traces
- Configuration validation results
- API request/response details

## Troubleshooting

### Common Issues

1. **Stockfish not found**
   - Check `STOCKFISH_PATH` environment variable
   - Verify executable exists and is accessible
   - System will fall back to basic analysis

2. **Database connection issues**
   - Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY`
   - Check network connectivity
   - Verify database permissions

3. **Analysis failures**
   - Check logs for detailed error messages
   - Verify PGN data format
   - Ensure sufficient system resources

### Getting Help

1. Check the health endpoint: `GET /health`
2. Review logs for error details
3. Verify configuration with the config module
4. Test individual components separately

## Development

### Running Tests

```bash
# Test the analysis engine
python python/core/analysis_engine.py

# Test the API server
python python/core/api_server.py

# Test configuration
python python/core/config.py
```

### Adding New Analysis Types

1. Extend the `AnalysisType` enum
2. Add analysis logic to the `ChessAnalysisEngine`
3. Update the API server to handle the new type
4. Add configuration options if needed

## License

This project is part of the chess analytics system. See the main project for license information.

## Contributing

1. Follow the existing code structure
2. Add comprehensive error handling
3. Include logging for debugging
4. Update documentation for new features
5. Test thoroughly before submitting changes
