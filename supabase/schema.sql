-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- RESTAURANTS
create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null,
  slug text unique not null,
  logo_url text,
  address text,
  city text,
  state text,
  zip text,
  phone text,
  email text,
  cuisine_type text,
  description text,
  stripe_account_id text unique,
  stripe_onboarding_complete boolean default false,
  retell_agent_id text,
  retell_phone_number text,
  is_open boolean default true,
  accepts_voice_orders boolean default true,
  accepts_in_person boolean default true,
  tax_rate decimal(5,4) default 0.0875,
  allow_sms_payment boolean default true,
  allow_ivr_payment boolean default true,
  allow_in_person_payment boolean default true,
  require_card_after_noshows int default 2,
  noshows_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- MENU CATEGORIES
create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  name text not null,
  description text,
  display_order int default 0,
  is_visible boolean default true,
  available_from time,
  available_until time,
  available_days int[] default '{0,1,2,3,4,5,6}',
  created_at timestamptz default now()
);

-- MENU ITEMS
create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  category_id uuid references public.menu_categories(id) on delete set null,
  name text not null,
  description text,
  price decimal(10,2) not null check (price >= 0),
  is_available boolean default true,
  is_featured boolean default false,
  track_quantity boolean default false,
  quantity_remaining int,
  auto_disable_at_zero boolean default true,
  available_from time,
  available_until time,
  image_url text,
  allergens text[] default '{}',
  calories int,
  prep_time_minutes int default 15,
  display_order int default 0,
  voice_description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- PRICE HISTORY
create table public.menu_price_history (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references public.menu_items(id) on delete cascade,
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  old_price decimal(10,2),
  new_price decimal(10,2),
  changed_by uuid references auth.users(id),
  reason text,
  changed_at timestamptz default now()
);

-- MENU UPLOADS
create table public.menu_uploads (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  uploaded_by uuid references auth.users(id),
  file_url text not null,
  file_type text,
  status text default 'processing',
  raw_extraction jsonb,
  items_found int default 0,
  items_imported int default 0,
  error_message text,
  created_at timestamptz default now()
);

-- CUSTOMERS
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  phone text unique not null,
  name text,
  email text,
  stripe_customer_id text unique,
  total_orders int default 0,
  total_spent decimal(10,2) default 0,
  noshows int default 0,
  preferred_payment text default 'sms_link',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ORDERS
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null default 'ORD-' || upper(substr(gen_random_uuid()::text, 1, 6)),
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  customer_id uuid references public.customers(id),
  customer_name text,
  customer_phone text,
  customer_email text,
  items jsonb not null default '[]',
  notes text,
  subtotal decimal(10,2) not null,
  tax decimal(10,2) default 0,
  tip decimal(10,2) default 0,
  platform_fee decimal(10,2) not null,
  restaurant_payout decimal(10,2) not null,
  total decimal(10,2) not null,
  payment_method text,
  payment_status text default 'pending',
  payment_code text,
  stripe_payment_intent_id text,
  stripe_payment_link_id text,
  stripe_payment_link_url text,
  stripe_transfer_id text,
  status text default 'pending',
  source text default 'voice_ai',
  retell_call_id text,
  created_at timestamptz default now(),
  accepted_at timestamptz,
  completed_at timestamptz,
  paid_at timestamptz,
  payment_link_sent_at timestamptz,
  payment_link_expires_at timestamptz
);

create unique index if not exists orders_retell_call_id_unique
  on public.orders(retell_call_id) where retell_call_id is not null;

create index if not exists orders_payment_code_idx
  on public.orders(payment_code) where payment_code is not null;

-- CALLS (voice analytics)
create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  retell_call_id text unique,
  caller_phone text,
  call_duration_seconds integer,
  call_status text default 'completed',
  order_placed boolean default false,
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists calls_restaurant_id_idx on public.calls(restaurant_id);
create index if not exists calls_created_at_idx on public.calls(created_at);

