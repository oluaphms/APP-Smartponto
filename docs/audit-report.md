# Relatório de Arquitetura e Auditoria — PontoWebDesk

**Versão:** 1.0  
**Data:** gerado automaticamente  
**Sistema:** PontoWebDesk Hybrid SaaS  

---

## 1. Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│  CAMADA 1: DISPOSITIVOS (Relógios de Ponto REP)                │
│  Control iD (HTTP) │ Dimep (AFD) │ Henry (AFD/TCP)             │
└────────────────────────────┬────────────────────────────────────┘
                             │ coleta periódica (10s)
┌────────────────────────────▼────────────────────────────────────┐
│  CAMADA 2: AGENTE LOCAL (Node.js — Offline First)              │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  VALIDAÇÃO (punchValidator.js)                          │   │
│  │  • Clock drift (±5min / 30 dias)                        │   │
│  │  • Employee ID (PIS/CPF/matrícula)                      │   │
│  │  • Rate limit por device (60/min)                       │   │
│  │  • Flood detection (10/min por employee)                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                             │                                   │
│  ┌─────────────────────────▼───────────────────────────────┐   │
│  │  DETECÇÃO DE FRAUDE (fraudDetector.js)                  │   │
│  │  • Velocidade impossível (GPS)                          │   │
│  │  • Horário suspeito (00h–04h)                           │   │
│  │  • Frequência anômala                                   │   │
│  │  • Sequência inválida                                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                             │                                   │
│  ┌─────────────────────────▼───────────────────────────────┐   │
│  │  FILA PERSISTENTE SQLite (syncQueue.js)                 │   │
│  │  • sync_jobs (pending/processing/done/failed)           │   │
│  │  • system_logs (observabilidade)                        │   │
│  │  • audit_trail (imutável, hash encadeado)               │   │
│  │  • sync_checkpoint (retomada após reinício)             │   │
│  │  • timestamp_anchors (Merkle root diária)               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                             │                                   │
│  ┌─────────────────────────▼───────────────────────────────┐   │
│  │  WORKER (syncService.js)                                │   │
│  │  • Circuit breaker (CLOSED/OPEN/HALF)                   │   │
│  │  • Lock distribuído (Supabase + fallback SQLite)        │   │
│  │  • Batching adaptativo (10–200 por latência)            │   │
│  │  • Retry inteligente (classifica erros)                 │   │
│  │  • Dead letter queue (10 tentativas)                    │   │
│  │  • Backpressure (>5000 jobs)                            │   │
│  │  • Modo degradado (Supabase fora)                       │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │ upsert (dedupe_hash)
┌────────────────────────────▼────────────────────────────────────┐
│  CAMADA 3: NUVEM (Supabase + Vercel)                           │
│                                                                 │
│  clock_event_logs → promote_clock_events_to_espelho            │
│                   → time_records (espelho)                     │
│                                                                 │
│  RLS: company_id isolamento por tenant                         │
│  audit_trail: append-only, replicado do agente                 │
└────────────────────────────┬────────────────────────────────────┘
                             │ Realtime (INSERT)
┌────────────────────────────▼────────────────────────────────────┐
│  CAMADA 4: FRONTEND (React + Vite)                             │
│  useRecords → Supabase Realtime → invalidate cache             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Garantias de Integridade

### 2.1 Exactly-Once Delivery
- `dedupe_hash = SHA-256(company_id|device_id|employee_id|timestamp|event_type)`
- Upsert com `ON CONFLICT (dedupe_hash) DO NOTHING`
- `_idempotency_key` propagado no `raw` de cada registro

### 2.2 Hash Chain (Trilha de Auditoria)
- Cada registro: `integrity_hash = SHA-256(previousHash + JSON(entry))`
- Hash inicial: `GENESIS`
- Verificação: `GET /api/admin/audit/verify`
- Adulteração detectável por qualquer auditor com acesso à trilha

