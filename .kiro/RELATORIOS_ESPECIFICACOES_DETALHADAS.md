# ESPECIFICAÇÕES DETALHADAS DOS 6 RELATÓRIOS

## 🎯 REGRA DE OURO
Cada relatório responde UMA pergunta clara. Sem misturar.

---

## 1. RELATÓRIO DE JORNADA

### 🎯 Pergunta
**"O funcionário cumpriu a jornada?"**

### 📊 Resumo (3 Cards)
```
┌──────────────────┬──────────────────┬──────────────────┐
│ Dias Trabalhados │ Dias Faltantes   │ Dias com Erro    │
│ 20               │ 2                │ 1                │
│ dias             │ dias             │ dias             │
└──────────────────┴──────────────────┴──────────────────┘
```

### 📋 Tabela
| Funcionário | Data | Jornada Prevista | Jornada Real | Status |
|-------------|------|------------------|--------------|--------|
| João Silva | 01/04/2026 | 08:00-17:30 | 08:00-17:30 | Cumprida |
| João Silva | 02/04/2026 | 08:00-17:30 | 08:15-17:30 | Incompleta |
| João Silva | 03/04/2026 | 08:00-17:30 | 08:00-18:30 | Excedida |
| João Silva | 04/04/2026 | 08:00-17:30 | — | Ausente |

### Status Possíveis
- **Cumprida** - Jornada dentro do esperado (±15 min)
- **Incompleta** - Menos horas que o previsto
- **Excedida** - Mais horas que o previsto
- **Ausente** - Sem marcação

### Colunas
- Funcionário: Nome completo
- Data: DD/MM/AAAA
- Jornada Prevista: HH:MM-HH:MM (baseado em escala)
- Jornada Real: HH:MM-HH:MM (entrada-saída)
- Status: Cumprida/Incompleta/Excedida/Ausente

### Filtros
- Período
- Funcionário(s)
- Departamento(s)
- Status (opcional)

### Exportação
- **PDF**: Resumo + Tabela (pronto para assinatura)
- **Excel**: Dados completos + histórico

---

## 2. RELATÓRIO DE HORAS EXTRAS

### 🎯 Pergunta
**"Quanto foi trabalhado além da jornada?"**

### 📊 Resumo (2 Cards)
```
┌──────────────────┬──────────────────┐
│ Total de Extras  │ Dias com Extra   │
│ 24:30            │ 8                │
│ horas            │ dias             │
└──────────────────┴──────────────────┘
```

### 📋 Tabela
| Funcionário | Data | Horas Normais | Horas Extras | Tipo |
|-------------|------|---------------|--------------|------|
| João Silva | 01/04/2026 | 08:00 | 01:30 | 50% |
| João Silva | 02/04/2026 | 08:00 | 02:00 | 100% |
| Maria Santos | 03/04/2026 | 08:00 | 00:30 | Banco |

### Tipo de Horas Extras
- **50%** - Adicional de 50% (noturno/feriado)
- **100%** - Adicional de 100% (feriado/repouso)
- **Banco de Horas** - Acumulado para compensação

### Colunas
- Funcionário: Nome completo
- Data: DD/MM/AAAA
- Horas Normais: HH:MM (jornada padrão)
- Horas Extras: HH:MM (tempo além da jornada)
- Tipo: 50% / 100% / Banco de Horas

### Filtros
- Período
- Funcionário(s)
- Departamento(s)
- Tipo de Extra (opcional)

### Exportação
- **PDF**: Resumo executivo + Tabela
- **Excel**: Dados completos + cálculo de valores

---

## 3. RELATÓRIO DE INCONSISTÊNCIAS

### 🎯 Pergunta
**"O que está errado no ponto?"**

### 📊 Resumo (2 Cards)
```
┌──────────────────┬──────────────────┐
│ Total de Erros   │ Funcionários     │
│ 15               │ 5                │
│ inconsistências  │ afetados         │
└──────────────────┴──────────────────┘
```

### 📋 Tabela
| Funcionário | Data | Problema | Gravidade | Ação |
|-------------|------|----------|-----------|------|
| João Silva | 01/04/2026 | Falta de batida | Crítica | Revisar |
| Maria Santos | 02/04/2026 | Intervalo irregular | Média | Avisar |
| Pedro Costa | 03/04/2026 | Jornada incompleta | Leve | Monitorar |
| Ana Silva | 04/04/2026 | Batida duplicada | Crítica | Corrigir |

