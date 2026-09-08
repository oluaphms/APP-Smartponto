-- 045 — Hardening pac_*: TTL (expires_at), consumo one-shot (consumed), consumed_at.
-- Idempotente. Não altera UpdateAgent (uag_*).

BEGIN;

ALTER TABLE public.master_professional_activation_tokens
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

ALTER TABLE public.master_professional_activation_tokens
  ADD COLUMN IF NOT EXISTS consumed_at timestamptz;

-- Expandir status: active | consumed | revoked
ALTER TABLE public.master_professional_activation_tokens
  DROP CONSTRAINT IF EXISTS master_pac_tokens_status_chk;

ALTER TABLE public.master_professional_activation_tokens
  ADD CONSTRAINT master_pac_tokens_status_chk
  CHECK (status IN ('active', 'consumed', 'revoked'));

CREATE INDEX IF NOT EXISTS idx_master_pac_tokens_expires
  ON public.master_professional_activation_tokens (expires_at)
  WHERE status = 'active';

COMMENT ON COLUMN public.master_professional_activation_tokens.expires_at IS
  'TTL para primeira ativação (status=active). Tokens consumed ignoram TTL até revoke.';
COMMENT ON COLUMN public.master_professional_activation_tokens.consumed_at IS
  'Momento do consumo atômico (active→consumed) na primeira ativação.';

COMMIT;