### 2.3 Assinatura HMAC
- `signature = HMAC-SHA256(integrity_hash + created_at + company_id + action, SECRET_KEY)`
- Prova que o registro foi criado pelo sistema (não forjado externamente)

### 2.4 Âncora de Timestamp (Merkle Root Diária)
- Diariamente às 23:55: `merkle_root = MerkleRoot(todos os integrity_hashes do dia)`
- Publicado em `timestamp_anchors` (local + Supabase)
- Permite provar que qualquer registro existia antes da âncora

---

## 3. Fluxo de Dados Completo

```
Relógio → Adapter → Validação → Fraude → SQLite (time_records)
       → Enqueue (sync_jobs) → Worker → clock_event_logs (Supabase)
       → promote_clock_events_to_espelho → time_records (Supabase)
       → Realtime → Frontend
```

**Reconciliação automática:** a cada 5 min, verifica `promoted_at IS NULL` e reprocessa.

---

## 4. Proteção de Dados (LGPD)

| Campo       | Tratamento                                    | Prazo       |
|-------------|-----------------------------------------------|-------------|
| p_pis       | Criptografado (AES-256-GCM) + anonimizado     | 5 anos      |
| p_cpf       | Criptografado (AES-256-GCM) + anonimizado     | 5 anos      |
| p_matricula | Mantido (não é dado pessoal sensível)         | 5 anos      |
| p_raw_data  | Campos pessoais removidos na anonimização     | 5 anos      |
| system_logs | Sem dados pessoais                            | 90 dias     |
| audit_trail | Sem dados pessoais (apenas IDs e ações)       | 5 anos      |

**Anonimização:** `ANON:<SHA-256(salt_empresa + valor)>` — irreversível.

---

## 5. Isolamento Multi-Tenant

- Todas as queries incluem `company_id`
- RLS no Supabase: `USING (company_id = auth.jwt()->>'company_id')`
- Chaves de criptografia derivadas por empresa (HKDF-SHA256)
- Métricas e logs separados por tenant

---

## 6. Endpoints de Auditoria

| Endpoint                        | Método | Descrição                              |
|---------------------------------|--------|----------------------------------------|
| `/api/health`                   | GET    | Health check do sistema                |
| `/api/admin/system-status`      | GET    | Status operacional completo            |
| `/api/admin/global-dashboard`   | GET    | Dashboard master multi-tenant          |
| `/api/admin/metrics`            | GET    | Métricas da fila                       |
| `/api/admin/audit`              | GET    | Consulta trilha de auditoria           |
| `/api/admin/audit/verify`       | GET    | Verifica integridade da trilha         |
| `/api/admin/audit/export`       | GET    | Exporta trilha (JSON/CSV/relatório)    |
| `/api/admin/audit/snapshot`     | POST   | Força snapshot imediato                |
| `/api/admin/sync-errors`        | GET    | Dead letter queue                      |
| `/api/admin/logs`               | GET    | Logs estruturados                      |
| `/api/admin/flags`              | GET    | Feature flags                          |
| `/api/export/afd`               | GET    | Exportação AFD (Portaria 671)          |
| `/api/export/aej`               | GET    | Exportação AEJ (JSON)                  |

---

## 7. Conformidade Legal

### Portaria 671 (MTE)
- Exportação AFD: `GET /api/export/afd`
- NSR sequencial por dispositivo
- Formato: `NSR(9) + DATA(8) + HORA(6) + CPF(11) + TIPO(1)`

### LGPD (Lei 13.709/2018)
- Retenção: 5 anos (mínimo legal)
- Anonimização automática após prazo
- Direito ao esquecimento: anonimização sob demanda
- Logs de acesso: audit_trail registra toda ação

### CLT Art. 74
- Registros imutáveis (append-only)
- Hash chain para prova de não-adulteração
- Exportação para fiscalização

---

## 8. Disaster Recovery

