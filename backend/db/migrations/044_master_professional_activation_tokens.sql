-- 044 — Tokens de ativação Professional (domínio licença — NÃO UpdateAgent).
-- Hash-only; bound a tenant + deployment + company license.
-- Idempotente.

BEGIN;

CREATE TABLE IF NOT EXISTS public.master_professional_activation_tokens (
  id                   text PRIMARY KEY,
  tenant_id            text NOT NULL,
  deployment_id        text NOT NULL,
  company_license_id   text NOT NULL,
  token_hash           text NOT NULL,
  status               text NOT NULL DEFAULT 'active',
  bound_machine_id     text,
  created_by           text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  revoked_at           timestamptz,
  last_used_at         timestamptz,
  CONSTRAINT master_pac_tokens_status_chk
    CHECK (status IN ('active', 'revoked'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_master_pac_tokens_hash
  ON public.master_professional_activation_tokens (token_hash);

CREATE INDEX IF NOT EXISTS idx_master_pac_tokens_deployment
  ON public.master_professional_activation_tokens (deployment_id, status);

CREATE INDEX IF NOT EXISTS idx_master_pac_tokens_tenant
  ON public.master_professional_activation_tokens (tenant_id, status);

COMMENT ON TABLE public.master_professional_activation_tokens IS
  'Credencial de ativação Professional (pac_*). Separado de UpdateAgent (uag_*).';

COMMIT;
