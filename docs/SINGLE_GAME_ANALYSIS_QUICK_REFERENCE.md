# Single Game Analysis - Quick Reference

## 🚀 Quick Start

### Frontend (React)
```typescript
// Trigger single game analysis
const response = await fetch(`${API_BASE_URL}/api/v1/analyze?use_parallel=false`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_id: "Nezar-kadah",
    platform: "chess.com", 
    game_id: "143917000916",
    analysis_type: "stockfish"
  })
});
```

### Backend (Python)
```python
# Single game analysis endpoint
@app.post("/api/v1/analyze")
async def analyze(request: UnifiedAnalysisRequest):
    if request.game_id or request.provider_game_id:
        return await _handle_single_game_by_id(request)
    # ... other analysis types
```

## 🔧 Key Functions

### Request Validation
```python
is_valid, error = _validate_single_game_analysis_request(request)
if not is_valid:
    return error_response(f"Validation failed: {error}")
```

### User ID Canonicalization
```python
canonical_user_id = _canonical_user_id(request.user_id, request.platform)
# "Nezar-kadah" → "nezar-kadah" for chess.com
```

### Foreign Key Validation
```python
fk_check = db_client.table('games').select('id').eq(
    'provider_game_id', game_id
).eq('user_id', canonical_user_id).eq('platform', platform).maybe_single().execute()

if not fk_check.data:
    return error_response("Foreign key constraint validation failed")
```

## 🛡️ Safeguards Checklist

- [ ] **Input Validation**: All parameters validated before processing
- [ ] **User ID Canonicalization**: Consistent lowercase user IDs
- [ ] **Foreign Key Validation**: Game exists before analysis save
- [ ] **Error Handling**: Graceful failures with structured responses
- [ ] **Logging**: Comprehensive step-by-step logging
- [ ] **Database Transactions**: Atomic operations for data consistency

## 🚨 Common Error Patterns

### Foreign Key Constraint Violation
```
ERROR: Key (user_id, platform, game_id)=(Nezar-kadah, chess.com, 143917000916) 
is not present in table "games"
```
**Fix**: Ensure user ID is canonicalized and game exists in games table

### Missing Parameters
```
[SINGLE GAME ANALYSIS] ❌ Validation failed: user_id is required
```
**Fix**: Check request body includes all required fields

### Database Connection Issues
```
[SINGLE GAME ANALYSIS] ❌ CRITICAL ERROR during save: Connection timeout
```
**Fix**: Check Supabase connection and credentials

## 📊 Log Patterns

### Successful Analysis
```
[SINGLE GAME ANALYSIS] Starting analysis for game_id: 143917000916, user: nezar-kadah
[SINGLE GAME ANALYSIS] ✅ Foreign key validation passed
[SINGLE GAME ANALYSIS] ✅ Analysis completed and saved for game_id: 143917000916
```

### Failed Analysis
```
[SINGLE GAME ANALYSIS] ❌ Validation failed: user_id is required
[SINGLE GAME ANALYSIS] ❌ CRITICAL: Foreign key validation failed
[SINGLE GAME ANALYSIS] ❌ Analysis completed but failed to save to database
```

## 🔍 Debug Commands

### Check Server Health
```bash
curl http://localhost:8002/health
```

### Test Single Game Analysis
```bash
curl -X POST http://localhost:8002/api/v1/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test-user",
    "platform": "chess.com",
    "game_id": "123456789",
    "analysis_type": "stockfish"
  }'
```

### Check Database Connection
```bash
curl http://localhost:8002/health | jq '.database_connected'
```

## 📋 Database Requirements

### Required Tables
- `games` - Main game records (for foreign key constraint)
- `games_pgn` - PGN data storage
- `game_analyses` - Analysis results
- `move_analyses` - Detailed move analysis

### Foreign Key Constraint
```sql
ALTER TABLE game_analyses
ADD CONSTRAINT fk_game_analyses_game 
FOREIGN KEY (user_id, platform, game_id)
REFERENCES games(user_id, platform, provider_game_id);
```

## ⚡ Performance Notes

- **Analysis Time**: ~1.3-1.7 seconds per move
- **Typical Game**: 50 moves = ~65-85 seconds
- **Memory Usage**: 512MB max, 64MB Stockfish hash
- **Concurrency**: Up to 4 concurrent analyses

## 🔧 Configuration

### Environment Variables
```bash
VITE_ANALYSIS_API_URL=http://localhost:8002
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Backend Settings
```python
STOCKFISH_DEPTH = 8
STOCKFISH_SKILL_LEVEL = 8
STOCKFISH_TIME_LIMIT = 1.0
MAX_CONCURRENT_ANALYSES = 4
```

## 🚀 Deployment Checklist

- [ ] Environment variables configured
- [ ] Database schema up to date
- [ ] Stockfish engine installed and accessible
- [ ] All dependencies installed
- [ ] Health checks passing
- [ ] Error monitoring configured

---

**Quick Links:**
- [Full Documentation](./SINGLE_GAME_ANALYSIS_SYSTEM.md)
- [API Reference](./API.md)
- [Database Schema](./DB/SCHEMA.md)
