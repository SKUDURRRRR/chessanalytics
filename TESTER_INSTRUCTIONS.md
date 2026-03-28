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

### Auth Redirect Consistency
- [ ] `/profile` — redirects to `/login` when logged out (confirmed working)
- [ ] `/coach/review` — should show login prompt or redirect
- [ ] `/coach/puzzles` — should show login prompt or redirect
- [ ] `/coach/progress` — should show login prompt or redirect
- [ ] `/coach/positions` — should show login prompt or redirect

### Password Reset Flow
- [ ] `/forgot-password` — enter test email, verify reset email arrives
- [ ] `/reset-password` — follow email link, verify password can be changed
- [ ] (Use a throwaway account for this, don't change test account password)

---

## PRIORITY 3: FULL REGRESSION (all pages)

All pages have been tested at least once. This is a final pass to catch regressions.

### Public Pages
- [ ] `/` — Landing page loads, search works, no emoji icons, MessageCircle SVG on "Talk with Coach" card
- [ ] `/login` — Login flow works
- [ ] `/signup` — Registration works, silver CTA button
- [ ] `/forgot-password` — Form submits, silver button
- [ ] `/pricing` — 3 tiers display, correct prices, features match spec
- [ ] `/terms` — Renders, proper typography
- [ ] `/privacy` — Renders, proper typography

### Authenticated Pages
- [ ] `/profile` — Shows Free tier, linked accounts with neutral (not green) styling, silver Connect buttons
- [ ] `/simple-analytics` — Stats load, charts render, match history works
- [ ] `/analysis/:id` — Board renders, moves navigate, "Review with Coach" button is silver (no emoji), "Re-analyze" is neutral ghost

### Coach Pages
- [ ] `/coach` — 4 cards, no flash, loads directly
- [ ] `/coach/review` — Game list with opening names, time controls (Blitz/Rapid), silver sort tabs
- [ ] `/coach/review/:id` — Board orientation correct, panel height matches board
- [ ] `/coach/play` — Engine responds, Coach Tal commentary works
- [ ] `/coach/puzzles` — Puzzle list loads, daily challenge available
- [ ] `/coach/puzzles/solve` — Board renders, timer works, hint button is amber (intentional)
- [ ] `/coach/progress` — Charts render, opening names (not ECO codes), silver period tabs
- [ ] `/coach/positions` — Empty state or saved positions display

### Hidden Routes
- [ ] `/coach/openings` — Shows 404 page
- [ ] `/coach/study-plan` — Shows 404 page

### Design System Compliance (spot check)
- [ ] No green/emerald CTA buttons anywhere (exception: semantic success indicators like "Unlimited Access" text)
- [ ] No emoji icons in UI (Lucide SVGs only)
- [ ] All CTA buttons are silver (#e4e8ed) or neutral ghost (white/[0.06])
- [ ] Cancel/Sign Out buttons use neutral ghost with rose text (not filled red)
- [ ] Active tabs/filters use silver, not green

---

## APP OVERVIEW

ChessData is a chess analytics platform that analyzes games from Chess.com and Lichess using Stockfish engine, provides AI coaching (Coach Tal), puzzles, and player personality insights. It follows a "Cool Silver Premium" dark theme design system.

---

## PRICING TIERS

| Tier          | Price           | Analyses | Imports  | Coach Lessons | Coach Puzzles | Game Reviews |
|---------------|-----------------|----------|----------|---------------|---------------|--------------|
| Free          | $0              | 5/day    | 100/day  | 1/week        | 3/day         | 1 lifetime   |
| Pro Monthly   | $5.45/month     | Unlimited| Unlimited| Unlimited     | Unlimited     | Unlimited    |
| Pro Yearly    | $49.05/year     | Unlimited| Unlimited| Unlimited     | Unlimited     | Unlimited    |

---

## KNOWN ITEMS (not bugs)

These were investigated and closed as intentional behavior:
- **ArrowRight at last position** does nothing — standard chess UI behavior
- **"The adventure is underway!"** on move 1 — intentional Coach Tal flavor text
- **Rating discrepancy** (quick access vs search) — shows highest rating across all time controls by design
- **Gradient dividers** on landing page — subtle `h-px` separators, not decorative gradients
- **"Unlimited Access" text** in emerald-400 on profile — semantic success indicator, not a CTA button

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
