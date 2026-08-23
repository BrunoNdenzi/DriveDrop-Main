ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS benji_idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS shipments_benji_idempotency_key_idx
  ON public.shipments (benji_idempotency_key)
  WHERE benji_idempotency_key IS NOT NULL;