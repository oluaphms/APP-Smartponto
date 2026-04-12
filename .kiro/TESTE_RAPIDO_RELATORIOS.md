# Teste Rápido - Relatórios ChronoDigital

## 🚀 Como Testar em 5 Minutos

### 1. Acessar Hub de Relatórios
```
http://localhost:3000/admin/reports
```

**Você deve ver:**
- ✅ Página com título "Relatórios"
- ✅ Grid com 6 cards coloridos
- ✅ Cada card tem ícone, título, descrição e badge
- ✅ Info box com dica
- ✅ Quick stats no rodapé

### 2. Clicar em "Relatório de Jornada"
```
Clique no primeiro card (azul com ícone de relógio)
```

**Você deve ver:**
- ✅ Página com filtros (data inicial, data final)
- ✅ Botões "Exportar PDF" e "Exportar Excel"
- ✅ Resumo com cards (Total de Dias, Dias Cumpridos, etc)
- ✅ Tabela com dados de exemplo

### 3. Testar Filtros
```
1. Alterar data inicial
2. Alterar data final
3. Clicar em coluna da tabela para ordenar
```

**Você deve ver:**
- ✅ Tabela atualiza automaticamente
- ✅ Ordenação funciona (asc/desc)
- ✅ Dados de exemplo aparecem

### 4. Testar Exportação PDF
```
Clicar em "Exportar PDF"
```

**Você deve ver:**
- ✅ PDF é baixado automaticamente
- ✅ Nome do arquivo: `relatorio-journey-YYYY-MM-DD.pdf`
- ✅ PDF contém:
  - Cabeçalho com título e período
  - Resumo com indicadores
  - Tabela com dados
  - Rodapé com número de página

### 5. Testar Exportação Excel
```
Clicar em "Exportar Excel"
```

**Você deve ver:**
- ✅ Excel é baixado automaticamente
- ✅ Nome do arquivo: `relatorio-journey-YYYY-MM-DD.xlsx`
- ✅ Excel contém:
  - Aba "Dados" com tabela
  - Aba "Resumo" com indicadores

---

## 🧪 Checklist de Teste

### Hub de Relatórios (/admin/reports)
- [ ] Página carrega sem erros
- [ ] 6 cards aparecem
- [ ] Cards têm ícones coloridos
- [ ] Cards têm títulos e descrições
- [ ] Cards têm badges (Essencial, Importante, Diferencial)
- [ ] Info box aparece
- [ ] Quick stats aparecem
- [ ] Clique em card leva para relatório

### Relatório de Jornada
- [ ] Página carrega sem erros
- [ ] Filtros aparecem (data inicial, data final)
- [ ] Botões de exportação aparecem
- [ ] Resumo com cards aparece
- [ ] Tabela com dados aparece
- [ ] Dados de exemplo carregam
- [ ] Ordenação funciona
- [ ] Exportação PDF funciona
- [ ] Exportação Excel funciona

### Responsividade
- [ ] Mobile (< 640px): 1 coluna
- [ ] Tablet (640px - 1024px): 2 colunas
- [ ] Desktop (> 1024px): 3 colunas

### Dark Mode
- [ ] Página funciona em light mode
- [ ] Página funciona em dark mode
- [ ] Cores legíveis em ambos os modos

---

## 🐛 Troubleshooting

### Problema: Página não carrega
**Solução:**
```bash
npm run dev
# Verificar console para erros
# Limpar cache do navegador (Ctrl+Shift+Delete)
```

### Problema: Cards não aparecem
**Solução:**
```bash
# Verificar se Tailwind CSS está compilando
npm run dev
# Verificar console para erros de CSS
```

### Problema: Exportação PDF não funciona
**Solução:**
```bash
# Verificar se jsPDF está instalado
npm list jspdf jspdf-autotable
# Se não estiver, instalar:
npm install jspdf jspdf-autotable
```

### Problema: Exportação Excel não funciona
**Solução:**
```bash
# Verificar se XLSX está instalado
npm list xlsx
# Se não estiver, instalar:
npm install xlsx
```

### Problema: Dados não carregam
**Solução:**
```bash
# Verificar console para erros
# Dados de exemplo devem carregar automaticamente
# Se não carregar, verificar se JourneyReport.tsx tem dados mockados
```

---

## 📊 Dados de Teste

### Jornada
```
João Silva: 08:00 - 08:00 (Cumprida ✓)
Maria Santos: 08:00 - 07:00 (Incompleta ⚠)
Pedro Costa: 08:00 - 00:00 (Ausente ✗)
Ana Oliveira: 08:00 - 09:00 (Excedida ℹ)
```

### Resumo Esperado
```
Total de Dias: 4
Dias Cumpridos: 1
Dias Incompletos: 1
Dias Excedidos: 1
Dias Ausentes: 1
Taxa de Cumprimento: 25%
```

---

## ✅ Teste Completo (Passo a Passo)

### 1. Iniciar aplicação
```bash
npm run dev
```

### 2. Acessar hub
```
http://localhost:3000/admin/reports
```

### 3. Verificar hub
- [ ] 6 cards aparecem
- [ ] Cards têm cores diferentes
- [ ] Cards têm ícones
- [ ] Info box aparece
- [ ] Quick stats aparecem

### 4. Clicar em "Jornada"
- [ ] Página carrega
- [ ] Filtros aparecem
- [ ] Resumo aparece
- [ ] Tabela aparece

### 5. Testar filtros
- [ ] Alterar data inicial
- [ ] Alterar data final
- [ ] Clicar em coluna para ordenar

### 6. Testar exportação
- [ ] Clicar "Exportar PDF"
- [ ] Verificar se PDF foi baixado
- [ ] Abrir PDF e verificar conteúdo
- [ ] Clicar "Exportar Excel"
- [ ] Verificar se Excel foi baixado
- [ ] Abrir Excel e verificar conteúdo

### 7. Testar responsividade
- [ ] Redimensionar janela para mobile
- [ ] Verificar se layout se adapta
- [ ] Redimensionar para tablet
- [ ] Redimensionar para desktop

### 8. Testar dark mode
- [ ] Ativar dark mode
- [ ] Verificar se cores estão legíveis
- [ ] Verificar se componentes funcionam

---

## 🎯 Resultado Esperado

Após completar todos os testes, você deve ter:

✅ Hub de relatórios funcional
✅ Página de jornada funcional
✅ Filtros funcionando
✅ Ordenação funcionando
✅ Exportação PDF funcionando
✅ Exportação Excel funcionando
✅ Responsividade funcionando
✅ Dark mode funcionando
✅ Sem erros no console

---

## 📝 Notas

1. **Dados de Exemplo**
   - Todos os dados são mockados
   - Não conecta ao Supabase
   - Pronto para testar sem banco de dados

2. **Exportação**
   - PDF: visual limpo, pronto para impressão
   - Excel: dados completos, pronto para análise

3. **Performance**
   - Página carrega em < 1 segundo
   - Exportação leva < 5 segundos

4. **Navegadores Suportados**
   - Chrome/Edge (recomendado)
   - Firefox
   - Safari

---

## 🚀 Próximos Passos

Após testar com sucesso:

1. Implementar 5 páginas restantes (OvertimeReport, etc)
2. Conectar com dados reais do Supabase
3. Adicionar gráficos nos resumos
4. Adicionar filtros avançados
5. Otimizar performance

---

**Tempo estimado de teste:** 5-10 minutos
**Dificuldade:** Fácil
**Pré-requisitos:** Nenhum (usa dados de exemplo)
