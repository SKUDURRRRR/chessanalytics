# How to Get Vercel Runtime Logs (User Errors)

## The Issue
The current `VERCEL_LOGS_ANALYSIS.md` only contains **build/deployment logs**.
User errors like "failed to select player" and "not found on lichess" happen at **runtime**, not during builds.

## How to Get Runtime Logs from Vercel:

### Option 1: Vercel Dashboard (Easiest)
1. Go to: https://vercel.com/dashboard
2. Select your project: **chessanalytics**
3. Click **"Monitoring"** or **"Runtime Logs"** tab (not "Deployments")
4. Set time range: Last 24-48 hours
5. Look for:
   - Browser console errors
   - API request failures (4xx, 5xx errors)
   - User-facing error messages

### Option 2: Vercel CLI (For Runtime Logs)
```bash
# Get runtime logs (not build logs)
vercel logs --follow --output runtime

# Or for specific time range:
vercel logs --since 24h --output runtime > vercel_runtime_logs.txt

# Filter for errors only:
vercel logs --since 24h | grep -i error > vercel_errors.txt
```

### Option 3: Browser Developer Tools (Most Useful for Frontend Issues)
1. Ask users to open browser DevTools (F12)
2. Go to **Console** tab
3. Try to reproduce the error
4. Copy/screenshot the error messages
5. Go to **Network** tab - look for failed API requests (red lines)

---

## What to Look For:

### For "flapjaxrfun - failed to select player":
- Check console errors when player search/selection happens
- Check API calls to `/api/v1/check-player` or similar endpoints
- Look for validation errors in PlayerSearch component

### For "chessgauravvv - not found on lichess":
- Check API calls to Lichess endpoints
- Look for 404 responses from `lichess.org/api/...`
- Check error handling in import flow

---

## Alternative: Add Frontend Error Tracking (Recommended)

Instead of manually checking logs, add Sentry:

```typescript
// src/main.tsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "your-dsn-here",
  environment: import.meta.env.MODE,
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
```

Then errors automatically get tracked with:
- Full stack traces
- User session replays
- Network requests
- Console logs
- Breadcrumbs of user actions

---

## Next Steps:

1. Get runtime logs using one of the methods above
2. Or ask affected users to send screenshots of browser console errors
3. Or set up Sentry for automatic error tracking
