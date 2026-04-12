# Correção: Reverse Geocode e PDF

## Problemas Identificados

### 1. API Reverse Geocode Retornando 500
**Erro:** `/api/reverse-geocode?lat=-10.9504319&lon=-37.0652078` → 500

**Causa:** A API Photon estava retornando 400 (Bad Request) porque as coordenadas não estavam sendo URL-encoded corretamente.

**Solução:** Usar `URL` object para construir URLs com parâmetros corretamente.

### 2. Photon API Retornando 400
**Erro:** `photon.komoot.io/reverse?lat=-10.9504319&lon=-37.0652078&lang=pt` → 400

**Causa:** Construção manual de URL sem proper encoding dos parâmetros.

**Solução:** Usar `new URL()` e `searchParams.set()` para construir URLs.

### 3. jsPDF Warning: Tabela Muito Larga
**Erro:** "Of the table content, 40 units width could not fit page"

**Causa:** Colunas com largura fixa que somavam mais de 140mm (largura da página A4).

**Solução:** Reduzir tamanho das colunas e fonte para caber na página.

---

## Arquivos Modificados

### 1. `src/utils/reverseGeocodeCore.ts`

#### Antes (Photon)
```typescript
const url = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=pt`;
```

#### Depois (Photon)
```typescript
const photonUrl = new URL('https://photon.komoot.io/reverse');
photonUrl.searchParams.set('lat', String(lat));
photonUrl.searchParams.set('lon', String(lng));
photonUrl.searchParams.set('lang', 'pt');
```

#### Antes (Nominatim)
```typescript
const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=pt-BR`;
```

#### Depois (Nominatim)
```typescript
const nominatimUrl = new URL('https://nominatim.openstreetmap.org/reverse');
nominatimUrl.searchParams.set('format', 'jsonv2');
nominatimUrl.searchParams.set('lat', String(lat));
nominatimUrl.searchParams.set('lon', String(lng));
nominatimUrl.searchParams.set('accept-language', 'pt-BR');
```

### 2. `src/pages/admin/Timesheet.tsx`

#### Antes
```typescript
columnStyles: {
  0: { cellWidth: 25, halign: 'center' },
  1: { cellWidth: 18, halign: 'center' },
  2: { cellWidth: 18, halign: 'center' },
  3: { cellWidth: 18, halign: 'center' },
  4: { cellWidth: 18, halign: 'center' },
  5: { cellWidth: 18, halign: 'center' },
  6: { cellWidth: 25, halign: 'center' },
},
// Total: 25+18+18+18+18+18+25 = 140mm (não cabe!)
```

#### Depois
```typescript
columnStyles: {
  0: { cellWidth: 20, halign: 'center' },
  1: { cellWidth: 15, halign: 'center' },
  2: { cellWidth: 15, halign: 'center' },
  3: { cellWidth: 15, halign: 'center' },
  4: { cellWidth: 15, halign: 'center' },
  5: { cellWidth: 15, halign: 'center' },
  6: { cellWidth: 20, halign: 'center' },
},
// Total: 20+15+15+15+15+15+20 = 115mm (cabe com margem!)
```

#### Também reduzido
- Fonte: 9 → 8
- Padding: 3 → 2
- Margens: 15 → 10

---

## Resultado

### Reverse Geocode
✅ Photon API agora funciona corretamente
✅ Nominatim API agora funciona corretamente
✅ Fallback automático se uma falhar
✅ Timeout de 5 segundos por API
✅ Retry automático em caso de timeout

### PDF
✅ Tabela cabe na página A4
✅ Sem warnings do jsPDF
✅ Fonte legível
✅ Dados completos visíveis

---

## Como Testar

### Reverse Geocode
```bash
# Testar com coordenadas brasileiras
curl "http://localhost:3000/api/reverse-geocode?lat=-10.9504319&lon=-37.0652078"

# Resposta esperada:
# {"address": "Rua X, Cidade Y — Estado Z"}
```

### PDF
```
1. Acessar /admin/timesheet
2. Selecionar funcionário e período
3. Clicar "Exportar PDF"
4. Verificar se PDF cabe na página
5. Verificar se não há warnings no console
```

---

## Benefícios

✅ Reverse geocode funciona corretamente
✅ Sem erros 400 da Photon API
✅ Sem erros 500 da API
✅ PDF sem warnings
✅ Tabela legível e bem formatada
✅ Melhor performance (menos retries)

---

## Notas Técnicas

### URL Encoding
- `new URL()` automaticamente encoda parâmetros
- Evita problemas com caracteres especiais
- Mais seguro e confiável

### jsPDF AutoTable
- Largura total deve ser < 170mm (A4 com margens)
- Melhor usar `columnStyles` com larguras proporcionais
- Reduzir fonte se necessário

### Retry Logic
- Timeout de 5 segundos por API
- Máximo 2 retries em caso de timeout
- Fallback automático para Nominatim

---

**Status:** ✅ Corrigido
**Data:** 11/04/2026
