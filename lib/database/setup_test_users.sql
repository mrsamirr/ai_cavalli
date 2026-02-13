-- Test User Setup Script for Ai Cavalli
-- Run this SQL in Supabase SQL Editor (after running add_pin_auth.sql)
-- 
-- This creates test users with PIN: 123456 for all users
-- Modify the email, phone, and name as needed

-- Create STUDENT user
INSERT INTO public.users (id, email, phone, name, role, pin_hash)
VALUES (
    gen_random_uuid(),
    'student@test.com',
    '9876543210',
    'Test Student',
    'STUDENT',
    crypt('123456', gen_salt('bf', 8))
)
ON CONFLICT (email) DO UPDATE SET
    pin_hash = crypt('123456', gen_salt('bf', 8)),
    role = 'STUDENT';

-- Create KITCHEN user
INSERT INTO public.users (id, email, phone, name, role, position, pin_hash)
VALUES (
    gen_random_uuid(),
    'chef@test.com',
    '9876543211',
    'Test Chef',
    'KITCHEN',
    'Head Chef',
    crypt('123456', gen_salt('bf', 8))
)
ON CONFLICT (email) DO UPDATE SET
    pin_hash = crypt('123456', gen_salt('bf', 8)),
    role = 'KITCHEN',
    position = 'Head Chef';

-- Create ADMIN user
INSERT INTO public.users (id, email, phone, name, role, pin_hash)
VALUES (
    gen_random_uuid(),
    'admin@test.com',
    '9876543212',
    'Test Admin',
    'ADMIN',
    crypt('123456', gen_salt('bf', 8))
)
ON CONFLICT (email) DO UPDATE SET
    pin_hash = crypt('123456', gen_salt('bf', 8)),
    role = 'ADMIN';

-- Verify users were created
SELECT email, phone, name, role, pin_hash FROM public.users 
WHERE email IN ('student@test.com', 'chef@test.com', 'admin@test.com');
