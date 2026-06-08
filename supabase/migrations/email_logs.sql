-- Track monthly report emails sent to restaurant owners
create table if not exists public.email_logs (
  id uuid default gen_random_uuid() primary key,
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
create index if not exists email_logs_report_period_idx on public.email_logs(report_year, report_month);
