# API Migration Guide: Legacy to Unified API

## 🚨 **IMPORTANT: Legacy API Deprecation Notice**

The legacy API endpoints are **deprecated** and will be removed in a future version. Please migrate to the Unified API (`/api/v1/*`) as soon as possible.

## 📋 **Migration Overview**

| Legacy Endpoint | Unified Endpoint | Status |
|----------------|------------------|---------|
| `POST /analyze-games` | `POST /api/v1/analyze` | ✅ **Migrated** |
| `POST /analyze-position` | `POST /api/v1/analyze` | ✅ **Migrated** |
| `POST /analyze-move` | `POST /api/v1/analyze` | ✅ **Migrated** |
| `POST /analyze-game` | `POST /api/v1/analyze` | ✅ **Migrated** |
| `GET /analysis/{user_id}/{platform}` | `GET /api/v1/results/{user_id}/{platform}` | ✅ **Migrated** |
| `GET /analysis-stats/{user_id}/{platform}` | `GET /api/v1/stats/{user_id}/{platform}` | ✅ **Migrated** |
| `GET /analysis-progress/{user_id}/{platform}` | `GET /api/v1/progress/{user_id}/{platform}` | ✅ **Migrated** |

## 🔄 **Detailed Migration Instructions**

### 1. **Batch Analysis Migration**

**Legacy:**
```http
POST /analyze-games
Content-Type: application/json

{
  "user_id": "username",
  "platform": "lichess",
  "analysis_type": "stockfish",
  "limit": 10,
  "depth": 8,
  "skill_level": 8
}
```

**Unified:**
```http
POST /api/v1/analyze
Content-Type: application/json

{
  "user_id": "username",
  "platform": "lichess",
  "analysis_type": "stockfish",
  "limit": 10,
  "depth": 8,
  "skill_level": 8
}
```

**Changes:**
- ✅ Same request body
- ✅ Same response format
- ✅ Same functionality

### 2. **Position Analysis Migration**

**Legacy:**
```http
POST /analyze-position
Content-Type: application/json

{
  "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "depth": 8,
  "skill_level": 8
}
```

**Unified:**
```http
POST /api/v1/analyze
Content-Type: application/json

{
  "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "depth": 8,
  "skill_level": 8
}
```

**Changes:**
- ✅ Same request body
- ✅ Same response format
- ✅ Same functionality

### 3. **Move Analysis Migration**

**Legacy:**
```http
POST /analyze-move
Content-Type: application/json

{
  "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "move": "e4",
  "depth": 8,
  "skill_level": 8
}
```

**Unified:**
```http
POST /api/v1/analyze
Content-Type: application/json

{
  "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "move": "e4",
  "depth": 8,
  "skill_level": 8
}
```

**Changes:**
- ✅ Same request body
- ✅ Same response format
- ✅ Same functionality

### 4. **Single Game Analysis Migration**

**Legacy:**
```http
POST /analyze-game
Content-Type: application/json

{
  "user_id": "username",
  "platform": "lichess",
  "game_id": "game123",
  "pgn": "1. e4 e5 2. Nf3 Nc6...",
  "analysis_type": "stockfish",
  "depth": 8,
  "skill_level": 8
}
```

**Unified:**
```http
POST /api/v1/analyze
Content-Type: application/json

{
  "user_id": "username",
  "platform": "lichess",
  "game_id": "game123",
  "pgn": "1. e4 e5 2. Nf3 Nc6...",
  "analysis_type": "stockfish",
  "depth": 8,
  "skill_level": 8
}
```

**Changes:**
- ✅ Same request body
- ✅ Same response format
- ✅ Same functionality

### 5. **Results Endpoint Migration**

**Legacy:**
```http
GET /analysis/{user_id}/{platform}?limit=10&analysis_type=stockfish
```

**Unified:**
```http
GET /api/v1/results/{user_id}/{platform}?limit=10&analysis_type=stockfish
```

**Changes:**
- ✅ Same URL parameters
- ✅ Same response format
- ✅ Same functionality

### 6. **Stats Endpoint Migration**

**Legacy:**
```http
GET /analysis-stats/{user_id}/{platform}?analysis_type=stockfish
```

