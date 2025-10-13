# Game Reanalysis Quick Start Guide

## 🚨 Can't Reanalyze Games? Do This First!

If you see errors like `duplicate key value violates unique constraint` when trying to reanalyze games, you need to update your database. **This is a one-time fix that takes 30 seconds.**

## Quick Fix (3 Steps)

### Step 1: Open Supabase SQL Editor
1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** in the left menu

### Step 2: Run the Migration
1. Click **+ New Query**
2. Copy the entire contents of `supabase/migrations/20250111000001_fix_game_analyses_constraint.sql`
3. Paste into the editor
4. Click **Run** (or press F5)

### Step 3: Verify It Worked
You should see messages like:
```
NOTICE:  Dropped constraint: ...
Query completed successfully
```

That's it! ✅

## Now Try Reanalysis Again

Go back to your app and try reanalyzing a game. It should work now!

## What This Does

- Allows you to reanalyze the same game multiple times
- Enables different analysis types (basic, stockfish, deep) for the same game
- Fixes the "duplicate key" error
- Preserves all your existing analysis data

## Troubleshooting

### ❌ "permission denied"
- Make sure you're logged into the correct Supabase project
- Check that you have admin access to the project

### ❌ "relation does not exist"
- Your database might be missing tables
- Run the other migrations in `supabase/migrations/` first

### ❌ Still getting duplicate key errors after migration
- Check the backend logs for `[PERSISTENCE]` messages
- The game might not exist in the `games` table - import it first
- Contact support if the issue persists

## Technical Details

For a detailed explanation of what changed and why, see [FIX_REANALYSIS_ISSUE.md](FIX_REANALYSIS_ISSUE.md).

## Recent Performance Improvements ⚡

This update also includes:
- **3-4x faster analysis** - Railway hobby settings now properly applied
- **Better error messages** - Clear guidance when things go wrong
- **Consistent configuration** - All analysis types use optimized settings

Enjoy faster and more reliable game analysis!

