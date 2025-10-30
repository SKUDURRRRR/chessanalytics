# 🐛 BUG FIX: User Validation & Profile Selection Errors

## Issues Identified

### 1. **chessgauravvv: "User not found on Lichess"** ✅ SOLVED
**Status**: Bug confirmed - User EXISTS on Lichess (6,246 games, 1956 rating)

**Root Cause**: Double error handling bug
- Frontend (autoImportService.ts line 72-78): Catches ALL errors and returns `exists: false`
- Backend (unified_api_server.py line 6521-6526): Catches ALL exceptions and returns `exists: false`
- Result: Network timeouts/errors incorrectly report "user not found"

### 2. **flapjaxrfun: "Failed to select player"**
**Status**: Bug confirmed - Error not reaching backend

**Root Cause**: ProfileService.getOrCreateProfile() failing silently
- Generic error message doesn't help debugging
- No retry logic for transient failures
- Error could be: timeout, network issue, or backend down

---

## 🔧 FIXES TO IMPLEMENT

### Fix #1: Improve Validation Error Handling (Frontend)

**File**: `src/services/autoImportService.ts`

```typescript
// BEFORE (line 50-79):
static async validateUserOnPlatform(
  userId: string,
  platform: 'lichess' | 'chess.com'
): Promise<UserValidation> {
  try {
    const response = await fetch(`${API_URL}/api/v1/validate-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        platform: platform,
      }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error validating user:', error)
    return {
      exists: false,  // ❌ THIS IS THE BUG!
      message: 'Failed to validate user. Please check your connection and try again.',
    }
  }
}

