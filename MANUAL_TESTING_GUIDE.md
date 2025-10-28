# Manual Testing Guide for Game Analysis Page

## Overview
This guide provides a comprehensive checklist for manually testing the game analysis page before production deployment. Test both white and black perspectives to ensure all features work correctly.

## Prerequisites
- Backend server running on localhost:8002
- Frontend server running on localhost:3000
- Test user with analyzed games (e.g., "audingo" on Lichess, "hikaru" on Chess.com)

## Test Scenarios

### 1. Basic Page Load & Navigation
- [ ] Navigate to a game analysis page
- [ ] Page loads without console errors
- [ ] Chessboard renders correctly
- [ ] Move timeline appears
- [ ] Evaluation bar is visible

### 2. Test with White Pieces on Bottom

#### 2.1 Chessboard Functionality
- [ ] Chessboard displays starting position
- [ ] Pieces are oriented correctly (white at bottom, black at top)
- [ ] Board squares have proper colors
- [ ] Piece images render correctly

#### 2.2 Move Navigation
- [ ] Click on moves in the timeline to navigate
- [ ] Board updates to show correct position
- [ ] Current move is highlighted in the timeline
- [ ] Navigation arrows (prev/next) work
- [ ] Keyboard navigation works (arrow keys)

#### 2.3 Move Analysis & Comments
- [ ] Move comments appear for each move
- [ ] Comment accuracy: Check for grammatical errors
- [ ] Comments match the position (e.g., "Takes pawn on e5")
- [ ] Move classifications appear (Excellent, Good, Inaccuracy, Mistake, Blunder)
- [ ] Performance ratings display correctly
- [ ] Chess.com style comments format properly

#### 2.4 Evaluation Bar
- [ ] Evaluation bar updates with each move
- [ ] Bar orientation: White advantage goes up, black advantage goes down
- [ ] Evaluation text displays (e.g., "+0.5", "Mate in 3")
- [ ] Bar animates smoothly between moves
- [ ] Bar color coding is correct (white/black sections)

