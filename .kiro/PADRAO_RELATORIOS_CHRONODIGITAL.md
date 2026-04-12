# PADRÃO DE RELATÓRIOS - CHRONODIGITAL

## 👉 REGRA DE OURO
**Cada relatório deve responder UMA pergunta clara**

Se não responde, está mal definido.

---

## 🔧 PADRÃO BASE (VALE PARA TODOS)

Todos os relatórios devem seguir essa estrutura:

### 1. CABEÇALHO
```
┌─────────────────────────────────────────────────────────────┐
│ Nome do Relatório                                           │
│ Empresa: [Nome da Empresa]                                  │
│                                                             │
│ Filtros Aplicados:                                          │
│ • Período: DD/MM/AAAA a DD/MM/AAAA                         │
│ • Funcionário(s): [Nome ou Todos]                          │
│ • Departamento(s): [Nome ou Todos]                         │
│ • [Outros filtros específicos do relatório]                │
└─────────────────────────────────────────────────────────────┘
```

**Regras**:
- ✅ Nome do relatório em destaque (14-16pt, bold)
- ✅ Empresa sempre visível
- ✅ Filtros aplicados listados claramente
- ✅ Data/hora de geração no rodapé

### 2. RESUMO (CARDS NO TOPO)
Sempre antes da tabela:

```
┌──────────────────┬──────────────────┬──────────────────┐
│ Total Geral      │ Indicador 1      │ Indicador 2      │
│ [Valor Principal]│ [Valor]          │ [Valor]          │
│ [Unidade]        │ [Descrição]      │ [Descrição]      │
└──────────────────┴──────────────────┴──────────────────┘
```

**Exemplos por tipo de relatório**:

#### Espelho de Ponto
- Total de Horas Trabalhadas
- Dias Trabalhados
- Faltas

#### Relatório de Horas Extras
- Total de Horas Extras
- Valor Total (se aplicável)
- Média por Funcionário

#### Relatório de Ausências
- Total de Faltas
- Total de Atrasos
- Taxa de Absenteísmo (%)

#### Relatório de Departamento
- Total de Funcionários
- Horas Totais
- Produtividade (%)

### 3. TABELA PRINCIPAL

**Regras Gerais**:
- ✅ Dados organizados e limpos
- ✅ Sem poluição visual
- ✅ Sem dados técnicos (IP, GPS, etc)
- ✅ Colunas ordenáveis (se possível)
- ✅ Cores alternadas para legibilidade
- ✅ Bordas leves
- ✅ Fonte: 9-10pt

**Estrutura**:
```
┌─────────────┬──────────┬──────────┬──────────┬──────────┐
│ Coluna 1    │ Coluna 2 │ Coluna 3 │ Coluna 4 │ Coluna 5 │
├─────────────┼──────────┼──────────┼──────────┼──────────┤
│ Dado 1      │ Dado 2   │ Dado 3   │ Dado 4   │ Dado 5   │
│ Dado 1      │ Dado 2   │ Dado 3   │ Dado 4   │ Dado 5   │
│ Dado 1      │ Dado 2   │ Dado 3   │ Dado 4   │ Dado 5   │
└─────────────┴──────────┴──────────┴──────────┴──────────┘
```

**Máximo de colunas**: 7-8 (para não quebrar layout)

### 4. EXPORTAÇÃO

#### PDF (Visual Limpo)
- ✅ Sem dados técnicos
- ✅ Sem localização
- ✅ Sem tipo de batida
- ✅ Apenas dados legais/comerciais
- ✅ Pronto para impressão
- ✅ Pronto para assinatura (se necessário)

#### Excel (Dados Completos)
- ✅ Inclui todos os dados
- ✅ Múltiplas abas (se necessário)
- ✅ Formatação básica
- ✅ Sem limite de colunas
- ✅ Dados brutos para análise

---

## 📋 TIPOS DE RELATÓRIOS

### 1. ESPELHO DE PONTO
**Pergunta**: Qual foi a jornada de trabalho do funcionário?

**Cabeçalho**:
- Período
- Funcionário
- Cargo/Departamento

**Resumo**:
- Total de Horas
- Dias Trabalhados
- Faltas

**Tabela**:
| Data | Entrada | Pausa | Retorno | Saída | Horas | Ocorrência |

**Exportação**:
- PDF: Limpo, pronto para assinatura
- Excel: Dados completos

---

### 2. RELATÓRIO DE HORAS EXTRAS
**Pergunta**: Quantas horas extras foram trabalhadas?

**Cabeçalho**:
- Período
- Funcionário(s)
- Departamento(s)

**Resumo**:
- Total de Horas Extras
- Valor Total (se aplicável)
- Média por Funcionário

**Tabela**:
| Data | Funcionário | Horas Extras | Motivo | Aprovado |

**Exportação**:
- PDF: Resumo executivo
- Excel: Dados detalhados

---

### 3. RELATÓRIO DE AUSÊNCIAS
**Pergunta**: Qual é o padrão de ausências?

**Cabeçalho**:
- Período
- Departamento(s)
- Tipo de Ausência

**Resumo**:
- Total de Faltas
- Total de Atrasos
- Taxa de Absenteísmo (%)

