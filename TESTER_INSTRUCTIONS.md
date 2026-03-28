# ChessData.app - Tester Instructions
# URL: https://www.chessdata.app
# Last updated: 2026-03-28

---

## TEST ACCOUNT CREDENTIALS

Email: aitester@karjerospuslapis.com
Password: mL4w&bWByDK7eH4S1Xj2
Tier: Free
Linked Chess.com account: hikaru

---

## APP OVERVIEW

ChessData is a chess analytics platform that analyzes games from Chess.com and Lichess using Stockfish engine, provides AI coaching (Coach Tal), puzzles, and player personality insights. It follows a "Cool Silver Premium" dark theme design system.

---

## PRICING TIERS

| Tier          | Price           | Game Analyses | Game Imports |
|---------------|-----------------|---------------|--------------|
| Free          | $0              | 5/day         | 100/day      |
| Pro Monthly   | $5.45/month     | Unlimited     | Unlimited    |
| Pro Yearly    | $49.05/year     | Unlimited     | Unlimited    |

Free tier includes: analytics, Stockfish analysis, opening analysis, personality insights, position exploration, Tal-inspired comments, playstyle analysis, learning suggestions, 1 coach lesson per week, 3 coach puzzles per day, and 1 lifetime game review in Coach tab.

Pro adds: unlimited everything.

---

## ALL PAGES & ROUTES TO TEST

### Public Pages (no login required)
- `/` - Landing page (hero section with integrated search bar)
- `/login` - Login page
- `/signup` - Sign up page
- `/forgot-password` - Password reset request
- `/reset-password` - Password reset (from email link)
- `/pricing` - Pricing plans (Free, Pro Monthly, Pro Yearly)
- `/terms` - Terms of Service
- `/privacy` - Privacy Policy

### Authenticated Pages (login required)
- `/profile` - User profile (shows linked accounts, usage stats, subscription)
- `/simple-analytics` - Main analytics dashboard for a player
- `/analysis/:platform/:userId/:gameId` - Individual game analysis with Coach Tal chat

### Coach Pages (login required)
- `/coach` - Coach Dashboard (4 feature cards: Game Review, Puzzles, Progress, Play Tal)
- `/coach/review` - Game Review list (pick a game to review)
- `/coach/review/:platform/:userId/:gameId` - Interactive Game Review with coaching
- `/coach/play` - Play with Coach Tal (play against engine with commentary)
- `/coach/puzzles` - Puzzle list
- `/coach/puzzles/solve` - Solve puzzles interactively
- `/coach/progress` - Progress tracking page
- `/coach/positions` - Position library (saved positions)

### Hidden/Disabled Pages (should NOT be accessible)
- `/coach/study-plan` - Study Plan (hidden, unfinished)
- `/coach/openings` - Openings page (hidden, unfinished)

---

## FUNCTIONAL TESTING

### 1. Landing Page & Search
- [ ] Landing page loads with hero section containing the search bar
- [ ] Search bar accepts Chess.com and Lichess usernames
- [ ] Platform toggle works (Chess.com / Lichess)
- [ ] Searching a username navigates to analytics page
- [ ] Try searching: "hikaru" (Chess.com), "DrNykterstein" (Lichess)
- [ ] Invalid/empty username shows appropriate error
- [ ] Testimonial section shows real rating data

### 2. Authentication
- [ ] Login with test credentials works
- [ ] Login redirects to the correct page
- [ ] Logout works and redirects to landing page
- [ ] Sign up flow works (use a throwaway email to test)
- [ ] Forgot password sends reset email
- [ ] Protected pages redirect to login when not authenticated
- [ ] Session persists across page refreshes

### 3. Analytics Dashboard (`/simple-analytics`)
- [ ] Player stats load correctly (games, ratings, win/loss/draw)
- [ ] Elo trend graph renders with data
- [ ] Opening statistics show (requires large game sample)
- [ ] Match history list loads with games sorted by date (newest first)
- [ ] Clicking a game opens game analysis
- [ ] Personality radar chart renders
- [ ] Score cards display correctly
- [ ] Filters work (opening filter, opponent filter)
- [ ] Auto-import triggers for new games

### 4. Game Analysis (`/analysis/:platform/:userId/:gameId`)
- [ ] Chess board renders correctly with pieces
- [ ] Move navigation works (forward/back arrows, clicking moves)
- [ ] Move classification colors display correctly:
  - Emerald/green = good moves (brilliant, best, great, excellent, good)
  - Amber/yellow = caution (acceptable, inaccuracy)
  - Rose/red = bad moves (mistake, blunder)
- [ ] Arrows display on the board showing best moves
- [ ] Coach Tal inline chat is visible
- [ ] Coach Tal responds to questions about the position
- [ ] Quick suggestion buttons work ("Why was this bad?", "Best continuation?", "Explain this opening")
- [ ] Right panel height aligns with chess board height
- [ ] Move timeline displays correctly

### 5. Coach Dashboard (`/coach`)
- [ ] Shows 4 feature cards: Game Review, Puzzles, Progress, Play with Coach
- [ ] Study Plan and Openings cards are NOT visible (hidden features)
- [ ] Each card links to the correct page
- [ ] Page follows Cool Silver design system

