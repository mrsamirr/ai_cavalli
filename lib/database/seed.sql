-- USERS (Password is PIN)
-- Student: 1234567890 / 123456
INSERT INTO public.users (phone, pin, name, role, parent_name)
VALUES 
('1234567890', '123456', 'Alice Student', 'student', 'Parent One'),
('9876543210', '123456', 'Bob Staff', 'staff', null),
('5555555555', '123456', 'K chef', 'kitchen_manager', null),
('0000000000', '123456', 'Admin User', 'admin', null)
ON CONFLICT (phone) DO NOTHING;

-- CATEGORIES
INSERT INTO public.categories (name, sort_order) VALUES
('Starters', 1),
('Mains', 2),
('Desserts', 3),
('Drinks', 4)
ON CONFLICT DO NOTHING;

-- MENU ITEMS (Assuming categories exist, this might be tricky with UUIDs in pure SQL without knowing IDs)
-- We will use a DO block to insert items dynamically based on category names

DO $$
DECLARE
  cat_starters uuid;
  cat_mains uuid;
  cat_desserts uuid;
  cat_drinks uuid;
BEGIN
  SELECT id INTO cat_starters FROM public.categories WHERE name = 'Starters' LIMIT 1;
  SELECT id INTO cat_mains FROM public.categories WHERE name = 'Mains' LIMIT 1;
  SELECT id INTO cat_desserts FROM public.categories WHERE name = 'Desserts' LIMIT 1;
  SELECT id INTO cat_drinks FROM public.categories WHERE name = 'Drinks' LIMIT 1;

  INSERT INTO public.menu_items (category_id, name, description, price, available) VALUES
  (cat_starters, 'Bruschetta', 'Toasted bread with tomatoes and basil', 8.50, true),
  (cat_mains, 'Pasta Carbonara', 'Traditional Roman pasta with egg and cheese', 16.00, true),
  (cat_mains, 'Margherita Pizza', 'Tomato sauce, mozzarella, and basil', 14.00, true),
  (cat_desserts, 'Tiramisu', 'Coffee-flavoured Italian dessert', 9.00, true),
  (cat_drinks, 'Espresso', 'Strong italian coffee', 3.00, true);
END $$;

-- DAILY SPECIALS
-- Insert a special for today if not exists
DO $$
DECLARE
  item_id uuid;
BEGIN
  SELECT id INTO item_id FROM public.menu_items WHERE name = 'Pasta Carbonara' LIMIT 1;
  
  IF item_id IS NOT NULL THEN
    INSERT INTO public.daily_specials (date, period, menu_item_id)
    VALUES (CURRENT_DATE, 'lunch', item_id)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ANNOUNCEMENTS
INSERT INTO public.announcements (title, description, active)
VALUES 
('Welcome to Ai Cavalli!', 'Order your food directly from this app.', true)
ON CONFLICT DO NOTHING;
