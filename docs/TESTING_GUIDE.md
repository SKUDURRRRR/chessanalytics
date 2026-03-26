# Chess Analytics Platform - Comprehensive Testing Guide

## Overview

This document provides step-by-step testing instructions for the entire Chess Analytics platform. It covers functionality, visual design, UX quality, wording/copy, data accuracy, edge cases, and cross-platform behavior.

**Intended audience:** Both human testers and AI testers (LLMs operating via browser automation, screenshots, or DOM inspection).

**Test Environment:**
- Frontend: `http://localhost:3000` (or Vercel preview URL)
- Backend: `http://localhost:8002` (or Railway URL)
- Platforms supported: Chess.com, Lichess

**Test Accounts Needed:**
- A free-tier account (email/password)
- A premium (pro) account with active subscription
- Chess.com username(s) with game history
- Lichess username(s) with game history
- A Stripe test card (`4242 4242 4242 4242`)

---

## AI Tester Instructions

This section defines how an AI tester should approach testing to impersonate a thorough human QA tester.

### Testing Methodology

1. **Navigate like a real user.** Don't jump directly to URLs — start from the home page and click through the UI. This catches broken links, missing nav items, and dead-end flows.
2. **Take a screenshot after every meaningful action** (page load, button click, modal open, form submit). Screenshots are your primary evidence.
3. **Read all visible text on every page.** Check for typos, grammar errors, placeholder text left in, broken formatting, and inconsistent terminology.
4. **Evaluate visual design on every page.** Check against the Cool Silver Premium design system (see Section 14). Flag any deviations.
5. **Test the unhappy path first.** Submit empty forms, click buttons twice, use invalid inputs, navigate while loading. Users make mistakes — the platform should handle them gracefully.
6. **Compare state before and after actions.** If you click "Import", verify the game count changed. If you upgrade, verify premium features unlock.
7. **Check every loading and empty state.** Every data-dependent component should have a loading skeleton/spinner AND an empty state message. Never a blank white area.
8. **Note anything that would confuse a first-time user.** Unlabeled icons, jargon without explanation, unclear next steps, hidden features.

### How to Report Issues

For each issue found, report with this structure:

```
[SEVERITY] CATEGORY — Short description
- Test Case: #X.X.X (if applicable)
- Page/URL: /path
- Steps: What you did
- Expected: What should happen
- Actual: What happened
- Screenshot: (reference number or description)
- Design System Violation: (if applicable, cite the specific rule)
```

**Severity levels:**
- **P0 BLOCKER**: Feature broken, data loss, security issue, payment failure
- **P1 HIGH**: Feature partially broken, wrong data displayed, misleading UI
- **P2 MEDIUM**: Visual bug, UX friction, wording issue, design system violation
- **P3 LOW**: Minor polish, nice-to-have improvement, edge case cosmetic issue

**Categories:** `FUNCTIONAL`, `VISUAL`, `UX`, `WORDING`, `DATA`, `PERFORMANCE`, `SECURITY`

### Thinking Like a Human Tester

When evaluating each page, ask yourself:
- **First impression:** Does this page look professional and trustworthy? Would I pay for this?
- **Clarity:** Do I immediately understand what this page does and what I should do next?
- **Feedback:** After I take an action, does the UI confirm what happened? Do I know if it worked?
- **Consistency:** Does this page look and feel like the rest of the app? Same colors, fonts, spacing, button styles?
- **Accessibility:** Can I read all text? Is contrast sufficient? Are interactive elements obviously clickable?
- **Error recovery:** If something goes wrong, can I recover without refreshing or losing my work?

---

## Table of Contents

