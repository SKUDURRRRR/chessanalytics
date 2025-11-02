"""
Apply the usage columns migration to Supabase database
This script adds the missing columns to authenticated_users table
"""
import os
import sys

# Set UTF-8 encoding for Windows console
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

def apply_migration():
    # Read environment variables
    supabase_url = os.environ.get('SUPABASE_URL')
    supabase_service_key = os.environ.get('SUPABASE_SERVICE_KEY')

    if not supabase_url or not supabase_service_key:
        print("[X] Error: SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables must be set")
        print("\nPlease set them in your environment or .env file:")
        print("  SUPABASE_URL=https://your-project-id.supabase.co")
        print("  SUPABASE_SERVICE_KEY=your-service-key")
        return False

    print(f"[*] Connecting to Supabase: {supabase_url}")

    try:
        # Read migration file
        with open('supabase/migrations/20251102000012_add_usage_columns_to_authenticated_users.sql', 'r') as f:
            migration_sql = f.read()

        print("[*] Reading migration file...")

        # Execute the migration SQL
        # Note: Supabase Python client doesn't have direct SQL execution
        # We need to use the REST API or PostgREST
        # For now, let's print the SQL and guide the user to apply it manually

        print("\n" + "="*80)
        print("[!] The Supabase Python client doesn't support direct SQL execution.")
        print("Please apply this migration manually via the Supabase Dashboard:")
        print("="*80)
        print("\n1. Go to: https://supabase.com/dashboard")
        print("2. Select your project")
        print("3. Navigate to: SQL Editor")
        print("4. Paste and run the following SQL:\n")
        print("-"*80)
        print(migration_sql)
        print("-"*80)

        print("\n[OK] After running the SQL, your import games error should be fixed!")
        return True

    except Exception as e:
        print(f"[X] Error: {e}")
        return False

if __name__ == "__main__":
    print("="*80)
    print("  Supabase Migration: Add Usage Tracking Columns")
    print("="*80)
    print()

    apply_migration()
