# Coach Dashboard Phase 2 - Implementation Plan

## Context
The Coach Dashboard has a solid MVP (dashboard, lessons, puzzles, play-with-coach, chat). This plan implements 8 features to make it a comprehensive chess improvement platform: progress tracking, study plans, position library with game tagging, two new lesson types (time management + playing style), bug fixes, interactive boards in lessons, and opening repertoire trainer.

---

## Chunk 0: Shared Infrastructure (DB + Types + Bug Fixes)
**Must be done first - everything depends on it.**

### New DB migration: `supabase/migrations/YYYYMMDDHHMMSS_coach_phase2_tables.sql`

Create 5 new tables (all with RLS, UUIDs, timestamps):

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `study_plans` | Weekly training plans | user_id (UUID FK), platform, week_start (DATE), goals (JSONB), daily_activities (JSONB), status. UNIQUE(user_id, platform, week_start) |
| `user_goals` | Goal tracking | user_id (UUID FK), platform, goal_type, target_value, current_value, deadline, status |
| `game_tags` | Tags on games | user_id (UUID FK), game_id (TEXT), platform, tag (TEXT), tag_type ('user'/'system'). UNIQUE(user_id, game_id, tag) |
| `saved_positions` | Bookmarked positions | user_id (UUID FK), fen, title, notes, source_game_id, source_move_number, platform, tags (TEXT[]) |
| `opening_repertoire` | Opening stats + spaced rep | user_id (UUID FK), platform, opening_family, color ('white'/'black'), games_played, win_rate, avg_accuracy, deviation_moves (JSONB), spaced_repetition_due, confidence_level. UNIQUE(user_id, platform, opening_family, color) |

Also add unique constraint on existing `lessons` table: `UNIQUE(user_id, platform, lesson_type, lesson_title)` (lesson_generator.py upserts on this but constraint is missing).

### TypeScript types: `src/types/index.ts`
Add interfaces: `ProgressData`, `StudyPlan`, `UserGoal`, `GameTag`, `SavedPosition`, `OpeningRepertoire`, `OpeningDetail`, `QuickStats`
Extend `DashboardData` with `quick_stats` field.

### Bug fixes (Feature 6):

