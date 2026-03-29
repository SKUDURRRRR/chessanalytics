# ChessData.app - Tester Instructions
# URL: https://www.chessdata.app
# Last updated: 2026-03-28 (Session 4)

---

## TEST ACCOUNT CREDENTIALS

Email: aitester@karjerospuslapis.com
Password: mL4w&bWByDK7eH4S1Xj2
Tier: Free (downgraded from Pro Monthly on 2026-03-28)
Linked Chess.com account: hikaru

---

## WHAT CHANGED SINCE LAST TEST SESSION

### DB changes applied (2026-03-28):
- Test account downgraded to **Free tier** (was Pro Monthly)
- Stale analysis records with <20% accuracy deleted from `move_analyses`

### Code fixes deployed in this build:
- **BUG-N**: Progress page now shows "Weak in Vienna Game" instead of "Weak in C26"
- **BUG-E**: Game Review list now uses `opening_normalized` as fallback (always populated)
- **BUG-H**: Board orientation now inferred from PGN headers when DB color is NULL
- **BUG-O**: Free tier features updated to include coach lesson + puzzle limits
- **BUG-R**: Fastest win now excludes games with 5 or fewer moves (needs backend redeploy)

### Previously fixed (verified in Session 3):
- BUG-A: Non-existent username shows "Player not found"
- BUG-B: /coach/openings returns 404
- BUG-C: Coach Tal chat shows "Log in" message when not authenticated
- BUG-F: Time control shows Blitz/Rapid/Bullet labels
- BUG-I: Right panel height matches chess board
- BUG-J: No "Connect account" flash on coach pages
- BUG-K: All buttons comply with silver CTA design system
- BUG-L: No emoji icons on landing page
- BUG-T/U/V/W: All remaining color violations fixed

---

## PRIORITY 1: RETEST NEW FIXES

### 1. Free Tier Limits (BUG-P fix — account downgraded)
- [ ] `/profile` shows "Free" tier (not Pro Monthly)
- [ ] `/profile` shows usage limits: "Game Reviews: X/1", "Analyses: X/5 per day", "Imports: X/100 per day"
- [ ] `/coach/review` — start a game review. Free users get 1 lifetime review
- [ ] After using the 1 free review, attempting another shows upgrade modal
- [ ] `/simple-analytics` — trigger analysis. After 5 analyses in a day, shows limit modal
- [ ] `/pricing` — "Current Plan" badge appears on Free tier
- [ ] Upgrade buttons on Pro tiers trigger Stripe checkout

### 2. Opening Names (BUG-E/N fixes)
- [ ] `/coach/review` — opening names show real names (e.g. "King's Pawn Opening"), not "Unknown Opening"
- [ ] `/coach/progress` — weakness text shows full name (e.g. "Weak in Vienna Game"), not ECO code ("Weak in C26")

### 3. Board Orientation (BUG-H fix)
- [ ] `/coach/review/:id` — for a game played as Black, board should show Black at bottom
- [ ] `/analysis/:id` — same check for Black games. Board should flip correctly
- [ ] For White games, board shows White at bottom (unchanged)

### 4. Accuracy Display (BUG-D fix — stale data deleted)
- [ ] `/simple-analytics` Games Analysis tab — un-analyzed games show "?%" (not "7%")
- [ ] After running Stockfish analysis on a game, accuracy shows real value (e.g. "90.5%")

### 5. Pricing Features (BUG-O fix)
- [ ] `/pricing` Free tier lists "1 coach lesson per week" and "3 coach puzzles per day"
- [ ] Pro tiers list "Unlimited" for these features

### 6. Fastest Win (BUG-R — needs backend redeploy)
- [ ] `/simple-analytics` Enhanced Game Length Insights — "Fastest Win" should show >5 moves
- [ ] If still showing "1 moves", this means backend hasn't been redeployed yet (expected)

---

## PRIORITY 2: PREVIOUSLY UNTESTED AREAS

