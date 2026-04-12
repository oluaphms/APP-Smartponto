# GUIA RÁPIDO: 6 RELATÓRIOS DO CHRONODIGITAL

## 📊 COMPARAÇÃO RÁPIDA

| Relatório | Pergunta | Resumo | Tabela Principal | Prioridade |
|-----------|----------|--------|------------------|-----------|
| **Jornada** | Cumpriu jornada? | Dias trab. / Faltantes / Erros | Func. / Data / Prev. / Real / Status | 🔴 Alta |
| **Extras** | Quanto extra? | Total / Dias com extra | Func. / Data / Normal / Extra / Tipo | 🔴 Alta |
| **Inconsistências** | O que errou? | Total / Afetados | Func. / Data / Problema / Gravidade / Ação | 🟡 Média |
| **Banco Horas** | Qual saldo? | Positivo / Negativo | Func. / Anterior / Crédito / Débito / Atual | 🔴 Alta |
| **Segurança** | Comportamento suspeito? | Eventos / Afetados | Func. / Data / Tipo / Risco / Detalhes | 🟢 Diferencial |
| **Horas Trab.** | Quanto trabalhou? | Total / Média | Func. / Dias / Total / Média / Variação | 🟡 Média |

---

## 🎯 QUANDO USAR CADA UM

### 1. JORNADA
**Quando**: Controle diário de cumprimento
**Quem**: RH, Gestor, Funcionário
**Ação**: Verificar se jornada foi cumprida

### 2. EXTRAS
**Quando**: Controle de horas extras
**Quem**: RH, Financeiro, Gestor
**Ação**: Aprovar/Rejeitar extras, calcular valores

### 3. INCONSISTÊNCIAS
**Quando**: Auditoria de ponto
**Quem**: RH, Segurança
**Ação**: Investigar e corrigir erros

### 4. BANCO HORAS
**Quando**: Controle de saldo
**Quem**: RH, Funcionário
**Ação**: Compensar horas, comunicar saldo

### 5. SEGURANÇA
**Quando**: Detecção de fraude
**Quem**: Segurança, RH
**Ação**: Investigar comportamento suspeito

### 6. HORAS TRABALHADAS
**Quando**: Análise de produtividade
**Quem**: Gestor, RH
**Ação**: Avaliar desempenho, tendências

---

## 🚀 COMO IMPLEMENTAR

### Passo 1: Criar Tipos
```typescript
// src/types/reports.ts
export interface JourneyData { ... }
export interface OvertimeData { ... }
// ... etc
```

### Passo 2: Criar Utilitários
```typescript
// src/utils/journeyCalculations.ts
export function getJourneyData(...) { ... }

// src/utils/overtimeCalculations.ts
export function getOvertimeData(...) { ... }
// ... etc
```

### Passo 3: Criar Página
```typescript
// src/pages/reports/JourneyReport.tsx
export const JourneyReport: React.FC = () => {
  // Usar ReportLayout
  // Usar utilitários de cálculo
  // Usar exportReport
}
```

### Passo 4: Testar
- [ ] Dados carregam?
- [ ] Filtros funcionam?
- [ ] PDF exporta limpo?
- [ ] Excel exporta completo?

---

## 📋 ESTRUTURA PADRÃO

Toda página de relatório segue:

```typescript
import ReportLayout from '@/components/Reports/ReportLayout';
import { exportReport } from '@/utils/reportExport';
import { getReportData } from '@/utils/reportCalculations';

export const ReportPage: React.FC = () => {
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState([]);

  useEffect(() => {
    loadData();
  }, [filters]);

  const loadData = async () => {
    const reportData = await getReportData(filters);
    setData(reportData.data);
    setSummary(reportData.summary);
  };

  return (
    <ReportLayout
      title="NOME DO RELATÓRIO"
      company={user.company?.name}
      filters={[...]}
      summary={summary}
      columns={[...]}
      data={data}
    >
      <button onClick={() => exportReport(config, ['pdf'])}>
        Exportar PDF
      </button>
    </ReportLayout>
  );
};
```

---

## 🎨 PADRÃO VISUAL

### Cabeçalho
```
NOME DO RELATÓRIO
Empresa: [Nome]
Filtros: Período | Funcionário | Departamento
```

### Resumo (Cards)
```
┌──────────────┬──────────────┬──────────────┐
│ Indicador 1  │ Indicador 2  │ Indicador 3  │
│ [Valor]      │ [Valor]      │ [Valor]      │
│ [Unidade]    │ [Unidade]    │ [Unidade]    │
└──────────────┴──────────────┴──────────────┘
```

### Tabela
- Cabeçalho: Cinza escuro, texto branco
- Linhas: Alternadas (branco/cinza claro)
- Alinhamento: Centro para horários, esquerda para texto
- Bordas: Leves

---

## 🚫 ERROS COMUNS

| Erro | ❌ | ✅ |
|------|----|----|
| Misturar dados | Jornada + Extras | Relatórios separados |
| Dados técnicos | IP, GPS, tipo | Apenas comercial |
| Sem resumo | Tabela direto | Cards antes |
| Sem filtros | Mostrar tudo | Filtrar por período |
| Sem exportação | Apenas tela | PDF + Excel |
| Sem status | Números | Status visual |

---

## 📦 CHECKLIST DE IMPLEMENTAÇÃO

- [ ] Tipos definidos
- [ ] Utilitários criados
- [ ] Página criada
- [ ] Dados carregam
- [ ] Filtros funcionam
- [ ] PDF exporta
- [ ] Excel exporta
- [ ] Testado com dados reais
- [ ] Documentado
- [ ] Pronto para produção

---

## 🔗 REFERÊNCIAS

- `.kiro/RELATORIOS_ESPECIFICACOES_DETALHADAS.md` - Especificações completas
- `.kiro/ARQUITETURA_IMPLEMENTACAO_RELATORIOS.md` - Arquitetura técnica
- `.kiro/PADRAO_RELATORIOS_CHRONODIGITAL.md` - Padrão base
- `src/components/Reports/ReportLayout.tsx` - Componente base
- `src/utils/reportExport.ts` - Exportação

---

## 🎯 ORDEM DE IMPLEMENTAÇÃO

1. **JourneyReport** (Jornada) - Mais simples
2. **OvertimeReport** (Extras) - Cálculos
3. **BankHoursReport** (Banco) - Acumulativo
4. **InconsistencyReport** (Erros) - Detecção
5. **WorkedHoursReport** (Horas) - Análise
6. **SecurityReport** (Segurança) - Complexo

---

## 💡 DICAS

1. **Reutilize o ReportLayout** - Não reinvente a roda
2. **Use utilitários de cálculo** - Separe lógica de apresentação
3. **Teste com dados reais** - Não use dados fake
4. **Valide exportação** - PDF e Excel devem estar perfeitos
5. **Documente tudo** - Facilita manutenção futura

---

## 🚀 RESULTADO

Ao final:
- ✅ 6 relatórios profissionais
- ✅ Cada um respondendo uma pergunta
- ✅ Sem poluição visual
- ✅ Exportáveis em PDF e Excel
- ✅ Prontos para ação
- ✅ Diferencial competitivo

---

## 📞 SUPORTE

Dúvidas? Consulte:
- Especificações: `.kiro/RELATORIOS_ESPECIFICACOES_DETALHADAS.md`
- Arquitetura: `.kiro/ARQUITETURA_IMPLEMENTACAO_RELATORIOS.md`
- Padrão: `.kiro/PADRAO_RELATORIOS_CHRONODIGITAL.md`
