-- ============================================================================
-- QUICK FIX: Create authenticated_users table and trigger
-- Run this in Supabase SQL Editor if migrations haven't been applied
-- ============================================================================

-- 1. Create authenticated_users table
CREATE TABLE IF NOT EXISTS public.authenticated_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    account_tier TEXT NOT NULL DEFAULT 'free' CHECK (account_tier IN ('free', 'pro', 'enterprise')),
    subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'cancelled', 'expired', 'trialing')),
    stripe_customer_id TEXT UNIQUE,
    stripe_subscription_id TEXT,
    subscription_end_date TIMESTAMPTZ
);

-- 2. Create indexes
CREATE INDEX IF NOT EXISTS idx_authenticated_users_stripe_customer ON public.authenticated_users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_authenticated_users_account_tier ON public.authenticated_users(account_tier);

-- 3. Enable RLS
ALTER TABLE public.authenticated_users ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON public.authenticated_users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.authenticated_users;
DROP POLICY IF EXISTS "Users can insert own profile on signup" ON public.authenticated_users;
DROP POLICY IF EXISTS "Service role full access" ON public.authenticated_users;

-- 5. Create RLS Policies
CREATE POLICY "Users can view own profile" ON public.authenticated_users
    FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.authenticated_users
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile on signup" ON public.authenticated_users
    FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Service role full access" ON public.authenticated_users
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 6. Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.authenticated_users TO authenticated;
GRANT ALL ON public.authenticated_users TO service_role;
GRANT ALL ON public.authenticated_users TO postgres;

-- 7. Create function to auto-create authenticated_users entry
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER  -- This is critical - runs with elevated privileges
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.authenticated_users (id, account_tier, subscription_status)
    VALUES (NEW.id, 'free', 'active')
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;

-- 8. Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 9. Backfill existing users (creates authenticated_users for existing auth.users)
INSERT INTO public.authenticated_users (id, account_tier, subscription_status)
SELECT
    au.id,
    'free',
    'active'
FROM auth.users au
LEFT JOIN public.authenticated_users pu ON au.id = pu.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 10. Verify setup
SELECT 'Setup complete!' as status,
       (SELECT COUNT(*) FROM auth.users) as total_auth_users,
       (SELECT COUNT(*) FROM public.authenticated_users) as total_authenticated_users;
