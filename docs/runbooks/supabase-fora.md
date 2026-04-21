# Runbook: Supabase Fora / Inacessível

**ID:** RB-002  
**Severidade típica:** P1 (se > 5 min) / P2 (se < 5 min)  
**Tempo estimado de resolução:** depende do provedor  

---

## Sintomas

- Alerta `circuit_open` recebido
- `GET /api/health` retorna `status: degraded` ou `503`
- `supabase.ok: false` no system-status
- Batidas sendo coletadas mas não sincronizadas

---

## Comportamento Esperado do Sistema

O sistema entra em **modo degradado automaticamente**:
- ✅ Continua coletando batidas dos relógios
- ✅ Salva tudo no SQLite local (sem perda de dados)
- ✅ Circuit breaker para de tentar (evita sobrecarga)
- ✅ Fila acumula jobs para reprocessamento
- ❌ Espelho não atualizado (frontend mostra dados antigos)

**Não há perda de dados** — o SQLite persiste offline indefinidamente.

---

## Diagnóstico

### 1. Confirmar que é o Supabase

```bash
# Testar conectividade direta
curl -I https://SEU_PROJETO.supabase.co/rest/v1/

# Verificar status do Supabase
curl https://status.supabase.com/api/v2/status.json
```

### 2. Verificar se é problema de credenciais

```bash
curl -H "Authorization: Bearer $API_KEY" \
  https://seu-dominio.com/api/health
```

Se `supabase.error` contém "invalid api key" → problema de credencial, não de disponibilidade.

### 3. Verificar circuit breaker

```bash
curl -H "Authorization: Bearer $API_KEY" \
  https://seu-dominio.com/api/admin/system-status | jq '.mode'
```

`degraded` = circuit breaker aberto.

---

## Ações

### Durante a indisponibilidade

**Não fazer nada.** O sistema está operando em modo degradado corretamente.

Monitorar:
```bash
# Verificar acúmulo na fila (deve crescer, mas não explodir)
watch -n 30 'curl -s -H "Authorization: Bearer $API_KEY" \
  https://seu-dominio.com/api/admin/metrics | jq ".queue.pending"'
```

### Quando o Supabase voltar

O circuit breaker vai resetar automaticamente após 30 segundos.  
O worker vai processar a fila acumulada com backoff exponencial.

Verificar recuperação:
```bash
# Circuit breaker deve fechar
curl -H "Authorization: Bearer $API_KEY" \
  https://seu-dominio.com/api/admin/system-status | jq '.mode'
# Esperado: "normal"

# Fila deve estar diminuindo
curl -H "Authorization: Bearer $API_KEY" \
  https://seu-dominio.com/api/admin/metrics | jq '.queue'
```

### Se o Supabase não voltar em 30 minutos

1. Verificar se há backup disponível para restore local
2. Considerar failover para região secundária (se configurado)
3. Abrir incidente P1

---

## Validação

**Critério de sucesso:**
- `mode === 'normal'`
- `queue.pending` diminuindo
- `supabase.ok: true`
- Espelho atualizado (verificar no dashboard)

---

## Prevenção

- Configurar alertas de status do Supabase: https://status.supabase.com
- Manter `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` atualizados
- Testar failover mensalmente
