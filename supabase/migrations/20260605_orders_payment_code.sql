-- Add a dedicated 4-digit numeric payment code for /pay lookup.
-- Previously the code was derived from the last 4 chars of order_number
-- (which could include letters). This stores an explicit numeric code.
alter table public.orders add column if not exists payment_code text;

create index if not exists orders_payment_code_idx
  on public.orders(payment_code) where payment_code is not null;