| Fix | File | What |
|-----|------|------|
| Unused Chess instance | [LessonViewer.tsx:22](src/components/coach/LessonViewer.tsx#L22) | Remove `const [game] = useState(new Chess())` - will be replaced properly in Chunk 9 |
| Unused Chessboard import | [LessonViewer.tsx:12](src/components/coach/LessonViewer.tsx#L12) | Remove `import { Chessboard } from 'react-chessboard'` |
| Generic fallback lesson | [lesson_generator.py](python/core/lesson_generator.py) | Remove the placeholder "Continue Your Chess Improvement" lesson; return empty list when no issues found |
| Practice positions lack FEN | [lesson_generator.py](python/core/lesson_generator.py) | Fix all 3 generators to include actual FEN from `moves_analysis` JSONB data in practice_positions |
| Chat rate limit comment | [unified_api_server.py](python/core/unified_api_server.py) | Add code comment documenting in-memory limitation (proper fix is separate infra concern) |

### Verify
- `supabase db reset` - migration applies cleanly
- `npm run lint && npm test` - no regressions
- Backend starts without errors

---

## Chunk 1: Progress Tracking - Backend
**Deps: Chunk 0**

### `python/core/progress_analyzer.py` - Add 3 methods:

1. **`get_progress_time_series(user_id, platform, game_analyses, period_days=90)`**
   - Rating trend: query `games` for `my_rating` by `played_at`, group by week
   - Accuracy by phase: aggregate opening/middlegame/endgame accuracy from `game_analyses` by week
   - Blunder rate trend: `blunders / total_moves` per week rolling average
   - Personality score trends: 6 scores aggregated by week

2. **`get_streak_data(user_id, platform)`**
   - Days active: distinct dates across game_analyses, lesson_progress, puzzle_attempts
   - Current streak + best streak (consecutive days)
   - Lessons completed / puzzles solved counts + solve rate

3. **`get_weakness_evolution(user_id, platform, game_analyses, weeks=8)`**
   - Weakness scores per week (tactical, positional, opening, etc.) to show improvement over time

### `python/core/unified_api_server.py` - Add endpoint:
```
GET /api/v1/coach/progress/{user_id}/{platform}?auth_user_id=&period_days=90
```
Returns: `{time_series, streaks, weakness_evolution}`
Same premium check pattern as dashboard endpoint.

### Verify
- Unit test with mock data
- Manual curl test

---

## Chunk 2: Progress Tracking - Frontend
**Deps: Chunk 1**

### `src/services/coachingService.ts` - Add `getProgress()` method
### `src/hooks/useCoachingData.ts` - Add `useCoachProgress()` hook

### New page: `src/pages/coach/ProgressPage.tsx`
Layout (following existing dashboard patterns):
1. Period selector (30d / 90d / 180d / All)
2. **Rating Trend Chart** - reuse `ResponsiveTrendChart` pattern from [ResponsiveTrendChart.tsx](src/components/simple/ResponsiveTrendChart.tsx) (recharts ComposedChart + Line + Area with gradients)
3. **Accuracy by Phase** - LineChart with 3 lines (opening/middlegame/endgame), same dark theme
4. **Blunder Rate Trend** - AreaChart declining over time
5. **Streaks Section** - stat cards: current streak, best streak, days active
6. **Weakness Evolution** - multi-line chart showing category scores trending over weeks

### `src/App.tsx` - Add route `/coach/progress`
### `src/pages/coach/CoachDashboardPage.tsx` - Replace "Coming soon" div (lines 153-157) with active Link to `/coach/progress`

### Verify
- Visual inspection of all charts
- Mobile responsiveness check
- `npm run lint`

---

## Chunk 3: Study Plans - Backend
**Deps: Chunk 0, Chunk 1 (uses streak/weakness data)**

### New file: `python/core/study_plan_generator.py`

```python
class StudyPlanGenerator:
    async def generate_weekly_plan(user_id, platform, game_analyses) -> Dict
    # 1. Get weaknesses from progress_analyzer
    # 2. Create 2-3 goals targeting top weaknesses
    # 3. Assign 7 days of activities (lessons, puzzles, review games)
    # 4. Save to study_plans + user_goals tables

    async def get_current_plan(user_id, platform) -> Optional[Dict]
    async def complete_daily_activity(user_id, plan_id, day, activity_index) -> Dict
    async def evaluate_week(user_id, platform) -> Dict
    # Compare start vs end weakness scores, adjust next week
```

### `python/core/unified_api_server.py` - Add 4 endpoints:
```
GET  /api/v1/coach/study-plan/{user_id}/{platform}     # Get current plan
POST /api/v1/coach/study-plan/{user_id}/{platform}     # Generate new plan
POST /api/v1/coach/study-plan/{plan_id}/activity       # Complete activity
GET  /api/v1/coach/goals/{user_id}/{platform}          # Get goals
```

### Verify: Unit tests, manual endpoint tests

---

## Chunk 4: Study Plans - Frontend
**Deps: Chunk 3**

### `src/services/coachingService.ts` - Add study plan CRUD methods
### New components:
- `src/components/coach/StudyPlanCard.tsx` - current week plan with checkable daily activities
- `src/components/coach/WeeklyCalendar.tsx` - 7-day visual with color-coded activities (lessons=blue, puzzles=cyan, review=amber)
- `src/components/coach/GoalCard.tsx` - goal with progress bar (current/target)

### New page: `src/pages/coach/StudyPlanPage.tsx`
Layout: goals section, weekly calendar, daily activity checklist, "Generate New Plan" button

### `src/App.tsx` - Add route `/coach/study-plan`
### Dashboard - Add Study Plan quick link card

### Verify: Full flow - generate plan, check off activities, verify persistence

---

## Chunk 5: Game Tagging + Position Library - Backend
**Deps: Chunk 0**

### `python/core/unified_api_server.py` - Add 8 endpoints:

Tags:
```
POST   /api/v1/coach/tags                         # Add tag to game
DELETE /api/v1/coach/tags/{tag_id}                 # Remove tag
GET    /api/v1/coach/tags/{user_id}/{platform}     # All user tags
GET    /api/v1/coach/tags/game/{game_id}           # Tags for a game
```

Positions:
```
POST   /api/v1/coach/positions                     # Save position
GET    /api/v1/coach/positions/{user_id}/{platform} # Get saved positions
PUT    /api/v1/coach/positions/{position_id}        # Update notes
DELETE /api/v1/coach/positions/{position_id}        # Delete
```

Auto-tagging logic (on analysis complete): blunders>=3 → "blunder game", accuracy>=95 → "brilliant game", win vs much higher-rated → "giant-killing". tag_type='system'.

### Verify: CRUD tests for tags + positions

---

## Chunk 6: Game Tagging + Position Library - Frontend
**Deps: Chunk 5**

### `src/services/coachingService.ts` - Add tag + position CRUD methods

### New components:
- `src/components/coach/TagBadge.tsx` - small colored badge, system vs user styling
- `src/components/coach/TagManager.tsx` - inline add/remove tags with autocomplete from existing tags
- `src/components/coach/SavePositionButton.tsx` - button + modal for saving current position (title, notes, auto-filled FEN)

### New page: `src/pages/coach/PositionLibraryPage.tsx`
- Grid of saved positions with mini react-chessboard previews
- Search/filter by tags
- Click to expand full board + notes

### Modify: `src/components/simple/MatchHistory.tsx`
- Add tag badges in game rows (both table and card layouts)
- Add TagManager inline (expand on click)
- Add tag filter dropdown in filter bar
- Batch-fetch tags for visible games on mount

### `src/App.tsx` - Add route `/coach/positions`

### Verify: Tag a game in MatchHistory, filter by tag, save position, view in library

---

## Chunk 7: Time Management + Playing Style Lessons - Backend
**Deps: Chunk 0**

### `python/core/lesson_generator.py` - Add 2 new generator methods:

**`generate_time_management_lessons(user_id, platform, game_analyses)`**
- Uses existing `time_management_score` from `game_analyses` (already computed by analysis engine)
- If avg time_management_score < 60 → critical lesson
- Compare blitz vs rapid accuracy (games table has time_control)
- If blitz accuracy << rapid accuracy → "You rush in blitz" lesson
- Optional: parse PGN clock annotations `{[%clk h:mm:ss]}` from `games_pgn` for time-per-move analysis
- Generate practice positions from worst time-management games

**`generate_style_lessons(user_id, platform, game_analyses)`**
- Uses personality scores from `game_analyses` (tactical, positional, aggressive, patient, novelty, staleness)
- Score-based lesson triggers:
  - aggressive>70 + patient<40 → "Channel your aggression safely"
  - patient>70 + aggressive<40 → "When patience becomes passivity"
  - novelty<35 → "Break out of your comfort zone"
  - tactical<50 + positional>65 → "Add tactics to your positional play"
  - staleness>65 → "Refresh your repertoire"
- Leverages [personality_scoring.py](python/core/personality_scoring.py) for score interpretation

### `lesson_generator.py` `get_all_lessons()` method - Add calls to both new generators after existing 3.

### Verify: Unit tests with mock personality score profiles

---

## Chunk 8: Time Management + Playing Style Lessons - Frontend
**Deps: Chunk 7**

Minimal changes - existing LessonsPage and LessonViewer already display any lesson type.

### `src/pages/coach/LessonsPage.tsx` - Expand category filters (currently lines 82-87):
```typescript
// Current: all, opening, tactical, positional
// Add: time_management, style
{ id: 'time_management', label: 'Time Management' },
{ id: 'style', label: 'Playing Style' },
```

### `src/components/coach/LessonCard.tsx` - Add icons/colors for new types:
- time_management → clock icon (⏱), amber accent
- style → palette icon (🎨), purple accent

### Verify: Generate lessons for user, verify new types appear, filter tabs work

---

## Chunk 9: Interactive Board in Lessons
**Deps: Chunk 0 (FEN fix), Chunk 7 (more lessons with practice_positions)**

### New utility: `src/utils/moveValidator.ts`
Extract move validation logic from [PuzzleSolvePage.tsx](src/pages/coach/PuzzleSolvePage.tsx) (lines ~96-137) into reusable function:
```typescript
export function validateMove(game: Chess, from: string, to: string, correctMove: string): {
  isValid: boolean; isCorrect: boolean; moveSan: string
}
```
Refactor PuzzleSolvePage to use this utility.

### New component: `src/components/coach/PracticePositionSection.tsx`
- Renders practice_positions array with interactive chessboard
- Position navigation (1 of N, prev/next buttons)
- For each position:
  - `<Chessboard>` with FEN, dark theme from `getDarkChessBoardTheme`
  - Description text
  - If `correct_move` exists: "What would you play?" quiz mode
    - Drag-and-drop move validation using `moveValidator`
    - Correct: green success feedback
    - Incorrect: red feedback + show correct move as arrow (`customArrows` prop)
  - If no `correct_move`: display-only study board
- Pattern follows [PuzzleSolvePage.tsx](src/pages/coach/PuzzleSolvePage.tsx) board implementation

### Modify: `src/components/coach/LessonViewer.tsx`
- Remove unused Chess/Chessboard imports (done in Chunk 0)
- Add `PracticePositionSection` between "Your Games" and "Action Items" sections:
```tsx
{lesson.lesson_content?.practice_positions?.length > 0 && (
  <PracticePositionSection positions={lesson.lesson_content.practice_positions} />
)}
```

### Verify: Load lesson with practice_positions, verify board renders, move validation works

---

## Chunk 10: Opening Repertoire Trainer - Backend
**Deps: Chunk 0**

### New file: `python/core/opening_repertoire.py`

```python
class OpeningRepertoireAnalyzer:
    async def analyze_repertoire(user_id, platform, canonical_user_id)
    # 1. Query games for opening, color, result, my_rating
    # 2. Query game_analyses for opening accuracy
    # 3. Group by opening_family (using opening_utils.normalize_opening_name) + color
    # 4. Compute: games_played, win_rate, avg_accuracy per opening
    # 5. Upsert to opening_repertoire table

    async def get_deviation_analysis(user_id, platform, opening_family, color)
    # 1. Get games with this opening from games + games_pgn
    # 2. Parse PGN move sequences
    # 3. Find common deviation points (where user diverges from most frequent line)
    # 4. Return {move_number, expected_move, actual_move, frequency, result_after}

    async def get_drill_positions(user_id, platform, opening_family, color)
    # Critical positions from deviation analysis
    # Positions where user made opening mistakes
    # Return with FEN, correct_move, explanation

    async def update_spaced_repetition(user_id, repertoire_id, confidence_delta)
    # Adjust confidence_level and spaced_repetition_due date
```

Uses [opening_utils.py](python/core/opening_utils.py) for ECO codes and opening family normalization.

### `python/core/unified_api_server.py` - Add 4 endpoints:
```
GET  /api/v1/coach/openings/{user_id}/{platform}             # Repertoire overview
GET  /api/v1/coach/openings/{user_id}/{platform}/{opening}   # Opening detail + deviations
POST /api/v1/coach/openings/drill                             # Get drill positions
POST /api/v1/coach/openings/drill/complete                    # Update after drill
```

### Verify: Unit tests with mock game data, test deviation detection

---

## Chunk 11: Opening Repertoire Trainer - Frontend
**Deps: Chunk 10, Chunk 9 (reuses PracticePositionSection for drilling)**

### `src/services/coachingService.ts` - Add repertoire methods

### New components:
- `src/components/coach/OpeningCard.tsx` - opening with stats: name, games count, win rate bar, accuracy %, confidence indicator. Color: green (>55% win), red (<45%), gray (in between).
- `src/components/coach/DrillMode.tsx` - sequential position drill using react-chessboard. Tracks correct/incorrect. Updates spaced repetition on completion. Reuses `PracticePositionSection` pattern from Chunk 9.

### New page: `src/pages/coach/OpeningsPage.tsx`
Layout:
1. Two columns: White repertoire / Black repertoire
2. OpeningCards sorted by games played
3. Click to expand: deviation analysis table, "Start Drill" button
4. Drill mode inline or fullscreen
5. Due-for-practice indicator (spaced repetition)

### `src/App.tsx` - Add route `/coach/openings`
### Dashboard - Add Openings quick link card

### Verify: Repertoire loads, drill mode works, spaced repetition updates

---

## Chunk 12: Dashboard Integration + Navigation Polish
**Deps: All previous chunks**

### `src/pages/coach/CoachDashboardPage.tsx` - Overhaul Quick Links:
- Expand from 4-card to 7-card grid (responsive: 2 cols mobile, 3-4 cols desktop)
- Cards: Play with Tal, Lessons, Puzzles, Progress, Study Plan, Openings, Position Library
- Add mini stats to each card from `quick_stats` (e.g., "12-day streak", "5 openings tracked")

### Backend: Extend dashboard endpoint response
Add `quick_stats` field to dashboard data:
```python
'quick_stats': {
    'current_streak': 5,
    'lessons_completed': 12,
    'puzzles_solved': 45,
    'puzzle_solve_rate': 0.72,
    'active_study_plan': True,
    'openings_tracked': 8,
}
```

### Premium gating alignment (Feature 6 final fix):
- Create `src/hooks/useIsPremium.ts` - shared hook encapsulating premium check logic
- Update `PremiumGate.tsx` to use it
- Ensure all new coach pages use consistent premium checking
- Align frontend tier name matching with backend `_check_premium_access()` logic

### Verify: Full end-to-end flow through all features, all navigation links work, premium gating consistent

---

## Dependency Graph

```
Chunk 0 (Infrastructure)
├── Chunk 1 (Progress Backend) → Chunk 2 (Progress Frontend)
├── Chunk 3 (Study Plans Backend) → Chunk 4 (Study Plans Frontend)
├── Chunk 5 (Tags/Positions Backend) → Chunk 6 (Tags/Positions Frontend)
├── Chunk 7 (Lesson Types Backend) → Chunk 8 (Lesson Types Frontend)
├── Chunk 9 (Interactive Board) ← needs Chunk 7 for FEN-bearing practice_positions
├── Chunk 10 (Openings Backend) → Chunk 11 (Openings Frontend) ← reuses Chunk 9
└── Chunk 12 (Integration) ← needs all above
```

**Parallel tracks after Chunk 0:**
- Track A: Chunks 1→2 (Progress)
- Track B: Chunks 3→4 (Study Plans) - needs Chunk 1 for weakness data
- Track C: Chunks 5→6 (Tags/Positions)
- Track D: Chunks 7→8→9 (Lesson Types + Interactive Board)
- Track E: Chunks 10→11 (Openings) - after Chunk 9

**Recommended serial order:** 0 → 7 → 8 → 9 → 1 → 2 → 5 → 6 → 10 → 11 → 3 → 4 → 12

Rationale: Fix practice_positions FEN (Chunk 7) first so interactive board (Chunk 9) has real data. Then progress tracking. Tags/positions and openings are independent. Study plans come later because they reference lessons/puzzles/progress. Integration last.

---

## Key Files Summary

| File | Chunks | Changes |
|------|--------|---------|
| `supabase/migrations/new_migration.sql` | 0 | 5 new tables + 1 constraint |
| `src/types/index.ts` | 0 | ~8 new interfaces |
| `python/core/lesson_generator.py` | 0, 7 | Fix FEN, remove fallback, add 2 generators |
| `python/core/progress_analyzer.py` | 1 | Add 3 time-series methods |
| `python/core/unified_api_server.py` | 1,3,5,10,12 | ~20 new endpoints |
| `src/services/coachingService.ts` | 2,4,6,11 | ~15 new API methods |
| `src/hooks/useCoachingData.ts` | 2,4 | New hooks |
| `src/components/coach/LessonViewer.tsx` | 0, 9 | Remove dead code, add interactive board |
| `src/pages/coach/LessonsPage.tsx` | 8 | Add 2 filter categories |
| `src/components/coach/LessonCard.tsx` | 8 | Add icons for new types |
| `src/pages/coach/CoachDashboardPage.tsx` | 2, 12 | Fix progress link, expand quick links |
| `src/components/simple/MatchHistory.tsx` | 6 | Add tag badges + filter |
| `src/App.tsx` | 2,4,6,11 | 4 new routes |
| New: `python/core/study_plan_generator.py` | 3 | Study plan generation |
| New: `python/core/opening_repertoire.py` | 10 | Repertoire analysis |
| New: 4 pages, ~8 components | Various | See chunks above |
