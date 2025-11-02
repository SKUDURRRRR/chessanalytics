# Admin Dashboard Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER ACTIONS                             │
├─────────────────────────────────────────────────────────────────┤
│  • Search Player  • Analyze Game  • View Pricing  • Register    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     TRACKING LAYER                               │
├─────────────────────────────────────────────────────────────────┤
│  PlayerSearch.tsx  →  track_player_search()                     │
│  unified_api_server.py  →  track_game_analysis()                │
│  PricingPage.tsx  →  track_pricing_page_view()                  │
│  Database Trigger  →  track_user_registration()                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     DATABASE LAYER                               │
├─────────────────────────────────────────────────────────────────┤
│  analytics_events (raw events)                                   │
│    ├── id, event_type, user_id, platform                        │
│    ├── is_anonymous, metadata, created_at                       │
│    └── Indexes: event_type, created_at, user_id                 │
│                                                                   │
│  Materialized Views (pre-computed aggregations)                  │
│    ├── analytics_hourly                                          │
│    ├── analytics_daily                                           │
│    ├── analytics_weekly                                          │
│    └── analytics_monthly                                         │
│                                                                   │
│  user_registration_status (view)                                 │
│    └── Shows complete vs incomplete registrations                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API ENDPOINTS                               │
├─────────────────────────────────────────────────────────────────┤
│  POST /api/v1/admin/track-event                                 │
│    → Track analytics events (public)                            │
│                                                                   │
│  POST /api/v1/admin/dashboard-metrics                           │
│    → Get aggregated metrics (authenticated)                     │
│    → Uses materialized views for speed                          │
│                                                                   │
│  GET /api/v1/admin/registration-stats                           │
│    → Get registration completion stats (authenticated)          │
│                                                                   │
│  POST /api/v1/admin/refresh-analytics                           │
│    → Refresh materialized views (authenticated)                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND SERVICE                              │
├─────────────────────────────────────────────────────────────────┤
│  AnalyticsService.ts                                             │
│    ├── trackPlayerSearch()                                       │
│    ├── trackGameAnalysis()                                       │
│    ├── trackPricingPageView()                                    │
│    ├── getDashboardMetrics()                                     │
│    ├── getRegistrationStats()                                    │
│    └── refreshAnalyticsViews()                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ADMIN DASHBOARD UI                            │
├─────────────────────────────────────────────────────────────────┤
│  AdminDashboardPage.tsx                                          │
│    ├── Time Range Selector (24h, 7d, 30d, 90d)                 │
│    ├── Summary Cards                                             │
│    │   ├── Player Searches                                       │
│    │   ├── Game Analyses                                         │
│    │   ├── Pricing Page Views                                    │
│    │   └── User Registrations                                    │
│    ├── Registration Status Section                               │
│    │   ├── Total / Completed / Incomplete                        │
│    │   └── Completion Rate Progress Bar                          │
│    ├── Activity Line Chart                                       │
│    │   └── All metrics over time                                 │
│    └── Event Comparison Bar Chart                                │
│        └── Side-by-side comparison                               │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Event Tracking Flow

```
User Action
    │
    ▼
Component/API calls tracking function
    │
    ▼
track_event() API endpoint
    │
    ▼
Database function (track_player_search, etc.)
    │
    ▼
Insert into analytics_events table
    │
    ▼
Event stored with:
    - event_type
    - user_id (or null for anonymous)
    - is_anonymous flag
    - platform
    - metadata (JSON)
    - created_at timestamp
```

### 2. Dashboard Query Flow

```
User opens Admin Dashboard
    │
    ▼
AdminDashboardPage.tsx loads
    │
    ▼
Calls AnalyticsService.getDashboardMetrics()
    │
    ▼
POST /api/v1/admin/dashboard-metrics
    │
    ▼
Backend calls get_dashboard_metrics() function
    │
    ▼
Queries appropriate materialized view
    (analytics_hourly, analytics_daily, analytics_weekly, or analytics_monthly)
    │
    ▼
Returns pre-computed aggregations
    (fast! no heavy computation)
    │
    ▼
Frontend transforms data for charts
    │
    ▼
Renders charts using Recharts library
```

## Performance Strategy

### Materialized Views

Instead of scanning millions of rows for each dashboard query, we use materialized views:

