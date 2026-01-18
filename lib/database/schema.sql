-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- USERS TABLE
create type user_role as enum ('student', 'staff', 'kitchen_manager', 'admin');

create table public.users (
  id uuid primary key default uuid_generate_v4(),
  phone text unique not null,
  pin text not null, -- Plain text PIN as per requirement (though not secure, requested by user)
  name text not null,
  role user_role not null default 'student',
  parent_name text, -- Only for students
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- MENU CATEGORIES
create table public.categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  sort_order integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- MENU ITEMS
create table public.menu_items (
  id uuid primary key default uuid_generate_v4(),
  category_id uuid references public.categories(id),
  name text not null,
  description text,
  price decimal(10,2) not null,
  image_url text,
  available boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- DAILY SPECIALS
create type special_period as enum ('breakfast', 'lunch');

create table public.daily_specials (
  id uuid primary key default uuid_generate_v4(),
  date date not null default current_date,
  period special_period not null,
  menu_item_id uuid references public.menu_items(id) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (date, period, menu_item_id)
);

-- ANNOUNCEMENTS (Home Page)
create table public.announcements (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  image_url text,
  link text,
  active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ORDERS
create type order_status as enum ('pending', 'preparing', 'ready', 'completed', 'cancelled');

create table public.orders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id), -- Nullable for guests
  guest_info jsonb, -- { name: string, phone: string } for guests
  table_name text not null,
  status order_status default 'pending',
  total decimal(10,2) not null default 0,
  discount_amount decimal(10,2) default 0,
  ready_in_minutes integer, -- 15, 30, 60
  notes text, -- User comments
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ORDER ITEMS
create table public.order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid references public.orders(id) on delete cascade not null,
  menu_item_id uuid references public.menu_items(id) not null,
  quantity integer not null default 1,
  price decimal(10,2) not null, -- Price at time of order
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS POLICIES (Basic Setup)
alter table public.users enable row level security;
alter table public.categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.daily_specials enable row level security;
alter table public.announcements enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Everybody can read menu, specials, announcements
create policy "Public Read Menu" on public.menu_items for select using (true);
create policy "Public Read Categories" on public.categories for select using (true);
create policy "Public Read Specials" on public.daily_specials for select using (true);
create policy "Public Read Announcements" on public.announcements for select using (true);

create policy "Staff manage menu items" on public.menu_items for all
  using (
    exists (
      select 1 from public.users 
      where id = auth.uid() 
      and role in ('kitchen_manager', 'admin', 'staff')
    )
  )
  with check (
    exists (
      select 1 from public.users 
      where id = auth.uid() 
      and role in ('kitchen_manager', 'admin', 'staff')
    )
  );

create policy "Staff manage categories" on public.categories for all
  using (
    exists (
      select 1 from public.users 
      where id = auth.uid() 
      and role in ('kitchen_manager', 'admin', 'staff')
    )
  )
  with check (
    exists (
      select 1 from public.users 
      where id = auth.uid() 
      and role in ('kitchen_manager', 'admin', 'staff')
    )
  );

-- CMS Policies
create policy "Staff manage announcements" on public.announcements for all
  using (
    exists (
      select 1 from public.users 
      where id = auth.uid() 
      and role in ('kitchen_manager', 'admin', 'staff')
    )
  )
  with check (
    exists (
      select 1 from public.users 
      where id = auth.uid() 
      and role in ('kitchen_manager', 'admin', 'staff')
    )
  );

-- Orders Policies
create policy "Users can view own orders" on public.orders for select
  using (auth.uid() = user_id);

create policy "Users can insert own orders" on public.orders for insert
  with check (auth.uid() = user_id);

create policy "Guests can insert orders" on public.orders for insert
  with check (user_id is null);
-- Note: Guests viewing orders is tricky without auth. 
-- For now, we rely on the UUID returned during creation to fetch status (public read with filter if strictly needed, but insecure)
-- OR we leave public read for orders disabled and use an Edge Function for guest status.
-- For this prototype, we'll allow public read on ORDERS so Guests can track by ID (security tradeoff acknowledged)
create policy "Public view orders" on public.orders for select using (true);

-- Kitchen/Admin Full Access
create policy "Staff View All Orders" on public.orders for select
  using (
    exists (
      select 1 from public.users 
      where id = auth.uid() 
      and role in ('kitchen_manager', 'admin', 'staff')
    )
  );

create policy "Staff Update Orders" on public.orders for update
  using (
    exists (
      select 1 from public.users 
      where id = auth.uid() 
      and role in ('kitchen_manager', 'admin')
    )
  );

-- Specials Management
create policy "Kitchen Manage Specials" on public.daily_specials for all
  using (
    exists (
      select 1 from public.users 
      where id = auth.uid() 
      and role in ('kitchen_manager', 'admin')
    )
  );

-- Order Items Policies
create policy "Users can view own order items" on public.order_items for select
  using (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
      and orders.user_id = auth.uid()
    )
  );

create policy "Users can insert own order items" on public.order_items for insert
  with check (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
      and orders.user_id = auth.uid()
    )
  );

create policy "Public view order items" on public.order_items for select using (true);

create policy "Guests can insert order items" on public.order_items for insert
  with check (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
      and orders.user_id is null
    )
  );

create policy "Staff View All Order Items" on public.order_items for select
  using (
    exists (
      select 1 from public.users 
      where id = auth.uid() 
      and role in ('kitchen_manager', 'admin', 'staff')
    )
  );
