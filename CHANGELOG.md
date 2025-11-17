# Chess Piece Drag Offset Fix and ModernChessArrows Restoration

**Commit:** `8284202` (November 14, 2025)
**Branch:** master

## Overview
Fixed a critical bug where chess pieces appeared far off their dedicated squares when picked up on desktop view. The piece could still be dragged and placed correctly, but the initial lift-up position was incorrect and shifted based on scroll position. Additionally, restored the ModernChessArrows component for proper arrow rendering and centering.

## Problem Description
- **Issue:** When clicking on a chess piece on desktop view, the piece appeared far from its original square
- **Behavior:** The offset increased/decreased based on page scroll position
- **Impact:** Made the chess board difficult to use on desktop, though mobile view was unaffected
- **Root Cause:** A `MutationObserver` that was previously added to remove native arrows was interfering with react-chessboard's drag-and-drop positioning

## Changes Made

### 1. Files Modified
- `src/components/debug/UnifiedChessAnalysis.tsx` (592 lines changed: +212, -439)
- `src/index.css` (59 lines removed)

### 2. UnifiedChessAnalysis.tsx Changes

#### Added Back:
- **ModernChessArrows Import:** Restored the import for custom arrow rendering component
- **userDrawnArrows State:** Re-added state management for user-drawn arrows (right-click drag)
  ```typescript
  const [userDrawnArrows, setUserDrawnArrows] = useState<ModernArrow[]>([])
  ```
- **handleArrowsChange Callback:** Restored the callback to intercept user-drawn arrows from react-chessboard
  - Converts native arrow format to ModernArrow format
  - Sets default color to orange (rgb(255, 170, 0))
  - Marks arrows as user-drawn
- **displayArrows useMemo Update:** Added userDrawnArrows to dependency array and arrow collection logic
- **onArrowsChange Prop:** Re-added to both mobile and desktop Chessboard components
- **ModernChessArrows Component Rendering:** Restored rendering for both mobile and desktop views
  - Only shows when not in follow-up exploration mode
  - Properly positioned with correct board dimensions and orientation

#### Removed:
- **Problematic MutationObserver:** Removed the useEffect that was using MutationObserver to manipulate native arrows
  - This was causing the piece drag offset issue
  - Was interfering with react-chessboard's internal positioning calculations

### 3. src/index.css Changes

#### Removed (59 lines):
- **Native Arrow Hiding Rules:** Removed CSS rules that were hiding react-chessboard's native SVG arrows
  ```css
  /* Removed rules that hid native arrows */
  .react-chessboard svg:not(.modern-chess-arrows) { display: none !important; }
  ```
- **Piece Dragging Fix Attempts:** Removed CSS rules that tried to fix drag positioning with transforms
  ```css
  /* Removed transform overrides that didn't work */
  .react-chessboard { transform: none !important; }
  ```
- **Unused Animation Keyframes:** Removed `liquid-glow-gold` animation that was not being used

### 4. Files Deleted (Cleanup)
- `INVESTIGATION_RESULTS.md` - Unrelated investigation documentation
- `scripts/check-user-data.js` - Diagnostic script for different issue
- `scripts/debug-api-response.js` - API testing script
- `scripts/investigate-invalid-results.js` - Database diagnostic script
- `scripts/investigate-invalid-results.ts` - TypeScript version of diagnostic script
- `scripts/test-live-api.html` - Interactive API tester
- `package.json`: Removed `investigate-results` script entry

## Technical Details

### How ModernChessArrows Works
1. User right-clicks and drags on the chess board
2. `react-chessboard` fires `onArrowsChange` event with arrow data
3. `handleArrowsChange` converts the data to ModernArrow format
4. Arrow data is stored in `userDrawnArrows` state
5. `displayArrows` useMemo combines user arrows with analysis arrows
6. `ModernChessArrows` component renders all arrows with proper centering

### Why the Original Fix Caused Issues
The MutationObserver was watching for DOM changes and manipulating elements, which:
- Interfered with react-dnd's coordinate calculations
- Caused piece positions to be incorrectly calculated relative to scroll position
- Created a conflict between native arrow rendering and custom arrow rendering

### The Solution
Instead of fighting with react-chessboard's native rendering:
1. Let react-chessboard handle the drag-and-drop natively
2. Use `onArrowsChange` to capture arrow data
3. Render arrows separately using ModernChessArrows component
4. No CSS overrides or DOM manipulation needed

## Testing
- ✅ Desktop piece dragging works correctly without offset
- ✅ Mobile piece dragging continues to work
- ✅ Orange arrows appear when right-clicking and dragging
- ✅ Arrows persist after being drawn
- ✅ Only ModernChessArrows are visible (properly centered)
- ✅ No scroll position dependency for piece positioning

## Impact
- **User Experience:** Chess board is now fully functional on desktop
- **Code Quality:** Removed 227 net lines of code (439 deleted, 212 added)
- **Maintainability:** Simpler approach without DOM manipulation
- **Performance:** No MutationObserver overhead

## Lessons Learned
1. **Don't fight the library:** Work with react-chessboard's API instead of manipulating its DOM
2. **MutationObserver can cause issues:** Especially with drag-and-drop libraries that rely on precise coordinate calculations
3. **CSS transforms affect coordinates:** Removing transform overrides was key to fixing the offset
4. **Separation of concerns:** Let react-chessboard handle pieces, use custom component for arrows

## Related Issues
- Original piece offset bug: Pieces appeared far from their squares on desktop
- Duplicate arrows issue: Both native and custom arrows were showing
- Arrow persistence: Arrows disappeared after drawing

## Future Considerations
- Monitor react-chessboard updates for any changes to arrow API
- Consider contributing arrow centering improvements back to react-chessboard
- Keep ModernChessArrows as the single source of arrow rendering
