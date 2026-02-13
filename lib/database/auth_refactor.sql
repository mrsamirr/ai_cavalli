-- COMPREHENSIVE AUTH REFACTOR
-- Single unified auth flow with RBAC (Role-Based Access Control)
-- Roles: STUDENT, OUTSIDER, KITCHEN, ADMIN

-- 1. Drop old user_role enum and create new one
DO $$
BEGIN
    -- Drop dependent objects first
    DROP TYPE IF EXISTS user_role CASCADE;
    
    -- Create new role enum
    CREATE TYPE user_role AS ENUM ('STUDENT', 'OUTSIDER', 'KITCHEN', 'ADMIN');
END $$;

-- 2. Recreate users table with unified structure
DROP TABLE IF EXISTS public.users CASCADE;

CREATE TABLE public.users (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    email text UNIQUE NOT NULL,
    phone text UNIQUE NOT NULL,
    name text NOT NULL,
    role user_role NOT NULL DEFAULT 'STUDENT',
    
    -- Additional fields based on role
    parent_name text,           -- For STUDENT only
    position text,              -- For KITCHEN/ADMIN (e.g., "Chef", "Manager")
    
    -- Account lock (anti-brute force)
    failed_login_attempts integer DEFAULT 0,
    locked_until timestamp with time zone,
    
    -- Session management
    last_login timestamp with time zone,
    session_token text,         -- For persistent sessions
    session_expires_at timestamp with time zone,
    
    -- Metadata
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create indexes for performance
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_phone ON public.users(phone);
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_session_token ON public.users(session_token);
CREATE INDEX idx_users_locked_until ON public.users(locked_until);

-- 4. Update guest_sessions to use OUTSIDER role
ALTER TABLE public.guest_sessions 
ADD COLUMN IF NOT EXISTS role text DEFAULT 'OUTSIDER',
ADD COLUMN IF NOT EXISTS session_expires_at timestamp with time zone;

-- 5. Create RLS Policies for Users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Admin can view all users
CREATE POLICY "admins_view_all_users" ON public.users FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role = 'ADMIN'
    )
);

-- Users can view their own profile
CREATE POLICY "users_view_own_profile" ON public.users FOR SELECT
USING (auth.uid() = id);

-- Allow updates to own profile (limited fields)
CREATE POLICY "users_update_own_profile" ON public.users FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
    auth.uid() = id 
    AND role = (SELECT role FROM public.users WHERE id = auth.uid()) -- Can't change own role
);

-- Admins can update users
CREATE POLICY "admins_update_users" ON public.users FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role = 'ADMIN'
    )
);

-- 6. Update RLS for guest_sessions
ALTER TABLE public.guest_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own sessions" ON public.guest_sessions;
DROP POLICY IF EXISTS "Users can insert own sessions" ON public.guest_sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON public.guest_sessions;
DROP POLICY IF EXISTS "Staff manage all sessions" ON public.guest_sessions;

-- Guests can view their own session
CREATE POLICY "guests_view_own_session" ON public.guest_sessions FOR SELECT
USING (auth.uid() = user_id OR auth.uid() IS NULL);

-- Kitchen staff can view all sessions
CREATE POLICY "kitchen_view_all_sessions" ON public.guest_sessions FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role IN ('KITCHEN', 'ADMIN')
    )
);

-- Guests can insert their session
CREATE POLICY "guests_insert_session" ON public.guest_sessions FOR INSERT
WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL);

-- Guests can update their own session
CREATE POLICY "guests_update_own_session" ON public.guest_sessions FOR UPDATE
USING (auth.uid() = user_id OR auth.uid() IS NULL);

-- Kitchen/Admin can manage all sessions
CREATE POLICY "kitchen_manage_all_sessions" ON public.guest_sessions FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role IN ('KITCHEN', 'ADMIN')
    )
);

-- 7. Create audit log table for security
CREATE TABLE IF NOT EXISTS public.auth_audit_log (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES public.users(id),
    action text NOT NULL,
    details jsonb,
    ip_address text,
    user_agent text,
    success boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX idx_audit_user_id ON public.auth_audit_log(user_id);
CREATE INDEX idx_audit_action ON public.auth_audit_log(action);
CREATE INDEX idx_audit_created_at ON public.auth_audit_log(created_at);

-- 8. Update orders table RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Staff view all orders" ON public.orders;
DROP POLICY IF EXISTS "Users can insert own orders" ON public.orders;

-- Students and Outsiders can view their own orders
CREATE POLICY "users_view_own_orders" ON public.orders FOR SELECT
USING (auth.uid() = user_id);

-- Kitchen/Admin can view all orders
CREATE POLICY "kitchen_view_all_orders" ON public.orders FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role IN ('KITCHEN', 'ADMIN')
    )
);

-- Users can insert orders
CREATE POLICY "users_insert_orders" ON public.orders FOR INSERT
WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL);

-- 9. Update order_items table RLS
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own order items" ON public.order_items;
DROP POLICY IF EXISTS "Staff view all order items" ON public.order_items;

CREATE POLICY "users_view_own_order_items" ON public.order_items FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.orders
        WHERE orders.id = order_items.order_id
        AND (orders.user_id = auth.uid() OR auth.uid() IS NULL)
    )
);

CREATE POLICY "kitchen_view_all_order_items" ON public.order_items FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role IN ('KITCHEN', 'ADMIN')
    )
);

-- 10. Create auth_logs table for detailed tracking
CREATE TABLE IF NOT EXISTS public.auth_logs (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES public.users(id),
    event_type text NOT NULL, -- 'login', 'logout', 'token_refresh', 'failed_login', 'session_expire'
    status text NOT NULL DEFAULT 'success', -- 'success', 'failed'
    reason text, -- failure reason
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX idx_auth_logs_user_id ON public.auth_logs(user_id);
CREATE INDEX idx_auth_logs_event_type ON public.auth_logs(event_type);
CREATE INDEX idx_auth_logs_created_at ON public.auth_logs(created_at);

-- 11. Grant appropriate permissions
GRANT SELECT ON public.users TO authenticated;
GRANT UPDATE ON public.users TO authenticated;
GRANT SELECT ON public.guest_sessions TO authenticated;
GRANT INSERT ON public.guest_sessions TO authenticated;
GRANT UPDATE ON public.guest_sessions TO authenticated;
GRANT SELECT ON public.orders TO authenticated;
GRANT INSERT ON public.orders TO authenticated;
GRANT SELECT ON public.order_items TO authenticated;
GRANT INSERT ON public.auth_logs TO authenticated;

-- Note: Supabase will handle password hashing via auth.users table
-- This table is for additional user metadata and session management