1. [Authentication & Account Management](#1-authentication--account-management)
2. [Navigation & Layout](#2-navigation--layout)
3. [Game Import & Data Sync](#3-game-import--data-sync)
4. [Simple Analytics Dashboard](#4-simple-analytics-dashboard)
5. [Game Analysis Page](#5-game-analysis-page)
6. [Data Accuracy Validation](#6-data-accuracy-validation)
7. [Coach Features (Premium)](#7-coach-features-premium)
8. [Payments & Subscriptions](#8-payments--subscriptions)
9. [Rate Limiting & Usage Tracking](#9-rate-limiting--usage-tracking)
10. [Mobile & Responsive Design](#10-mobile--responsive-design)
11. [Edge Cases & Error Handling](#11-edge-cases--error-handling)
12. [API Health & Performance](#12-api-health--performance)
13. [Security Testing](#13-security-testing)
14. [Visual & Design System Compliance](#14-visual--design-system-compliance)
15. [UX Quality](#15-ux-quality)
16. [Wording & Copy Review](#16-wording--copy-review)

---

## 1. Authentication & Account Management

### 1.1 Sign Up

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 1.1.1 | Email/password sign up | Go to `/signup`, enter valid email + password (8+ chars), submit | Account created, email confirmation sent, redirected to confirm page |
| 1.1.2 | Weak password rejection | Try password with < 8 characters | Error message shown, form not submitted |
| 1.1.3 | Duplicate email | Sign up with already-registered email | Error: "User already registered" or similar |
| 1.1.4 | Google OAuth sign up | Click "Sign up with Google" | Redirected to Google, then back to app with account created |
| 1.1.5 | Chess.com OAuth sign up | Click "Sign up with Chess.com" | Redirected to Chess.com OAuth, then back with account linked |
| 1.1.6 | Lichess OAuth sign up | Click "Sign up with Lichess" | Redirected to Lichess OAuth, then back with account linked |
| 1.1.7 | Return-to URL preserved | Visit `/coach` while logged out, sign up | After sign up, redirected back to `/coach` (not home) |

### 1.2 Login

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 1.2.1 | Email/password login | Enter valid credentials at `/login` | Logged in, redirected to home or return-to URL |
| 1.2.2 | Wrong password | Enter correct email, wrong password | Error message, not logged in |
| 1.2.3 | Non-existent email | Enter unregistered email | Error message |
| 1.2.4 | OAuth login (Google) | Click "Sign in with Google" | Logged in via Google |
| 1.2.5 | Session persistence | Log in, close tab, reopen app | Still logged in (session persisted) |
| 1.2.6 | Sign out | Click "Sign Out" in nav/profile | Logged out, redirected to home |

### 1.3 Password Reset

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 1.3.1 | Request reset | Go to `/forgot-password`, enter email | "Check your email" message shown |
| 1.3.2 | Reset with link | Click email link, enter new password at `/reset-password` | Password updated, can log in with new password |
| 1.3.3 | Change password in profile | Go to `/profile`, enter current + new password | Password changed successfully |

### 1.4 Chess Account Linking

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 1.4.1 | Link Chess.com account | Go to `/profile`, enter Chess.com username | Username validated against Chess.com API, linked to account |
| 1.4.2 | Link Lichess account | Go to `/profile`, enter Lichess username | Username validated against Lichess API, linked to account |
| 1.4.3 | Invalid username | Enter non-existent username | Error: "User not found on [platform]" |
| 1.4.4 | Link both platforms | Link both Chess.com and Lichess usernames | Both shown in profile, can set primary |
| 1.4.5 | Set primary platform | After linking both, set primary | Primary badge shown, "My Analytics" uses primary |
| 1.4.6 | Unlink account | Click unlink on a connected account | Account removed, data may be preserved |
| 1.4.7 | Case sensitivity | Chess.com: try "Hikaru" vs "hikaru" / Lichess: try exact case | Chess.com accepts both (case-insensitive), Lichess requires exact case |

### 1.5 Profile Page

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 1.5.1 | View account info | Go to `/profile` | Email, tier, connected accounts displayed |
| 1.5.2 | Usage stats display | Check usage section | Import/analysis/coach limits shown with progress bars |
| 1.5.3 | Reset timer | Check "Hours until reset" | Shows correct time until daily reset |
| 1.5.4 | Upgrade CTA | Free tier user views profile | "Upgrade" button visible, links to `/pricing` |

---

## 2. Navigation & Layout

### 2.1 Navigation Bar

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 2.1.1 | Anonymous nav | Visit app without login | Shows: Home, Pricing, Login, Sign Up |
| 2.1.2 | Authenticated nav | Log in | Shows: Home, My Analytics, Pricing, Coach, Profile, Sign Out |
| 2.1.3 | "My Analytics" link | Click "My Analytics" with linked account | Goes to `/simple-analytics` with your username pre-filled |
| 2.1.4 | "Connect Account" | No chess account linked, click nav item | Prompts to link Chess.com/Lichess account |
| 2.1.5 | Usage indicators | Desktop view, logged in | Import/analysis remaining counts visible in nav |
| 2.1.6 | "Last Player" (anonymous) | View a player's analytics, return to home | "Last Player" link appears in nav |

### 2.2 Footer & Static Pages

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 2.2.1 | Terms of Service | Navigate to `/terms` | Terms page renders correctly |
| 2.2.2 | Privacy Policy | Navigate to `/privacy` | Privacy page renders correctly |
| 2.2.3 | Footer links | Check footer on any page | All links work, no broken links |

---

## 3. Game Import & Data Sync

### 3.1 Basic Import

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 3.1.1 | Import Chess.com games | Search a Chess.com username, trigger import | Games imported, progress bar shown, count matches expected |
| 3.1.2 | Import Lichess games | Search a Lichess username, trigger import | Games imported successfully |
| 3.1.3 | Import progress tracking | Start large import (100+ games) | Progress bar updates in real-time (percentage, games imported) |
| 3.1.4 | Deduplication | Import same user twice | Second import only adds new games, no duplicates |
| 3.1.5 | Date range import | Import with fromDate/toDate filters | Only games within date range imported |

### 3.2 Import Validation

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 3.2.1 | Non-existent username | Search "xyznonexistent12345" on Chess.com | Error: "User not found" |
| 3.2.2 | Private profile | Search user with private game history | Appropriate error message |
| 3.2.3 | Cancel import | Start import, then cancel | Import stops, partial data preserved |
| 3.2.4 | Empty game history | Search new account with 0 games | "No games found" message |

### 3.3 Data Integrity After Import

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 3.3.1 | Game count matches | Compare imported count vs platform profile | Numbers should match (within date range) |
| 3.3.2 | Game metadata correct | Open any imported game | Result (W/L/D), opponent, rating, opening, date all correct |
| 3.3.3 | PGN stored correctly | Check game analysis loads PGN | Moves replay correctly on the board |
| 3.3.4 | Chronological order | View match history | Games ordered by `played_at` DESC (most recent first) |

---

## 4. Simple Analytics Dashboard

### 4.1 Search & Display

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 4.1.1 | Search by username | Enter Chess.com/Lichess username, select platform | Analytics page loads with player data |
| 4.1.2 | Platform switch | Switch between Chess.com and Lichess | Data refreshes for selected platform |
| 4.1.3 | URL persistence | Load analytics, refresh page | Same player/platform still shown (query params preserved) |
| 4.1.4 | Direct link | Navigate to `/profile/{userId}/{platform}` | Analytics load for that user |

### 4.2 ELO Trend Graph

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 4.2.1 | Graph renders | View ELO trend section | Line chart with rating over time |
| 4.2.2 | Time control breakdown | Check different time controls | Separate lines for bullet/blitz/rapid/classical |
| 4.2.3 | Data accuracy | Compare highest rating on graph vs platform profile | Should match the platform's reported peak rating |
| 4.2.4 | Date range | Check graph x-axis dates | Dates match actual game dates |

### 4.3 Opening Statistics

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 4.3.1 | Opening list | View openings section | Shows openings played with game count and win rate |
| 4.3.2 | Win rate calculation | Pick an opening, manually count W/L/D from match history | Win rate percentage matches manual calculation |
| 4.3.3 | Opening filter | Click/filter by specific opening | Match history filters to show only those games |
| 4.3.4 | Sample size | Check opening stats use large sample | Should use limit=10000 data (not just 100 games) |

### 4.4 Personality Radar

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 4.4.1 | Radar renders | View personality section | 6-axis radar chart (tactical, positional, aggressive, patient, novelty, staleness) |
| 4.4.2 | Score range | Check all 6 trait scores | Each between 0-100 |
| 4.4.3 | Trait consistency | Compare traits to play style (e.g., aggressive player with lots of sacrifices) | Scores should reasonably reflect actual play patterns |

### 4.5 Match History

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 4.5.1 | Game list | View match history table | Shows games with result, opponent, rating, opening, date |
| 4.5.2 | Sorting | Sort by different columns | Table re-sorts correctly |
| 4.5.3 | Filtering | Filter by result (wins only) or opening | Table filters correctly |
| 4.5.4 | Game link | Click on a game | Navigates to game analysis page |

### 4.6 Other Analytics Widgets

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 4.6.1 | Score cards | View move classification summary | Blunders, mistakes, inaccuracies, brilliant moves displayed |
| 4.6.2 | Opponent analysis | View opponent win rates | Shows opponents played most and win rate against each |
| 4.6.3 | Time spent analysis | View time management section | Phase-based breakdown (opening/middle/endgame) |
| 4.6.4 | Long-term planner | View improvement recommendations | Actionable suggestions based on weaknesses |

### 4.7 Comprehensive Analytics Data Accuracy

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 4.7.1 | Color performance | Check white vs black win rates | W/L/D counts for white and black should sum to total games |
| 4.7.2 | Win rate math | Total wins / total games = win rate | Percentage is mathematically correct |
| 4.7.3 | Average ELO | Check reported average rating | Should be reasonable average across displayed games |
| 4.7.4 | Game length distribution | Check short/medium/long game counts | Should sum to total analyzed games |
| 4.7.5 | Personal records | Check "fastest win", "highest accuracy" | Cross-reference with actual game data |

---

## 5. Game Analysis Page

### 5.1 Board & Move Playback

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 5.1.1 | Board loads | Navigate to `/analysis/{platform}/{userId}/{gameId}` | Chessboard renders with starting position |
| 5.1.2 | Move playback | Click through moves or use arrows | Board updates position correctly for each move |
| 5.1.3 | Move list | View move notation sidebar | All moves displayed in SAN notation |
| 5.1.4 | First/last move | Jump to start/end of game | Board shows initial/final position |
| 5.1.5 | Sound effects | Play through moves with sound enabled | Move sounds play (toggle in settings) |

### 5.2 Move Classification

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 5.2.1 | Classification badges | Play through analyzed game | Each move shows classification badge (brilliant/best/great/good/etc.) |
| 5.2.2 | Color coding | Check badge colors | Brilliant = cyan/teal, Best = green, Mistake = orange, Blunder = red |
| 5.2.3 | Blunder identification | Find a blunder in the game | Move marked as blunder, shows centipawn loss |
| 5.2.4 | Brilliant move | Find brilliant move (if any) | Correctly identified sacrifice or non-obvious winning move |

### 5.3 AI Coaching Comments

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 5.3.1 | Comments on critical moves | Navigate to a blunder/mistake/brilliant move | AI coaching comment displayed |
| 5.3.2 | No comments on normal moves | Navigate to a "good" or "best" move | No AI comment (or minimal comment) - this is by design |
| 5.3.3 | Comment quality | Read AI comments on mistakes | Educational, references specific pieces/squares, suggests better move |
| 5.3.4 | Player reference | Check how AI refers to the player | Uses color name ("White"/"Black"), never "Player 1200" |
| 5.3.5 | Tense consistency | Check verb tenses in comments | Past tense ("played", "captured"), not present ("is playing") |
| 5.3.6 | Board accuracy | AI mentions a piece on a square | Piece is actually on that square in the position |

### 5.4 Arrows & Suggestions

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 5.4.1 | Best move arrow | On a mistake/blunder, check for arrow | Arrow shows suggested better move |
| 5.4.2 | Arrow accuracy | Verify suggested move | The suggested move should improve the position (compare eval) |

### 5.5 Game Metadata

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 5.5.1 | Opening display | Check opening name | Matches the actual opening played |
| 5.5.2 | Player ratings | Check both player ratings | Match the ratings at time of game |
| 5.5.3 | Result | Check game result | Correct (win/loss/draw) from searched player's perspective |
| 5.5.4 | Accuracy score | Check overall accuracy | Between 0-100%, reasonable for the game quality |
| 5.5.5 | Phase accuracy | Check opening/middle/endgame accuracy | Each between 0-100%, should reflect play quality in each phase |

---

## 6. Data Accuracy Validation

These tests validate that the platform's calculations are correct.

### 6.1 Move Classification Accuracy

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 6.1.1 | Centipawn loss thresholds | Analyze a game, check move with ~50cp loss | Should be classified as inaccuracy (not mistake or good) |
| 6.1.2 | Blunder threshold | Find move with 200+ cp loss | Classified as blunder |
| 6.1.3 | Mistake threshold | Find move with 100-200 cp loss | Classified as mistake |
| 6.1.4 | Rating adjustment | Compare same position analyzed for 800 vs 2000 rated player | Lower-rated player may get more lenient brilliant thresholds |
| 6.1.5 | Cross-reference with Chess.com | Compare move classifications with Chess.com's game review | Should roughly match (same naming convention used) |

### 6.2 Accuracy Score Validation

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 6.2.1 | Perfect game accuracy | Find a game with all best/great moves | Accuracy should be 95-100% |
| 6.2.2 | Poor game accuracy | Find a game with many blunders | Accuracy should be notably low (< 50%) |
| 6.2.3 | Phase accuracy sum | Compare phase accuracies to overall | Overall should be a weighted average of phases |
| 6.2.4 | Move count consistency | Count total moves in game | Should match `total_moves` field |
| 6.2.5 | Classification counts | Sum brilliant+best+great+...+blunder | Should equal total analyzed moves |

### 6.3 Personality Score Validation

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 6.3.1 | Tactical score | Player with many tactical games (forks, pins, sacrifices) | High tactical score (70+) |
| 6.3.2 | Positional score | Player who plays quiet, strategic games | High positional score |
| 6.3.3 | Aggressive score | Player with many king attacks and sacrifices | High aggressive score |
| 6.3.4 | Score stability | Analyze same player twice | Scores should be identical (deterministic) |
| 6.3.5 | Score range | Check all personality scores | All between 0-100, no negatives or > 100 |

### 6.4 Statistics Accuracy

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 6.4.1 | Win rate calculation | Manually count wins / total games | Matches displayed win rate |
| 6.4.2 | Opening win rate | For a specific opening, count wins manually | Matches displayed opening win rate |
| 6.4.3 | Color win rate | Count white wins vs black wins separately | Match "Color Performance" section |
| 6.4.4 | Average centipawn loss | Spot-check a game's avg CPL | Reasonable (10-30 for good play, 50+ for poor play) |
| 6.4.5 | ELO trend data points | Check dates on ELO graph | Each data point corresponds to an actual game date |
| 6.4.6 | Game count consistency | Compare total games across different views | Match history count = analytics total = import count |

### 6.5 Stockfish Analysis Accuracy

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 6.5.1 | Evaluation accuracy | Compare eval at a known position vs Stockfish GUI | Should be within ~10cp (depth may vary) |
| 6.5.2 | Best move accuracy | Check Stockfish's suggested best move | Should be a strong move (verify with external engine) |
| 6.5.3 | Mate detection | Game with forced mate | Correctly identifies "Mate in X" |
| 6.5.4 | Opening evaluation | Check eval in opening moves | Should be near 0.0 (equal) for standard openings |

---

## 7. Coach Features (Premium)

### 7.1 Premium Gate

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 7.1.1 | Free user blocked | Log in as free user, go to `/coach` | Premium gate shown, redirect to pricing |
| 7.1.2 | Premium user access | Log in as premium user, go to `/coach` | Coach dashboard loads |
| 7.1.3 | No chess account | Premium user without linked chess account | Prompt to link account before using coach |
| 7.1.4 | Trial access | User with `subscription_status = 'trialing'` | Full coach access granted |
| 7.1.5 | Expired subscription | User with `subscription_status = 'expired'` | Premium gate shown |

### 7.2 Coach Dashboard (`/coach`)

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 7.2.1 | Dashboard loads | Navigate to `/coach` | Shows weakness cards, strength cards, quick links |
| 7.2.2 | Weakness cards | Check weaknesses section | Shows 2-4 areas needing improvement with specific data |
| 7.2.3 | Strength cards | Check strengths section | Shows 2-4 areas of excellence |
| 7.2.4 | Quick links | Click each feature link | Each navigates to correct coach sub-page |

### 7.3 Game Review (`/coach/review`)

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 7.3.1 | Review list | Navigate to `/coach/review` | Shows analyzed games with mistake counts |
| 7.3.2 | Sort options | Sort by recent / most mistakes / lowest accuracy | List re-sorts correctly |
| 7.3.3 | Game badges | Check result badges | Color-coded (green=win, red=loss, gray=draw) |
| 7.3.4 | Open review | Click a game | Opens game review page |

### 7.4 Game Review Detail (`/coach/review/{platform}/{userId}/{gameId}`)

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 7.4.1 | Critical moments | Review loads | Shows list of critical moments (blunders, mistakes) |
| 7.4.2 | Think First mode | Encounter a mistake position | Position shown BEFORE revealing the mistake - asks what you'd play |
| 7.4.3 | Mistake walkthrough | Step through a mistake | Shows what was played, why it's bad, what was better |
| 7.4.4 | Coach commentary | Read Tal Coach comments | Educational, specific to the position, references correct pieces |
| 7.4.5 | Best move arrows | Check arrow visualization | Arrow shows the correct/better move |
| 7.4.6 | No-mistakes game | Open a game with no mistakes | "No critical moments found" or similar message |
| 7.4.7 | Summary phase | Complete review | Summary with statistics shown |

### 7.5 Puzzles (`/coach/puzzles`)

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 7.5.1 | Puzzle list | Navigate to `/coach/puzzles` | Shows puzzle stats, daily challenge, theme filters |
| 7.5.2 | Daily challenge | Click daily challenge | Loads today's puzzle(s) |
| 7.5.3 | Theme filter | Filter by theme (fork, pin, mate, etc.) | Only matching puzzles shown |
| 7.5.4 | Puzzle rating | Check displayed puzzle rating | Shows current puzzle Elo and match difficulty |

### 7.6 Puzzle Solving (`/coach/puzzles/solve`)

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 7.6.1 | Board loads | Start a puzzle | Position shown with correct side to move |
| 7.6.2 | Correct move | Play the correct move | Green feedback, puzzle progresses (or completes) |
| 7.6.3 | Wrong move | Play an incorrect move | Red feedback, can retry or see solution |
| 7.6.4 | Multi-move puzzle | Puzzle requires 2+ correct moves | Opponent auto-responds, user must find all moves |
| 7.6.5 | Hint system | Request a hint | Partial hint shown without giving full answer |
| 7.6.6 | Rating change | Complete a rated puzzle | Rating adjusts up (correct) or down (incorrect) |
| 7.6.7 | XP earned | Complete puzzle | XP earned shown, level progress updated |
| 7.6.8 | Next puzzle | Complete one puzzle | "Next puzzle" button loads a new puzzle |
| 7.6.9 | Solution playback | After completing/failing | Can replay the full solution |

### 7.7 Progress Tracking (`/coach/progress`)

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 7.7.1 | Rating trend chart | View rating trend | Line chart with rating over selected period |
| 7.7.2 | Period selector | Switch between 30/90/180/365 days | Chart updates to show selected period |
| 7.7.3 | Accuracy chart | View accuracy by phase | Opening/middlegame/endgame accuracy over time |
| 7.7.4 | Win/loss/draw distribution | View game results | Pie or bar chart with correct proportions |
| 7.7.5 | Weakness radar | View weakness evolution | Radar chart showing improvement/regression per area |
| 7.7.6 | Streak tracking | Check current streak | Shows consecutive days of activity |
| 7.7.7 | Advanced metrics | Check advantage conversion, comeback rate | Percentages shown, reasonable values |
| 7.7.8 | Data accuracy | Cross-check metrics with game data | Metrics should match manual calculations |

### 7.8 Position Library (`/coach/positions`)

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 7.8.1 | Empty state | New user, no saved positions | "No positions saved" message |
| 7.8.2 | Save position | Save a position from game analysis | Position appears in library with mini board |
| 7.8.3 | Edit notes | Edit position notes/title | Changes saved and persisted |
| 7.8.4 | Delete position | Delete a saved position | Position removed from library |
| 7.8.5 | Open position | Click a saved position | Full board view with the position |
| 7.8.6 | FEN accuracy | Check saved position | FEN matches the position it was saved from |

### 7.9 Openings (`/coach/openings`)

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 7.9.1 | Opening list | View opening repertoire | Lists all openings played with stats |
| 7.9.2 | Multi-platform | User with both platforms linked | Combined stats from Chess.com + Lichess |
| 7.9.3 | Opening stats | Check a specific opening | Games played, win rate, avg rating match game data |
| 7.9.4 | Opening detail | Expand an opening | Shows deviation tracking, latest results |
| 7.9.5 | Drill mode | Start drill for an opening | Positions from your games presented for practice |
| 7.9.6 | Sort order | Check default sort | Sorted by games played (most first) |
| 7.9.7 | Platform badges | Check opening entries | Each shows which platform the games came from |

### 7.10 Study Plan (`/coach/study-plan`)

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 7.10.1 | Plan generation | View study plan page | Weekly plan with daily activities shown |
| 7.10.2 | Activity types | Check daily activities | Mix of puzzle/lesson/review/play/opening activities |
| 7.10.3 | Activity links | Click an activity | Navigates to relevant coach feature |
| 7.10.4 | Complete activity | Mark an activity as done | Checkbox updates, progress tracked |
| 7.10.5 | Weekly summary | Check summary stats | Shows completion percentage, days active |
| 7.10.6 | Weakness radar | Check weakness snapshot | Radar chart with tactical/positional/opening/middlegame/endgame/blunder scores |
| 7.10.7 | Goals | Check/edit personal goals | Goals displayed, editable |

### 7.11 Play With Coach (`/coach/play`)

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 7.11.1 | Start game | Begin new game against Tal Coach | Board loads, game starts |
| 7.11.2 | Make moves | Play moves on the board | Legal moves only accepted, engine responds |
| 7.11.3 | Coach commentary | Make a mistake during play | Coach comment appears for critical moves |
| 7.11.4 | Move classification | After each move | Classification badge shown (when applicable) |
| 7.11.5 | Game result | Finish game (win/loss/draw) | Result modal shown with analysis |
| 7.11.6 | Move history | Check notation panel | Full move list in SAN notation |
| 7.11.7 | Sound effects | Play with sound on | Contextual sounds for moves, captures, checks |

### 7.12 Coach Chat

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 7.12.1 | Open chat | Click coach chat panel | Chat interface opens |
| 7.12.2 | Ask about position | Send message about current position | AI responds with relevant analysis |
| 7.12.3 | Conversation context | Send follow-up questions | AI remembers conversation context |
| 7.12.4 | Rate limiting | Send 50+ messages in an hour | Rate limit error after limit reached |

---

## 8. Payments & Subscriptions

### 8.1 Pricing Page

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 8.1.1 | Tier display | Visit `/pricing` | Free, Pro Monthly, Pro Yearly tiers shown |
| 8.1.2 | Feature comparison | Check feature lists | Correct features listed per tier |
| 8.1.3 | Current plan highlight | Logged in user views pricing | Current tier highlighted, button shows "Current Plan" |
| 8.1.4 | Upgrade button | Free user clicks "Become Pro" | Redirected to Stripe checkout |
| 8.1.5 | Plan switching | Pro Monthly user sees "Switch to Yearly" | Option available to change plan |

### 8.2 Checkout Flow

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 8.2.1 | Stripe checkout | Click upgrade, complete with test card `4242 4242 4242 4242` | Checkout succeeds, redirected back to app |
| 8.2.2 | Session verification | After checkout redirect | Subscription status updated in app, premium features unlocked |
| 8.2.3 | Failed payment | Use declining test card `4000 0000 0000 0002` | Error shown, subscription not created |
| 8.2.4 | Cancel checkout | Start checkout, click back/close | No subscription created, no charge |

### 8.3 Subscription Management

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 8.3.1 | View subscription | Go to `/profile` as premium user | Shows plan, status, renewal date |
| 8.3.2 | Cancel subscription | Click cancel in profile | Confirmation dialog shown, subscription set to cancel at period end |
| 8.3.3 | Post-cancellation access | After cancelling but before period end | Full access until subscription_end_date |
| 8.3.4 | Resubscribe | After cancellation, click resubscribe | New checkout flow, subscription reactivated |

### 8.4 Webhook Processing

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 8.4.1 | Payment succeeded | Complete Stripe checkout | `authenticated_users` table updated with tier, stripe IDs |
| 8.4.2 | Subscription cancelled | Cancel via Stripe dashboard | Status updated to 'cancelled', end date set |
| 8.4.3 | Subscription expired | After end date passes | Status updated to 'expired', premium features locked |

---

## 9. Rate Limiting & Usage Tracking

### 9.1 Anonymous Users

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 9.1.1 | Analysis limit | Analyze 2 games without logging in | Third analysis blocked with "limit reached" modal |
| 9.1.2 | Import limit | Try importing as anonymous | Limited import count enforced |
| 9.1.3 | Limit modal | Hit a limit | Modal shown with option to sign up |

### 9.2 Free Tier Users

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 9.2.1 | Daily analysis limit | Use 5 analyses in one day | Sixth analysis blocked |
| 9.2.2 | Import limit | Exceed import quota | Error message with upgrade CTA |
| 9.2.3 | Coach blocked | Try accessing coach features | Premium gate shown |
| 9.2.4 | Usage reset | Check after 24 hours | Limits reset, can analyze again |

### 9.3 Premium Users

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 9.3.1 | Unlimited analyses | Run many analyses | No limit reached (or very high limit) |
| 9.3.2 | Unlimited imports | Import many games | No limit block |
| 9.3.3 | Coach access | Access all coach features | No premium gate blocks |
| 9.3.4 | API rate limits | Send 5+ analysis requests/minute | Rate limit still applies (server protection) |

### 9.4 Usage Display

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 9.4.1 | Counter updates | Use an analysis, check profile | Used count incremented by 1 |
| 9.4.2 | Progress bars | View usage in profile | Bars fill proportionally to usage |
| 9.4.3 | Nav indicators | Desktop nav, check usage counts | Remaining counts match profile page |

---

## 10. Mobile & Responsive Design

### 10.1 Layout

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 10.1.1 | Mobile nav | View on mobile (< 768px) | Hamburger menu, collapsible nav |
| 10.1.2 | Chessboard sizing | View game analysis on mobile | Board resizes to fit screen width |
| 10.1.3 | Analytics layout | View analytics on mobile | Cards stack vertically, no horizontal overflow |
| 10.1.4 | Charts responsive | View ELO graph on mobile | Chart resizes, labels readable |
| 10.1.5 | Coach pages on mobile | Navigate coach features on mobile | All pages functional, no cut-off content |
| 10.1.6 | Bottom sheet | Mobile modals/sheets | Use native bottom sheet instead of modal |

### 10.2 Touch Interactions

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 10.2.1 | Move pieces | Touch-drag pieces on mobile | Pieces move correctly |
| 10.2.2 | Tap navigation | Tap through moves in analysis | Board updates per tap |
| 10.2.3 | Scroll behavior | Scroll through analytics | Smooth scrolling, no conflicts with charts |

---

## 11. Edge Cases & Error Handling

### 11.1 Network & API Errors

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 11.1.1 | Backend offline | Stop backend, try to analyze | User-friendly error message, no crash |
| 11.1.2 | Slow connection | Throttle network, load analytics | Loading indicators shown, eventually loads or times out gracefully |
| 11.1.3 | Chess.com API down | Circuit breaker triggers | Graceful fallback message, no stuck loading |
| 11.1.4 | Lichess API down | Circuit breaker triggers | Same graceful handling |
| 11.1.5 | AI API unavailable | Gemini/Claude API fails | Fallback comments generated, no blank coaching |

### 11.2 Data Edge Cases

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 11.2.1 | Player with 1 game | Analyze user with single game | Analytics display correctly (no division by zero) |
| 11.2.2 | Very old games | Import games from years ago | Dates display correctly, no timezone issues |
| 11.2.3 | Special game types | Analyze a game with en passant, castling, promotion | All special moves rendered and classified correctly |
| 11.2.4 | Resignation | Game ended by resignation | Result shown correctly, incomplete game handled |
| 11.2.5 | Timeout | Game ended by timeout | Result and analysis handled |
| 11.2.6 | Draw types | Stalemate, repetition, 50-move, agreement | Draw result correctly shown |
| 11.2.7 | Very long game | Game with 100+ moves | All moves load, scrollable move list |
| 11.2.8 | Very short game | Scholar's mate (4 moves) | Analysis works, phases may be limited |

### 11.3 Input Validation

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 11.3.1 | SQL injection in search | Search for `'; DROP TABLE games;--` | Input sanitized, no database impact |
| 11.3.2 | XSS in username | Search for `<script>alert(1)</script>` | Script not executed, input escaped |
| 11.3.3 | Empty search | Submit empty search form | Validation error shown |
| 11.3.4 | Special characters | Search for username with special chars | Handled gracefully |

### 11.4 Error Boundaries

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 11.4.1 | Component crash | Trigger render error in a widget | Error boundary catches it, rest of page works |
| 11.4.2 | Invalid game ID | Navigate to `/analysis/chess.com/user/invalid-id` | Error message, not a white screen |
| 11.4.3 | Invalid route | Navigate to `/nonexistent-page` | 404 or redirect to home |

---

## 12. API Health & Performance

### 12.1 Health Check

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 12.1.1 | Health endpoint | `GET /health` | Returns 200 with Stockfish status, DB status, timestamp |
| 12.1.2 | Root endpoint | `GET /` | Returns API info, version 3.0.0 |

### 12.2 Performance

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 12.2.1 | Analytics load time | Load analytics for user with 500+ games | Page loads within 5 seconds |
| 12.2.2 | Game analysis load | Open individual game analysis | Board + analysis loads within 3 seconds |
| 12.2.3 | Import speed | Import 100 games | Completes within 30 seconds |
| 12.2.4 | Cache effectiveness | Load same analytics twice | Second load significantly faster |
| 12.2.5 | Memory usage | Check `/api/v1/metrics/memory` after heavy use | Memory stable, no leaks |

### 12.3 Circuit Breaker

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 12.3.1 | Circuit breaker stats | `GET /api/v1/api-client-stats` | Shows status for Chess.com, Lichess, AI APIs |
| 12.3.2 | Recovery | After API failure recovery | Circuit breaker resets, requests resume |

---

## 13. Security Testing

### 13.1 Authentication Security

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 13.1.1 | Protected routes | Access `/profile` without login | Redirected to login |
| 13.1.2 | Coach routes | Access `/coach/puzzles` without premium | Premium gate shown |
| 13.1.3 | API auth | Call `/api/v1/auth/profile` without JWT | 401 Unauthorized |
| 13.1.4 | Expired token | Use expired JWT | 401, re-authentication required |

### 13.2 Data Isolation (RLS)

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 13.2.1 | Cross-user data | User A tries to access User B's coach data | Access denied by RLS |
| 13.2.2 | Own data only | Query games table | Only returns authenticated user's games |
| 13.2.3 | Public data | Puzzle bank access | All users can read puzzle bank (public table) |

### 13.3 Payment Security

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 13.3.1 | Webhook signature | Send fake webhook without valid signature | Rejected with 400 |
| 13.3.2 | Tier manipulation | Try to set account_tier directly via API | Not possible, only webhook updates tier |

### 13.4 Input Security

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 13.4.1 | Parameterized queries | All DB queries use parameters | No SQL injection possible (verify in code) |
| 13.4.2 | CORS policy | API request from unauthorized origin | CORS rejection |
| 13.4.3 | Rate limiting | Flood API with requests | Rate limiter kicks in (429 Too Many Requests) |

---

## 14. Visual & Design System Compliance

All frontend pages must follow the Cool Silver Premium design system (`docs/DESIGN_SYSTEM.md`). Run these checks on **every page** you visit.

### 14.1 Color Compliance

| # | Test Case | What to Check | Expected Result |
|---|-----------|---------------|-----------------|
| 14.1.1 | Page background | Main page background color | `#0c0d0f` (cool-tinted near-black, not pure black or warm gray) |
| 14.1.2 | Card backgrounds | Card/panel background color | `#151618` (surface-1) or `#1c1d20` (surface-2), never pure gray |
| 14.1.3 | Hover states | Hover over cards and interactive elements | Max `bg-white/[0.04]`, no bright or jarring hover flashes |
| 14.1.4 | Primary buttons | CTA/primary button color | Silver `#e4e8ed` background with dark text. Not blue, green, or any other color |
| 14.1.5 | Semantic colors | Win/loss/error indicators | Emerald for positive, amber for caution, rose for negative. Never rainbow colors |
| 14.1.6 | Move classification colors | Move badges in game analysis | 3 color groups only (emerald/neutral/rose-amber), not 7 different colors |
| 14.1.7 | No banned effects | Scan page for visual effects | No gradients, glassmorphism, glow shadows, or neon effects anywhere |
| 14.1.8 | Text colors | Check heading and body text | Headings: `#f0f0f0`, body: `text-gray-300`, secondary: `text-gray-400`. Never pure white `#fff` for body text |

### 14.2 Typography

| # | Test Case | What to Check | Expected Result |
|---|-----------|---------------|-----------------|
| 14.2.1 | Font family | All text on page | Inter font (check in dev tools or visually — clean sans-serif, not system default) |
| 14.2.2 | Font weights | Headings and body | Only 400 (regular), 500 (medium), 600 (semibold). Never bold/700 anywhere |
| 14.2.3 | Font sizes | All text elements | No `text-base` (16px) in UI components. Use the defined type scale only |
| 14.2.4 | Monospace text | Move notation, evaluations | Uses monospace font (`SF Mono`, `Fira Code`, or `Consolas`) |
| 14.2.5 | Letter spacing | Uppercase labels/captions | `tracking-wider` on uppercase text, `tracking-tight` on large headings |

### 14.3 Components & Layout

| # | Test Case | What to Check | Expected Result |
|---|-----------|---------------|-----------------|
| 14.3.1 | Card borders | Card outline/border style | Ring shadow (`box-shadow: 0 0 0 1px`), never Tailwind `border` utility |
| 14.3.2 | Border radius | Cards, buttons, containers | Max `rounded-lg`. Never `rounded-2xl`, `rounded-3xl`, or `rounded-full` on containers |
| 14.3.3 | Button variants | All buttons on page | Only 4 types: primary (silver), secondary (outline), ghost (transparent), danger (rose). No other styles |
| 14.3.4 | Icons | All icons on page | Lucide React icons only. No emoji icons, no FontAwesome, no custom SVG icons |
| 14.3.5 | Transitions | Hover/interact with elements | `transition-colors` only. Never `transition-all` (causes layout jank) |
| 14.3.6 | Z-index | Check for stacking issues | No `z-[9999]` or absurdly high z-index values. Layers should stack naturally |
| 14.3.7 | Spacing consistency | Compare padding/margins across similar elements | Cards, sections, and lists should use consistent spacing throughout the page |

### 14.4 Page-Level Visual Audit

Run this checklist on each major page. Mark pass/fail:

| Page | BG Color | Card Style | Typography | Buttons | Icons | Semantic Colors | No Banned Effects |
|------|----------|------------|------------|---------|-------|----------------|-------------------|
| Home / Landing | | | | | | | |
| Login / Sign Up | | | | | | | |
| Profile | | | | | | | |
| Simple Analytics | | | | | | | |
| Game Analysis | | | | | | | |
| Coach Dashboard | | | | | | | |
| Coach Game Review | | | | | | | |
| Coach Puzzles | | | | | | | |
| Coach Progress | | | | | | | |
| Coach Openings | | | | | | | |
| Coach Study Plan | | | | | | | |
| Coach Play | | | | | | | |
| Pricing | | | | | | | |

---

## 15. UX Quality

These tests evaluate the user experience — not whether features *work*, but whether they feel good, intuitive, and polished.

### 15.1 Navigation & Wayfinding

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 15.1.1 | Breadcrumbs / back navigation | Navigate deep into coach features, then try to go back | Clear path back to parent page. No dead ends |
| 15.1.2 | Current page indicator | Look at nav while on each page | Active nav item is visually highlighted |
| 15.1.3 | Page titles | Check browser tab title on each page | Descriptive title (not just "Chess Analytics" on every page) |
| 15.1.4 | Deep link sharing | Copy URL from any page, open in new tab | Page loads with same state (player, platform, game) |
| 15.1.5 | First-time user flow | Log in with fresh account, no chess accounts linked | Clear guidance on what to do next (link account, search a player) |

### 15.2 Loading & Feedback States

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 15.2.1 | Loading indicators | Trigger any data fetch (import, analysis, page load) | Visible loading state (spinner, skeleton, progress bar) — never a blank screen |
| 15.2.2 | Loading duration feel | Time how long loading states persist | If > 3 seconds, should show progress or a message ("This may take a moment") |
| 15.2.3 | Success feedback | Complete an action (import, save position, link account) | Clear success indicator (toast, checkmark, state change). Not just silently completing |
| 15.2.4 | Error feedback | Trigger an error (bad username, network fail) | Error message is specific and actionable. Not just "Something went wrong" |
| 15.2.5 | Button loading state | Click a submit/action button | Button shows loading state, prevents double-click |
| 15.2.6 | Empty states | View any list/page with no data (new user, no games, no positions) | Friendly empty state with illustration or message + CTA to get started |
| 15.2.7 | Skeleton screens | Load a data-heavy page | Content areas show skeleton placeholders during load, not just a spinner |

### 15.3 Form & Input UX

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 15.3.1 | Input focus states | Tab through form inputs | Clear focus ring/highlight on active input |
| 15.3.2 | Validation timing | Type invalid email, tab away | Validation shown on blur or submit, not on every keystroke |
| 15.3.3 | Error field highlighting | Submit form with errors | The specific field with error is highlighted, not just a generic message |
| 15.3.4 | Placeholder text | Check all input placeholders | Helpful examples (e.g., "e.g., hikaru"), not generic ("Enter text here") |
| 15.3.5 | Autofocus | Open login/signup/search page | First input field is auto-focused, ready to type |
| 15.3.6 | Keyboard submit | Fill form, press Enter | Form submits (not just clicking the button) |

### 15.4 Transitions & Micro-interactions

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 15.4.1 | Page transitions | Navigate between pages | Smooth transition, no flash of unstyled content (FOUC) |
| 15.4.2 | Modal open/close | Open any modal or dialog | Smooth fade/slide in, backdrop dims. Close is equally smooth |
| 15.4.3 | Tooltip behavior | Hover over info icons or abbreviated text | Tooltip appears after brief delay, disappears on mouse leave |
| 15.4.4 | Tab/filter switching | Switch tabs or filters on analytics | Content transitions smoothly, no layout shift |
| 15.4.5 | Chart animations | Load a chart (ELO trend, radar) | Chart animates in on first render (not instantly popping in) |

### 15.5 Information Hierarchy

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 15.5.1 | Visual hierarchy | Glance at any page for 3 seconds | The most important information stands out first (headings, key numbers) |
| 15.5.2 | Data density | View analytics dashboard | Information is dense but not overwhelming. Logical grouping with whitespace |
| 15.5.3 | Progressive disclosure | Complex sections (personality, openings) | Summary visible first, details available on expand/click |
| 15.5.4 | CTAs are obvious | Check upgrade prompts, action buttons | Primary action is visually dominant. Secondary actions are subdued |
| 15.5.5 | Related items grouped | Check card groupings on dashboard/coach | Related data is visually grouped (same card, same section, clear labels) |

### 15.6 Contextual Help

| # | Test Case | Steps | Expected Result |
|---|-----------|-------|-----------------|
| 15.6.1 | Chess jargon explained | Find terms like "centipawn loss", "accuracy", "personality" | Tooltip, info icon, or brief explanation for non-obvious chess terms |
| 15.6.2 | Feature discoverability | Navigate coach features as a new premium user | Each feature has a clear description or onboarding hint |
| 15.6.3 | Metric explanations | Hover/click on stats like "Advantage Conversion Rate" | Explanation of what the metric means and why it matters |

---

## 16. Wording & Copy Review

Run these checks on **every page**. Read all visible text carefully.

### 16.1 Grammar & Spelling

| # | Test Case | What to Check | Expected Result |
|---|-----------|---------------|-----------------|
| 16.1.1 | Spelling | All visible text on page | No typos or misspellings |
| 16.1.2 | Grammar | Sentences, labels, tooltips | Grammatically correct English |
| 16.1.3 | Punctuation | Headings, buttons, labels | Headings: no trailing period. Sentences: proper punctuation. Buttons: no trailing period |
| 16.1.4 | Capitalization | Headings, buttons, nav items | Title Case for headings/nav, Sentence case for descriptions. Consistent throughout |
| 16.1.5 | Placeholder/debug text | Scan all pages | No "TODO", "Lorem ipsum", "test", "asdf", "undefined", or `{variable}` visible |

### 16.2 Tone & Voice

| # | Test Case | What to Check | Expected Result |
|---|-----------|---------------|-----------------|
| 16.2.1 | Professional tone | All user-facing text | Professional but approachable. Not overly casual ("yo!") or corporate ("pursuant to") |
| 16.2.2 | Encouraging coach tone | AI coaching comments, lesson text | Encouraging and educational. Never condescending ("Obviously you should have...") |
| 16.2.3 | Error message tone | All error messages | Empathetic and helpful ("We couldn't find that user"), never blaming ("You entered a wrong username") |
| 16.2.4 | Consistent voice | Compare text across different pages | Same voice/personality throughout. Not formal on one page and casual on another |

### 16.3 Chess Terminology Accuracy

| # | Test Case | What to Check | Expected Result |
|---|-----------|---------------|-----------------|
| 16.3.1 | Move classifications | Labels on move badges | Exactly: brilliant, best, great, excellent, good, acceptable, inaccuracy, mistake, blunder (Chess.com standard) |
| 16.3.2 | Opening names | Opening labels in analytics and coach | Standard names (e.g., "Sicilian Defense: Najdorf Variation", not "Sicilian Najdorf") |
| 16.3.3 | Piece names | AI comments, tooltips | Standard names: king, queen, rook, bishop, knight, pawn. Never "horse" or abbreviated improperly |
| 16.3.4 | Square notation | AI comments referencing squares | Standard algebraic notation (e.g., "e4", "Nf3"). Lowercase file, number rank |
| 16.3.5 | Game result terms | Result indicators | "Win", "Loss", "Draw" (not "Won", "Lost", "Tied") in labels. Past tense in descriptions only |
| 16.3.6 | Rating terminology | Rating displays | "Rating" or "Elo", not "ELO" (it's named after Arpad Elo, not an acronym) |

### 16.4 Consistency Checks

| # | Test Case | What to Check | Expected Result |
|---|-----------|---------------|-----------------|
| 16.4.1 | Platform names | References to chess platforms | Always "Chess.com" (with capital C, period) and "Lichess" (capital L, one word) |
| 16.4.2 | Feature names | Coach feature names across pages | Same name everywhere (e.g., "Game Review" not sometimes "Review" and sometimes "Game Analysis") |
| 16.4.3 | Number formatting | Statistics, percentages, ratings | Consistent format: "1,234" or "1234" (not mixed). Percentages always with "%" sign |
| 16.4.4 | Date formatting | Dates across the app | Consistent format throughout (e.g., always "Mar 27, 2026" or always "2026-03-27", not mixed) |
| 16.4.5 | Action labels | Button text for similar actions | Consistent verbs: "Save" not sometimes "Save" and sometimes "Submit". "Cancel" not sometimes "Close" |
| 16.4.6 | Tier naming | References to subscription tiers | Consistent names: "Free" and "Pro" (not sometimes "Premium", "Starter", or "Basic") |

### 16.5 Wording Audit by Page

Run this on each page. For every piece of text ask: Is it correct? Is it clear? Is it consistent with the rest of the app?

| Page | Headings OK | Labels OK | Buttons OK | Error Messages OK | Tooltips OK | No Placeholder Text |
|------|-------------|-----------|------------|-------------------|-------------|---------------------|
| Home / Landing | | | | | | |
| Login / Sign Up | | | | | | |
| Profile | | | | | | |
| Simple Analytics | | | | | | |
| Game Analysis | | | | | | |
| Coach Dashboard | | | | | | |
| Coach Game Review | | | | | | |
| Coach Puzzles | | | | | | |
| Coach Progress | | | | | | |
| Coach Openings | | | | | | |
| Coach Study Plan | | | | | | |
| Coach Play | | | | | | |
| Pricing | | | | | | |

---

## Appendix A: Test Data Recommendations

### Recommended Test Users

| Platform | Username | Why |
|----------|----------|-----|
| Chess.com | hikaru | Large game history, all time controls |
| Chess.com | GothamChess | Popular, good variety of games |
| Lichess | DrNykterstein | Magnus Carlsen, high-level games |
| Chess.com | (your test account) | Known games for accuracy verification |

### Manual Verification Method

For data accuracy tests, pick 5 random games and manually verify:
1. Open the game on Chess.com/Lichess
2. Compare result, ratings, opening name, date
3. Replay the game move-by-move and check analysis classifications against Chess.com's game review
4. Calculate win rate manually from match history and compare to displayed percentage
5. Check that personality scores make intuitive sense for the player's style

### Test Card Numbers (Stripe Test Mode)

| Card | Result |
|------|--------|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 0002` | Declined |
| `4000 0000 0000 3220` | 3D Secure required |

---

## Appendix B: Bug Report Template

When reporting issues found during testing:

```
**Test Case #:** [e.g., 6.1.2]
**Section:** [e.g., Move Classification Accuracy]
**Severity:** Critical / High / Medium / Low
**Environment:** Browser, OS, screen size, account tier

**Steps to Reproduce:**
1. ...
2. ...
3. ...

**Expected Result:** ...
**Actual Result:** ...
**Screenshots/Evidence:** [attach]
**Game/URL for reproduction:** [link to specific game or page]
```

---

## Appendix C: Testing Priority Order

If time is limited, test in this priority order:

1. **P0 - Critical Path:** Sign up > Link account > Import games > View analytics > Open game analysis
2. **P1 - Visual & Wording:** Design system compliance on every visited page + copy review (catches the most user-facing issues)
3. **P2 - Data Accuracy:** Move classifications, accuracy scores, win rates, ELO trends
4. **P3 - UX Quality:** Loading states, empty states, error feedback, form UX, navigation flow
5. **P4 - Premium Flow:** Pricing > Checkout > Coach access > Game review > Puzzles
6. **P5 - Coach Features:** Progress tracking, openings, study plan, position library
7. **P6 - Edge Cases:** Error handling, mobile, rate limiting, security

### AI Tester Workflow

For an AI tester, the recommended workflow per page is:

1. **Navigate** to the page (via UI clicks, not direct URL)
2. **Screenshot** the page at full viewport
3. **Visual scan** — run Section 14 checklist (colors, typography, components)
4. **Read all text** — run Section 16 checklist (spelling, grammar, tone, consistency)
5. **Functional test** — run the relevant Section 1-13 tests for that page
6. **UX evaluation** — run Section 15 checks (loading states, feedback, hierarchy)
7. **Log all findings** with severity, category, and evidence
