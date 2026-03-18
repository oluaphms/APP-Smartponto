# Supabase Rules

- Sempre tratar erro após qualquer operação
- Nunca assumir que insert/update funcionou
- Validar dados antes de enviar

## Exemplo padrão
try {
  const { data, error } = await supabase.from('table').insert([payload])

  if (error) throw error

} catch (err) {
  console.error(err)
}

## Regras
- Nunca deixar erro silencioso
- Sempre retornar feedback para o usuário                                                                                                                                                                                                                                                                                                                                                               