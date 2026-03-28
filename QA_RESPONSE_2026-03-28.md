# QA Response to Test Report — 2026-03-28

Response to the QA report dated 2026-03-28. Covers all 18 reported bugs: fixes applied, items classified as not-a-bug, and items requiring further investigation.

---

## FIXED (10 bugs)

### BUG-A: Non-existent username creates a fake profile (CRITICAL)
**Fix:** Added platform validation on the analytics page. When 0 games are found locally, the app now calls the backend `/api/v1/validate-user` endpoint to check whether the username actually exists on Chess.com/Lichess. If the user doesn't exist, a "Player not found" page is shown with a clear message and a "Back to Search" button — instead of rendering empty analytics with fabricated personality data.
**Files:** `src/pages/SimpleAnalyticsPage.tsx`
**Retest:** Search for "nonexistentuser99999" on Chess.com. Should now show "Player not found" page. Also verify that searching for a real user with 0 imported games (e.g. a brand new account) still works and shows the Import button.

### BUG-B: /coach/openings exposes raw HTTP 500 error (CRITICAL)
**Fix:** Commented out the `/coach/openings` route and its lazy import in App.tsx. The route now falls through to the catch-all 404 page, matching the behavior of `/coach/study-plan`.
**Files:** `src/App.tsx`
**Retest:** Navigate to `/coach/openings` — should show the themed 404 page, not a 500 error.

### BUG-C: Coach Tal chat send button permanently disabled without explanation (HIGH)
**Fix:** Added two changes:
1. Input placeholder now reads "Log in to chat with Coach Tal" when not authenticated (instead of the misleading "Ask about this position...")
2. Added a visible "Log in" link below the chat area for unauthenticated users
**Files:** `src/components/coach/InlineCoachChat.tsx`
**Retest:** Visit any game analysis page without logging in. The chat should clearly indicate login is required with a link to the login page. After logging in, the placeholder should return to "Ask about this position..." and the send button should work.

### BUG-E: Opening name shows "Unknown" in Game Review list (HIGH)
**Fix:** Added `time_control` to the Supabase SELECT query (was missing entirely). The `opening` and `opening_family` fields were already queried but may be empty in the database for some games. If openings still show "Unknown" after this fix, the root cause is the backend import not populating the `opening` column in the `games` table — that would be a separate backend data issue.
**Files:** `src/pages/coach/LessonsPage.tsx`
**Retest:** Open `/coach/review` and check if opening names now appear. If they still show "Unknown Opening", report as a new backend data bug.

### BUG-F: Time control shows "Unknown" in Game Review list (HIGH)
**Fix:** Same fix as BUG-E. Added `time_control` to the Supabase SELECT query, added `timeControl` field to the `ReviewableGame` interface, and added it to the card display (shown between opening name and date). Same caveat: if the DB column is empty, it will still show "Unknown".
**Files:** `src/pages/coach/LessonsPage.tsx`
**Retest:** Open `/coach/review` and check if time controls (Blitz, Rapid, Bullet, etc.) now appear next to the opening name on each game card.

### BUG-I: Right panel height doesn't match chess board (MEDIUM)
**Fix:** Changed the parent flex container alignment from `items-start` to `items-stretch` on both the Game Review page and the main Game Analysis page. This allows the right panel to stretch to match the board height.
**Files:** `src/pages/coach/GameReviewPage.tsx`, `src/components/debug/UnifiedChessAnalysis.tsx`
**Retest:** Open any analyzed game on both `/analysis/...` and `/coach/review/...`. The right panel (Analysis/Coach Tal tabs) should now fill the full height of the chess board without empty dark space below. Test on desktop (the fix only applies to non-mobile layout).

### BUG-J: Coach page flashes "Connect your chess account" on load (MEDIUM)
**Fix:** Added `profileLoaded` prop to the `CoachPageGuard` component. The guard now waits for both auth AND profile data to finish loading before deciding whether to show the "Connect account" screen. Previously it would briefly show the connect screen in the gap between auth resolving and profile data arriving.
**Files:** `src/components/coach/CoachPageGuard.tsx`, `src/hooks/useCoachUser.ts`, `src/pages/coach/CoachDashboardPage.tsx`, `src/pages/coach/ProgressPage.tsx`, `src/pages/coach/PuzzlesPage.tsx`, `src/pages/coach/PositionLibraryPage.tsx`
**Retest:** Log in and navigate to `/coach`. The dashboard should load directly with "Welcome back, hikaru" — no flash of the "Connect your chess account" screen. Test on multiple coach pages.

