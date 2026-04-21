# Compliance e Certificação — PontoWebDesk

**Versão:** 1.0  
**Classificação:** Confidencial  
**Aplicável a:** ISO 27001, SOC 2 Type II, LGPD, Portaria 671 MTE  

---

## 1. Controles de Segurança da Informação (ISO 27001 / SOC 2)

### A.8 — Gestão de Ativos

| Controle | Implementação | Evidência |
|----------|---------------|-----------|
| Inventário de ativos | Tabela `devices` no Supabase | `GET /api/admin/global-dashboard` |
| Classificação de dados | PIS/CPF = Sensível; matrícula = Interno | `services/dataEncryption.js` |
| Retenção de dados | 5 anos (Portaria 671) | `services/retentionPolicy.js` |

### A.9 — Controle de Acesso

| Controle | Implementação | Evidência |
|----------|---------------|-----------|
| Política de acesso | RLS por company_id | SQL: `docs/audit-report.md §9` |
| Gestão de privilégios | service_role apenas backend | `api/punch.ts`, `services/syncService.js` |
| Autenticação | JWT Supabase + API_KEY para agente | `api/punch.ts` |
| Segregação de funções | admin / auditor / viewer (feature flags) | `services/featureFlags.js` |

### A.10 — Criptografia

| Controle | Implementação | Evidência |
|----------|---------------|-----------|
| Política de criptografia | AES-256-GCM por tenant | `services/dataEncryption.js` |
| Gestão de chaves | Envelope encryption (DEK/KEK) | `services/kmsProvider.js` |
| Rotação de chaves | A cada 90 dias | `KEY_ROTATION_INTERVAL_DAYS=90` |
| Criptografia em trânsito | HTTPS/TLS obrigatório (HSTS) | `services/securityHeaders.js` |

### A.12 — Segurança Operacional

| Controle | Implementação | Evidência |
|----------|---------------|-----------|
| Logs de operação | `system_logs` SQLite + Supabase | `services/syncQueue.js` |
| Monitoramento | Circuit breaker + alertas webhook | `services/circuitBreaker.js` |
| Backup | WAL checkpoint (5 min) + snapshot diário | `services/drManager.js` |
| Teste de restore | Mensal automatizado | `services/drManager.js#runRestoreTest` |
| Proteção contra malware | Validação de payload (Zod) | `api/punch.ts` |

### A.16 — Gestão de Incidentes

| Controle | Implementação | Evidência |
|----------|---------------|-----------|
| Detecção | Alertas automáticos (webhook) | `services/alertDispatcher.js` |
| Resposta | Dead letter queue + requeue manual | `api/admin/sync-errors.ts` |
| Registro | Audit trail imutável | `services/auditTrail.js` |
| Recuperação | DR Manager (RPO 5min, RTO 30min) | `services/drManager.js` |

### A.18 — Conformidade

| Controle | Implementação | Evidência |
|----------|---------------|-----------|
| Identificação de requisitos | Portaria 671, LGPD, CLT art. 74 | Este documento |
| Proteção de registros | Append-only + hash chain | `services/auditTrail.js` |
| Privacidade | Anonimização LGPD | `services/retentionPolicy.js` |

---

## 2. Conformidade LGPD (Lei 13.709/2018)

### 2.1 Base Legal
- **Art. 7º, II**: cumprimento de obrigação legal (CLT art. 74 — controle de jornada)
- **Art. 7º, V**: execução de contrato (prestação de serviço de ponto eletrônico)

### 2.2 Dados Tratados

| Dado | Categoria | Base Legal | Retenção | Proteção |
|------|-----------|------------|----------|----------|
| PIS/CPF | Pessoal | Art. 7º, II | 5 anos | AES-256-GCM |
| Matrícula | Pessoal | Art. 7º, V | 5 anos | Sem criptografia |
| Horário de trabalho | Pessoal | Art. 7º, II | 5 anos | Sem criptografia |
| Localização GPS | Pessoal sensível | Consentimento | 5 anos | Sem criptografia |
| Foto biométrica | Biométrico | Consentimento | 5 anos | Storage Supabase |

### 2.3 Direitos dos Titulares

| Direito | Mecanismo | Endpoint |
|---------|-----------|----------|
| Acesso | Consulta via painel | Dashboard do colaborador |
| Correção | Ajuste manual com audit trail | Admin → Espelho de Ponto |
| Eliminação | Anonimização (não exclusão — obrigação legal) | `services/retentionPolicy.js` |
| Portabilidade | Exportação AFD/AEJ | `GET /api/export/afd` |
| Oposição | Feature flag `ENABLE_FRAUD_DETECTION=0` | `services/featureFlags.js` |

### 2.4 Medidas Técnicas e Organizacionais
- Criptografia em repouso: AES-256-GCM por tenant
- Criptografia em trânsito: TLS 1.2+ (HSTS)
- Controle de acesso: RLS + JWT + API_KEY
- Anonimização automática após 5 anos
- Trilha de auditoria imutável de todos os acessos

---

## 3. Conformidade Portaria 671 (MTE)

### 3.1 Requisitos Atendidos

| Requisito | Status | Implementação |
|-----------|--------|---------------|
| REP-P (software) | ✅ | Pipeline local + cloud |
| AFD (Arquivo Fonte de Dados) | ✅ | `GET /api/export/afd` |
| ACJEF (Arquivo de Controle) | ✅ | `GET /api/export/aej` |
| NSR sequencial | ✅ | Campo `nsr` em `time_records` |
| Imutabilidade dos registros | ✅ | Append-only + hash chain |
| Identificação do trabalhador | ✅ | PIS/CPF/matrícula |
| Carimbo de tempo | ✅ | UTC + HMAC + Merkle root |