**Tabela**:
| Data | Funcionário | Tipo | Departamento | Justificativa |

**Exportação**:
- PDF: Resumo por departamento
- Excel: Dados individuais

---

### 4. RELATÓRIO DE DEPARTAMENTO
**Pergunta**: Como está a produtividade do departamento?

**Cabeçalho**:
- Período
- Departamento
- Gestor

**Resumo**:
- Total de Funcionários
- Horas Totais
- Produtividade (%)

**Tabela**:
| Funcionário | Horas | Faltas | Atrasos | Extras | Status |

**Exportação**:
- PDF: Resumo executivo
- Excel: Dados detalhados

---

### 5. RELATÓRIO DE BANCO DE HORAS
**Pergunta**: Qual é o saldo de banco de horas?

**Cabeçalho**:
- Data de Corte
- Funcionário(s)
- Departamento(s)

**Resumo**:
- Saldo Total Positivo
- Saldo Total Negativo
- Média por Funcionário

**Tabela**:
| Funcionário | Saldo Anterior | Período | Saldo Atual | Status |

**Exportação**:
- PDF: Resumo por funcionário
- Excel: Histórico completo

---

## 🎨 PADRÕES VISUAIS

### Tipografia
- **Título Relatório**: 16pt, bold, preto
- **Cabeçalho Tabela**: 9pt, bold, branco sobre cinza escuro
- **Corpo Tabela**: 9pt, normal, preto
- **Resumo Cards**: 11pt, bold para valor, 9pt para descrição

### Cores
- **Cabeçalho Tabela**: RGB(51, 65, 85) - cinza escuro
- **Linhas Alternadas**: RGB(245, 245, 245) - cinza claro
- **Bordas**: RGB(200, 200, 200) - cinza médio
- **Texto**: RGB(0, 0, 0) - preto
- **Destaque**: RGB(59, 130, 246) - azul

### Espaçamento
- **Margem Superior**: 15mm
- **Margem Lateral**: 15mm
- **Margem Inferior**: 20mm
- **Espaço entre seções**: 10mm

### Layout
- **Orientação**: Portrait (padrão) ou Landscape (se necessário)
- **Tamanho**: A4
- **Sem quebra de página** no meio de linhas

---

## ✅ CHECKLIST PARA NOVO RELATÓRIO

Ao criar um novo relatório, verificar:

- [ ] Define UMA pergunta clara?
- [ ] Tem cabeçalho com filtros?
- [ ] Tem resumo com indicadores?
- [ ] Tem tabela principal limpa?
- [ ] Exporta para PDF (limpo)?
- [ ] Exporta para Excel (completo)?
- [ ] Sem dados técnicos (IP, GPS, etc)?
- [ ] Sem poluição visual?
- [ ] Segue padrão de cores?
- [ ] Segue padrão de tipografia?
- [ ] Pronto para impressão?
- [ ] Pronto para assinatura (se necessário)?

---

## 🚀 IMPLEMENTAÇÃO

### Componente Base (Reutilizável)
```typescript
interface ReportConfig {
  title: string;
  company: string;
  filters: {
    period: { start: string; end: string };
    employees?: string[];
    departments?: string[];
    [key: string]: any;
  };
  summary: {
    label: string;
    value: string | number;
    unit?: string;
  }[];
  columns: {
    key: string;
    label: string;
    align?: 'left' | 'center' | 'right';
  }[];
  data: any[];
  exportPDF?: () => void;
  exportExcel?: () => void;
}
```

### Estrutura de Pasta
```
src/
├── components/
│   └── Reports/
│       ├── ReportHeader.tsx
│       ├── ReportSummary.tsx
│       ├── ReportTable.tsx
│       └── ReportLayout.tsx
├── pages/
│   └── reports/
│       ├── Timesheet.tsx (Espelho de Ponto)
│       ├── OvertimeReport.tsx (Horas Extras)
│       ├── AbsenceReport.tsx (Ausências)
│       ├── DepartmentReport.tsx (Departamento)
│       └── BankHoursReport.tsx (Banco de Horas)
└── utils/
    └── reportExport.ts (PDF/Excel)
```

---

## 📝 PRÓXIMOS PASSOS

1. ✅ Criar componentes base (ReportHeader, ReportSummary, ReportTable)
2. ✅ Implementar ReportLayout reutilizável
3. ✅ Criar utilitários de exportação (PDF/Excel)
4. ✅ Refatorar Espelho de Ponto com novo padrão
5. ⏳ Criar Relatório de Horas Extras
6. ⏳ Criar Relatório de Ausências
7. ⏳ Criar Relatório de Departamento
8. ⏳ Criar Relatório de Banco de Horas

---

## 🎯 RESULTADO ESPERADO

Todos os relatórios do ChronoDigital:
- ✅ Seguem o mesmo padrão visual
- ✅ Respondem uma pergunta clara
- ✅ Sem poluição visual
- ✅ Sem dados técnicos
- ✅ Prontos para impressão
- ✅ Prontos para assinatura
- ✅ Exportáveis em PDF e Excel
- ✅ Profissionais e confiáveis