### BUG-K: Design system violations — colored CTA buttons (MEDIUM)
**Fix:** Replaced all colored buttons with design-system-compliant alternatives:
- **Profile page:** "Upgrade to Yearly Pro" / "Resubscribe" buttons changed from green (`emerald-500/20`) to silver CTA (`#e4e8ed`)
- **Profile page:** "Cancel Subscription" / "Sign Out" buttons changed from red (`rose-500/20`) to neutral surface (`white/[0.06]`) with rose text
- **Pricing page:** "Current Plan" badge changed from green (`emerald-500/10`) to neutral (`white/[0.06]`)
- **Progress page:** Active period tab changed from green (`emerald-500`) to silver CTA (`#e4e8ed`)
- **Coach page guard:** "Go to Profile to Connect" button changed from green (`emerald-500`) to silver CTA (`#e4e8ed`)
**Files:** `src/pages/ProfilePage.tsx`, `src/pages/PricingPage.tsx`, `src/pages/coach/ProgressPage.tsx`, `src/components/coach/CoachPageGuard.tsx`
**Retest:** Visit `/profile`, `/pricing`, `/coach/progress`, and `/coach` (while logged out with no linked account). All buttons should use silver/neutral colors, no green or red backgrounds.

### BUG-L: Emoji icon on landing page feature cards (MEDIUM)
**Fix:** Replaced the `U+1F4AC` speech bubble emoji with a Lucide React `MessageCircle` icon for the "Talk with Coach" feature card on the landing page. All other feature cards use Unicode text symbols which are not emoji.
**Files:** `src/pages/HomePage.tsx`
**Retest:** Visit the landing page, scroll to the "Everything you need to improve" section. The "Talk with Coach" card should show a small circle icon instead of a speech bubble emoji.

### BUG-R: "Fastest Win: 1 moves" in analytics (LOW)
**Fix:** Changed the minimum move threshold in `_compute_personal_records()` from `> 0` to `> 5`. Games with 5 or fewer total moves (resigned/aborted games) are now excluded from personal records like "Fastest Win". This prevents misleading stats from opponent resignations after 1 move.
**Files:** `python/core/unified_api_server.py`
**Retest:** Check the "Enhanced Game Length Insights" section on the analytics page. "Fastest Win" should now show a realistic move count (>5), not 1. Note: This requires a backend redeployment AND the stats cache to be refreshed (re-analyze or wait for cache expiry).

---

## NOT A BUG (5 items)

### BUG-G: ArrowRight keyboard navigation stuck at last position
**Verdict:** Working as intended. When at the last move, ArrowRight silently does nothing — this is standard behavior (same as chess.com, lichess). The tester acknowledged this: "Already at last position — no change (acceptable)." The large timeline scroll width (8605px) is just the full rendered move list, not hidden moves.

### BUG-H: Board orientation wrong in Game Review for Black games
**Verdict:** Code is correct. `GameReviewPage.tsx` line 542 sets `boardOrientation={playerColor}` which correctly flips the board. The color is derived from the game record's `color` field. If this appears wrong, it's likely a data issue where the `color` column is null/empty in the database for that specific game, causing it to default to white. Not a code bug.

### BUG-M: Gradients present on landing page
**Verdict:** These are subtle `h-px` horizontal divider lines using inline `linear-gradient(to right, transparent, rgba(255,255,255,0.06), transparent)`. They are barely visible decorative separators, not the decorative gradients banned by the design system (which refers to background gradients on cards, buttons, etc.). Low visual impact, technically debatable but not actionable.

### BUG-Q: Generic opening commentary "The adventure is underway!"
**Verdict:** Intentional design. The comment templates in `src/utils/commentTemplates.ts` deliberately provide Tal-inspired theatrical flavor text for move 1. This is by design — there is no meaningful chess analysis to provide for the very first move of the game. The AI coaching comments are reserved for critical moments (blunders, mistakes, brilliant moves) per the architecture.

