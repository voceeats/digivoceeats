-- Prevent duplicate voice orders from the same Retell call
CREATE UNIQUE INDEX IF NOT EXISTS orders_retell_call_id_unique
ON orders(retell_call_id) WHERE retell_call_id IS NOT NULL;
