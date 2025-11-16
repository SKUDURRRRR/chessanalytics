# Chunk Loading Error Fix

## Problem

Users were experiencing "Failed to fetch dynamically imported module" errors when:
1. They had the site open in their browser
2. A new deployment happened with updated chunk filenames
3. They navigated to a new page, triggering lazy loading
4. The browser tried to fetch old chunks that no longer existed

**Error Message:**
```
TypeError: Failed to fetch dynamically imported module:
https://www.chessdata.app/assets/HomePage-D3jpt9F9.js
```

## Root Cause

This is a **cache invalidation problem** common in SPAs using code splitting:

- Vite generates unique hash-based filenames for chunks (e.g., `HomePage-D3jpt9F9.js`)
- On deployment, these hashes change (e.g., `HomePage-XYZ123.js`)
- Users with stale HTML still reference the old chunk names
- When lazy loading triggers, the old chunks are 404

## Solutions Implemented

### 1. Automatic Chunk Reload (`src/App.tsx`)

Created a `lazyWithRetry` wrapper that automatically reloads the page when chunk loading fails:

```typescript
const lazyWithRetry = (componentImport: () => Promise<any>) => {
  return lazy(async () => {
    const pageHasAlreadyBeenForceRefreshed = JSON.parse(
      window.sessionStorage.getItem('page-has-been-force-refreshed') || 'false'
    )

    try {
      const component = await componentImport()
      window.sessionStorage.setItem('page-has-been-force-refreshed', 'false')
      return component
    } catch (error) {
      // If chunk loading fails and we haven't already refreshed
      if (!pageHasAlreadyBeenForceRefreshed) {
        window.sessionStorage.setItem('page-has-been-force-refreshed', 'true')
        window.location.reload() // Get latest chunks
        return { default: () => null }
      }
      throw error // Prevent infinite loops
    }
  })
}
```

**How it works:**
1. When a chunk fails to load, check if we've already tried reloading
2. If not, mark it in sessionStorage and reload the page
3. On reload, get the fresh HTML with correct chunk names
4. If reload doesn't fix it (real network issue), show error boundary

### 2. Enhanced Error Boundary (`src/components/ErrorBoundaries.tsx`)

Updated error boundary to detect chunk errors and auto-reload:

```typescript
componentDidCatch(error: Error, errorInfo: ErrorInfo) {
  // Detect chunk loading errors
  const isChunkError = error?.message?.includes('Failed to fetch dynamically imported module') ||
                      error?.message?.includes('Loading chunk') ||
                      error?.message?.includes('ChunkLoadError')

  if (isChunkError && this.props.level === 'page') {
    // Auto-reload after brief message
    setTimeout(() => {
      window.location.reload()
    }, 2000)
  }
}
```

**User experience:**
- Shows "Update Available" message instead of scary error
- Automatically reloads after 2 seconds
- User gets latest version seamlessly

### 3. Proper Cache Headers (`vercel.json`)

Set optimal caching to prevent stale HTML:

```json
{
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    },
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "no-cache, no-store, must-revalidate"
        }
      ]
    }
  ]
}
```

**Strategy:**
- **Assets (chunks)**: Cache forever (immutable) - safe because hashed filenames change on update
- **HTML**: Never cache - always get fresh HTML with correct chunk references

## Why This Works

### Two-Layer Protection:

1. **Prevention (Cache Headers):**
   - HTML is never cached, so users get fresh chunk references
   - Chunks are cached forever (safe due to hashed names)
   - Reduces likelihood of mismatch

2. **Recovery (Auto-reload):**
   - If mismatch happens (user kept tab open during deploy), auto-reload fixes it
   - Users barely notice - just a 2-second "update available" message
   - No manual refresh needed

## Testing

### To verify the fix works:

1. **Simulate the error:**
   ```bash
   # Build and deploy version 1
   npm run build
   # Note a chunk filename like HomePage-ABC123.js

   # Make a change and build version 2
   npm run build
   # Chunk is now HomePage-XYZ789.js

   # Try to load old chunk URL manually
   # Should trigger auto-reload
   ```

2. **Test auto-reload:**
   - Open app in browser
   - In console: `sessionStorage.setItem('page-has-been-force-refreshed', 'false')`
   - Navigate to a page
   - Should load successfully even if chunks changed

3. **Test cache headers:**
   ```bash
   curl -I https://www.chessdata.app/
   # Should see: Cache-Control: no-cache, no-store, must-revalidate

   curl -I https://www.chessdata.app/assets/HomePage-ABC123.js
   # Should see: Cache-Control: public, max-age=31536000, immutable
   ```

## Alternative Solutions (Not Used)

### 1. Service Worker
- **Pro:** Can intercept failed requests and serve fallbacks
- **Con:** Complex to implement, can cause its own caching issues

### 2. Webpack Module Federation
- **Pro:** Dynamic chunk loading with fallbacks
- **Con:** Overkill for this use case, requires major refactor

### 3. Disable Code Splitting
- **Pro:** No chunk loading errors
- **Con:** Huge initial bundle, poor performance

## Monitoring

Track chunk loading errors in your analytics:

```typescript
// In error boundary
if (isChunkError) {
  // Log to analytics
  analytics.track('chunk_load_error', {
    error: error.message,
    autoReload: true
  })
}
```

## Prevention Best Practices

1. **Always set proper cache headers** (done ✅)
2. **Use hash-based chunk names** (Vite default ✅)
3. **Implement auto-reload on chunk errors** (done ✅)
4. **Deploy atomically** - upload all files before updating routing
5. **Consider blue-green deployments** for zero-downtime updates

## Impact

- **User Experience:** Seamless - auto-reloads on stale chunks
- **Error Rate:** Should drop to near zero for chunk loading errors
- **Performance:** No impact - chunks still lazy loaded and cached
- **Maintenance:** Self-healing - no manual intervention needed

## Related Issues

- [Vite Issue #7508](https://github.com/vitejs/vite/issues/7508)
- [React Router Issue #8427](https://github.com/remix-run/react-router/issues/8427)

## Deployment

When deploying this fix:

1. Deploy the code changes (App.tsx, ErrorBoundaries.tsx, vercel.json)
2. Verify cache headers are active
3. Monitor error logs for chunk loading errors
4. Should see immediate reduction in these errors

## Future Improvements

1. **Version API:** Check server version before loading chunks
2. **Graceful degradation:** Show cached content if offline
3. **User notification:** "New version available, click to update"
4. **Metrics dashboard:** Track chunk error rates over time
