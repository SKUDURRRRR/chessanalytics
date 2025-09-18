# Unified API Migration Guide

This guide explains how to migrate from the old multiple API endpoints to the new unified API system.

## 🎯 What Changed

### Before (Multiple Endpoints)
- `/analyze-games` - Batch analysis
- `/analyze-position` - Position analysis  
- `/analyze-move` - Move analysis
- `/analyze-game` - Single game analysis
- `/analysis/{user_id}/{platform}` - Get results
- `/analysis-stats/{user_id}/{platform}` - Get stats
- `/analysis-progress/{user_id}/{platform}` - Get progress

### After (Unified API)
- `POST /api/v1/analyze` - **Single endpoint for all analysis types**
- `GET /api/v1/results/{user_id}/{platform}` - Get results
- `GET /api/v1/stats/{user_id}/{platform}` - Get stats  
- `GET /api/v1/progress/{user_id}/{platform}` - Get progress
- `GET /api/v1/deep-analysis/{user_id}/{platform}` - Deep analysis

## 🔄 Migration Steps

### 1. Update Frontend Services

**Old Code:**
```typescript
import { AnalysisService } from '../services/analysisService'
import { DeepAnalysisService } from '../services/deepAnalysisService'

// Multiple service calls
await AnalysisService.startAnalysis(userId, platform, limit)
await AnalysisService.getAnalysisResults(userId, platform, limit)
await AnalysisService.getAnalysisStats(userId, platform)
```

**New Code:**
```typescript
import { UnifiedAnalysisService } from '../services/unifiedAnalysisService'

// Single service for everything
await UnifiedAnalysisService.startBatchAnalysis(userId, platform, 'stockfish', limit)
await UnifiedAnalysisService.getAnalysisResults(userId, platform, limit)
await UnifiedAnalysisService.getAnalysisStats(userId, platform)
```

### 2. Update API Calls

**Old Code:**
```typescript
// Different endpoints for different analysis types
const batchResponse = await fetch('/analyze-games', { method: 'POST', body: batchData })
const positionResponse = await fetch('/analyze-position', { method: 'POST', body: positionData })
const moveResponse = await fetch('/analyze-move', { method: 'POST', body: moveData })
```

**New Code:**
```typescript
// Single endpoint for all analysis types
const batchResponse = await fetch('/api/v1/analyze', { 
  method: 'POST', 
  body: JSON.stringify({ ...batchData, analysis_type: 'stockfish' })
})
const positionResponse = await fetch('/api/v1/analyze', { 
  method: 'POST', 
  body: JSON.stringify({ ...positionData, fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' })
})
const moveResponse = await fetch('/api/v1/analyze', { 
  method: 'POST', 
  body: JSON.stringify({ ...moveData, fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', move: 'e2e4' })
})
```

### 3. Update Request Models

**Old Code:**
```typescript
// Different request models for different endpoints
interface BatchAnalysisRequest {
  user_id: string
  platform: string
  analysis_type: string
  limit: number
}

interface PositionAnalysisRequest {
  fen: string
  analysis_type: string
  depth: number
}
```

**New Code:**
```typescript
// Single unified request model
interface UnifiedAnalysisRequest {
  user_id: string
  platform: string
  analysis_type?: 'basic' | 'stockfish' | 'deep'
  limit?: number
  depth?: number
  skill_level?: number
  pgn?: string        // For single game analysis
  fen?: string        // For position analysis
  move?: string       // For move analysis
}
```

## 📋 API Endpoint Mapping

| Old Endpoint | New Endpoint | Method | Notes |
|--------------|--------------|---------|-------|
| `POST /analyze-games` | `POST /api/v1/analyze` | POST | Add `analysis_type: 'stockfish'` |
| `POST /analyze-position` | `POST /api/v1/analyze` | POST | Add `fen: 'position'` |
| `POST /analyze-move` | `POST /api/v1/analyze` | POST | Add `fen: 'position'` and `move: 'e2e4'` |
| `POST /analyze-game` | `POST /api/v1/analyze` | POST | Add `pgn: 'game_pgn'` |
| `GET /analysis/{user_id}/{platform}` | `GET /api/v1/results/{user_id}/{platform}` | GET | Same parameters |
| `GET /analysis-stats/{user_id}/{platform}` | `GET /api/v1/stats/{user_id}/{platform}` | GET | Same parameters |
| `GET /analysis-progress/{user_id}/{platform}` | `GET /api/v1/progress/{user_id}/{platform}` | GET | Same parameters |
| - | `GET /api/v1/deep-analysis/{user_id}/{platform}` | GET | **New endpoint** |

## 🔧 Backward Compatibility

The new `UnifiedAnalysisService` includes backward compatibility methods:

```typescript
// These still work but are deprecated
UnifiedAnalysisService.startAnalysis()     // Use startBatchAnalysis()
UnifiedAnalysisService.getResults()        // Use getAnalysisResults()
UnifiedAnalysisService.getStats()          // Use getAnalysisStats()
```

## 🚀 New Features

### 1. Deep Analysis
```typescript
const deepAnalysis = await UnifiedAnalysisService.getDeepAnalysis(userId, platform)
// Returns personality scores, player style, recommendations, etc.
```

### 2. API Discovery
```typescript
const apiInfo = await UnifiedAnalysisService.getApiInfo()
// Returns available features and endpoints
```

### 3. Unified Error Handling
All analysis types now use the same error handling patterns and response format.

## 📝 Example Migration

**Before:**
```typescript
// Multiple service imports
import { AnalysisService } from '../services/analysisService'
import { DeepAnalysisService } from '../services/deepAnalysisService'

// Multiple API calls
const analysisResponse = await AnalysisService.startAnalysis(userId, platform, 10)
const results = await AnalysisService.getAnalysisResults(userId, platform, 10)
const stats = await AnalysisService.getAnalysisStats(userId, platform)
const deepData = await DeepAnalysisService.fetchDeepAnalysis(userId, platform)
```

**After:**
```typescript
// Single service import
import { UnifiedAnalysisService } from '../services/unifiedAnalysisService'

// Unified API calls
const analysisResponse = await UnifiedAnalysisService.startBatchAnalysis(userId, platform, 'stockfish', 10)
const results = await UnifiedAnalysisService.getAnalysisResults(userId, platform, 10)
const stats = await UnifiedAnalysisService.getAnalysisStats(userId, platform)
const deepData = await UnifiedAnalysisService.getDeepAnalysis(userId, platform)
```

## ✅ Benefits

1. **Simplified API** - Single endpoint for all analysis types
2. **Consistent Interface** - Same request/response patterns
3. **Better Error Handling** - Unified error handling across all analysis types
4. **Easier Maintenance** - Single service to maintain instead of multiple
5. **New Features** - Deep analysis and API discovery
6. **Backward Compatibility** - Old methods still work during transition

## 🎉 Migration Complete!

Once you've updated your code to use the unified API, you can:
1. Remove the old service files (`analysisService.ts`, `deepAnalysisService.ts`)
2. Update all imports to use `UnifiedAnalysisService`
3. Enjoy the simplified, more maintainable codebase!

