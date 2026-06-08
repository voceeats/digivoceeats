-- Track every inbound Retell voice call for analytics
create table if not exists public.calls (
  id uuid default gen_random_uuid() primary key,
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
