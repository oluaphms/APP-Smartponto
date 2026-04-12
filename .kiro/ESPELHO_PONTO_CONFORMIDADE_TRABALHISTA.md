# ESPELHO DE PONTO - CONFORMIDADE TRABALHISTA BRASILEIRA

## 🎯 Objetivo
Refatoração completa da geração do PDF de Espelho de Ponto do ChronoDigital, garantindo conformidade com boas práticas trabalhistas brasileiras.

## 📌 1. ESTRUTURA DO DOCUMENTO

### 1.1 Cabeçalho
- **Título centralizado**: ESPELHO DE PONTO
- **Período**: DD/MM/AAAA a DD/MM/AAAA
- **Fonte**: Arial/Helvetica, 14pt bold

### 1.2 Dados do Colaborador
Exibido para cada funcionário:
- **Nome completo** (em uma única linha, sem quebra)
- **Cargo** (se disponível)
- **Departamento** (se disponível)
- **Fonte**: 11pt bold para nome, 9pt normal para dados

## 📊 2. TABELA PRINCIPAL (OBRIGATÓRIA)

### Colunas:
| Campo | Formato | Alinhamento |
|-------|---------|-------------|
| Data | DD/MM/AAAA | Centro |
| Entrada | HH:MM | Centro |
| Pausa | HH:MM | Centro |
| Retorno | HH:MM | Centro |
| Saída | HH:MM | Centro |
| Horas | HH:MM | Centro |
| Ocorrência | Texto | Centro |

### Regras:
- ✅ Uma linha por dia
- ✅ Datas em formato DD/MM/AAAA
- ✅ Horários em formato HH:MM
- ✅ Horas trabalhadas em formato HH:MM
- ✅ Alinhamento central para todos os campos
- ✅ Cores alternadas para legibilidade
- ✅ Bordas leves

### Campo "Ocorrência":
Valores possíveis:
- **OK** - Dia normal trabalhado
- **Falta** - Sem marcação
- **Atraso** - Entrada após horário
- **Folga** - Dia de folga configurado
- **Inconsistência** - Dados inconsistentes

## 🚫 3. DADOS PROIBIDOS NO ESPELHO

❌ **NÃO incluir**:
- Localização (endereço, GPS, coordenadas)
- Tipo de batida (foto, biometria, manual, admin)
- Logs detalhados de batidas
- IP, dispositivo, navegador
- Strings técnicas ou códigos internos
- Caracteres inválidos (￾, %%, etc)
- Indicadores técnicos (⚠, ⚡, etc)

✅ **Essas informações devem existir apenas em relatório separado de auditoria**

## 🧮 4. RESUMO FINAL (RODAPÉ)

Ao final da tabela de cada colaborador, incluir:

```
Total de Horas: HH:MM
Dias Trabalhados: NN
Faltas: NN
```

Formato:
- **Total de Horas**: Soma de todas as horas trabalhadas
- **Dias Trabalhados**: Quantidade de dias com marcação
- **Faltas**: Quantidade de dias sem marcação

## ✍️ 5. ASSINATURAS

Adicionar ao final de cada espelho:

```
_____________________                    _____________________
Funcionário                              RH / Responsável
Data: ___/___/_____                      Data: ___/___/_____
```

Regras:
- Duas colunas (esquerda e direita)
- Linhas de assinatura com 35mm de comprimento
- Espaço de 15mm para assinatura
- Campos de data em branco para preenchimento manual

## 🎨 6. PADRÕES VISUAIS

### Tipografia
- **Fonte**: Arial, Helvetica ou similar
- **Título**: 14pt, bold, centralizado
- **Cabeçalho tabela**: 9pt, bold, branco sobre fundo escuro
- **Corpo tabela**: 9pt, normal
- **Rodapé**: 8pt, normal

### Espaçamento
- **Margem superior**: 15mm
- **Margem lateral**: 15mm
- **Margem inferior**: 50mm (para assinatura)
- **Espaço entre seções**: 8-10mm

