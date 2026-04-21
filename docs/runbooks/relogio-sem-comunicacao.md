# Runbook: Relógio Sem Comunicação

**ID:** RB-003  
**Severidade típica:** P3  
**Tempo estimado de resolução:** 10–30 minutos  

---

## Sintomas

- Batidas de um dispositivo específico não aparecem no sistema
- `last_sync` do device não atualiza há mais de 15 minutos
- Logs mostram erros de conexão para um `device_id` específico

---

## Diagnóstico

### 1. Identificar o dispositivo

```bash
# Verificar devices ativos e último sync
curl -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  "https://SEU_PROJETO.supabase.co/rest/v1/devices?active=eq.true&select=id,name,brand,ip,last_sync" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY"
```

Dispositivos com `last_sync` > 15 min atrás são suspeitos.

### 2. Verificar logs do agente

```bash
curl -H "Authorization: Bearer $API_KEY" \
  "https://seu-dominio.com/api/admin/logs?scope=sync&limit=50" | \
  jq '.logs[] | select(.context.deviceId == "DEVICE_ID_AQUI")'
```

### 3. Testar conectividade com o relógio

```bash
# Ping básico
ping -c 4 IP_DO_RELOGIO

# Testar porta HTTP (Control iD)
curl -v --connect-timeout 5 http://IP_DO_RELOGIO/load_objects

# Testar porta TCP (Henry)
nc -zv IP_DO_RELOGIO 4370
```

---

## Ações por Marca

### Control iD

```bash
# Verificar se o relógio responde
curl -u admin:admin http://IP_DO_RELOGIO/load_objects \
  -X POST -H "Content-Type: application/json" \
  -d '{"object": "access_logs"}'

# Se não responder: verificar IP, porta, credenciais na tabela devices
```

**Causas comuns:**
- IP mudou (DHCP) → atualizar na tabela `devices`
- Senha padrão alterada → atualizar `username`/`password`
- Relógio reiniciado → aguardar 2 min e tentar novamente
- Firewall bloqueando → verificar regras de rede

### Dimep (AFD)

O Dimep usa arquivo AFD — verificar:
1. Caminho do arquivo `afd_file` na configuração do device
2. Permissões de leitura do arquivo
3. Se o arquivo está sendo gerado pelo relógio

### Henry

```bash
# Testar porta TCP
nc -zv IP_DO_RELOGIO 4370
```

---

## Correção

### Atualizar IP do dispositivo

```sql
-- No Supabase
UPDATE devices SET ip = 'NOVO_IP' WHERE id = 'DEVICE_ID';
```

### Atualizar credenciais

```sql
UPDATE devices SET username = 'novo_user', password = 'nova_senha' WHERE id = 'DEVICE_ID';
```

### Desativar dispositivo temporariamente

```sql
UPDATE devices SET active = false WHERE id = 'DEVICE_ID';
```

---

## Validação

Após correção, aguardar 1 ciclo do agente (15s) e verificar:

```bash
# last_sync deve atualizar
curl -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  "https://SEU_PROJETO.supabase.co/rest/v1/devices?id=eq.DEVICE_ID&select=last_sync" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY"
```

**Critério de sucesso:** `last_sync` atualizado nos últimos 30 segundos.