### Problemas Possíveis
- **Falta de batida** - Entrada ou saída não registrada
- **Intervalo irregular** - Pausa fora do horário esperado
- **Jornada incompleta** - Menos de 4 horas trabalhadas
- **Batida duplicada** - Múltiplas batidas no mesmo horário
- **Horário inconsistente** - Entrada/saída fora do padrão

### Gravidade
- **Leve** - Desvio menor, sem impacto
- **Média** - Desvio moderado, requer atenção
- **Crítica** - Desvio grave, requer ação imediata

### Colunas
- Funcionário: Nome completo
- Data: DD/MM/AAAA
- Problema: Descrição do erro
- Gravidade: Leve/Média/Crítica
- Ação: Revisar/Avisar/Monitorar/Corrigir

### Filtros
- Período
- Funcionário(s)
- Departamento(s)
- Gravidade (opcional)
- Tipo de Problema (opcional)

### Exportação
- **PDF**: Resumo + Tabela (para ação)
- **Excel**: Dados completos + histórico de correções

---

## 4. RELATÓRIO DE BANCO DE HORAS

### 🎯 Pergunta
**"Qual o saldo de cada funcionário?"**

### 📊 Resumo (2 Cards)
```
┌──────────────────┬──────────────────┐
│ Total Positivo   │ Total Negativo   │
│ +120:00          │ -45:30           │
│ horas            │ horas            │
└──────────────────┴──────────────────┘
```

### 📋 Tabela
| Funcionário | Saldo Anterior | Crédito | Débito | Saldo Atual | Status |
|-------------|----------------|---------|--------|-------------|--------|
| João Silva | +10:00 | +05:30 | -02:00 | +13:30 | OK |
| Maria Santos | -05:00 | +08:00 | -03:00 | 0:00 | Zerado |
| Pedro Costa | +20:00 | +02:00 | -15:00 | +07:00 | OK |
| Ana Silva | -30:00 | +10:00 | -05:00 | -25:00 | Negativo |

### Status
- **OK** - Saldo positivo
- **Zerado** - Saldo em 0:00
- **Negativo** - Saldo devedor

### Colunas
- Funcionário: Nome completo
- Saldo Anterior: HH:MM (saldo do período anterior)
- Crédito: HH:MM (horas ganhas no período)
- Débito: HH:MM (horas usadas no período)
- Saldo Atual: HH:MM (saldo final)
- Status: OK/Zerado/Negativo

### Filtros
- Data de Corte
- Funcionário(s)
- Departamento(s)
- Status (opcional)

### Exportação
- **PDF**: Resumo + Tabela (para comunicação)
- **Excel**: Histórico completo + projeção

---

## 5. RELATÓRIO DE SEGURANÇA (ANTIFRAUDE) 🔒

### 🎯 Pergunta
**"Existe comportamento suspeito?"**

### 📊 Resumo (2 Cards)
```
┌──────────────────┬──────────────────┐
│ Eventos Suspeitos│ Funcionários     │
│ 8                │ 3                │
│ eventos          │ com risco        │
└──────────────────┴──────────────────┘
```

### 📋 Tabela
| Funcionário | Data | Tipo de Evento | Risco | Detalhes |
|-------------|------|----------------|-------|----------|
| João Silva | 01/04/2026 | Localização inconsistente | Alto | Batida em 2 cidades diferentes |
| Maria Santos | 02/04/2026 | Troca de dispositivo | Médio | Novo dispositivo detectado |
| Pedro Costa | 03/04/2026 | Batida manual excessiva | Médio | 5 batidas manuais em 1 semana |
| Ana Silva | 04/04/2026 | Falha de biometria | Baixo | Múltiplas tentativas |

### Eventos Suspeitos
- **Localização inconsistente** - Batidas em locais muito distantes
- **Troca de dispositivo** - Novo dispositivo/navegador detectado
- **Batida manual excessiva** - Muitas batidas manuais em curto período
- **Falha de biometria** - Múltiplas tentativas de autenticação
- **Horário anômalo** - Batidas fora do horário usual
- **Padrão quebrado** - Desvio significativo do padrão normal

### Risco
- **Baixo** - Comportamento incomum, sem indicadores de fraude
- **Médio** - Múltiplos indicadores, requer investigação
- **Alto** - Forte indicador de fraude, ação imediata

### Colunas
- Funcionário: Nome completo
- Data: DD/MM/AAAA
- Tipo de Evento: Descrição do comportamento suspeito
- Risco: Baixo/Médio/Alto
- Detalhes: Informações técnicas (sem dados sensíveis)

### Filtros
- Período
- Funcionário(s)
- Departamento(s)
- Nível de Risco (opcional)
- Tipo de Evento (opcional)