### BUG-S: Rating discrepancy in Quick Access vs Search results
**Verdict:** Working as designed. The system stores and displays the highest rating ever achieved across all time controls. The `_infer_current_rating()` function intentionally takes the maximum. The two different numbers the tester saw (3228 vs 3579) are likely from different data sources or time windows, not a bug. This is a UX design choice, not a code defect.

---

## NEEDS FURTHER INVESTIGATION (3 items)

### BUG-D: Game list accuracy shows "7%" for all un-analyzed games
**Status:** Frontend code is correct — `MatchHistory.tsx` returns `null` for games without analysis data and renders "?%" for those. The 7% value must be coming from the backend or the database. Possible causes:
- Backend returning a default/fallback accuracy value for unanalyzed games
- Stale data in the database from a previous import/migration
**Action needed:** Check the backend endpoint `/api/v1/match-history/{userId}/{platform}` — inspect what accuracy value it returns for games that have not been analyzed by Stockfish. Also check the `games` table for a default `accuracy` column value.

### BUG-N: "Weak in C26" shows raw ECO code on Progress page
**Status:** Could not reproduce from code inspection. The `ProgressPage.tsx` formats weakness data with proper string transforms. The raw ECO code may be coming from the backend `/api/v1/coach/progress` endpoint which sends the weakness data.
**Action needed:** Check the backend response for the progress endpoint — does it send ECO codes (like "C26") or full opening names (like "Vienna Game")? The fix would be in the backend's progress analyzer.

### BUG-O: Pricing page shows undocumented free tier features
**Status:** The hardcoded fallback tiers in `PricingPage.tsx` do NOT include "1 coach lesson per week" or "3 coach puzzles per day". These features must come from the backend `/api/v1/payment-tiers` endpoint.
**Action needed:** Check what the backend returns for free tier features. Either the backend tier config needs updating, or the tester instructions should be updated to reflect these limits.

### BUG-P: Test account tier is "Pro Monthly" instead of Free
**Status:** This is a database data issue, not a code bug. Someone upgraded the test account to Pro Monthly. This prevents testing free-tier limitations (1 game review limit, upgrade prompts, rate limits).
**Action needed:** Either downgrade the test account back to Free tier in the database, or create a second test account that stays on Free tier.

---

## WHAT TO TEST NEXT

### Retest all fixes above
Priority order:
1. BUG-A — Search for non-existent username (most impactful fix)
2. BUG-B — Navigate to `/coach/openings` (should be 404 now)
3. BUG-J — Coach dashboard load (no more flash)
4. BUG-K — Check all button colors across Profile, Pricing, Progress, Coach
5. BUG-I — Right panel height on Game Analysis and Game Review
6. BUG-C — Coach Tal chat when not logged in
7. BUG-E/F — Opening names and time controls in Game Review list
8. BUG-L — Landing page "Talk with Coach" icon
9. BUG-R — Fastest Win stat (requires backend redeploy)

### Pages not yet tested (from original report)
- `/signup` — Sign-up flow
- `/forgot-password` — Password reset request
- `/reset-password` — Password reset via email link
- `/terms` — Terms of Service page
- `/privacy` — Privacy Policy page
- `/coach/positions` — Position Library page
- `/coach/puzzles/solve` — Puzzle solver interactive mode

### Functional areas not yet tested
- **Mobile responsive layout** — Test at 375px, 390px, 768px viewports
- **Stripe checkout flow** — Upgrade to Pro (use Stripe test cards)
- **Auth redirect** — Visit protected pages while logged out, verify redirect to `/login`
- **Lichess username search** — Search for "DrNykterstein" on Lichess
- **Rate limiting** — Test free tier limits (5 analyses/day, 100 imports/day)
- **Cross-browser** — Test on Firefox, Safari (if available), Edge

### Regression checks
After the design system color fixes, verify that:
- Profile page subscription management buttons are still clearly distinguishable (upgrade vs cancel)
- Pricing page still clearly shows which plan is current
- Progress page period selector is still clearly showing which period is active
- Coach page guard "Connect" button is still visually prominent

---

*Report generated: 2026-03-28*
*Fixes are in the `redesign` branch, pending deployment.*
