# Chess Sounds Directory

This directory should contain 4 sound files for chess moves:

## Required Files:

1. **move.mp3** - Normal piece movement (e.g., `Nf3`, `e4`, `e8=Q` promotions)
2. **capture.mp3** - Capturing a piece (e.g., `Nxf3`, `exd5`)
3. **castle.mp3** - Castling moves (`O-O`, `O-O-O`)
4. **check.mp3** - King in check or checkmate (e.g., `Qh5+`, `Qh7#`)

## Where to Get Sound Files:

### Option 1: Lichess (Recommended - Free & Open Source)
Visit: https://github.com/lichess-org/lila/tree/master/public/sound

Choose a sound set folder (e.g., `standard/`, `futuristic/`, `lisp/`, `piano/`)

Download these files and rename them:
- `Move.mp3` → `move.mp3`
- `Capture.mp3` → `capture.mp3`
- `CastleShort.mp3` or `CastleLong.mp3` → `castle.mp3`
- `Check.mp3` → `check.mp3`

### Option 2: Freesound.org
Search for "chess sound" at https://freesound.org

### Option 3: Generate Your Own
Use any audio editing software to create subtle sound effects

## File Format:
- Recommended: `.mp3` (default)
- Alternatives: `.ogg`, `.wav` (update `useChessSound.ts` if using different format)

## After Adding Files:
1. Restart your dev server if it's running
2. Navigate to any game analysis page
3. Use arrow keys or buttons to navigate through moves
4. Sounds should play automatically! 🎵

---

For full documentation, see: `CHESS_SOUNDS_IMPLEMENTATION.md` in the project root