**Unified:**
```http
GET /api/v1/stats/{user_id}/{platform}?analysis_type=stockfish
```

**Changes:**
- ✅ Same URL parameters
- ✅ Same response format
- ✅ Same functionality

### 7. **Progress Endpoint Migration**

**Legacy:**
```http
GET /analysis-progress/{user_id}/{platform}
```

**Unified:**
```http
GET /api/v1/progress/{user_id}/{platform}
```

**Changes:**
- ✅ Same URL parameters
- ✅ Same response format
- ✅ Same functionality

## 🆕 **New Unified API Features**

The Unified API provides additional features not available in the legacy API:

### **Deep Analysis**
```http
GET /api/v1/deep-analysis/{user_id}/{platform}
```
- Personality scoring and insights
- Player style analysis
- Improvement recommendations

### **Real-time Progress**
```http
GET /api/v1/progress-realtime/{user_id}/{platform}
```
- Live progress updates
- WebSocket support (future)

### **ELO Statistics**
```http
GET /api/v1/elo-stats/{user_id}/{platform}
```
- ELO rating analysis
- Performance trends

### **Job Management**
```http
GET /api/v1/job-status/{job_id}
DELETE /api/v1/job/{job_id}
```
- Job status tracking
- Job cancellation

## 🔧 **Migration Steps**

### **Step 1: Update Base URL**
```javascript
// Before
const API_BASE = 'http://localhost:8001'

// After  
const API_BASE = 'http://localhost:8002/api/v1'
```

### **Step 2: Update Endpoint Paths**
```javascript
// Before
const endpoints = {
  analyzeGames: '/analyze-games',
  analyzePosition: '/analyze-position',
  analyzeMove: '/analyze-move',
  analyzeGame: '/analyze-game',
  getResults: '/analysis/{user_id}/{platform}',
  getStats: '/analysis-stats/{user_id}/{platform}',
  getProgress: '/analysis-progress/{user_id}/{platform}'
}

// After
const endpoints = {
  analyze: '/analyze',
  getResults: '/results/{user_id}/{platform}',
  getStats: '/stats/{user_id}/{platform}',
  getProgress: '/progress/{user_id}/{platform}',
  getDeepAnalysis: '/deep-analysis/{user_id}/{platform}',
  getEloStats: '/elo-stats/{user_id}/{platform}'
}
```

### **Step 3: Update Service Calls**
```javascript
// Before - Multiple service calls
const analysisResponse = await AnalysisService.startAnalysis(userId, platform, 10)
const results = await AnalysisService.getResults(userId, platform, 10)
const stats = await AnalysisService.getStats(userId, platform)

// After - Single unified service
const analysisResponse = await UnifiedAnalysisService.startBatchAnalysis(userId, platform, 'stockfish', 10)
const results = await UnifiedAnalysisService.getAnalysisResults(userId, platform, 10)
const stats = await UnifiedAnalysisService.getAnalysisStats(userId, platform)
```

## ⚠️ **Breaking Changes**

### **None!** 
The migration is designed to be **100% backward compatible**:
- ✅ Same request formats
- ✅ Same response formats  
- ✅ Same functionality
- ✅ Same error handling

## 🚀 **Benefits of Migration**

1. **Simplified API**: Single endpoint for all analysis types
2. **Better Performance**: Optimized unified processing
3. **Enhanced Features**: Deep analysis, real-time progress, ELO stats
4. **Future-Proof**: Active development and new features
5. **Better Documentation**: Comprehensive API documentation
6. **Improved Error Handling**: Consistent error responses

## 📞 **Support**

If you encounter any issues during migration:

1. **Check the logs**: Deprecated endpoints show migration warnings
2. **Test thoroughly**: Verify all functionality works as expected
3. **Contact support**: Create an issue with migration details

## 📅 **Timeline**

- **Phase 2 (Current)**: Legacy endpoints marked as deprecated with warnings
- **Phase 3 (Future)**: Legacy endpoints will be removed
- **Migration Period**: 6 months from deprecation notice

---

**⚠️ Action Required**: Please migrate to the Unified API as soon as possible to avoid service disruption.
