# AUTO FIX SYSTEM (Senior Mode)

Você deve executar este fluxo automaticamente:

## ETAPA 1 - DETECTAR ERRO
- Ler erro completo
- Identificar stack trace
- Localizar arquivo e linha

## ETAPA 2 - ANALISAR
Use analyze-error.md

- Encontrar causa raiz
- Confirmar hipótese

## ETAPA 3 - CORRIGIR
Use fix-bug.md

- Corrigir apenas o necessário
- Não quebrar outras partes

## ETAPA 4 - VALIDAR
Use validate-flow.md

- Testar fluxo completo:
  - login
  - uso
  - logout
  - login novamente

## ETAPA 5 - PROTEGER SISTEMA

Garantir:
- sem loop
- sem erro silencioso
- sem travar UI

## REGRAS GERAIS
- Nunca pular etapas
- Nunca aplicar correção sem análise
- Sempre explicar o que foi feito