// AFTER (FIXED):
static async validateUserOnPlatform(
  userId: string,
  platform: 'lichess' | 'chess.com'
): Promise<UserValidation> {
  try {
    const response = await fetch(`${API_URL}/api/v1/validate-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        platform: platform,
      }),
      timeout: 10000, // 10 second timeout
    })

    if (!response.ok) {
      // Distinguish between different HTTP errors
      if (response.status === 404) {
        return {
          exists: false,
          message: `User not found on ${platform}`
        }
      } else if (response.status >= 500) {
        // Server error - don't assume user doesn't exist
        throw new Error(`Server error: ${response.status}`)
      } else {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error validating user:', error)

    // ✅ FIXED: Don't assume user doesn't exist on network errors!
    // Let the user know it's a connection issue, not that user doesn't exist
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Cannot connect to server. Please check your internet connection.')
    }

    throw new Error(error instanceof Error ? error.message : 'Unknown error occurred')
  }
}
```

---

### Fix #2: Improve Backend Validation (Don't catch all exceptions)

**File**: `python/core/unified_api_server.py`

```python
# BEFORE (line 6468-6526):
@app.post("/api/v1/validate-user")
async def validate_user(request: dict):
    """Validate that a user exists on the specified platform."""
    try:
        # ... validation logic ...
    except Exception as e:
        print(f"Error validating user: {e}")
        return {
            "exists": False,  # ❌ THIS IS THE BUG!
            "message": f"Error validating user: {str(e)}"
        }

# AFTER (FIXED):
@app.post("/api/v1/validate-user")
async def validate_user(request: dict):
    """Validate that a user exists on the specified platform."""
    try:
        user_id = request.get("user_id")
        platform = request.get("platform")

        if not user_id or not platform:
            return JSONResponse(
                status_code=400,
                content={
                    "exists": False,
                    "message": "Missing user_id or platform parameter"
                }
            )

        if platform not in ["lichess", "chess.com"]:
            return JSONResponse(
                status_code=400,
                content={
                    "exists": False,
                    "message": "Platform must be 'lichess' or 'chess.com'"
                }
            )

        # Validate user exists on the platform
        if platform == "lichess":
            import aiohttp
            async with aiohttp.ClientSession() as session:
                url = f"https://lichess.org/api/user/{user_id}"
                try:
                    async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as response:
                        if response.status == 200:
                            return {"exists": True, "message": "User found on Lichess"}
                        elif response.status == 404:
                            return {
                                "exists": False,
                                "message": f"User '{user_id}' not found on Lichess"
                            }
                        else:
                            # ✅ FIXED: Return HTTP 503 for Lichess API errors
                            raise HTTPException(
                                status_code=503,
                                detail=f"Lichess API returned status {response.status}"
                            )
                except asyncio.TimeoutError:
                    # ✅ FIXED: Return HTTP 504 for timeouts
                    raise HTTPException(
                        status_code=504,
                        detail="Lichess API timeout - please try again"
                    )
        else:  # chess.com
            import httpx
            headers = {
                'User-Agent': 'ChessAnalytics/1.0'
            }
            try:
                async with httpx.AsyncClient() as client:
                    canonical_username = user_id.strip().lower()
                    url = f"https://api.chess.com/pub/player/{canonical_username}"
                    response = await client.get(url, headers=headers, timeout=10.0)

                    if response.status_code == 200:
                        return {"exists": True, "message": "User found on Chess.com"}
                    elif response.status_code == 404:
                        return {
                            "exists": False,
                            "message": f"User '{user_id}' not found on Chess.com"
                        }
                    else:
                        # ✅ FIXED: Return HTTP 503 for Chess.com API errors
                        raise HTTPException(
                            status_code=503,
                            detail=f"Chess.com API returned status {response.status_code}"
                        )
            except httpx.TimeoutException:
                # ✅ FIXED: Return HTTP 504 for timeouts
                raise HTTPException(
                    status_code=504,
                    detail="Chess.com API timeout - please try again"
                )

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        print(f"Unexpected error validating user: {e}")
        import traceback
        traceback.print_exc()
        # ✅ FIXED: Return HTTP 500 for unexpected errors, not exists=false
        raise HTTPException(
            status_code=500,
            detail=f"Server error: {str(e)}"
        )
```

---

### Fix #3: Add Retry Logic for Profile Selection

**File**: `src/components/simple/PlayerSearch.tsx`

```typescript
// Add retry utility at the top of the file:
const retryWithBackoff = async <T,>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> => {
  let lastError: Error;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
};

// Then update handlePlayerSelect (line 102-130):
const handlePlayerSelect = async (
  userId: string,
  platform: 'lichess' | 'chess.com',
  displayName?: string,
  rating?: number
) => {
  try {
    // ✅ FIXED: Add retry logic for ProfileService
    const profile = await retryWithBackoff(
      () => ProfileService.getOrCreateProfile(userId, platform),
      3, // 3 retries
      1000 // 1 second initial delay
    );

    // Add to recent players
    addRecentPlayer({
      userId,
      platform,
      displayName: displayName || profile.display_name || userId,
      rating: rating || profile.current_rating
    });

    setRecentPlayers(getRecentPlayers());
    onPlayerSelect(userId, platform);

    // Reset search
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
    setImportProgress(null);
  } catch (error) {
    console.error('Error selecting player:', error);

    // ✅ FIXED: More specific error messages
    let errorMessage = 'Failed to select player. Please try again.';

    if (error instanceof Error) {
      if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
        errorMessage = `Connection timeout while loading profile for "${userId}". Please try again.`;
      } else if (error.message.includes('network') || error.message.includes('fetch failed')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (error.message.includes('not found') || error.message.includes('404')) {
        errorMessage = `Profile for "${userId}" could not be created. Please verify the username.`;
      } else {
        errorMessage = `Error loading profile: ${error.message}`;
      }
    }

    alert(errorMessage);
  }
};
```

---

### Fix #4: Better Error UI in PlayerSearch

Instead of `alert()`, show a proper error UI:

```typescript
// Add error state at the top of PlayerSearch component:
const [selectionError, setSelectionError] = useState<string | null>(null);

// In handlePlayerSelect catch block:
} catch (error) {
  console.error('Error selecting player:', error);

  let errorMessage = // ... (same as above)

  setSelectionError(errorMessage);

  // Clear error after 10 seconds
  setTimeout(() => setSelectionError(null), 10000);
}

// Add error display in the JSX (after the search input):
{selectionError && (
  <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 mb-4">
    <div className="flex items-start gap-3">
      <span className="text-red-500 text-xl">⚠️</span>
      <div>
        <h4 className="text-red-400 font-semibold mb-1">Selection Failed</h4>
        <p className="text-red-300 text-sm">{selectionError}</p>
        <button
          onClick={() => setSelectionError(null)}
          className="mt-2 text-xs text-red-400 hover:text-red-300"
        >
          Dismiss
        </button>
      </div>
    </div>
  </div>
)}
```

---

## 📊 Testing Checklist

After implementing fixes, test:

### For chessgauravvv issue:
- [ ] Search for "chessgauravvv" on Lichess platform
- [ ] Should successfully validate and import
- [ ] With backend API down, should show connection error (not "user not found")
- [ ] With network disconnected, should show network error

### For flapjaxrfun issue:
- [ ] Search for "flapjaxrfun" and try to select
- [ ] Should retry 3 times on failure
- [ ] Should show specific error message (not generic)
- [ ] Check Railway logs for ProfileService errors

### General:
- [ ] Test with non-existent users (should still show "not found")
- [ ] Test with slow network (should retry)
- [ ] Test with backend down (should show server error)

---

## 🚀 Deployment Priority

1. **IMMEDIATE** (Deploy today):
   - Fix #2: Backend validation error handling
   - Fix #1: Frontend validation error handling

2. **HIGH** (Deploy this week):
   - Fix #3: Retry logic for ProfileService
   - Fix #4: Better error UI

3. **RECOMMENDED** (Optional):
   - Add Sentry for automatic error tracking
   - Add logging of which external API calls fail

---

## 📝 Summary

Both issues stem from **poor error handling**:
- Network errors/timeouts were incorrectly treated as "user not found"
- Generic error messages didn't help users or developers debug
- No retry logic for transient failures

The fixes ensure:
- ✅ Network errors are clearly distinguished from "user not found"
- ✅ Proper HTTP status codes are used
- ✅ Retry logic handles transient failures
- ✅ Users get helpful, specific error messages
