#!/usr/bin/env python3
"""
Fix game_analyses constraint to allow re-analysis.

This script fixes the database constraint that's preventing game re-analysis.
The issue: The database has a unique constraint on (user_id, platform, game_id)
but the code expects (user_id, platform, game_id, analysis_type).
"""

import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "python"))

from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get Supabase credentials
SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("VITE_SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("❌ Error: VITE_SUPABASE_URL and VITE_SUPABASE_SERVICE_ROLE_KEY must be set")
    print("   Check your .env.local file")
    sys.exit(1)

def main():
    print("="*80)
    print("FIX GAME RE-ANALYSIS CONSTRAINT")
    print("="*80)
    print()
    print("This script will fix the database constraint that prevents re-analyzing games.")
    print()
    print("⚠️  WARNING: This will modify your database schema!")
    print()
    
    response = input("Do you want to continue? (yes/no): ").strip().lower()
    if response != "yes":
        print("❌ Aborted by user")
        sys.exit(0)
    
    print()
    print("Connecting to Supabase...")
    
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        print("✅ Connected to Supabase")
        print()
        
        # Read the migration file
        migration_path = Path(__file__).parent.parent / "supabase" / "migrations" / "20250111000001_fix_game_analyses_constraint.sql"
        
        if not migration_path.exists():
            print(f"❌ Error: Migration file not found at {migration_path}")
            sys.exit(1)
        
        with open(migration_path, 'r') as f:
            migration_sql = f.read()
        
        print("Applying migration...")
        print("-" * 80)
        
        # Execute the migration
        # Note: Supabase Python client doesn't directly support raw SQL with multiple statements
        # So we'll need to use the REST API or break it into parts
        
        # First, let's check what constraints exist
        print("📋 Checking current constraints...")
        
        check_sql = """
        SELECT conname, contype
        FROM pg_constraint 
        WHERE conrelid = 'public.game_analyses'::regclass 
        AND contype = 'u'
        """
        
        result = supabase.rpc('exec_sql', {'query': check_sql}).execute()
        print(f"Current constraints: {result.data}")
        
        print()
        print("⚠️  MANUAL STEP REQUIRED:")
        print("=" * 80)
        print()
        print("The Supabase Python client doesn't support complex DDL migrations.")
        print("Please apply the migration manually using one of these methods:")
        print()
        print("METHOD 1: Supabase Dashboard (Recommended)")
        print("-" * 80)
        print("1. Go to: https://supabase.com/dashboard")
        print("2. Select your project")
        print("3. Click on 'SQL Editor' in the left sidebar")
        print("4. Create a new query")
        print("5. Paste the SQL below")
        print("6. Click 'Run'")
        print()
        print("SQL TO RUN:")
        print("=" * 80)
        print(migration_sql)
        print("=" * 80)
        print()
        print("METHOD 2: Command Line (Advanced)")
        print("-" * 80)
        print("If you have psql installed:")
        print(f"psql '{SUPABASE_URL}/db' -c \"$(cat {migration_path})\"")
        print()
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()

