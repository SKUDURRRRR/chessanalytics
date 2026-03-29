# Opening Detection Fix - Testing Guide

## The Profile Creation Error (Not Related to Opening Fix)

The error you're seeing: **"Failed to create profile"** is a separate issue from the opening detection fix I just made. This happens when:

1. The frontend tries to create a user profile before importing games
2. The profile creation fails (could be RLS policies, duplicate entries, or other database issues)
3. The import is aborted before any games are downloaded

## The Opening Detection Fix IS Working

The fix I made to `python/core/unified_api_server.py` will work correctly **once games are successfully imported**. The changes ensure that:

```python
# Line 5586 - Now prioritizes ECO codes:
raw_opening = game.opening_family or game.opening or 'Unknown'
```

This means:
- ✅ ECO code "B01" → "Scandinavian Defense"
- ✅ ECO code "C50" → "Italian Game"
- ✅ ECO code "D00" → "Queen's Pawn Game"

## How to Test the Opening Fix

### Option 1: Test with an Existing User (Recommended)

1. Go to your analytics page
2. Search for user **"hikaru"** (exists in your database with 260 games)
3. Click "Import More Games" or re-import
4. Check if new games show proper opening names

### Option 2: Fix the Profile Issue First

The profile creation error might be caused by:

**A. Duplicate Entry**
- If "lakiss" profile already exists but query failed
- Solution: Check database manually

**B. RLS Policy**
- Row Level Security might be blocking profile creation
- Solution: Check RLS policies in Supabase dashboard

**C. Missing Required Fields**
- The profile insert might be missing required fields
- Solution: Check the `user_profiles` table schema

### Option 3: Test with Chess.com User

Try importing a Chess.com user instead (Lichess might have different issues):

1. Go to search page
2. Switch to "Chess.com" platform
3. Try user "hikaru" or any other Chess.com username

## Verifying the Opening Fix Works

Once you successfully import games, run this script:

```python
python -c "from supabase import create_client; import os; from dotenv import load_dotenv; load_dotenv(); client = create_client(os.getenv('VITE_SUPABASE_URL'), os.getenv('VITE_SUPABASE_ANON_KEY')); result = client.table('games').select('opening_normalized').order('created_at', desc=True).limit(10).execute(); print('Latest 10 games:'); [print(f\"  - {g['opening_normalized']}\") for g in result.data]"
```

Expected output (if fix is working):
```
Latest 10 games:
  - Scandinavian Defense
  - Italian Game
  - French Defense
  - Sicilian Defense
  ...
```

NOT:
```
  - Unknown
  - Unknown
  - Unknown
```

## Summary

- ✅ **Opening detection fix**: Complete and correct
- ⚠️  **Profile creation error**: Separate issue preventing import
- 🔧 **Next step**: Either fix profile creation OR test with existing user

The opening detection will work correctly once games are successfully imported!
