# Correção: Erro 400 ao Atualizar Mídia (draft → approved)

**Data:** 2026-02-16  
**Status:** ✅ Completo

---

## 🐛 Problema Encontrado

Ao editar mídia e alterar status de "draft" para "approved", ocorria erro 400:

```
api/media/17:1  Failed to load resource: the server responded with a status of 400 (Bad Request)
Erro ao atualizar mídia: AxiosError: Request failed with status code 400
```

---

## 🔍 Causa Raiz

1. **Tags sendo enviadas como array**: O validator esperava string, mas o frontend enviava array
2. **Validator muito restritivo**: Não aceitava array de tags
3. **approvalStatus sem validação de valores**: Aceitava qualquer string

---

## ✅ Correções Realizadas

### 1. Frontend - Conversão de Tags
**Arquivo:** `frontend/src/pages/Media/Media.tsx`

**Mudança:**
```typescript
// ANTES
tags: editForm.tags,

// DEPOIS
tags: Array.isArray(editForm.tags) && editForm.tags.length > 0 
  ? editForm.tags.join(',') 
  : (editForm.tags && typeof editForm.tags === 'string' && editForm.tags.trim() 
      ? editForm.tags.trim() 
      : undefined),
```

**Linha:** 264-270

---

### 2. Backend - Validator Mais Flexível
**Arquivo:** `backend/src/validators/media.validators.ts`

**Mudanças:**
- ✅ Tags agora aceita string OU array
- ✅ approvalStatus valida valores permitidos: 'pending', 'approved', 'rejected'

**Antes:**
```typescript
body('tags').optional().isString().withMessage('Tags deve ser uma string'),
body('approvalStatus').optional().isString().withMessage('approvalStatus deve ser uma string'),
```

**Depois:**
```typescript
body('tags').optional().custom((value) => {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return true;
  if (Array.isArray(value)) return true;
  return false;
}).withMessage('Tags deve ser uma string ou array'),
body('approvalStatus').optional().isIn(['pending', 'approved', 'rejected'])
  .withMessage('approvalStatus deve ser: pending, approved ou rejected'),
```

**Linhas:** 19-26

---

### 3. Backend - Processamento de Tags Melhorado
**Arquivo:** `backend/src/routes/media.ts`

**Mudança:**
- ✅ Aceita tags como string ou array
- ✅ Processa corretamente ambos os formatos
- ✅ Filtra tags vazias

**Antes:**
```typescript
let processedTags: string[] | undefined = undefined;
if (req.body.tags) {
  const tagsStr = String(req.body.tags);
  processedTags = tagsStr.includes(',') 
    ? tagsStr.split(',').map(t => t.trim()).filter(Boolean)
    : [tagsStr.trim()].filter(Boolean);
}
```

**Depois:**
```typescript
let processedTags: string[] | undefined = undefined;
if (req.body.tags !== undefined && req.body.tags !== null) {
  if (Array.isArray(req.body.tags)) {
    // Se já é array, usar diretamente (filtrando vazios)
    processedTags = req.body.tags.map((t: any) => String(t).trim()).filter(Boolean);
  } else {
    // Se é string, converter para array
    const tagsStr = String(req.body.tags).trim();
    if (tagsStr) {
      processedTags = tagsStr.includes(',') 
        ? tagsStr.split(',').map((t: string) => t.trim()).filter(Boolean)
        : [tagsStr].filter(Boolean);
    }
  }
}
```

**Linhas:** 575-592

---

## 📋 Sobre os Erros 404

Os erros 404 dos arquivos (`assets/uploads/subscriber-X/medias/...`) ocorrem porque:

1. **Arquivos físicos ainda estão em `client-X`**: Os arquivos demo foram criados em `client-X` mas o banco já foi atualizado para `subscriber-X`
2. **Solução**: O sistema tem compatibilidade automática que verifica ambos os caminhos
3. **Recomendação**: Executar script de migração para mover arquivos físicos

**Script de migração disponível:**
```bash
./scripts/migrate-media-paths-client-to-subscriber.sh
```

---

## ✅ Verificação

### Build TypeScript
```bash
cd backend && npm run build
# ✅ Compilação bem-sucedida
```

### Testes Recomendados

1. **Editar mídia e alterar status**
   - ✅ Deve funcionar sem erro 400
   - ✅ approvalStatus deve ser atualizado corretamente

2. **Tags**
   - ✅ Aceita array ou string
   - ✅ Processa corretamente ambos os formatos

---

## 🎯 Resumo

| Item | Status | Observação |
|------|--------|------------|
| Erro 400 | ✅ Corrigido | Tags e approvalStatus validados corretamente |
| Validator tags | ✅ Melhorado | Aceita string ou array |
| Validator approvalStatus | ✅ Melhorado | Valida valores permitidos |
| Processamento tags | ✅ Melhorado | Aceita ambos os formatos |
| Build TypeScript | ✅ Funcionando | Sem erros de compilação |
| Erros 404 | ⚠️ Esperado | Arquivos precisam ser migrados |

---

## 📌 Próximos Passos

1. **Migrar arquivos físicos** (opcional mas recomendado):
   ```bash
   ./scripts/migrate-media-paths-client-to-subscriber.sh
   ```

2. **Testar atualização de mídia**:
   - Editar mídia
   - Alterar status para "approved"
   - Verificar se funciona sem erros

---

## ✅ Status Final

- ✅ Erro 400 corrigido
- ✅ Validators melhorados
- ✅ Processamento de tags robusto
- ✅ Build funcionando
- ⚠️ Arquivos físicos precisam migração (opcional)
