# Runbook: Fila de Sync Travada

**ID:** RB-001  
**Severidade típica:** P2  
**Tempo estimado de resolução:** 5–15 minutos  

---

## Sintomas

- `GET /api/admin/metrics` retorna `pending > 1000`
- Alerta `queue_overflow` recebido no webhook
- Dashboard mostra batidas não aparecendo no espelho
- `processingDelayMs > 120000` (> 2 minutos)

---

## Diagnóstico

### 1. Verificar status da fila

```bash
curl -H "Authorization: Bearer $API_KEY" \
  https://seu-dominio.com/api/admin/metrics
```

Verificar:
- `queue.pending`: quantos jobs aguardando
- `queue.failed`: quantos na dead letter
- `queue.errorRate`: taxa de erro recente
- `queue.processingDelayMs`: atraso do item mais antigo

### 2. Verificar circuit breaker

```bash
curl -H "Authorization: Bearer $API_KEY" \
  https://seu-dominio.com/api/admin/system-status
```

Se `mode === 'degraded'` → Supabase está fora (ver runbook `supabase-fora.md`).

### 3. Verificar logs de erro

```bash
curl -H "Authorization: Bearer $API_KEY" \
  "https://seu-dominio.com/api/admin/logs?level=error&limit=20"
```

Identificar o tipo de erro predominante:
- `NETWORK_ERROR` → problema de conectividade
- `FK_ERROR` → device_id não existe em `devices`
- `VALIDATION_ERROR` → dados inválidos (ver dead letter)
- `RATE_LIMIT` → Supabase throttling

### 4. Verificar dead letter queue

```bash
curl -H "Authorization: Bearer $API_KEY" \
  "https://seu-dominio.com/api/admin/sync-errors?limit=10"
```

---

## Ações

### Caso A: Erro de rede transitório (NETWORK_ERROR)

A fila vai se recuperar automaticamente com backoff exponencial.  
**Aguardar 2–5 minutos** e verificar se `pending` está diminuindo.

Se não diminuir após 5 min:
```bash
# Verificar conectividade com Supabase
curl -H "Authorization: Bearer $API_KEY" \
  https://seu-dominio.com/api/health
```

### Caso B: Jobs na dead letter (VALIDATION_ERROR / FK_ERROR)

Esses jobs **não serão reprocessados automaticamente** (erros permanentes).

1. Inspecionar os jobs:
```bash
curl -H "Authorization: Bearer $API_KEY" \
  "https://seu-dominio.com/api/admin/sync-errors?error_type=FK_ERROR"
```

2. Se FK_ERROR: verificar se o `device_id` existe na tabela `devices` do Supabase.

3. Se VALIDATION_ERROR: os dados são inválidos — não reprocessar.

### Caso C: Backpressure ativo (pending > 5000)

O sistema pausou a ingestão automaticamente.  
**Aguardar** o worker processar a fila. Não é necessária ação manual.

Se a fila não diminuir:
```bash
# Verificar se o worker está rodando
ps aux | grep clock-sync-agent

# Reiniciar o agente se necessário
npm run clock-sync-agent
```

### Caso D: Reprocessar dead letter manualmente

Apenas para erros transitórios (NETWORK_ERROR, SERVER_ERROR):
```bash
curl -X POST \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"all": true}' \
  https://seu-dominio.com/api/admin/sync-errors
```

---

## Validação

Após a ação, verificar:
```bash
# Fila deve estar diminuindo
curl -H "Authorization: Bearer $API_KEY" \
  https://seu-dominio.com/api/admin/metrics | jq '.queue.pending'

# Espelho deve estar sendo atualizado
curl -H "Authorization: Bearer $API_KEY" \
  https://seu-dominio.com/api/admin/system-status | jq '.espelho'
```

**Critério de sucesso:** `pending < 100` e `processingDelayMs < 30000`.

---

## Escalação

Se não resolvido em 15 minutos:
1. Abrir incidente P2: `POST /api/admin/incidents`
2. Verificar runbook `supabase-fora.md`
3. Contatar responsável de plantão
