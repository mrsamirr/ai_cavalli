-- FIX: Add missing RLS policies for order_items editing
-- Problem: Staff can SELECT but cannot UPDATE, INSERT, or DELETE order_items
-- This prevents kitchen managers from editing orders

-- Allow staff to UPDATE order items (for quantity changes)
DROP POLICY IF EXISTS "Staff update order items" ON public.order_items;
CREATE POLICY "Staff update order items" ON public.order_items FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('staff', 'kitchen_manager', 'admin')))
WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('staff', 'kitchen_manager', 'admin')));

-- Allow staff to DELETE order items (for removing items from orders)
DROP POLICY IF EXISTS "Staff delete order items" ON public.order_items;
CREATE POLICY "Staff delete order items" ON public.order_items FOR DELETE
USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('staff', 'kitchen_manager', 'admin')));

-- Allow staff to INSERT order items (for adding items to orders)
DROP POLICY IF EXISTS "Staff insert order items" ON public.order_items;
CREATE POLICY "Staff insert order items" ON public.order_items FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('staff', 'kitchen_manager', 'admin')));

-- Verify RLS is enabled
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