```sql
-- Instead of this (slow for large tables):
SELECT DATE_TRUNC('day', created_at) AS day,
       event_type,
       COUNT(*) AS count
FROM analytics_events
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY day, event_type;

-- We query this (instant):
SELECT * FROM analytics_daily
WHERE day >= NOW() - INTERVAL '30 days';
```

### Refresh Strategy

Materialized views are refreshed:
1. **Manually** - Click "Refresh Data" button
2. **Automatically** - Set up cron job (recommended hourly)

```sql
-- Refresh all views at once
SELECT refresh_analytics_views();
```

## Event Types

| Event Type | Tracked When | Tracked By |
|-----------|--------------|------------|
| `player_search` | User searches for a player | PlayerSearch.tsx |
| `game_analysis` | Game analysis is performed | unified_api_server.py |
| `pricing_page_view` | User visits pricing page | PricingPage.tsx |
| `user_registration` | User signs up | Database trigger |

## Metrics Calculated

For each event type and time period:
- **event_count**: Total number of events
- **unique_users**: Count of distinct authenticated users
- **anonymous_count**: Count of anonymous user events

## Time Granularities

| Time Range | Granularity | View Used | Data Points |
|-----------|-------------|-----------|-------------|
| Last 24 Hours | Hour | analytics_hourly | ~24 |
| Last 7 Days | Day | analytics_daily | ~7 |
| Last 30 Days | Day | analytics_daily | ~30 |
| Last 90 Days | Week | analytics_weekly | ~13 |

## Database Tables

### analytics_events (raw data)
```sql
id              UUID PRIMARY KEY
event_type      TEXT (player_search, game_analysis, etc.)
user_id         UUID (null for anonymous)
is_anonymous    BOOLEAN
platform        TEXT (lichess, chess.com)
metadata        JSONB (additional data)
created_at      TIMESTAMPTZ
```

### analytics_daily (aggregated)
```sql
day             TIMESTAMPTZ (date truncated to day)
event_type      TEXT
event_count     BIGINT
unique_users    BIGINT
anonymous_count BIGINT
```

## Security Model

| Endpoint | Access Level | Reason |
|----------|-------------|--------|
| track-event | Public | Events from anonymous users must be tracked |
| dashboard-metrics | Authenticated | Sensitive business data |
| registration-stats | Authenticated | Sensitive user data |
| refresh-analytics | Authenticated | Admin operation |

**Future Enhancement:** Add admin role check to dashboard endpoints.

## Charts & Visualizations

### Line Chart (Activity Over Time)
- **X-axis**: Time (formatted based on granularity)
- **Y-axis**: Event count
- **Lines**: One per event type
- **Interactive**: Hover to see exact values

### Bar Chart (Event Comparison)
- **X-axis**: Time buckets
- **Y-axis**: Event count
- **Bars**: Grouped by event type
- **Color-coded**: Different color per event type

### Summary Cards
- Large number display
- Icon/emoji indicator
- Subtitle with context
- Responsive grid layout

### Registration Status
- Progress bar visualization
- Percentage display
- Breakdown of complete vs incomplete

## Integration Points

1. **Player Search** → `src/components/simple/PlayerSearch.tsx`
   - Tracks when user selects a player
   - Includes username and platform

2. **Game Analysis** → `python/core/unified_api_server.py`
   - Tracks when analysis completes
   - Includes game_id and analysis_type

3. **Pricing Page** → `src/pages/PricingPage.tsx`
   - Tracks page view on mount
   - One event per session

4. **User Registration** → Database trigger on `auth.users`
   - Automatic on INSERT
   - No code changes needed

## Monitoring & Maintenance

### Check Event Counts
```sql
SELECT event_type, COUNT(*)
FROM analytics_events
GROUP BY event_type
ORDER BY COUNT(*) DESC;
```

### Check Latest Events
```sql
SELECT * FROM analytics_events
ORDER BY created_at DESC
LIMIT 10;
```

### Check View Freshness
```sql
SELECT
  'hourly' AS view_name,
  MAX(hour) AS last_data
FROM analytics_hourly
UNION ALL
SELECT
  'daily',
  MAX(day)
FROM analytics_daily;
```

### Monitor Table Sizes
```sql
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size('public.' || tablename))
FROM pg_tables
WHERE tablename LIKE 'analytics%';
```

---

**Architecture Version:** 1.0.0
**Last Updated:** November 2, 2025
