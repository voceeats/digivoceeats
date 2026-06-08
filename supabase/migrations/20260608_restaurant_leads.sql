-- Restaurant signup leads from /signup form
create table if not exists public.restaurant_leads (
  id uuid default gen_random_uuid() primary key,
  restaurant_name text not null,
  cuisine_type text,
  owner_name text not null,
  owner_email text not null,
  owner_phone text,
  restaurant_phone text,
  address text,
  num_locations text,
  heard_about text,
  message text,
  status text not null default 'new',
  submitted_at timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists restaurant_leads_status_idx on public.restaurant_leads(status);
create index if not exists restaurant_leads_submitted_at_idx on public.restaurant_leads(submitted_at desc);
