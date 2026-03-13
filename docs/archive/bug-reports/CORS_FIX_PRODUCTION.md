# CORS Fix for Production

## Problem
CORS errors in production preventing API requests from `https://www.chessdata.app` to `https://chessanalytics-production.up.railway.app`.

## Solution

### Step 1: Set CORS_ORIGINS in Railway

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Select your backend service (e.g., `chess-analytics-production`)
3. Click on the **Variables** tab
4. Add or update the `CORS_ORIGINS` variable:

**Value (comma-separated, NO spaces):**
```
https://www.chessdata.app,https://chessdata.app
```

**Important:**
- ✅ Use comma-separated format: `https://www.chessdata.app,https://chessdata.app`
- ✅ No spaces after commas
- ✅ Must include `https://` protocol
- ❌ Don't use: `https://www.chessdata.app, https://chessdata.app` (has spaces)

### Step 2: Verify the Variable

After setting the variable, Railway will automatically redeploy. Check the logs to verify:

Look for this in Railway logs:
```
CORS Origins configured: ['https://www.chessdata.app', 'https://chessdata.app']
Using production CORS configuration
```

### Step 3: Test

1. Open `https://www.chessdata.app` in your browser
2. Open DevTools (F12) → Console tab
3. Try to use the app (import games, analyze, etc.)
4. CORS errors should be gone

## What Changed

The code now properly parses comma-separated `CORS_ORIGINS` environment variables:
- Automatically splits by comma
- Strips whitespace from each origin
- Validates format (must start with `http://` or `https://`)

## Troubleshooting

### Still seeing CORS errors?

1. **Check Railway logs** - Look for "CORS Origins configured" message
2. **Verify the variable format** - Must be comma-separated, no spaces
3. **Check the origin** - Make sure you're accessing from `https://www.chessdata.app` (not `http://`)
4. **Wait for redeploy** - Railway auto-redeploys after env var changes (usually 1-2 minutes)

### Common Mistakes

❌ **Wrong:** `CORS_ORIGINS=https://www.chessdata.app, https://chessdata.app` (spaces)
✅ **Correct:** `CORS_ORIGINS=https://www.chessdata.app,https://chessdata.app`

❌ **Wrong:** `CORS_ORIGINS=www.chessdata.app` (missing https://)
✅ **Correct:** `CORS_ORIGINS=https://www.chessdata.app`

❌ **Wrong:** `CORS_ORIGINS=https://www.chessdata.app https://chessdata.app` (space instead of comma)
✅ **Correct:** `CORS_ORIGINS=https://www.chessdata.app,https://chessdata.app`

## Additional Notes

- The fix handles both comma-separated strings and lists
- Whitespace is automatically stripped
- Empty strings are filtered out
- Format validation ensures origins start with `http://` or `https://`
