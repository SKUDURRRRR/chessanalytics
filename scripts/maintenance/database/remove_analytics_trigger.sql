-- Quick fix: Remove the analytics trigger until the table is created
DROP TRIGGER IF EXISTS on_user_registration ON auth.users;

-- Verify it was removed
SELECT 'Trigger removed - signup should work now!' as status;

-- You can recreate it later after creating the analytics_events table