### Mobile Responsive Layout
Test at these viewport widths (Chrome DevTools > Device Mode):
- [ ] 375px (iPhone SE) — all pages readable, no horizontal scroll
- [ ] 390px (iPhone 12/13) — cards stack vertically, board fits
- [ ] 768px (iPad) — tablet layout works, grids adapt
- [ ] Hamburger menu appears on mobile, full nav on desktop
- [ ] Chess board scales to fit viewport
- [ ] Bottom sheet used for mobile menus (instead of dropdowns)
- [ ] Touch targets at least 44px

### Auth Redirect Consistency
- [ ] `/profile` — redirects to `/login` when logged out
- [ ] `/coach/review` — shows login prompt or redirect
- [ ] `/coach/puzzles` — shows login prompt or redirect
- [ ] `/coach/progress` — shows login prompt or redirect
- [ ] `/coach/positions` — shows login prompt or redirect

### Password Reset Flow
- [ ] `/forgot-password` — enter test email, verify reset email arrives
- [ ] `/reset-password` — follow email link, verify password can be changed
- [ ] (Use a throwaway account for this, don't change test account password)

---

## PRIORITY 3: FULL FEATURE COVERAGE

### All Pages & Routes

**Public Pages (no login required):**
- `/` — Landing page (hero section with integrated search bar)
- `/search` — Same as landing page
- `/login` — Login page
- `/signup` — Sign up page (email/password + Google OAuth)
- `/forgot-password` — Password reset request
- `/reset-password` — Password reset (from email link)
- `/pricing` — Pricing plans (Free, Pro Monthly, Pro Yearly)
- `/terms` — Terms of Service
- `/privacy` — Privacy Policy

**Authenticated Pages (login required):**
- `/profile` — User profile (linked accounts, usage stats, subscription)
- `/simple-analytics` — Main analytics dashboard
- `/profile/:userId/:platform` — Analytics for specific player/platform
- `/analysis/:platform/:userId/:gameId` — Individual game analysis

**Coach Pages (login required):**
- `/coach` — Coach Dashboard (4 feature cards)
- `/coach/review` — Game Review list
- `/coach/review/:platform/:userId/:gameId` — Interactive Game Review
- `/coach/play` — Play with Coach Tal
- `/coach/puzzles` — Puzzle list
- `/coach/puzzles/solve` — Puzzle solver
- `/coach/progress` — Progress tracking
- `/coach/positions` — Position library

**Hidden/Disabled (should return 404):**
- `/coach/study-plan`
- `/coach/openings`

---

### 1. Landing Page & Search
- [ ] Hero section with integrated search bar loads
- [ ] Platform toggle works (Chess.com / Lichess)
- [ ] Searching "hikaru" (Chess.com) navigates to analytics
- [ ] Searching "DrNykterstein" (Lichess) navigates to analytics
- [ ] Searching non-existent username shows "Player not found"
- [ ] Empty search shows appropriate error
- [ ] Feature cards use Lucide SVG icons (no emoji)
- [ ] "Talk with Coach" card uses MessageCircle icon (not speech bubble emoji)
- [ ] Testimonial section shows real rating data
- [ ] Quick access section shows player cards

### 2. Authentication & Account

**Login:**
- [ ] Login with email/password works
- [ ] Session persists across page refreshes
- [ ] Logout works and redirects to landing page

**Sign Up:**
- [ ] Email/password registration works
- [ ] Google OAuth ("Continue with Google") works
- [ ] Account setup modal appears after first login
- [ ] Setup modal lets you link Chess.com username (with verification)
- [ ] Setup modal lets you link Lichess username (with verification)
- [ ] Setup modal shows import count after linking
- [ ] "Skip" button available, "Done" only after linking at least one account
- [ ] CTA button is silver (#e4e8ed)

**Password Management:**
- [ ] `/forgot-password` — sends reset email
- [ ] `/reset-password` — reset link works
- [ ] `/profile` — "Change Password" button works
- [ ] Change password requires current password
- [ ] New password must be min 6 chars and different from current
- [ ] Confirm password must match
- [ ] Success toast notification on change

### 3. Profile Page (`/profile`)
- [ ] Shows subscription tier (Free)
- [ ] Shows usage stats with limits (analyses X/5, imports X/100)
- [ ] Shows game reviews used (X/1 for free tier)
- [ ] Shows "Unlimited Access" text for Pro users (semantic green — intentional)
- [ ] Linked Chess.com account shown with neutral styling
- [ ] "Connect" buttons are silver CTA (#e4e8ed)
- [ ] Connected account rows use neutral background (white/[0.06])
- [ ] Can unlink accounts
- [ ] Can link a second platform account (Lichess)
- [ ] "Cancel Subscription" / "Sign Out" use ghost style with rose text
- [ ] Stripe payment verification works (after returning from checkout with session_id)

### 4. Analytics Dashboard (`/simple-analytics`)

**Stats & Charts:**
- [ ] Player stats load (games, ratings, win/loss/draw)
- [ ] Elo trend graph renders with data points
- [ ] Personality radar chart shows real differentiated values
- [ ] Score cards display correctly
- [ ] Opening statistics show (requires large game sample)
- [ ] Enhanced Game Length Insights section renders
- [ ] "Fastest Win" shows >5 moves (after backend redeploy)

**Match History:**
- [ ] Games list loads sorted by date (newest first)
- [ ] Un-analyzed games show "?%" accuracy (not "7%")
- [ ] Analyzed games show real accuracy (e.g. "90.5%")
- [ ] Clicking a game opens game analysis page
- [ ] "Analyze" button triggers Stockfish analysis on individual games
- [ ] Analysis progress shows during processing

**Game Import:**
- [ ] "Import Games (100)" button imports recent games
- [ ] Import progress status messages display
- [ ] Large import (5000+) shows progress bar with percentage
- [ ] Date range picker available for targeted imports (when 5000+ games)
- [ ] Import limit modal shows when free tier limit reached (100/day)
- [ ] Auto-sync checks for new games on page load

**Filtering:**
- [ ] Opening filter — filter games by opening name
- [ ] Opponent filter — filter games by opponent
- [ ] Clear filter removes applied filter
- [ ] Analytics update when filter applied

**Multi-Platform (Combined View):**
- [ ] If both Chess.com and Lichess linked, "Combined" toggle appears
- [ ] Combined view aggregates stats from both platforms
- [ ] Can switch between single platform and combined view
- [ ] "Link other platform" prompt shows if only one account linked

### 5. Game Analysis (`/analysis/:platform/:userId/:gameId`)

**Board & Navigation:**
- [ ] Chess board renders correctly with pieces
- [ ] Board orientation correct (White at bottom for White, Black at bottom for Black)
- [ ] Move navigation: forward/back arrows, first/last buttons
- [ ] Keyboard: ArrowLeft/ArrowRight navigate moves
- [ ] Clicking a move in timeline jumps to that position
- [ ] Move timeline scrolls to current move
- [ ] Evaluation bar shows position advantage

**Move Classification:**
- [ ] Colors: emerald = good, amber = caution, rose = bad
- [ ] Classification badges show on each move
- [ ] Arrows display on board showing best/played moves

**Coach Tal Chat:**
- [ ] Chat panel visible in right panel tabs
- [ ] When logged in: can type and send messages
- [ ] When NOT logged in: shows "Log in to chat with Coach Tal" + login link
- [ ] Quick suggestions: "Why was this bad?", "Best continuation?", "Explain this opening"
- [ ] Coach responds with position-aware analysis
- [ ] Auto-scroll to newest message

**Follow-Up Explorer:**
- [ ] "Show Follow-Up" button appears on critical moves
- [ ] Expands Stockfish continuation (14+ moves)
- [ ] Play button auto-plays continuation on board
- [ ] Free exploration mode: try other moves at decision points
- [ ] Undo / reset exploration moves

**Actions (Desktop: individual buttons, Mobile: three-dots menu):**
- [ ] "Review with Coach" — silver CTA, navigates to `/coach/review/...`
- [ ] "Re-analyze" — neutral ghost style, triggers re-analysis
- [ ] Re-analysis shows spinner, then "Updated!" on success
- [ ] "Download PGN" — downloads `.pgn` file
- [ ] Right panel height matches chess board height

### 6. Coach Dashboard (`/coach`)
- [ ] Shows 4 feature cards: Game Review, Puzzles, Progress, Play with Coach
- [ ] Study Plan and Openings cards are NOT visible
- [ ] "Welcome back, {username}" personalization
- [ ] No "Connect account" flash on load
- [ ] Each card links to correct page

### 7. Game Review (`/coach/review`)

**Game List:**
- [ ] Games load for linked account
- [ ] Opening names show real names (not "Unknown Opening")
- [ ] Time control shows labels (Blitz, Rapid) not raw seconds
- [ ] Sort tabs: "Most Recent", "Most Mistakes", "Lowest Accuracy" — all silver active state
- [ ] Result badges: green=win, red=loss, neutral=draw
- [ ] Accuracy and key moments (blunders/mistakes) shown per game

**Game Review Page (`/coach/review/:platform/:userId/:gameId`):**
- [ ] "Think First" mode: see position before mistake revealed
- [ ] User can try their own move before reveal
- [ ] Best move shown with arrows after reveal
- [ ] Coach explanation of the mistake
- [ ] Navigate between key moments (prev/next)
- [ ] Board orientation correct for Black games
- [ ] Right panel height matches board
- [ ] Free user: 1 lifetime review, then upgrade modal

### 8. Puzzles (`/coach/puzzles` and `/coach/puzzles/solve`)

**Puzzle List:**
- [ ] Daily Challenge with progress tracking
- [ ] Quick Play mode available
- [ ] Category tags shown (Fork, Pin, etc.)
- [ ] Puzzle rating displayed

**Puzzle Solve:**
- [ ] Board renders with correct position
- [ ] Prompt: "Black/White to move — find the best move!"
- [ ] Timer counts up
- [ ] Arrows display centered on squares
- [ ] "Show Hint (-50% XP)" button (amber styling — intentional)
- [ ] Move progress: "Move 1 of N"
- [ ] Right panel: Puzzle + Coach Tal tabs
- [ ] Solving records the attempt

### 9. Play with Coach (`/coach/play`)
- [ ] Can start a game against engine
- [ ] Choose color (White/Black) with Flip Color button
- [ ] Engine level slider adjustable
- [ ] Engine responds with moves
- [ ] Coach Tal provides commentary per move
- [ ] Move history in compact two-column table
- [ ] "New Game" button starts fresh
- [ ] Game result modal on end (checkmate/stalemate/resignation)
  - [ ] Shows result and player color
  - [ ] "Play Again" / "Try Again" button
  - [ ] "Review Game" option (if analyzed)

### 10. Progress (`/coach/progress`)
- [ ] Charts render (Accuracy by Phase, Weakness Evolution)
- [ ] Period selector tabs: 30/60/90 days — silver active state
- [ ] Opening weakness shows full name (e.g. "Weak in Vienna Game"), not ECO code
- [ ] Key insights display with actionable text

### 11. Position Library (`/coach/positions`)
- [ ] Empty state: "No saved positions yet"
- [ ] Search input for saved positions
- [ ] Save positions from game analysis pages
- [ ] Grid view with mini chessboard previews
- [ ] Custom tags on positions with autocomplete
- [ ] Delete positions
- [ ] Load position for study

### 12. Pricing Page (`/pricing`)
- [ ] 3 tiers: Free ($0), Pro Monthly ($5.45), Pro Yearly ($49.05/yr)
- [ ] Free tier lists: "1 coach lesson per week", "3 coach puzzles per day"
- [ ] Pro tiers list unlimited features
- [ ] "Current Plan" badge on user's current tier (neutral styling)
- [ ] Upgrade button triggers Stripe checkout (live keys)
- [ ] "Become Pro" link for logged-out users goes to `/signup`

---

## CROSS-CUTTING CONCERNS

### Sound & Audio
- [ ] Chess sounds play on moves (player and opponent)
- [ ] Sound toggle on/off works
- [ ] Volume adjustment works
- [ ] Settings persist across page loads (localStorage)

### Toast Notifications
- [ ] Success toasts appear (green border) for successful actions
- [ ] Error toasts appear (red border) for failures
- [ ] Toasts auto-dismiss after ~6 seconds
- [ ] Dismiss button works on each toast
- [ ] Toasts stack in top-right corner

### Keyboard Shortcuts
- [ ] Enter sends chat messages
- [ ] Escape closes modals, bottom sheets, action menus
- [ ] ArrowLeft/ArrowRight navigate moves in game analysis

### Error Handling
- [ ] Invalid route shows themed 404 page
- [ ] Backend down: user-friendly error messages (not raw errors)
- [ ] Chunk load failure: auto-reload after 2 seconds
- [ ] Component errors show fallback UI (not blank page)

### Deep Linking & URL Sharing
- [ ] Game analysis URLs are shareable (`/analysis/chess.com/hikaru/12345`)
- [ ] Analytics URLs preserve platform and user (`/simple-analytics?user=hikaru&platform=chess.com`)
- [ ] Tab state persists in URL (`?tab=matchHistory`)
- [ ] Filter state persists in URL

### Performance
- [ ] Landing page loads in under 3 seconds
- [ ] Analytics page loads in ~3 seconds
- [ ] No duplicate API calls on page load (check Network tab)
- [ ] Coach pages don't re-fetch on navigation between them
- [ ] No console errors during normal usage
- [ ] Pages lazy-load (loading spinner shown during chunk download)

---

## UI/UX DESIGN SYSTEM COMPLIANCE

### Silver CTA Theme (spot check all pages)
- [ ] All primary CTA buttons: silver `#e4e8ed` with dark text `#111`
- [ ] Active tabs/filters: silver background, dark text
- [ ] Cancel/destructive buttons: ghost `white/[0.06]` with rose text
- [ ] No green/emerald CTA buttons (exception: semantic success text like "Unlimited Access")
- [ ] No emoji icons in UI — Lucide React SVGs only
- [ ] No bold text (font-weight max 600, never 700)
- [ ] Background: cool-tinted dark `#0c0d0f` (not pure black)
- [ ] Cards: ring shadow `box-shadow: 0 0 0 1px`, not border utility
- [ ] Max border radius: `rounded-lg` (no `rounded-2xl` or larger)
- [ ] Hover states: max `bg-white/[0.04]`
- [ ] Transitions: `transition-colors` only, never `transition-all`
- [ ] Font: Inter throughout (weights 400/500/600)
- [ ] Move colors: emerald=good, amber=caution, rose=bad (3 groups only)
- [ ] Favicon: chess knight on dark background in browser tab

---

## PRICING TIERS

| Tier          | Price           | Analyses | Imports  | Lessons  | Puzzles  | Reviews  |
|---------------|-----------------|----------|----------|----------|----------|----------|
| Free          | $0              | 5/day    | 100/day  | 1/week   | 3/day    | 1 total  |
| Pro Monthly   | $5.45/month     | Unlimited| Unlimited| Unlimited| Unlimited| Unlimited|
| Pro Yearly    | $49.05/year     | Unlimited| Unlimited| Unlimited| Unlimited| Unlimited|

---

## KNOWN ITEMS (not bugs — intentional behavior)

- **ArrowRight at last position** does nothing — standard chess UI behavior
- **"The adventure is underway!"** on move 1 — intentional Coach Tal flavor text
- **Rating discrepancy** (quick access vs search) — shows highest rating across all time controls
- **Gradient dividers** on landing page — subtle `h-px` separators, not decorative gradients
- **"Unlimited Access" text** in emerald on profile — semantic success indicator, not a CTA
- **"Show Hint (-50% XP)"** amber styling on puzzle page — amber = caution/cost (intentional)

---

## BUG REPORTING FORMAT

When reporting bugs, include:
1. Page URL where the bug occurred
2. Steps to reproduce
3. Expected behavior
4. Actual behavior
5. Screenshot or screen recording
6. Browser + device info
7. Console errors (F12 > Console tab)
8. Network errors (F12 > Network tab)
