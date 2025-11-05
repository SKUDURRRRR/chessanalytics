# Re-analyze Game "Failed to Fetch" Error - Diagnostic Guide

## Problem
When clicking "Re-analyze" on a game, you get a "Failed to re-analyze game" error. The browser console shows:
```
TypeError: Failed to fetch
at fetchWithTimeout (fetchWithTimeout.ts:35:28)
```

## Root Causes
This error typically occurs when the frontend cannot connect to the backend API. Common causes:

1. **Backend server not running** - The most common cause
2. **Wrong API URL configuration** - Frontend pointing to wrong port/URL
3. **CORS blocking the request** - Backend not allowing requests from frontend origin
4. **Network connectivity issues** - Firewall or network blocking localhost connections

## Diagnostic Steps

### Step 1: Verify Backend Server is Running
Check if the backend is running on port 8002:

```powershell
# Check if port 8002 is in use
netstat -ano | findstr :8002

# Or check process
Get-Process | Where-Object {$_.ProcessName -like "*python*"}
```

**Expected:** You should see a Python process listening on port 8002.

**If not running**, start it:
```powershell
cd "C:\my files\Projects\chess-analytics\python"
python -m uvicorn core.unified_api_server:app --reload --host 0.0.0.0 --port 8002
```

### Step 2: Test Backend Health Endpoint
Verify the backend is responding:

```powershell
# Test health endpoint
Invoke-WebRequest -Uri http://localhost:8002/health -Method GET | Select-Object -ExpandProperty Content
```

**Expected:** Should return JSON with `{"status":"healthy",...}`

**If it fails:** Backend is not running or not accessible.

### Step 3: Check API URL Configuration
The frontend uses `VITE_ANALYSIS_API_URL` environment variable or defaults to `http://localhost:8002`.

1. **Check browser console** - Look for log message:
   ```
   🔧 UNIFIED_API_URL configured as: http://localhost:8002
   ```

2. **Check .env file** (if exists):
   ```
   VITE_ANALYSIS_API_URL=http://localhost:8002
   ```

3. **Verify URL matches backend port** - Default is 8002, but your backend might be on a different port.

### Step 4: Check CORS Configuration
The backend must allow requests from your frontend origin.

**Frontend typically runs on:** `http://localhost:5173` (Vite default)

**Backend CORS config** should include this origin. Check `python/core/cors_security.py`:
- Default config includes `http://localhost:5173`
- If using custom config, ensure your frontend origin is listed

### Step 5: Check Browser Console for Detailed Errors
With the improved error handling, you should now see more detailed error messages:

1. Open browser DevTools (F12)
2. Go to Console tab
3. Click "Re-analyze" button
4. Look for error message with details about:
   - The URL being called
   - Network error details
   - Possible causes

## Solutions

### Solution 1: Start Backend Server
If backend is not running:

```powershell
cd "C:\my files\Projects\chess-analytics\python"
python -m uvicorn core.unified_api_server:app --reload --host 0.0.0.0 --port 8002
```

Leave this terminal running while using the app.

### Solution 2: Fix API URL Configuration
If the URL is wrong:

1. Create/update `.env` file in project root:
   ```
   VITE_ANALYSIS_API_URL=http://localhost:8002
   ```

2. Restart the frontend dev server:
   ```powershell
   # Stop current server (Ctrl+C)
   npm run dev
   ```

### Solution 3: Fix CORS Configuration
If CORS is blocking requests:

1. Check `python/core/unified_api_server.py` line 96:
   ```python
   cors_origins = config.api.cors_origins or ["http://localhost:3000", ...]
   ```

2. Ensure your frontend origin is included. For Vite (port 5173), the default config should work.

3. If using custom origins, add your frontend URL:
   ```python
   cors_origins = [
       "http://localhost:5173",  # Add your frontend port
       # ... other origins
   ]
   ```

4. Restart backend server after changes.

### Solution 4: Check Firewall/Network
If network is blocking localhost:

1. **Windows Firewall** - May block localhost connections
2. **Antivirus** - May block localhost connections
3. **VPN** - May interfere with localhost connections

Try temporarily disabling firewall/antivirus to test.

## Improved Error Messages

With the recent fixes, error messages now provide:
- **Detailed network error messages** - Explains what went wrong
- **URL validation** - Shows what URL is being called
- **Troubleshooting hints** - Suggests what to check

## Testing After Fix

1. Start backend server
2. Start frontend dev server
3. Open browser console (F12)
4. Navigate to a game analysis page
5. Click "Re-analyze"
6. Check console for detailed error messages if it fails
7. Verify the request URL in console logs

## Quick Checklist

- [ ] Backend server is running on port 8002
- [ ] Frontend can reach `http://localhost:8002/health`
- [ ] API URL is correctly configured (`http://localhost:8002`)
- [ ] CORS allows requests from frontend origin
- [ ] No firewall/antivirus blocking localhost
- [ ] Browser console shows detailed error messages

## Still Having Issues?

If the problem persists after checking all above:

1. **Check backend logs** - Look for errors when re-analyze request arrives
2. **Check browser Network tab** - See if request is being sent, what response (if any)
3. **Verify ports** - Make sure frontend and backend are on expected ports
4. **Try different browser** - Rule out browser-specific issues
5. **Check for proxy/VPN** - May interfere with localhost connections
