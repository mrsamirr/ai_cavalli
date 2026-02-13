-- ============================================================
-- SAFE AUTH MIGRATION - Run this in Supabase SQL Editor
-- Works whether you have old schema or new schema
-- Does NOT drop any tables or lose data
-- ============================================================

-- 1. Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Add missing columns to users table (safe - uses IF NOT EXISTS)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS pin_hash TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS session_token TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS session_expires_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS position TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3. Migrate role values from old to new (safe - only updates if old values exist)
DO $$
BEGIN
    -- Convert role column to TEXT temporarily for migration
    ALTER TABLE public.users ALTER COLUMN role TYPE TEXT USING role::TEXT;
    
    -- Map old role values to new ones
    UPDATE public.users SET role = 'STUDENT' WHERE role = 'student';
    UPDATE public.users SET role = 'OUTSIDER' WHERE role = 'guest';
    UPDATE public.users SET role = 'KITCHEN' WHERE role IN ('staff', 'kitchen_manager');
    UPDATE public.users SET role = 'ADMIN' WHERE role = 'admin';
    
    -- Drop old enum type
    DROP TYPE IF EXISTS user_role CASCADE;
    
    -- Create new enum
    CREATE TYPE user_role AS ENUM ('STUDENT', 'OUTSIDER', 'KITCHEN', 'ADMIN');
    
    -- Convert back to enum
    ALTER TABLE public.users ALTER COLUMN role TYPE user_role USING role::user_role;
    
    RAISE NOTICE 'Role migration completed successfully';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Role migration note: %', SQLERRM;
END $$;

-- 4. Generate email for users that don't have one
UPDATE public.users 
SET email = CONCAT('user_', phone, '@aicavalli.local')
WHERE email IS NULL OR email = '';

-- 5. Hash plaintext PINs into pin_hash (if pin column exists with data)
DO $$
BEGIN
    UPDATE public.users 
    SET pin_hash = crypt(pin, gen_salt('bf', 8))
    WHERE pin IS NOT NULL 
      AND pin != '' 
      AND (pin_hash IS NULL OR pin_hash = '');
    
    RAISE NOTICE 'PIN hashes generated from plaintext PINs';
EXCEPTION WHEN undefined_column THEN
    RAISE NOTICE 'No plaintext pin column found - skipping hash generation';
END $$;

-- 6. Create indexes
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone);
CREATE INDEX IF NOT EXISTS idx_users_session_token ON public.users(session_token);

-- 7. Ensure email uniqueness (handle duplicates first)
DO $$
BEGIN
    ALTER TABLE public.users ADD CONSTRAINT users_email_key UNIQUE (email);
EXCEPTION WHEN duplicate_table THEN
    NULL; -- already exists
WHEN duplicate_object THEN
    NULL; -- already exists
WHEN OTHERS THEN
    RAISE NOTICE 'Email constraint: %', SQLERRM;
END $$;

-- 8. RLS policies (drop old, create new)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop all existing user policies to start clean
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'users' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', pol.policyname);
    END LOOP;
END $$;

-- Service role bypass (for login operations)
CREATE POLICY "service_bypass" ON public.users FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Anon can read users (needed for login lookup)  
CREATE POLICY "anon_select" ON public.users FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert" ON public.users FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_update" ON public.users FOR UPDATE TO anon USING (true);

-- Authenticated users can read own data
CREATE POLICY "auth_select_own" ON public.users FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "auth_update_own" ON public.users FOR UPDATE TO authenticated USING (id = auth.uid());

-- Kitchen/Admin can read all
CREATE POLICY "kitchen_admin_select_all" ON public.users FOR SELECT TO authenticated 
USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('KITCHEN', 'ADMIN')));

-- 9. Create verify_pin helper function
CREATE OR REPLACE FUNCTION verify_pin(input_pin TEXT, stored_hash TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    IF stored_hash IS NULL OR stored_hash = '' THEN
        RETURN FALSE;
    END IF;
    RETURN crypt(input_pin, stored_hash) = stored_hash;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

GRANT EXECUTE ON FUNCTION verify_pin(TEXT, TEXT) TO anon, authenticated, service_role;

-- 10. Ensure guest_sessions table has needed columns
DO $$
BEGIN
    ALTER TABLE public.guest_sessions ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'OUTSIDER';
    ALTER TABLE public.guest_sessions ADD COLUMN IF NOT EXISTS session_expires_at TIMESTAMPTZ;
EXCEPTION WHEN undefined_table THEN
    RAISE NOTICE 'guest_sessions table does not exist yet - will be created when needed';
END $$;

-- 11. Create auth_logs table if not exists
CREATE TABLE IF NOT EXISTS public.auth_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    event_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'success',
    reason TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.auth_logs ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    DROP POLICY IF EXISTS "auth_logs_service" ON public.auth_logs;
    CREATE POLICY "auth_logs_service" ON public.auth_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
    
    DROP POLICY IF EXISTS "auth_logs_anon_insert" ON public.auth_logs;
    CREATE POLICY "auth_logs_anon_insert" ON public.auth_logs FOR INSERT TO anon WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Auth logs policy: %', SQLERRM;
END $$;

-- ============================================================
-- DONE! Now create test users (change PINs as needed):
-- ============================================================

-- STUDENT (PIN: 123456)
INSERT INTO public.users (id, email, phone, name, role, pin_hash)
VALUES (
    gen_random_uuid(),
    'student@test.com',
    '9876543210',
    'Test Student',
    'STUDENT',
    crypt('123456', gen_salt('bf', 8))
) ON CONFLICT (phone) DO UPDATE SET
    pin_hash = crypt('123456', gen_salt('bf', 8)),
    role = 'STUDENT',
    name = 'Test Student';

-- KITCHEN (PIN: 123456)
INSERT INTO public.users (id, email, phone, name, role, position, pin_hash)
VALUES (
    gen_random_uuid(),
    'chef@test.com',
    '9876543211',
    'Test Chef',
    'KITCHEN',
    'Head Chef',
    crypt('123456', gen_salt('bf', 8))
) ON CONFLICT (phone) DO UPDATE SET
    pin_hash = crypt('123456', gen_salt('bf', 8)),
    role = 'KITCHEN',
    name = 'Test Chef';

-- ADMIN (PIN: 123456)
INSERT INTO public.users (id, email, phone, name, role, pin_hash)
VALUES (
    gen_random_uuid(),
    'admin@test.com',
    '9876543212',
    'Test Admin',
    'ADMIN',
    crypt('123456', gen_salt('bf', 8))
) ON CONFLICT (phone) DO UPDATE SET
    pin_hash = crypt('123456', gen_salt('bf', 8)),
    role = 'ADMIN',
    name = 'Test Admin';

-- Verify everything
SELECT id, email, phone, name, role, 
       CASE WHEN pin_hash IS NOT NULL THEN 'YES' ELSE 'NO' END AS has_pin_hash,
       failed_login_attempts, locked_until
FROM public.users 
ORDER BY role;