#### 2.5 Arrows & Suggestions
- [ ] Best move arrow appears (usually green)
- [ ] Mistake arrows appear (usually red) for bad moves
- [ ] Arrows point in the correct direction (from white's perspective)
- [ ] Arrows are visible on the board
- [ ] Arrows update when navigating moves
- [ ] Multiple arrows can appear simultaneously

#### 2.6 Tabs & Additional Features
- [ ] Overview tab displays game summary
- [ ] Positional Analysis tab shows positional elements
- [ ] Critical Moments tab highlights key positions
- [ ] Mistakes tab lists all inaccuracies/mistakes/blunders
- [ ] Opening analysis section displays correctly

### 3. Test with Black Pieces on Bottom (CRITICAL)

#### 3.1 Flip the Board
- [ ] Find and click the "Flip Board" button or equivalent
- [ ] Board rotates so black pieces are at bottom
- [ ] OR navigate to a game where you played as black

#### 3.2 Chessboard Orientation
- [ ] Chessboard displays correctly (black at bottom, white at top)
- [ ] Coordinate labels are correct (a-h flipped)
- [ ] Pieces still render correctly after flip

#### 3.3 Arrow Direction Verification (MOST IMPORTANT)
- [ ] Arrows still point in the correct direction FROM BLACK'S PERSPECTIVE
- [ ] A move from e7 to e5 shows arrow pointing "down" on the flipped board
- [ ] Best move arrows are oriented correctly for black
- [ ] Mistake arrows are oriented correctly for black
- [ ] No arrows appear backwards or inverted

#### 3.4 Evaluation Bar with Black Bottom
- [ ] Evaluation bar still updates correctly
- [ ] Bar orientation remains consistent (white at top, black at bottom)
- [ ] Positive evaluation for white still shows white advantage
- [ ] Negative evaluation still shows black advantage

#### 3.5 Move Navigation & Analysis
- [ ] Move timeline still works correctly
- [ ] Comments still match the position
- [ ] Move classification still appears
- [ ] All tabs still function properly

### 4. Exploration Mode Features

#### 4.1 Free Exploration from Starting Position
- [ ] Navigate to starting position (before any moves)
- [ ] Click "Free Exploration" or equivalent button
- [ ] Blue indicator appears: "Free Exploration Mode"
- [ ] Can move pieces freely on the board
- [ ] Evaluation bar updates based on explored position
- [ ] Green arrow shows best move from explored position

#### 4.2 Follow-Up Move Exploration
- [ ] Navigate to any move in the game
- [ ] Click "Explore Follow-Ups" or similar button
- [ ] Can make moves to explore variations
- [ ] Stockfish analysis runs in real-time
- [ ] Analysis comments update: "From this position, best is..."
- [ ] PV (principal variation) line displays

#### 4.3 Exploration Controls
- [ ] "Undo" button removes last explored move
- [ ] "Reset" button returns to original game position
- [ ] "Exit Exploration" button returns to normal mode
- [ ] Exploration indicator is always visible when active

### 5. Additional Features Testing

#### 5.1 Sound Effects (if enabled)
- [ ] Move sound plays when navigating moves
- [ ] Capture sound plays for captures
- [ ] Check sound plays when king is in check
- [ ] Sounds can be muted/unmuted

#### 5.2 Performance & Responsiveness
- [ ] Page loads in under 3 seconds
- [ ] Move navigation is instant (< 100ms)
- [ ] No lag when flipping board
- [ ] Evaluation bar animates smoothly
- [ ] No memory leaks (check DevTools)

#### 5.3 Mobile/Tablet View (Bonus)
- [ ] Test on iPad Air or similar tablet
- [ ] Chessboard scales appropriately
- [ ] Move timeline is accessible
- [ ] All buttons are tappable
- [ ] Text is readable

### 6. Error Handling

#### 6.1 Network Issues
- [ ] Graceful error message if backend is down
- [ ] Loading indicators appear during analysis
- [ ] Timeout handling works properly

#### 6.2 Invalid Data
- [ ] Page handles games without analysis gracefully
- [ ] Missing move data doesn't crash the page
- [ ] Invalid FEN positions are handled

### 7. Cross-Browser Testing

- [ ] Test in Chrome/Edge (Chromium)
- [ ] Test in Firefox
- [ ] Test in Safari (if available)
- [ ] All features work in all browsers

## Common Issues to Watch For

### Arrow Rendering Issues
- **Backwards arrows**: Arrows pointing the wrong way when board is flipped
- **Missing arrows**: No arrows appearing for best moves
- **Wrong colors**: Green arrows for mistakes or red for best moves
- **Incorrect coordinates**: Arrows not aligning with squares

### Evaluation Bar Issues
- **Inverted evaluation**: Bar going up when position gets worse
- **Wrong orientation**: White/black sections reversed when board flipped
- **Not updating**: Bar stuck on same evaluation
- **Incorrect scaling**: Mate evaluations not displaying properly

### Comment Issues
- **Grammar errors**: Typos, incorrect verb tenses
- **Wrong move**: Comment describing different move than displayed
- **Missing context**: Comment doesn't explain why move is good/bad
- **Formatting**: Broken HTML or unescaped characters

### Exploration Mode Issues
- **Analysis not updating**: Stockfish not running
- **No best move arrow**: Green arrow not appearing
- **Can't undo**: Undo button not working
- **Stuck in mode**: Can't exit exploration mode

## Reporting Issues

When you find an issue, document:
1. **What you were doing**: Specific steps to reproduce
2. **What you expected**: Correct behavior
3. **What happened**: Actual behavior
4. **Board orientation**: White or black at bottom
5. **Screenshots**: Especially for visual issues like arrows
6. **Console errors**: Check browser DevTools console

## Test Completion Checklist

- [ ] All white-bottom tests passed
- [ ] All black-bottom tests passed (especially arrows)
- [ ] Exploration mode fully functional
- [ ] No console errors
- [ ] Comments are accurate and grammatically correct
- [ ] Arrows point in correct directions
- [ ] Evaluation bar works correctly
- [ ] All tabs display properly
- [ ] Performance is acceptable

---

## Quick Test (5 minutes)
If you're short on time, test these critical items:
1. Load a game, verify board and moves work
2. Flip board to black, verify arrows point correctly
3. Test exploration mode from starting position
4. Check move comments for accuracy
5. Verify evaluation bar updates correctly

## Full Test (30 minutes)
Go through all sections systematically, testing each feature thoroughly with both white and black orientations.