### 3.2 Formato AFD (Portaria 671, Anexo I)
```
Tipo 3 (Marcação de Ponto):
NSR(9) + TIPO_REGISTRO(1) + DATA(8) + HORA(6) + CPF(11)
Exemplo: 000000001 3 20042024 080000 12345678901
```

### 3.3 Assinatura do Arquivo
- `file_hash = SHA-256(conteúdo do arquivo)`
- `signature = HMAC-SHA256(file_hash, TIMESTAMP_SECRET_KEY)`
- Incluído no header do arquivo exportado

---

## 4. SOC 2 Type II — Critérios de Serviço de Confiança

### CC6 — Controles de Acesso Lógico e Físico

| Critério | Implementação |
|----------|---------------|
| CC6.1 — Identificação e autenticação | JWT Supabase + API_KEY |
| CC6.2 — Autorização | RLS por company_id |
| CC6.3 — Remoção de acesso | Desativação de device/usuário |
| CC6.6 — Proteção contra ameaças externas | Rate limiting + validação Zod |
| CC6.7 — Transmissão de dados | HTTPS/TLS + HSTS |
| CC6.8 — Prevenção de malware | Validação de payload + sanitização |

### CC7 — Operações do Sistema

| Critério | Implementação |
|----------|---------------|
| CC7.1 — Detecção de vulnerabilidades | Validação de entrada + classificação de erros |
| CC7.2 — Monitoramento | Circuit breaker + alertas + métricas |
| CC7.3 — Avaliação de incidentes | Dead letter queue + audit trail |
| CC7.4 — Resposta a incidentes | Alertas webhook + requeue manual |
| CC7.5 — Recuperação | DR Manager (RPO 5min, RTO 30min) |

### CC9 — Gestão de Riscos

| Critério | Implementação |
|----------|---------------|
| CC9.1 — Identificação de riscos | Fraud detector + anomaly detection |
| CC9.2 — Mitigação de riscos | Backpressure + circuit breaker + retry |

---

## 5. Disaster Recovery

### 5.1 Objetivos
- **RPO (Recovery Point Objective):** ≤ 5 minutos
- **RTO (Recovery Time Objective):** ≤ 30 minutos

### 5.2 Estratégia
1. **WAL Checkpoint** (a cada 5 min): cópia do SQLite local → `agent/data/dr/`
2. **Upload remoto** (best-effort): Supabase Storage bucket `dr-backups`
3. **Snapshot diário** (02:00): export completo → `agent/data/snapshots/`
4. **Teste de restore** (mensal, 04:00): valida último checkpoint

### 5.3 Procedimento de Restore
```bash
# 1. Identificar último checkpoint válido
ls -la agent/data/dr/ | grep wal-checkpoint

# 2. Parar o agente
npm run stop-agent  # ou kill do processo

# 3. Restaurar banco
cp agent/data/dr/wal-checkpoint-YYYY-MM-DD.db agent/data/pending.db

# 4. Verificar integridade
node -e "
  const db = require('better-sqlite3')('agent/data/pending.db');
  const count = db.prepare('SELECT COUNT(*) as c FROM time_records').get();
  console.log('Registros:', count.c);
"

# 5. Reiniciar agente
npm run clock-sync-agent
```

---

## 6. Endpoints de Auditoria para Fiscalização

Para auditores externos, os seguintes endpoints estão disponíveis com autenticação:

```bash
# Verificar integridade da trilha
curl -H "Authorization: Bearer $API_KEY" \
  https://seu-dominio.com/api/admin/audit/verify

# Exportar trilha completa (relatório para auditor)
curl -H "Authorization: Bearer $API_KEY" \
  "https://seu-dominio.com/api/admin/audit/export?format=report" \
  -o audit_report.json

# Relatório diário de auditoria
curl -H "Authorization: Bearer $API_KEY" \
  https://seu-dominio.com/api/admin/audit/daily-report

# Exportar AFD (Portaria 671)
curl -H "Authorization: Bearer $JWT_TOKEN" \
  "https://seu-dominio.com/api/export/afd?company_id=UUID" \
  -o AFD_empresa.txt

# Status do sistema
curl -H "Authorization: Bearer $API_KEY" \
  https://seu-dominio.com/api/admin/system-status
```

---

## 7. Variáveis de Ambiente de Segurança

```bash
# Criptografia (obrigatório em produção)
DATA_ENCRYPTION_KEY=<64 hex chars>   # AES-256 master key
TIMESTAMP_SECRET_KEY=<64 hex chars>  # HMAC key para assinaturas

# KMS (opcional — para nível enterprise)
KMS_PROVIDER=env|aws|gcp|vault
KMS_KEY_ID=<ARN ou ID da chave>
KEY_ROTATION_INTERVAL_DAYS=90

# Alertas
ALERT_WEBHOOK_URL=<URL do webhook>
ALERT_WEBHOOK_SECRET=<Bearer token>

# DR
DR_ENABLED=1
DR_CHECKPOINT_MS=300000  # 5 minutos
DR_BUCKET=dr-backups

# Logs externos
EXTERNAL_LOG_URL=<URL do serviço>
EXTERNAL_LOG_TOKEN=<API key>
EXTERNAL_LOG_LEVEL=warn
```

---

## 8. Geração de Chaves

```bash
# Gerar DATA_ENCRYPTION_KEY (AES-256)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Gerar TIMESTAMP_SECRET_KEY (HMAC-SHA256)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Gerar API_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

*Documento gerado pelo sistema PontoWebDesk.*  
*Última atualização: automática a cada deploy.*  
*Contato técnico: verificar `docs/audit-report.md` para detalhes de arquitetura.*
