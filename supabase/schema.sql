-- Hamro Chwok — Supabase schema (go-live phase)
-- Mirrors src/lib/types.ts. Run in the Supabase SQL editor of a new project.
-- Realtime: enable on orders + waiter_calls (Database → Replication).

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_ne text not null default '',
  sort_order int not null default 0
);

create table menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete cascade,
  name text not null,
  name_ne text not null default '',
  description text not null default '',
  description_ne text not null default '',
  price numeric(10,2) not null check (price >= 0),
  photo_url text,
  diet text not null default 'none' check (diet in ('veg','nonveg','none')),
  spice smallint not null default 0 check (spice between 0 and 3),
  stock text not null default 'in' check (stock in ('in','low','out')),
  sort_order int not null default 0,
  popular boolean not null default false,
  special boolean not null default false,
  prep_min int not null default 10,
  available_from time,
  available_to time
);

create table cafe_tables (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  active boolean not null default true
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  table_id uuid not null references cafe_tables(id),
  status text not null default 'received'
    check (status in ('received','preparing','ready','served','cancelled')),
  batches int not null default 1,
  paid boolean not null default false,
  payment_method text check (payment_method in ('cash','counter-qr')),
  served_by uuid,
  placed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status_at jsonb not null default '{}'::jsonb,
  feedback jsonb
);
create index orders_open_idx on orders (status, placed_at desc);

create table order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  item_id uuid references menu_items(id) on delete set null,
  name text not null,          -- denormalized at order time
  name_ne text not null default '',
  price numeric(10,2) not null,
  qty int not null check (qty > 0),
  note text not null default '',
  batch int not null default 1
);
create index order_lines_order_idx on order_lines (order_id);

create table waiter_calls (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references cafe_tables(id) on delete cascade,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid
);

-- Staff auth: use Supabase Auth for login; this table holds role + display name.
create table staff (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role text not null check (role in ('admin','kitchen','waiter','counter'))
);

create table inventory (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null,
  qty numeric(10,2) not null default 0,
  low_threshold numeric(10,2) not null default 0
);

create table inventory_logs (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references inventory(id) on delete cascade,
  delta numeric(10,2) not null,
  reason text not null default '',
  by_user uuid,
  at timestamptz not null default now()
);

create table settings (
  id int primary key default 1 check (id = 1), -- single row
  cafe_name text not null default 'Hamro Chwok',
  cafe_name_ne text not null default 'हाम्रो चोक',
  tagline text not null default 'Café at the courts',
  phone text not null default '',
  hours text not null default '7:00 AM – 9:00 PM',
  vat_percent numeric(5,2) not null default 0,
  service_charge_percent numeric(5,2) not null default 0,
  sound_on boolean not null default true,
  currency text not null default 'NPR'
);
insert into settings (id) values (1);

-- ---------- Row Level Security ----------
alter table categories     enable row level security;
alter table menu_items     enable row level security;
alter table cafe_tables    enable row level security;
alter table orders         enable row level security;
alter table order_lines    enable row level security;
alter table waiter_calls   enable row level security;
alter table staff          enable row level security;
alter table inventory      enable row level security;
alter table inventory_logs enable row level security;
alter table settings       enable row level security;

-- Anonymous customers: read the menu, create orders/lines/calls, read their order.
create policy "public read menu"     on categories   for select using (true);
create policy "public read items"    on menu_items   for select using (true);
create policy "public read tables"   on cafe_tables  for select using (true);
create policy "public read settings" on settings     for select using (true);
create policy "public create order"  on orders       for insert with check (true);
create policy "public read orders"   on orders       for select using (true);
create policy "public create lines"  on order_lines  for insert with check (true);
create policy "public read lines"    on order_lines  for select using (true);
create policy "public call waiter"   on waiter_calls for insert with check (true);
create policy "public read calls"    on waiter_calls for select using (true);
-- Customers may add feedback / append rounds to open orders:
create policy "public update open orders" on orders for update
  using (status in ('received','preparing','ready','served'));

-- Staff (any authenticated user present in staff table): full management access.
create policy "staff manage categories" on categories   for all using (auth.uid() in (select id from staff));
create policy "staff manage items"      on menu_items   for all using (auth.uid() in (select id from staff));
create policy "staff manage tables"     on cafe_tables  for all using (auth.uid() in (select id from staff));
create policy "staff manage orders"     on orders       for all using (auth.uid() in (select id from staff));
create policy "staff manage lines"      on order_lines  for all using (auth.uid() in (select id from staff));
create policy "staff manage calls"      on waiter_calls for all using (auth.uid() in (select id from staff));
create policy "staff read staff"        on staff        for select using (auth.uid() in (select id from staff));
create policy "staff manage inventory"  on inventory    for all using (auth.uid() in (select id from staff));
create policy "staff manage inv logs"   on inventory_logs for all using (auth.uid() in (select id from staff));
create policy "admin update settings"   on settings     for update
  using (auth.uid() in (select id from staff where role = 'admin'));

-- Photo uploads: create a public storage bucket named 'menu-photos'
-- (Storage → New bucket → public) and allow staff-only writes.
