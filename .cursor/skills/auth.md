# Authentication Flow

- Sempre limpar sessão no logout
- Garantir reset de estado global
- Não confiar apenas no localStorage

## Logout correto
- supabase.auth.signOut()
- limpar storage
- resetar contexto

## Problemas comuns
- usuário não consegue logar novamente
- sessão persistida incorretamente