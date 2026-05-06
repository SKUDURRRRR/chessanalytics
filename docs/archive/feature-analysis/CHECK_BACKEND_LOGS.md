# Instructions to Check Backend Logs

## For Railway/Production
1. Go to Railway dashboard
2. Click on your backend service
3. Click "Deployments" tab
4. Click on the most recent deployment
5. Look at the logs

## For Local Development
Run this command:

```powershell
cd "C:\my files\Projects\chess-analytics\python"
Get-Content backend.out.log -Tail 100 | Select-String "Smart import|pakrovejas69"
```

Or to see live logs:
```powershell
cd "C:\my files\Projects\chess-analytics\python"
Get-Content backend.out.log -Wait -Tail 50
```

## What to Look For

After refreshing pakrovejas69's page, you should see:
```
[Smart import] ===== FETCHING GAMES FROM LICHESS =====
[Smart import] Fetched X games from platform API
[Smart import] Sample fetched game DATES (first 3): [dates here]
[Smart import] Most recent game date: [should be Oct 28, 2025]
[Smart import] ===== DUPLICATE CHECK =====
[Smart import] Game 1: ID=xxx, Date=2025-10-28..., In DB=False  <-- Should be False!
[Smart import] ✓ NEW GAME FOUND: xxx (2025-10-28...)
```

If you see "In DB=True" for games from Oct 14-28, that's the bug - those games aren't actually in the database (your Match History shows only up to Oct 13).

## Next Steps

1. **Restart your backend** (important!)
2. **Clear browser cache** (localStorage) - or use incognito
3. Refresh pakrovejas69's page
4. Share the backend logs with game IDs and dates
