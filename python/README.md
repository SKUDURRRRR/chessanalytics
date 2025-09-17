# Chess Analysis API

A Python-based chess analysis service that provides deep insights into chess games using Stockfish engine and machine learning techniques.

## Features

- **Move Quality Analysis**: Identifies blunders, mistakes, inaccuracies, and brilliant moves
- **Phase Analysis**: Separate accuracy for opening, middle game, and endgame
- **Pattern Recognition**: Detects tactical and positional patterns
- **Rating Projections**: Performance analysis and rating trends
- **Time Management**: Analysis of time usage patterns
- **Supabase Integration**: Stores analysis results in your existing database

## Prerequisites

- Python 3.11+
- Stockfish chess engine
- Supabase account and project

## Quick Start

### 1. Install Dependencies

```bash
cd python
python setup.py
```

### 2. Install Stockfish

**Option A: Using pip (recommended)**
```bash
pip install stockfish
```

**Option B: Manual installation**
1. Download from [Stockfish website](https://stockfishchess.org/download/)
2. Add to your PATH or update `STOCKFISH_PATH` in `.env`

### 3. Configure Environment

Copy `env.example` to `.env` and update with your Supabase credentials:

```bash
cp env.example .env
```

### 4. Run the API

```bash
python main.py
```

The API will be available at `http://localhost:8000`

## API Endpoints

### Health Check
```
GET /health
```

### Start Analysis
```
POST /analyze-games
{
  "user_id": "username",
  "platform": "lichess",
  "limit": 10
}
```

### Get Analysis Results
```
GET /analysis/{user_id}/{platform}?limit=10
```

### Get Analysis Statistics
```
GET /analysis-stats/{user_id}/{platform}
```

## Docker Deployment

### Using Docker Compose

```bash
# Set environment variables
export SUPABASE_URL="your-supabase-url"
export SUPABASE_ANON_KEY="your-supabase-key"

# Run with Docker Compose
docker-compose up -d
```

### Using Docker

```bash
# Build image
docker build -t chess-analysis-api .

# Run container
docker run -p 8000:8000 \
  -e SUPABASE_URL="your-supabase-url" \
  -e SUPABASE_ANON_KEY="your-supabase-key" \
  chess-analysis-api
```

## Analysis Features

### Move Quality Classification

- **Blunders**: Moves that lose significant advantage (>200 centipawns)
- **Mistakes**: Moves that lose moderate advantage (100-200 centipawns)
- **Inaccuracies**: Moves that lose small advantage (50-100 centipawns)
- **Brilliant**: Exceptionally good moves (<-100 centipawns)

### Phase Analysis

- **Opening**: First 20 moves or 1/3 of game
- **Middle Game**: Moves 21-60 or middle 1/3
- **Endgame**: Last 20 moves or final 1/3

### Pattern Recognition

- **Tactical Patterns**: Pins, forks, skewers, discovered attacks
- **Positional Patterns**: Pawn structures, piece placement
- **Time Management**: Move timing analysis

## Database Schema

The analysis results are stored in the `game_analyses` table with the following structure:

```sql
CREATE TABLE game_analyses (
  id UUID PRIMARY KEY,
  game_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  total_moves INTEGER,
  accuracy FLOAT,
  blunders INTEGER,
  mistakes INTEGER,
  inaccuracies INTEGER,
  brilliant_moves INTEGER,
  opening_accuracy FLOAT,
  middle_game_accuracy FLOAT,
  endgame_accuracy FLOAT,
  average_evaluation FLOAT,
  time_management_score FLOAT,
  tactical_patterns JSONB,
  positional_patterns JSONB,
  analysis_date TIMESTAMP,
  moves_analysis JSONB
);
```

## Performance Considerations

- **Stockfish Depth**: Default depth is 15 (adjustable in code)
- **Batch Processing**: Analysis runs in background
- **Memory Usage**: ~100MB per concurrent analysis
- **Processing Time**: ~2-5 seconds per game

## Troubleshooting

### Stockfish Not Found
```
Error: Stockfish not found in PATH
```
**Solution**: Install Stockfish and ensure it's in your PATH, or update `STOCKFISH_PATH` in `.env`

### Supabase Connection Error
```
Error: Failed to connect to Supabase
```
**Solution**: Check your `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env`

### Memory Issues
```
Error: Out of memory
```
**Solution**: Reduce batch size or increase available memory

## Development

### Running Tests
```bash
python -m pytest tests/
```

### Code Formatting
```bash
black .
isort .
```

### Type Checking
```bash
mypy .
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details
