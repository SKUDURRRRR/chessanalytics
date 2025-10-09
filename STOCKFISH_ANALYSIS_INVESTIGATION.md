# Stockfish Analysis Investigation Report
## Issue: Stockfish Analysis Not Running on chessdata.app

### Problem Summary
After security key changes, Stockfish analysis stopped working on the production webapp. The backend returns "Error analyzing game: Stockfish executable not found" despite Stockfish being correctly installed in the Docker container.

### Root Cause Analysis

#### 1. **Disconnected Configuration Systems**
The system has TWO separate methods for finding Stockfish:

**A. ChessAnalysisConfig._find_stockfish_executable() (config.py:163-221)**
- ✅ Correctly checks Linux paths: `/usr/games/stockfish`, `/usr/bin/stockfish`, `/usr/local/bin/stockfish`
- ✅ Checks environment variable `STOCKFISH_PATH`
- ✅ Has proper Railway/production support
- ⚠️ **BUT this configuration is never passed to the analysis engine**

**B. ChessAnalysisEngine._find_stockfish_path() (analysis_engine.py:271-293)**
- ❌ Only checks Windows paths
- ❌ Only checks "stockfish" and "stockfish.exe" in PATH
- ❌ Does NOT check `/usr/games/stockfish` or other Linux paths
- ❌ **This is the method actually used by the engine**

#### 2. **Engine Initialization Bug**
In `unified_api_server.py:2673-2678`:
```python
def get_analysis_engine() -> ChessAnalysisEngine:
    """Get or create the analysis engine instance."""
    global analysis_engine
    # Always create a new engine to ensure we get the latest Stockfish detection
    analysis_engine = ChessAnalysisEngine()  # ❌ No stockfish_path parameter!
    return analysis_engine
```

The engine is created without passing the stockfish path from config, causing it to use its broken `_find_stockfish_path()` method.

#### 3. **Docker Environment Variable Issue**
In `python/Dockerfile:24-36`:
```dockerfile
RUN if [ -f /usr/games/stockfish ]; then \
        echo "STOCKFISH_PATH=/usr/games/stockfish" >> /etc/environment; \
```
- The Dockerfile attempts to set `STOCKFISH_PATH` in `/etc/environment`
- ⚠️ **This doesn't work because the CMD doesn't source `/etc/environment`**
- Environment variables set this way are not available to the Python application

#### 4. **Security Key Changes Impact**
After security key changes:
- Railway environment variables might have been reset
- `STOCKFISH_PATH` environment variable was likely lost
- Without this env var, the broken engine path detection fails completely

### Error Flow
1. Frontend requests analysis → Backend `/api/v1/analyze` endpoint
2. `get_analysis_engine()` creates `ChessAnalysisEngine()` without stockfish_path
3. Engine calls `_find_stockfish_path(None)` which only checks Windows paths
4. Returns `None` because `/usr/games/stockfish` is never checked
5. Later when `_analyze_move_stockfish()` is called, it raises: `ValueError("Stockfish executable not found")`
6. Error caught but analysis fails with "Error analyzing game: Stockfish executable not found"

### Evidence from Logs
```
Move analysis completed in 0.0ms  ← Analysis completing instantly = not running
Error analyzing game: Stockfish executable not found  ← The actual error
INFO: "POST /api/v1/analyze?use_parallel=false HTTP/1.1" 200 OK  ← Returns 200 but with error
```

### Verification
The Dockerfile correctly installs Stockfish:
```dockerfile
RUN apt-get update && \
    apt-get install -y stockfish && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*
```

On Railway/Ubuntu, this installs Stockfish to `/usr/games/stockfish`, which is the standard location.

## Solution

### Fix 1: Pass Config Stockfish Path to Engine (RECOMMENDED)
Modify `unified_api_server.py:2673-2678`:
```python
def get_analysis_engine() -> ChessAnalysisEngine:
    """Get or create the analysis engine instance."""
    global analysis_engine
    # Pass stockfish path from config
    stockfish_path = config.stockfish.path
    analysis_engine = ChessAnalysisEngine(stockfish_path=stockfish_path)
    return analysis_engine
```

### Fix 2: Update Engine Path Detection to Include Linux Paths
Modify `analysis_engine.py:271-293` to include Linux paths:
```python
def _find_stockfish_path(self, custom_path: Optional[str]) -> Optional[str]:
    """Find the best available Stockfish executable."""
    if custom_path and os.path.exists(custom_path):
        return custom_path
    
    # Check environment variable
    env_path = os.getenv("STOCKFISH_PATH")
    if env_path and os.path.exists(env_path):
        return env_path
    
    import platform
    is_windows = platform.system() == "Windows"
    
    # Try common paths based on OS
    possible_paths = []
    if is_windows:
        possible_paths = [
            # Windows paths...
        ]
    else:
        # Linux/production paths
        possible_paths = [
            "/usr/games/stockfish",  # Railway/Debian/Ubuntu
            "/usr/bin/stockfish",
            "/usr/local/bin/stockfish",
            "stockfish"
        ]
    
    for path in possible_paths:
        if os.path.exists(path) or self._check_command_exists(path):
            return path
    
    return None
```

### Fix 3: Set Environment Variable in Railway
Add to Railway environment variables:
```
STOCKFISH_PATH=/usr/games/stockfish
```

### Fix 4: Fix Dockerfile ENV Setting (OPTIONAL)
Replace the `/etc/environment` approach with direct ENV:
```dockerfile
# Find and set STOCKFISH_PATH at build time
RUN if [ -f /usr/games/stockfish ]; then \
        export STOCKFISH_PATH=/usr/games/stockfish; \
    elif [ -f /usr/bin/stockfish ]; then \
        export STOCKFISH_PATH=/usr/bin/stockfish; \
    else \
        export STOCKFISH_PATH=stockfish; \
    fi

# Set as environment variable
ENV STOCKFISH_PATH=${STOCKFISH_PATH:-/usr/games/stockfish}
```

## Recommended Implementation Order

1. **Fix 1** - Pass config stockfish path to engine (immediate fix)
2. **Fix 2** - Update engine path detection (defensive programming)
3. **Fix 3** - Set Railway environment variable (production safety)
4. **Fix 4** - Update Dockerfile (long-term robustness)

All four fixes are complementary and create a robust, multi-layer solution.

## Testing Verification

After fixes, verify:
1. Backend startup logs show: `[STOCKFISH] Found Stockfish at /usr/games/stockfish`
2. Health endpoint shows: `"stockfish_available": true`
3. Analysis requests complete with realistic timing (not 0.0ms)
4. No "Stockfish executable not found" errors in logs