-- EMAIL LOGS (monthly report tracking)
create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  recipient_email text not null,
  report_type text not null default 'monthly',
  report_month integer not null,
  report_year integer not null,
  status text not null default 'sent',
  error_message text,
  resend_id text,
  metrics jsonb,
  created_at timestamptz default now()
);

create index if not exists email_logs_restaurant_id_idx on public.email_logs(restaurant_id);
create index if not exists email_logs_created_at_idx on public.email_logs(created_at desc);

-- PRINTERS
create table public.printers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  name text not null,
  type text not null,
  ip_address text,
  port int default 8008,
  is_default boolean default false,
  is_online boolean default true,
  auto_print_on_accept boolean default true,
  paper_width text default '80mm',
  created_at timestamptz default now()
);

-- PAYOUTS
create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants(id),
  order_id uuid references public.orders(id),
  stripe_transfer_id text unique,
  amount decimal(10,2) not null,
  currency text default 'usd',
  status text default 'pending',
  arrived_at timestamptz,
  created_at timestamptz default now()
);

-- NOTIFICATIONS
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants(id) on delete cascade,
  type text not null,
  title text not null,
  message text,
  order_id uuid references public.orders(id),
  is_read boolean default false,
  created_at timestamptz default now()
);

-- INDEXES
create index idx_orders_restaurant on public.orders(restaurant_id);
create index idx_orders_status on public.orders(status);
create index idx_orders_created on public.orders(created_at desc);
create index idx_menu_items_restaurant on public.menu_items(restaurant_id);
create index idx_menu_items_available on public.menu_items(is_available);
create index idx_notifications_restaurant on public.notifications(restaurant_id, is_read);
create index idx_customers_phone on public.customers(phone);

-- REALTIME
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.menu_items;
alter publication supabase_realtime add table public.notifications;

-- ROW LEVEL SECURITY
alter table public.restaurants enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.printers enable row level security;
alter table public.notifications enable row level security;
alter table public.payouts enable row level security;

create policy "owners_manage_restaurant" on public.restaurants
  for all using (auth.uid() = owner_id);

create policy "owners_manage_categories" on public.menu_categories
  for all using (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()));

create policy "owners_manage_items" on public.menu_items
  for all using (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()));

create policy "owners_view_orders" on public.orders
  for all using (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()));

create policy "owners_manage_printers" on public.printers
  for all using (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()));

create policy "owners_view_notifications" on public.notifications
  for all using (restaurant_id in (select id from public.restaurants where owner_id = auth.uid()));

-- FUNCTIONS & TRIGGERS
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at_restaurants
  before update on public.restaurants
  for each row execute function update_updated_at();

create trigger set_updated_at_menu_items
  before update on public.menu_items
  for each row execute function update_updated_at();

create or replace function check_item_quantity()
returns trigger as $$
begin
  if new.track_quantity = true
    and new.auto_disable_at_zero = true
    and new.quantity_remaining <= 0 then
    new.is_available = false;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger auto_disable_item
  before update on public.menu_items
  for each row execute function check_item_quantity();

create or replace function log_price_change()
returns trigger as $$
begin
  if old.price != new.price then
    insert into public.menu_price_history (
      item_id, restaurant_id, old_price, new_price, changed_by
    ) values (
      new.id, new.restaurant_id, old.price, new.price, auth.uid()
    );
  end if;
  return new;
end;
$$ language plpgsql;

create trigger track_price_changes
  after update on public.menu_items
  for each row execute function log_price_change();

create or replace function notify_new_order()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications (
      restaurant_id, type, title, message, order_id
    ) values (
      new.restaurant_id,
      'new_order',
      'New Order Received!',
      'Order ' || new.order_number || ' — $' || new.total::text || ' from ' || coalesce(new.customer_name, 'Voice AI Customer'),
      new.id
    );
  end if;
  return new;
end;
$$ language plpgsql;

create trigger on_new_order
  after insert on public.orders
  for each row execute function notify_new_order();
