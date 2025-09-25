# API Documentation

## Overview
The Chess Analytics API provides endpoints for analyzing chess games and extracting personality insights from player performance.

## Base URL
- **Development**: `http://localhost:8002`
- **Production**: TBD

## Authentication
Currently no authentication required. All endpoints are publicly accessible.

## Endpoints

### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "service": "chess-analysis-api"
}
```

### Start Game Analysis
```http
POST /analyze-games
```

**Request Body:**
```json
{
  "user_id": "string",
  "platform": "string",
  "game_ids": ["string"],
  "limit": 10
}
```

**Response:**
```json
{
  "success": true,
  "message": "Analysis started for user on platform"
}
```

### Get Analysis Results
```http
GET /analysis/{user_id}/{platform}?limit=10
```

**Response:**
```json
[
  {
    "game_id": "string",
    "accuracy": 85.5,
    "blunders": 2,
    "mistakes": 5,
    "inaccuracies": 8,
    "brilliant_moves": 1,
    "opening_accuracy": 90.2,
    "middle_game_accuracy": 82.1,
    "endgame_accuracy": 88.7
  }
]
```

### Get Analysis Progress
```http
GET /analysis-progress/{user_id}/{platform}
```

**Response:**
```json
{
  "analyzed_games": 45,
  "total_games": 100,
  "progress_percentage": 45.0,
  "is_complete": false,
  "current_phase": "analyzing",
  "estimated_time_remaining": 120
}
```

### Get Analysis Statistics
```http
GET /analysis-stats/{user_id}/{platform}
```

**Response:**
```json
{
  "total_games_analyzed": 100,
  "average_accuracy": 82.3,
  "total_blunders": 15,
  "total_mistakes": 45,
  "total_inaccuracies": 78,
  "total_brilliant_moves": 12,
  "total_material_sacrifices": 8,
  "average_opening_accuracy": 85.1,
  "average_middle_game_accuracy": 80.2,
  "average_endgame_accuracy": 81.5,
  "average_aggressiveness_index": 65.4,
  "blunders_per_game": 0.15,
  "mistakes_per_game": 0.45,
  "inaccuracies_per_game": 0.78,
  "brilliant_moves_per_game": 0.12,
  "material_sacrifices_per_game": 0.08
}
```

## Data Models

### AnalysisRequest
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| user_id | string | Yes | Username of the chess player |
| platform | string | Yes | Platform: "lichess" or "chess.com" |
| game_ids | string[] | No | Specific game IDs to analyze |
| limit | number | No | Maximum number of games to analyze (default: 10) |

### GameAnalysisSummary
| Field | Type | Description |
|-------|------|-------------|
| game_id | string | Unique identifier for the game |
| accuracy | number | Overall move accuracy percentage |
| blunders | number | Number of blunders (major mistakes) |
| mistakes | number | Number of mistakes |
| inaccuracies | number | Number of inaccuracies |
| brilliant_moves | number | Number of brilliant moves |
| opening_accuracy | number | Accuracy in opening phase |
| middle_game_accuracy | number | Accuracy in middle game phase |
| endgame_accuracy | number | Accuracy in endgame phase |

### AnalysisProgress
| Field | Type | Description |
|-------|------|-------------|
| analyzed_games | number | Number of games analyzed so far |
| total_games | number | Total number of games to analyze |
| progress_percentage | number | Progress percentage (0-100) |
| is_complete | boolean | Whether analysis is complete |
| current_phase | string | Current phase: "fetching", "analyzing", "calculating", "saving", "complete" |
| estimated_time_remaining | number | Estimated time remaining in seconds |

## Error Handling

### HTTP Status Codes
- `200` - Success
- `404` - Resource not found
- `500` - Internal server error

### Error Response Format
```json
{
  "detail": "Error message describing what went wrong"
}
```

## Rate Limiting
Currently no rate limiting implemented. Consider implementing for production use.

## CORS
CORS is configured to allow all origins in development. Update for production security.

## 2025-09-17 — Diffs

### New Endpoints Added
- `POST /analyze-games` - Start background analysis
- `GET /analysis/{user_id}/{platform}` - Retrieve analysis results
- `GET /analysis-progress/{user_id}/{platform}` - Track analysis progress
- `GET /analysis-stats/{user_id}/{platform}` - Get aggregated statistics
- `GET /health` - Health check endpoint

### Schema Changes
- Added personality score fields to analysis results
- Implemented comprehensive error handling
- Added progress tracking for long-running operations
- Created proper request/response validation

### Backwards Compatibility
- All new endpoints are additive
- No breaking changes to existing functionality
- Maintains existing data structures

