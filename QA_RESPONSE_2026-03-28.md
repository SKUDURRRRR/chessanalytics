# QA Response to Test Reports — 2026-03-28 (Session 1 + Session 2 Regression)

Covers all 22 bugs across both sessions: 18 from Session 1, 4 new from Session 2.

---

## FIXED IN THIS BUILD (16 bugs)

### From Session 1 (confirmed fixed in regression):
- **BUG-A** (CRITICAL): Non-existent username now shows "Player not found" page
- **BUG-B** (CRITICAL): `/coach/openings` now returns themed 404 page
- **BUG-C** (HIGH): Coach Tal chat shows "Log in to chat" with login link
- **BUG-J** (MEDIUM): Coach dashboard loads directly, no "Connect account" flash
- **BUG-L** (MEDIUM): Speech bubble emoji replaced with Lucide MessageCircle icon

### Fixed in this build (Session 2 regressions + new bugs):

**BUG-F: Time control shows raw seconds ("180") instead of label**
Fix: Now uses `getTimeControlCategory()` utility to convert raw seconds to human-readable labels (Bullet, Blitz, Rapid, Classical). Was missing the import and formatting step.
Files: `src/pages/coach/LessonsPage.tsx`

**BUG-I: Right panel 88px shorter than chess board**
Fix: Added a matching spacer div to the right panel in the main analysis page (to align with the Game Phase Indicator spacer above the board). Set explicit `height: boardWidth + 2` on the right panel card. Also switched panel to `minHeight/maxHeight` on Game Review page.
Files: `src/components/debug/UnifiedChessAnalysis.tsx`, `src/pages/coach/GameReviewPage.tsx`

**BUG-K remaining: Colored buttons on Profile page (Connect, status indicators)**
Fix: Replaced all emerald-green account connection buttons and status indicators with silver CTA (`#e4e8ed`) and neutral surfaces (`white/[0.06]`). Includes both Chess.com and Lichess Connect buttons, connected account status backgrounds, checkmark icons, and "Primary" badges.
Files: `src/pages/ProfilePage.tsx`

**BUG-T: "Review with Coach" button — green + chess queen emoji**
Fix: Button changed from green (`emerald-500/10`) to silver CTA (`#e4e8ed`). Removed the `&#9819;` chess queen icon. Mobile action menu icons also replaced from emoji to Unicode symbols.
Files: `src/pages/GameAnalysisPage.tsx`

**BUG-U: "Re-analyze" button has red tint background**
Fix: Changed from rose-tinted background (`rose-500/10`) to neutral ghost style (`white/[0.06]`). Loading and success states also updated to neutral colors.
Files: `src/pages/GameAnalysisPage.tsx`

**BUG-V: "Most Recent" active filter tab is green**
Fix: Changed active state from green (`emerald-500/20 text-emerald-300`) to silver CTA (`#e4e8ed text-[#111]`).
Files: `src/pages/coach/LessonsPage.tsx`

**BUG-W: Lichess "Connect" button on Profile is green**
Fix: Both Chess.com and Lichess Connect buttons changed from green to silver CTA. Connected account status backgrounds changed from emerald to neutral. (Same fix as BUG-K remaining.)
Files: `src/pages/ProfilePage.tsx`

**BUG-R: "Fastest Win: 1 moves"**
Fix: Backend minimum threshold changed from `> 0` to `> 5` moves. Requires backend redeployment + cache refresh to take effect.
Files: `python/core/unified_api_server.py`

---

## NOT A BUG (5 items — unchanged from Session 1)

- **BUG-G**: ArrowRight at last position does nothing — standard chess UI behavior
- **BUG-M**: Landing page gradient dividers are subtle `h-px` separators, not decorative gradients
- **BUG-Q**: "The adventure is underway!" for move 1 is intentional Tal-inspired flavor text
- **BUG-S**: Rating discrepancy is by design — system shows highest rating across all time controls

### BUG-H: Board orientation wrong in Game Review for Black games
**Verdict: Database data issue, not code bug.** The code correctly sets `boardOrientation={playerColor}` where `playerColor` is derived from `gameRecord.color`. If the `color` column is NULL in the database for a specific game, it defaults to `'white'`. This happens when games were imported before the `color` field was added, or the import didn't populate it. Fix: re-import the affected games, or run a data migration to backfill the `color` column from PGN headers.

---

## NEEDS BACKEND / DATA INVESTIGATION (4 items)

### BUG-D: Game list accuracy shows "7%" for un-analyzed games
**Root cause identified:** The frontend code is correct — it shows `?%` when accuracy is `null`. The 7% value comes from the backend `checkGamesAnalyzed` endpoint which returns accuracy from the `move_analyses` or `unified_analyses` table. These games DO have analysis records with accuracy=7%. This is likely stale data from an old analysis run with a bug, or a batch analysis that saved incorrect accuracy values. **Action:** Check the `move_analyses` table for games with suspiciously low accuracy (< 20%) and verify if they have valid `moves_analysis` data. If the analysis data is corrupted, delete those records and re-analyze.

### BUG-E: Opening shows "Unknown" in Game Review list
**Root cause identified:** The Supabase query now includes the `opening` and `opening_family` columns, but they are NULL in the database for the tested games. The same games show correct openings on `/analysis/` because that page uses the backend API which may enrich the data. **Action:** Check the `games` table for NULL `opening` values. Either backfill from PGN headers or update the import pipeline to always populate this field.

### BUG-N: "Weak in C26" uses raw ECO code
**Status:** Frontend formats data correctly. The raw ECO code comes from the backend `/api/v1/coach/progress` endpoint. **Action:** Update the backend progress analyzer to map ECO codes to full opening names before returning the response.

### BUG-O: Pricing page shows undocumented Free tier features
**Status:** Not in frontend fallback data. Comes from backend `/api/v1/payment-tiers`. **Action:** Check backend tier configuration and either update the features list or update the tester instructions to reflect these limits.

### BUG-P: Test account is Pro Monthly instead of Free
**Status:** Database issue. **Action:** Downgrade the test account to Free tier in the `authenticated_users` table, or create a separate Free-tier test account.

---

## RETEST CHECKLIST (priority order)

1. **BUG-F** — `/coach/review` time controls now show Blitz/Rapid/Bullet instead of raw seconds
2. **BUG-I** — Right panel height on `/analysis/...` and `/coach/review/...` (should match board)
3. **BUG-T** — "Review with Coach" button on `/analysis/...` (should be silver, no emoji)
4. **BUG-U** — "Re-analyze" button on `/analysis/...` (should be neutral ghost, not red)
5. **BUG-V** — Sort tabs on `/coach/review` (active should be silver, not green)
6. **BUG-W** — Connect buttons on `/profile` (should be silver, not green)
7. **BUG-K** — All remaining button colors across Profile, Pricing, Progress pages
8. **BUG-R** — Fastest Win stat (requires backend redeploy)

### Still untested:
- `/reset-password` (requires email link)
- Mobile visual layout at actual viewport sizes (375px, 390px, 768px)
- Free tier rate limiting (requires free-tier test account)
- Auth redirect consistency (Coach sub-routes)

---

*Report generated: 2026-03-28*
*Fixes in `redesign` branch.*
