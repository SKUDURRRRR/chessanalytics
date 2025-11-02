# Admin Dashboard Implementation Guide

## Overview

This guide explains the newly implemented admin analytics dashboard that tracks key metrics for your chess analytics platform.

## Features

The admin dashboard provides real-time insights into:

1. **Player Searches** - How many players were searched
2. **Game Analyses** - How many analyses were performed
3. **User Registrations** - Total registrations with completion status
4. **Pricing Page Views** - How many users checked the pricing page

## Time Filtering

All metrics can be filtered by:
- **Last 24 Hours** (hourly granularity)
- **Last 7 Days** (daily granularity)
- **Last 30 Days** (daily granularity)
- **Last 90 Days** (weekly granularity)

## Components Created

### 1. Database Migration (`supabase/migrations/20251102000005_create_admin_analytics_system.sql`)

Creates:
- `analytics_events` table for tracking all events
- Materialized views for fast aggregations (hourly, daily, weekly, monthly)
- `user_registration_status` view for tracking incomplete registrations
- Helper functions for tracking events:
  - `track_player_search()`
  - `track_game_analysis()`
  - `track_pricing_page_view()`
  - `track_user_registration()` (auto-triggered)
- Dashboard query functions:
  - `get_dashboard_metrics()`
  - `get_registration_stats()`
  - `refresh_analytics_views()`

### 2. Backend API Endpoints (`python/core/unified_api_server.py`)

Added endpoints:
- `POST /api/v1/admin/track-event` - Track analytics events (public)
- `POST /api/v1/admin/dashboard-metrics` - Get dashboard metrics (authenticated)
- `GET /api/v1/admin/registration-stats` - Get registration statistics (authenticated)
- `POST /api/v1/admin/refresh-analytics` - Refresh materialized views (authenticated)

### 3. Frontend Service (`src/services/analyticsService.ts`)

Provides methods:
- `trackPlayerSearch()` - Track player searches
- `trackGameAnalysis()` - Track game analyses
- `trackPricingPageView()` - Track pricing page views
- `getDashboardMetrics()` - Fetch dashboard data
- `getRegistrationStats()` - Fetch registration stats
- `refreshAnalyticsViews()` - Manually refresh cached data

### 4. Dashboard Page (`src/pages/AdminDashboardPage.tsx`)

Full-featured admin dashboard with:
- Time range selector (24h, 7d, 30d, 90d)
- Summary cards for each metric
- Registration completion status
- Interactive line chart showing trends over time
- Bar chart for event comparison
- Refresh button to update materialized views

## Setup Instructions

### 1. Run the Database Migration

```bash
# Apply the migration
supabase db push

# Or if using Supabase CLI locally
supabase migration up
```

This will:
- Create the analytics tables and views
- Backfill historical data from existing tables
- Set up automatic tracking for user registrations

### 2. Verify Backend is Running

Make sure your Python backend is running:

```bash
cd python
python -m core.unified_api_server --host 0.0.0.0 --port 8002
```

### 3. Access the Dashboard

Navigate to:
```
http://localhost:3000/admin/dashboard
```

Or in production:
```
https://your-domain.com/admin/dashboard
```

## Automatic Tracking

The following events are automatically tracked:

### Player Searches
Tracked when a user searches for a player in `PlayerSearch.tsx`:
```typescript
AnalyticsService.trackPlayerSearch(userId, platform)
```

### Game Analyses
Tracked when a game analysis is performed in `unified_api_server.py`:
```python
db_client.rpc('track_game_analysis', {
    'p_user_id': auth_user_id,
    'p_platform': request.platform,
    'p_game_id': request.game_id,
    'p_analysis_type': request.analysis_type
})
```

### Pricing Page Views
Tracked when the pricing page loads in `PricingPage.tsx`:
```typescript
AnalyticsService.trackPricingPageView()
```

### User Registrations
Automatically tracked via database trigger when a new user signs up.

## Performance Optimization

### Materialized Views

The system uses materialized views to pre-compute aggregations, making dashboard queries extremely fast. These views are updated via:

1. **Automatic Refresh** - Set up a cron job to refresh hourly:
```sql
SELECT refresh_analytics_views();
```

2. **Manual Refresh** - Click "Refresh Data" button in the dashboard

### Caching

- Frontend caches dashboard data during the session
- Backend uses materialized views for instant queries
- Real-time tracking uses non-blocking database writes

