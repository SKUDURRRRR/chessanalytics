# Admin Dashboard - Quick Start Checklist

## ✅ Implementation Complete!

All code has been written and is ready to use. Follow these steps to get the admin dashboard running:

## 📋 Deployment Checklist

### Step 1: Apply Database Migration ⏱️ ~2 minutes

```bash
# Navigate to your project root
cd "C:\my files\Projects\chess-analytics"

# Apply the migration using Supabase CLI
supabase db push

# Alternative: If you're using direct SQL
# Go to Supabase Dashboard > SQL Editor
# Run the contents of: supabase/migrations/20251102000005_create_admin_analytics_system.sql
```

**What this does:**
- ✅ Creates analytics_events table
- ✅ Creates 4 materialized views (hourly, daily, weekly, monthly)
- ✅ Creates tracking functions
- ✅ Backfills historical data from existing tables
- ✅ Sets up auto-tracking for user registrations

### Step 2: Verify Backend is Running ⏱️ ~1 minute

```bash
# Make sure your Python backend is running
cd python
python -m core.unified_api_server --host 0.0.0.0 --port 8002

# Should see:
# ✓ Starting Unified Chess Analysis API Server v3.0
# ✓ Available analytics endpoints
```

### Step 3: Test the Dashboard ⏱️ ~2 minutes

```bash
# Start your frontend (if not already running)
npm run dev

# Open browser to:
# http://localhost:3000/admin/dashboard
```

**Login required:** You must be logged in to view the dashboard.

### Step 4: Generate Some Test Data ⏱️ ~3 minutes

To see the dashboard in action:

1. **Player Search**
   - Go to homepage
   - Search for a player (e.g., "magnuscarlsen")
   - This will track a `player_search` event

2. **Game Analysis**
   - Open a player's profile
   - Click on a game to analyze it
   - This will track a `game_analysis` event

3. **Pricing Page View**
   - Navigate to /pricing
   - This will track a `pricing_page_view` event

4. **User Registration**
   - Sign up a new user (or use existing)
   - This will track a `user_registration` event

### Step 5: Refresh and View Dashboard ⏱️ ~1 minute

```bash
# Go back to admin dashboard
http://localhost:3000/admin/dashboard

# Click "Refresh Data" button
# You should now see your test events!
```

## 🔍 Verification Steps

### Check if Migration Applied

```sql
-- In Supabase SQL Editor, run:
SELECT table_name
FROM information_schema.tables
WHERE table_name LIKE 'analytics%';

-- Should return:
-- analytics_events
-- analytics_hourly
-- analytics_daily
-- analytics_weekly
-- analytics_monthly
```

### Check if Events are Being Tracked

```sql
-- In Supabase SQL Editor, run:
SELECT event_type, COUNT(*) as count
FROM analytics_events
GROUP BY event_type
ORDER BY count DESC;

-- Should show counts for each event type
```

### Check if Functions Exist

```sql
-- In Supabase SQL Editor, run:
SELECT routine_name
FROM information_schema.routines
WHERE routine_name LIKE 'track_%';

-- Should return:
-- track_player_search
-- track_game_analysis
-- track_pricing_page_view
-- track_user_registration
```

## 🎯 Quick Test Script

Run these commands in your browser console while on the frontend:

```javascript
// Test tracking (must be on your chess analytics site)

// 1. Track a player search (will work even if not logged in)
fetch('http://localhost:8002/api/v1/admin/track-event', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    event_type: 'player_search',
    platform: 'lichess',
    metadata: { username: 'test-user', platform: 'lichess' }
  })
}).then(r => r.json()).then(console.log)

// 2. Track a pricing page view
fetch('http://localhost:8002/api/v1/admin/track-event', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    event_type: 'pricing_page_view'
  })
}).then(r => r.json()).then(console.log)
```

## 🚨 Troubleshooting

### "No data available"

**Solution:**
1. Generate some test events (see Step 4 above)
2. Click "Refresh Data" button in dashboard
3. Wait a few seconds for materialized views to update

### "Authentication required"

**Solution:**
- Make sure you're logged in
- The dashboard requires authentication
- Login at `/login` first

### "Failed to fetch metrics"

**Solution:**
1. Check backend is running: `http://localhost:8002/api/v1/health`
2. Check browser console for errors
3. Verify `VITE_API_URL` is set correctly in `.env`

### No events being tracked

**Solution:**
1. Check backend logs: `python/backend.out.log`
2. Verify tracking functions exist (see verification steps)
3. Try manual tracking (see test script above)

### Migration fails

**Solution:**
1. Check for existing tables: `DROP TABLE IF EXISTS analytics_events CASCADE;`
2. Check Supabase logs for specific error
3. Try running migration SQL directly in SQL Editor

## 📊 Expected Results

After completing all steps, your dashboard should show:

- ✅ **Summary cards** with event counts
- ✅ **Registration status** with completion rate
- ✅ **Line chart** showing activity over time
- ✅ **Bar chart** comparing different events

## 🔄 Next Steps (Optional but Recommended)

### 1. Set Up Automatic View Refresh

Create a cron job to refresh materialized views every hour:

```bash
# Add to your cron (Linux/Mac) or Task Scheduler (Windows)
0 * * * * curl -X POST http://your-api.com/api/v1/admin/refresh-analytics \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 2. Add Admin-Only Access

Restrict dashboard to admins:

```sql
-- Add role column
ALTER TABLE authenticated_users
ADD COLUMN role TEXT DEFAULT 'user'
CHECK (role IN ('user', 'admin'));

-- Make yourself admin
UPDATE authenticated_users
SET role = 'admin'
WHERE email = 'your-email@example.com';
```

Then update the backend endpoints to check for admin role.

### 3. Add Navigation Link

In your Navigation component, add:

```tsx
{user && (
  <Link to="/admin/dashboard" className="...">
    📊 Admin Dashboard
  </Link>
)}
```

## 📖 Documentation Files

- `ADMIN_DASHBOARD_SUMMARY.md` - Quick overview and feature list
- `ADMIN_DASHBOARD_GUIDE.md` - Complete implementation guide
- `ADMIN_DASHBOARD_ARCHITECTURE.md` - Technical architecture details

## ✨ Success Criteria

You'll know everything is working when:

- ✅ Dashboard loads at `/admin/dashboard`
- ✅ Summary cards show non-zero numbers
- ✅ Charts display data points
- ✅ Time range selector changes the data
- ✅ "Refresh Data" button updates the metrics
- ✅ New actions (searches, analyses) appear in dashboard

## 💬 Need Help?

1. Check the troubleshooting section above
2. Review `ADMIN_DASHBOARD_GUIDE.md` for detailed docs
3. Check backend logs: `python/backend.out.log`
4. Check browser console for frontend errors
5. Verify environment variables are set

---

**Total Setup Time:** ~10 minutes
**Ready to deploy!** 🚀

All files are created and ready. Just follow the steps above to get your admin dashboard running!
