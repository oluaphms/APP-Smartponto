# React Best Practices

- Nunca usar hooks fora de componentes
- useEffect deve ter dependências corretas
- Evitar múltiplos estados desnecessários
- Preferir componentes pequenos e reutilizáveis

## Problemas comuns
- Loop infinito em useEffect
- Estado não atualizado corretamente
- Re-render desnecessário

## Boas práticas
- Usar loading e error states
- Sempre validar dados antes de renderizar