| Métrica | Valor   | Mecanismo                                    |
|---------|---------|----------------------------------------------|
| RPO     | 0 dados | SQLite local persiste offline indefinidamente |
| RTO     | < 5 min | Worker reinicia automaticamente               |
| Backup  | Diário  | Snapshot local + Supabase Storage             |
| Retenção| 7 dias  | Snapshots locais rotacionados                 |

---

## 9. SQL de Hardening (Supabase)

```sql
-- 1. Trilha de auditoria append-only
REVOKE UPDATE, DELETE ON audit_trail FROM public;
REVOKE UPDATE, DELETE ON audit_trail FROM authenticated;
GRANT INSERT, SELECT ON audit_trail TO service_role;

-- 2. RLS reforçado
ALTER TABLE time_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON time_records
  FOR ALL
  USING (
    company_id::text = COALESCE(
      current_setting('request.jwt.claim.company_id', true),
      (auth.jwt()->>'company_id')
    )
  )
  WITH CHECK (
    company_id::text = COALESCE(
      current_setting('request.jwt.claim.company_id', true),
      (auth.jwt()->>'company_id')
    )
  );

-- 3. Índice único para exactly-once
CREATE UNIQUE INDEX IF NOT EXISTS uq_clock_event_dedupe
  ON clock_event_logs (dedupe_hash);

-- 4. Lock distribuído
CREATE TABLE IF NOT EXISTS distributed_locks (
  name         TEXT PRIMARY KEY NOT NULL,
  locked_by    TEXT,
  locked_until TIMESTAMPTZ
);
INSERT INTO distributed_locks (name) VALUES ('sync_worker') ON CONFLICT DO NOTHING;

-- 5. Âncoras de timestamp
CREATE TABLE IF NOT EXISTS timestamp_anchors (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date        DATE UNIQUE NOT NULL,
  merkle_root TEXT NOT NULL,
  hash_count  INTEGER NOT NULL,
  anchored_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  external_ref TEXT
);

-- 6. Feature flags
CREATE TABLE IF NOT EXISTS feature_flags (
  name    TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  active  BOOLEAN NOT NULL DEFAULT true
);

-- 7. Audit trail cloud (append-only)
CREATE TABLE IF NOT EXISTS audit_trail (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity          TEXT NOT NULL,
  entity_id       TEXT,
  action          TEXT NOT NULL,
  before_data     JSONB,
  after_data      JSONB,
  performed_by    TEXT,
  company_id      UUID,
  integrity_hash  TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
REVOKE UPDATE, DELETE ON audit_trail FROM public;
REVOKE UPDATE, DELETE ON audit_trail FROM authenticated;
CREATE INDEX ON audit_trail (company_id, created_at);
CREATE INDEX ON audit_trail (action, created_at);
```

---

## 10. Variáveis de Ambiente Obrigatórias

| Variável                    | Obrigatória | Descrição                              |
|-----------------------------|-------------|----------------------------------------|
| `SUPABASE_URL`              | ✅          | URL do projeto Supabase                |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅          | Chave service role (backend only)      |
| `CLOCK_AGENT_API_KEY`       | ✅          | Chave de autenticação do agente        |
| `TIMESTAMP_SECRET_KEY`      | ✅ prod     | Chave HMAC para assinaturas (64 hex)   |
| `DATA_ENCRYPTION_KEY`       | ✅ prod     | Chave AES-256 para dados sensíveis     |
| `ALERT_WEBHOOK_URL`         | ⚠️ recom.  | URL para alertas críticos              |
| `CLOCK_AGENT_SQLITE_PATH`   | ⚠️ recom.  | Caminho do banco SQLite local          |
| `EXTERNAL_LOG_URL`          | opcional    | Endpoint de logs externos              |

---

*Documento gerado automaticamente pelo sistema PontoWebDesk.*  
*Para verificação de integridade: `GET /api/admin/audit/verify`*  
*Para exportação completa: `GET /api/admin/audit/export?format=report`*
