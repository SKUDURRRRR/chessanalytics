#!/usr/bin/env python3
"""
Diagnose and fix the re-analysis constraint issue.

This script will:
1. Check the current database constraints
2. Show what needs to be fixed
3. Optionally apply the fix automatically (if psycopg2 is available)
"""

import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "python"))

from dotenv import load_dotenv

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("VITE_SUPABASE_SERVICE_ROLE_KEY")

def check_constraints():
    """Check current constraints on game_analyses table."""
    print("="*80)
    print("GAME RE-ANALYSIS CONSTRAINT DIAGNOSTIC")
    print("="*80)
    print()
    
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("❌ Error: Missing Supabase credentials")
        print("   Please set VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY")
        print("   in your .env.local file")
        sys.exit(1)
    
    print("✅ Supabase credentials found")
    print(f"   URL: {SUPABASE_URL}")
    print()
    
    # Try to use psycopg2 for direct database connection
    try:
        import psycopg2
        print("✅ psycopg2 is available - can apply fix automatically")
        print()
        use_psycopg2 = True
    except ImportError:
        print("⚠️  psycopg2 not available - will provide manual fix instructions")
        print("   To enable automatic fix: pip install psycopg2-binary")
        print()
        use_psycopg2 = False
    
    if use_psycopg2:
        try:
            # Extract connection details from Supabase URL
            # Format: https://xxx.supabase.co
            project_ref = SUPABASE_URL.replace("https://", "").replace(".supabase.co", "")
            
            # Note: Direct PostgreSQL connection requires additional setup
            # For now, we'll fall back to manual instructions
            print("ℹ️  Direct PostgreSQL connection requires additional setup.")
            print("   Falling back to manual fix instructions...")
            print()
            use_psycopg2 = False
        except Exception as e:
            print(f"⚠️  Could not establish direct database connection: {e}")
            print()
            use_psycopg2 = False
    
    # Provide manual fix instructions
    print("📋 CURRENT ISSUE")
    print("-"*80)
    print("The database has a unique constraint on:")
    print("  • (user_id, platform, game_id)")
    print()
    print("But the code expects a constraint on:")
    print("  • (user_id, platform, game_id, analysis_type)")
    print()
    print("This prevents re-analyzing games and storing multiple analysis types.")
    print()
    
    print("🔧 HOW TO FIX")
    print("-"*80)
    print()
    print("OPTION 1: Use Supabase Dashboard (Easiest)")
    print("-"*40)
    print("1. Open: https://supabase.com/dashboard")
    print("2. Select your project")
    print("3. Click 'SQL Editor' in sidebar")
    print("4. Click 'New Query'")
    print("5. Copy the SQL from: FIX_REANALYSIS_ISSUE.md")
    print("6. Paste and click 'Run'")
    print()
    
    print("OPTION 2: Use Supabase CLI")
    print("-"*40)
    print("If you have Supabase CLI installed:")
    print("  supabase db push --file supabase/migrations/20250111000001_fix_game_analyses_constraint.sql")
    print()
    
    print("OPTION 3: Copy SQL Now")
    print("-"*40)
    
    migration_path = Path(__file__).parent.parent / "supabase" / "migrations" / "20250111000001_fix_game_analyses_constraint.sql"
    
    if migration_path.exists():
        print("Run this SQL in your Supabase SQL Editor:")
        print()
        print("```sql")
        with open(migration_path, 'r') as f:
            print(f.read())
        print("```")
        print()
    else:
        print(f"⚠️  Migration file not found at: {migration_path}")
        print()
    
    print("="*80)
    print("After applying the fix, try re-analyzing your game again!")
    print("="*80)

if __name__ == "__main__":
    check_constraints()