### Cores
- **Cabeçalho tabela**: RGB(51, 65, 85) - cinza escuro
- **Texto cabeçalho**: Branco
- **Linhas alternadas**: RGB(245, 245, 245) - cinza claro
- **Bordas**: Cinza claro

### Layout
- **Orientação**: Portrait (A4)
- **Tamanho página**: 210mm x 297mm
- **Sem quebra de página** no meio de linhas
- **Nome do colaborador NÃO quebra** em múltiplas linhas

## 🧹 7. CORREÇÕES OBRIGATÓRIAS

✅ **Implementado**:
- ✅ Sem problemas de encoding
- ✅ Sem quebra de layout
- ✅ Sem repetição de informações
- ✅ Sem poluição visual
- ✅ Sem dados redundantes
- ✅ Sem dados técnicos
- ✅ Sem localização
- ✅ Sem tipo de batida

## 🧩 8. ARQUITETURA

### Dois Relatórios Distintos:

#### 📄 1. Espelho de Ponto (OFICIAL)
- Simples e limpo
- Apenas tabela + resumo
- Usado para assinatura
- Conformidade trabalhista
- **Arquivo**: `espelho-ponto-YYYY-MM-DD-YYYY-MM-DD.pdf`

#### 📊 2. Relatório de Auditoria (TÉCNICO) - Futuro
- Contém tipo de batida
- Contém localização
- Contém IP/dispositivo
- Contém logs completos
- Uso interno apenas

## ⚙️ 9. REGRAS DE NEGÓCIO

✅ **Implementado**:
- ✅ Cada linha representa UM DIA
- ✅ Suporta dias sem marcação (Falta)
- ✅ Destaca inconsistências automaticamente
- ✅ Considera jornada configurada
- ✅ Integra com banco de horas

## ✅ RESULTADO ESPERADO

Um PDF:
- ✅ Limpo e profissional
- ✅ Legível e bem formatado
- ✅ Juridicamente confiável
- ✅ Sem poluição visual
- ✅ Pronto para auditoria
- ✅ Pronto para assinatura
- ✅ Conformidade trabalhista brasileira

## 📋 EXEMPLO DE LAYOUT

```
═══════════════════════════════════════════════════════════════════════════
                          ESPELHO DE PONTO
                    Período: 01/04/2026 a 30/04/2026
═══════════════════════════════════════════════════════════════════════════

Colaborador: João Silva da Santos
Cargo: Analista de Sistemas
Departamento: Tecnologia

┌──────────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│ Data         │ Entrada  │ Pausa    │ Retorno  │ Saída    │ Horas    │ Ocorrência│
├──────────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ 01/04/2026   │ 08:00    │ 12:00    │ 13:00    │ 17:30    │ 08:30    │ OK       │
│ 02/04/2026   │ 08:15    │ 12:00    │ 13:00    │ 17:30    │ 08:15    │ Atraso   │
│ 03/04/2026   │ —        │ —        │ —        │ —        │ —        │ Falta    │
│ 04/04/2026   │ —        │ —        │ —        │ —        │ —        │ Folga    │
│ 05/04/2026   │ 08:00    │ 12:00    │ 13:00    │ 17:30    │ 08:30    │ OK       │
└──────────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘

Total de Horas: 33:45
Dias Trabalhados: 3
Faltas: 1

_____________________                    _____________________
Funcionário                              RH / Responsável
Data: ___/___/_____                      Data: ___/___/_____
```

## 📝 ARQUIVO MODIFICADO
- `src/pages/admin/Timesheet.tsx`

## 🚨 PRIORIDADE
**ALTA** — Este documento é crítico para conformidade trabalhista e credibilidade do sistema.

## ✅ STATUS
- ✅ Build passou com sucesso
- ✅ Implementação completa
- ✅ Pronto para produção
- ✅ Conformidade trabalhista brasileira