### Exportação
- **PDF**: Resumo + Tabela (para segurança)
- **Excel**: Dados completos + análise técnica

### ⚠️ IMPORTANTE
- Sem dados técnicos sensíveis (IP, GPS exato)
- Apenas indicadores de comportamento
- Pronto para investigação manual
- Conformidade com LGPD

---

## 6. RELATÓRIO DE HORAS TRABALHADAS

### 🎯 Pergunta
**"Quanto cada funcionário trabalhou no período?"**

### 📊 Resumo (2 Cards)
```
┌──────────────────┬──────────────────┐
│ Total Geral      │ Média por Func.  │
│ 3.200:00         │ 160:00           │
│ horas            │ horas            │
└──────────────────┴──────────────────┘
```

### 📋 Tabela
| Funcionário | Dias Trabalhados | Total Horas | Média Diária | Variação |
|-------------|------------------|-------------|--------------|----------|
| João Silva | 20 | 160:00 | 08:00 | 0% |
| Maria Santos | 19 | 152:00 | 08:00 | -5% |
| Pedro Costa | 21 | 168:00 | 08:00 | +5% |
| Ana Silva | 18 | 144:00 | 08:00 | -10% |

### Colunas
- Funcionário: Nome completo
- Dias Trabalhados: Quantidade de dias com marcação
- Total Horas: HH:MM (soma de todas as horas)
- Média Diária: HH:MM (total / dias trabalhados)
- Variação: % (comparado com jornada esperada)

### Filtros
- Período
- Funcionário(s)
- Departamento(s)
- Ordenação (por horas, por funcionário, etc)

### Exportação
- **PDF**: Resumo + Tabela (para gestão)
- **Excel**: Dados completos + análise de tendências

---

## 🚫 ERROS QUE VOCÊ PRECISA EVITAR

### ❌ 1. Misturar tudo em um relatório só
**Errado**: Um relatório com jornada + extras + inconsistências
**Certo**: 6 relatórios separados, cada um respondendo uma pergunta

### ❌ 2. Colocar dados técnicos demais
**Errado**: IP, GPS exato, tipo de batida, dispositivo
**Certo**: Apenas dados comerciais/legais

### ❌ 3. Não ter resumo
**Errado**: Tabela sem contexto
**Certo**: Cards de resumo antes da tabela

### ❌ 4. Tabela genérica sem contexto
**Errado**: Colunas iguais em todos os relatórios
**Certo**: Colunas específicas para cada pergunta

### ❌ 5. Sem filtros
**Errado**: Mostrar todos os dados sempre
**Certo**: Permitir filtrar por período, funcionário, departamento

### ❌ 6. Sem exportação
**Errado**: Apenas visualizar na tela
**Certo**: Exportar em PDF (limpo) e Excel (completo)

### ❌ 7. Sem status/indicadores
**Errado**: Apenas números
**Certo**: Status visual (OK/Alerta/Crítico)

### ❌ 8. Sem ação
**Errado**: Relatório informativo apenas
**Certo**: Relatório com ações sugeridas

---

## ✅ CHECKLIST PARA CADA RELATÓRIO

- [ ] Define UMA pergunta clara?
- [ ] Tem 2-3 cards de resumo?
- [ ] Tabela tem colunas específicas?
- [ ] Sem dados técnicos?
- [ ] Tem status/indicadores?
- [ ] Tem filtros?
- [ ] Exporta PDF (limpo)?
- [ ] Exporta Excel (completo)?
- [ ] Pronto para impressão?
- [ ] Pronto para ação?

---

## 📁 ESTRUTURA DE IMPLEMENTAÇÃO

```
src/pages/reports/
├── JourneyReport.tsx (Jornada)
├── OvertimeReport.tsx (Horas Extras)
├── InconsistencyReport.tsx (Inconsistências)
├── BankHoursReport.tsx (Banco de Horas)
├── SecurityReport.tsx (Segurança)
└── WorkedHoursReport.tsx (Horas Trabalhadas)

src/utils/
├── reportExport.ts (Exportação)
└── reportCalculations.ts (Cálculos)

src/components/Reports/
└── ReportLayout.tsx (Base)
```

---

## 🎯 PRIORIDADE DE IMPLEMENTAÇÃO

1. **Alta**: Jornada + Horas Extras + Banco de Horas
2. **Média**: Inconsistências + Horas Trabalhadas
3. **Diferencial**: Segurança (Antifraude)

---

## 📝 STATUS

- ✅ Especificações definidas
- ⏳ Implementação dos 6 relatórios
- ⏳ Testes e validação
- ⏳ Deploy em produção
