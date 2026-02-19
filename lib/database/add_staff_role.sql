-- Add STAFF to the user_role enum
-- Run this in Supabase SQL Editor

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'STAFF';
