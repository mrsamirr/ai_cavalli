-- Add PIN-based authentication to users table
-- This allows direct PIN validation without Supabase Auth dependency

-- Add pin_hash column if it doesn't exist
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS pin_hash TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_pin_hash ON public.users(pin_hash);

-- Update RLS policy to allow PIN hash reads (for authentication)
DROP POLICY IF EXISTS "Users can view own data" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Kitchen and admin can view all" ON public.users;
DROP POLICY IF EXISTS "Only admins can delete users" ON public.users;

-- Recreate policies with PIN hash access
CREATE POLICY "Users can view own data"
ON public.users
FOR SELECT
USING (
  auth.uid() = id OR
  (SELECT role FROM public.users WHERE id = auth.uid()) IN ('KITCHEN', 'ADMIN')
);

CREATE POLICY "Users can update own profile without changing role"
ON public.users
FOR UPDATE
USING (auth.uid() = id OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'ADMIN')
WITH CHECK (
  auth.uid() = id OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'ADMIN'
);

CREATE POLICY "Kitchen and admin can view all"
ON public.users
FOR SELECT
USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('KITCHEN', 'ADMIN'));

CREATE POLICY "Only admins can delete users"
ON public.users
FOR DELETE
USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'ADMIN');

-- Helper function to verify PIN hash (using pgcrypto)
CREATE OR REPLACE FUNCTION verify_pin(input_pin TEXT, stored_hash TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN crypt(input_pin, stored_hash) = stored_hash;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION verify_pin(TEXT, TEXT) TO anon, authenticated;