## Security Considerations

### Authentication Requirements

- **Track Event Endpoint** (`/api/v1/admin/track-event`): Public (works for both authenticated and anonymous users)
- **Dashboard Metrics** (`/api/v1/admin/dashboard-metrics`): Authenticated users only
- **Registration Stats** (`/api/v1/admin/registration-stats`): Authenticated users only
- **Refresh Views** (`/api/v1/admin/refresh-analytics`): Authenticated users only

### Adding Admin Role Check (TODO)

To restrict dashboard access to admins only, add role checks in the backend:

```python
# In unified_api_server.py, add to each admin endpoint:
user_role = await get_user_role(user_id)
if user_role != 'admin':
    raise HTTPException(status_code=403, detail="Admin access required")
```

And create an admin role in your database:

```sql
-- Add role column to authenticated_users table
ALTER TABLE authenticated_users ADD COLUMN role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin'));

-- Create admin user
UPDATE authenticated_users SET role = 'admin' WHERE email = 'your-admin@email.com';
```

## Monitoring Incomplete Registrations

The dashboard shows users who started registration but haven't confirmed their email:

- **Total Registrations** - All sign-up attempts
- **Completed** - Users who confirmed their email
- **Incomplete** - Users who haven't confirmed yet
- **Completion Rate** - Percentage of completed registrations

This helps identify issues with the registration flow and potential areas for improvement.

## Troubleshooting

### Dashboard Shows No Data

1. **Check if migration was applied:**
```bash
supabase migration list
```

2. **Verify tables exist:**
```sql
SELECT * FROM analytics_events LIMIT 5;
```

3. **Refresh materialized views:**
Click "Refresh Data" button or run:
```sql
SELECT refresh_analytics_views();
```

### Tracking Events Not Working

1. **Check backend logs** for tracking errors
2. **Verify database functions exist:**
```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_name LIKE 'track_%';
```

3. **Test tracking manually:**
```sql
SELECT track_player_search('test-user', 'lichess', 'magnuscarlsen');
```

### Performance Issues

1. **Refresh materialized views** regularly (hourly recommended)
2. **Check index usage:**
```sql
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'public';
```

3. **Monitor table sizes:**
```sql
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename LIKE 'analytics%'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## Future Enhancements

Potential additions:
1. Export dashboard data as CSV/PDF
2. Email alerts for significant metric changes
3. Comparison with previous periods
4. Platform-specific breakdowns (Lichess vs Chess.com)
5. Conversion funnel analysis (searches → analyses → registrations)
6. User retention metrics
7. Geographic distribution of users

## API Examples

### Track a Player Search
```bash
curl -X POST http://localhost:8002/api/v1/admin/track-event \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "player_search",
    "platform": "lichess",
    "metadata": {
      "username": "magnuscarlsen",
      "platform": "lichess"
    }
  }'
```

### Get Dashboard Metrics
```bash
curl -X POST http://localhost:8002/api/v1/admin/dashboard-metrics \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "start_date": "2025-10-26T00:00:00Z",
    "end_date": "2025-11-02T23:59:59Z",
    "granularity": "day"
  }'
```

### Get Registration Stats
```bash
curl "http://localhost:8002/api/v1/admin/registration-stats?start_date=2025-10-26T00:00:00Z&end_date=2025-11-02T23:59:59Z" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Database Schema

### analytics_events Table
```sql
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY,
    event_type TEXT,  -- 'player_search', 'game_analysis', 'pricing_page_view', 'user_registration'
    user_id UUID,  -- NULL for anonymous users
    is_anonymous BOOLEAN,
    platform TEXT,  -- 'lichess' or 'chess.com'
    metadata JSONB,  -- Additional event data
    created_at TIMESTAMPTZ
);
```

### Materialized Views
- `analytics_hourly` - Hourly aggregations
- `analytics_daily` - Daily aggregations
- `analytics_weekly` - Weekly aggregations
- `analytics_monthly` - Monthly aggregations

Each view contains:
- Time bucket (hour/day/week/month)
- Event type
- Event count
- Unique users
- Anonymous count

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review backend logs: `python/backend.out.log`
3. Check Supabase logs in the dashboard
4. Verify environment variables are set correctly

---

**Last Updated:** November 2, 2025
**Version:** 1.0.0
