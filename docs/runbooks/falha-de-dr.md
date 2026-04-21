# Runbook: Falha de DR / Restore de Emergência

**ID:** RB-004  
**Severidade típica:** P1  
**Tempo estimado de resolução:** 15–30 minutos  

---

## Sintomas

- Banco SQLite local corrompido ou perdido
- Agente não inicia (`SQLITE_CORRUPT` ou arquivo não encontrado)
- Perda de dados locais após falha de hardware

---

## Diagnóstico

### 1. Verificar integridade do banco atual

```bash
# Verificar se o arquivo existe
ls -la $CLOCK_AGENT_SQLITE_PATH

# Testar integridade
node -e "
  const db = require('better-sqlite3')(process.env.CLOCK_AGENT_SQLITE_PATH);
  const result = db.pragma('integrity_check');
  console.log(result);
  db.close();
"
```

### 2. Verificar backups disponíveis

```bash
# Checkpoints WAL locais
ls -la agent/data/dr/ | grep wal-checkpoint

# Snapshots diários
ls -la agent/data/snapshots/ | grep snapshot
```

---

## Restore de Emergência

### Opção A: Restore do último WAL checkpoint (RPO ≤ 5 min)

```bash
# 1. Parar o agente
kill $(pgrep -f clock-sync-agent)

# 2. Fazer backup do banco corrompido (para análise)
cp $CLOCK_AGENT_SQLITE_PATH ${CLOCK_AGENT_SQLITE_PATH}.corrupted.$(date +%s)

# 3. Identificar checkpoint mais recente
LATEST=$(ls -t agent/data/dr/wal-checkpoint-*.db | head -1)
echo "Restaurando: $LATEST"

# 4. Restaurar
cp "$LATEST" $CLOCK_AGENT_SQLITE_PATH

# 5. Verificar integridade
node -e "
  const db = require('better-sqlite3')(process.env.CLOCK_AGENT_SQLITE_PATH);
  const count = db.prepare('SELECT COUNT(*) as c FROM time_records').get();
  console.log('Registros restaurados:', count.c);
  db.close();
"

# 6. Reiniciar agente
npm run clock-sync-agent
```

### Opção B: Restore do snapshot diário (RPO ≤ 24h)

```bash
# 1. Parar o agente
kill $(pgrep -f clock-sync-agent)

# 2. Identificar snapshot mais recente
LATEST=$(ls -t agent/data/snapshots/snapshot-*.json | head -1)
echo "Restaurando snapshot: $LATEST"

# 3. Recriar banco a partir do snapshot JSON
node -e "
  const fs = require('fs');
  const db = require('better-sqlite3')(process.env.CLOCK_AGENT_SQLITE_PATH);
  const snap = JSON.parse(fs.readFileSync('$LATEST', 'utf8'));
  
  // Recriar schema
  db.pragma('journal_mode = WAL');
  
  // Inserir time_records
  const stmt = db.prepare(\`
    INSERT OR IGNORE INTO time_records
      (id, company_id, rep_id, nsr, p_pis, p_cpf, p_matricula, p_data_hora, p_tipo_marcacao, p_raw_data, synced)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  \`);
  
  const trx = db.transaction(() => {
    for (const r of snap.timeRecords) {
      stmt.run(r.id, r.company_id, r.rep_id, r.nsr, r.p_pis, r.p_cpf, r.p_matricula, r.p_data_hora, r.p_tipo_marcacao, r.p_raw_data);
    }
  });
  trx();
  
  console.log('Restaurados:', snap.timeRecords.length, 'registros');
  db.close();
"

# 4. Reiniciar agente
npm run clock-sync-agent
```

### Opção C: Restore do Supabase Storage (se backup remoto disponível)

```bash
# Baixar último checkpoint do Supabase Storage
curl -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  "https://SEU_PROJETO.supabase.co/storage/v1/object/dr-backups/wal/FILENAME.db" \
  -o restored.db

# Verificar e usar
node -e "
  const db = require('better-sqlite3')('restored.db', { readonly: true });
  const count = db.prepare('SELECT COUNT(*) as c FROM time_records').get();
  console.log('Registros:', count.c);
  db.close();
"

cp restored.db $CLOCK_AGENT_SQLITE_PATH
npm run clock-sync-agent
```

---

## Validação

```bash
# 1. Agente deve iniciar sem erros
npm run clock-sync-agent 2>&1 | head -20

# 2. Verificar contagem de registros
curl -H "Authorization: Bearer $API_KEY" \
  https://seu-dominio.com/api/admin/metrics | jq '.queue'

# 3. Verificar que sync está funcionando
sleep 30
curl -H "Authorization: Bearer $API_KEY" \
  https://seu-dominio.com/api/admin/system-status | jq '.mode'
# Esperado: "normal"
```

**Critério de sucesso:** agente rodando, `mode === 'normal'`, fila processando.

---

## Pós-Restore

1. Abrir incidente P1 documentando a causa
2. Verificar se há dados perdidos (comparar com Supabase)
3. Executar snapshot imediato: `POST /api/admin/audit/snapshot`
4. Revisar configuração de DR para prevenir recorrência