### 6. Game Review (`/coach/review`)
- [ ] Free users can access 1 lifetime game review
- [ ] After using the free review, a premium upgrade modal appears
- [ ] Game list loads for the linked account
- [ ] Selecting a game opens the review page
- [ ] Review page shows coaching commentary on critical moves
- [ ] Right panel height matches chess board

### 7. Puzzles (`/coach/puzzles`)
- [ ] Puzzle list loads
- [ ] Clicking a puzzle opens solve page
- [ ] Puzzle board renders with correct position
- [ ] Arrows display correctly (centered on squares)
- [ ] Right panel height matches chess board
- [ ] Solving a puzzle records the attempt

### 8. Play with Coach (`/coach/play`)
- [ ] Can start a game against the engine
- [ ] Engine responds with moves
- [ ] Coach Tal provides commentary during play
- [ ] Compact move list displays alongside chat
- [ ] Board orientation is correct for chosen color

### 9. Progress (`/coach/progress`)
- [ ] Progress metrics display
- [ ] Charts/graphs render with data

### 10. Profile Page (`/profile`)
- [ ] Shows user email and linked chess accounts
- [ ] Shows usage stats (game reviews used: X/1 for free tier)
- [ ] Shows subscription tier
- [ ] Can link/unlink Chess.com and Lichess accounts

### 11. Pricing Page (`/pricing`)
- [ ] All 3 tiers display correctly (Free, Pro Monthly, Pro Yearly)
- [ ] Prices match: Free=$0, Monthly=$5.45, Yearly=$49.05
- [ ] Feature lists are accurate
- [ ] Upgrade button triggers Stripe checkout (for Pro tiers)
- [ ] Current tier is highlighted for logged-in users

---

## UI/UX TESTING (Cool Silver Premium Design System)

### Theme & Colors
- [ ] Background is dark cool-tinted gray (#0c0d0f), NOT pure black
- [ ] Cards use surface colors (#151618, #1c1d20, #232428)
- [ ] Primary CTA buttons are silver (#e4e8ed), not blue/green
- [ ] No gradients, glassmorphism, or glow shadows anywhere
- [ ] No emoji icons used in the UI (Lucide React icons only)
- [ ] No bold text (font-weight should be 400/500/600, never 700)

### Typography
- [ ] Font is Inter throughout
- [ ] Text is readable on all pages without zooming
- [ ] Headings use proper hierarchy
- [ ] No text-base used in UI components

### Components
- [ ] Cards use ring shadow (box-shadow: 0 0 0 1px), NOT border utility
- [ ] Maximum border radius is rounded-lg (no rounded-2xl or larger)
- [ ] Hover states are subtle (max bg-white/[0.04])
- [ ] Transitions use transition-colors only, NOT transition-all

### Move Classification Colors (3 groups, not 7 rainbow)
- [ ] Good moves: emerald/green tones
- [ ] Caution moves: amber/yellow tones
- [ ] Bad moves: rose/red tones

### Favicon & PWA
- [ ] Browser tab shows proper chess knight favicon (dark background)
- [ ] PWA install works on mobile (if supported)
- [ ] App name shows as "chessdata.app" when installed

---

## RESPONSIVE / MOBILE TESTING

### Viewports to Test
- Mobile: 375px (iPhone SE), 390px (iPhone 12/13)
- Tablet: 768px (iPad)
- Desktop: 1280px+

### Mobile Checks
- [ ] Navigation works on mobile (hamburger menu or mobile nav)
- [ ] Chess board fits viewport without horizontal scroll
- [ ] Search bar is easily tappable
- [ ] Cards stack vertically
- [ ] Touch targets are at least 44px
- [ ] No horizontal scrolling on any page

---

## PERFORMANCE TESTING

- [ ] Landing page loads in under 3 seconds
- [ ] Analytics page loads in ~3 seconds (was optimized from ~9s)
- [ ] Coach pages load without excessive delay
- [ ] No duplicate API calls visible in Network tab on page load
- [ ] Page navigation between coach pages doesn't re-fetch already loaded data
- [ ] No console errors during normal usage

---

## SECURITY TESTING

- [ ] Protected pages (profile, coach, analytics) redirect to login when not authenticated
- [ ] Cannot access other users' private data by changing URL parameters
- [ ] API calls use proper authentication (JWT tokens in headers)
- [ ] No sensitive data visible in browser URL bar or console
- [ ] Stripe checkout uses HTTPS
- [ ] CORS blocks requests from unauthorized origins
- [ ] No XSS vulnerabilities in search input or any text fields
- [ ] Rate limits work (free tier: 5 analyses/day, 100 imports/day)

---

## EDGE CASES & ERROR HANDLING

- [ ] Search for non-existent username shows error message
- [ ] Analyze a player with 0 games - handles gracefully
- [ ] Navigate to invalid game ID - shows 404 or error
- [ ] Rapidly click through moves in game analysis - no crashes
- [ ] Open multiple coach pages in sequence - no memory leaks
- [ ] Try to exceed free tier limits - shows upgrade prompt
- [ ] Slow network: loading states display properly
- [ ] Backend down: appropriate error messages shown (not raw errors)

---

## KNOWN LIMITATIONS / NOT YET IMPLEMENTED

- Study Plan page - route is hidden, should not be accessible
- Openings page - route is hidden, should not be accessible
- Position Library may have limited functionality
- Coach Tal chat quality depends on position context being passed correctly

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
