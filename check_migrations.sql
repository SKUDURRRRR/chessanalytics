-- Check which migrations have been applied
SELECT * FROM supabase_migrations.schema_migrations
ORDER BY version DESC
LIMIT 10;
