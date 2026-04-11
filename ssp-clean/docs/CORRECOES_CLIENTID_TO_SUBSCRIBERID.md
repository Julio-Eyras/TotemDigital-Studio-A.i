# Correções: clientId → subscriberId

**Data:** 2026-02-16  
**Status:** ✅ Completo

---

## 🐛 Erro Encontrado

```
src/services/storageService.ts:182:64 - error TS18004: 
No value exists in scope for the shorthand property 'clientId'. 
Either declare one or provide an initializer.
```

---

## ✅ Correções Realizadas

### 1. StorageService - Erro de Compilação
**Arquivo:** `backend/src/services/storageService.ts`

**Linha 182:**
```typescript
// ANTES (ERRADO)
logErrorSync('Erro ao salvar arquivo de mídia', error, { clientId, mediaName });

// DEPOIS (CORRETO)
logErrorSync('Erro ao salvar arquivo de mídia', error, { subscriberId, mediaName });
```

**Causa:** O parâmetro da função foi renomeado de `clientId` para `subscriberId`, mas o log ainda usava o nome antigo.

---

### 2. Rota de Quota - Atualização de Nomenclatura
**Arquivo:** `backend/src/routes/media.ts`

**Mudanças:**
- ✅ Rota atualizada: `/quota/:clientId` → `/quota/:subscriberId`
- ✅ Parâmetro renomeado: `clientId` → `subscriberId`
- ✅ Resposta JSON atualizada: `clientId` → `subscriberId`
- ✅ Mensagens de erro atualizadas

**Linhas:** 776-809

---

## 📝 Notas sobre Compatibilidade

### Referências Mantidas (Compatibilidade)

Algumas referências a `clientId` foram **mantidas intencionalmente** para compatibilidade com dados antigos:

1. **Helper de Subscriber** (`subscriberHelper.ts`)
   - `userClientId` usado como fallback: `userSubscriberId || userClientId`
   - Permite que o sistema funcione com dados antigos

2. **Rotas com Fallback**
   - `req.user?.subscriberId || req.user?.clientId`
   - Garante compatibilidade durante migração

3. **Normalização de Dados**
   - `data.subscriberId || data.subscriber_id || data.clientId`
   - Aceita ambos os formatos durante transição

### Referências Corrigidas

1. ✅ `storageService.ts` - Log de erro corrigido
2. ✅ `routes/media.ts` - Rota de quota atualizada

---

## ✅ Verificação

### Build TypeScript
```bash
cd backend && npm run build
# ✅ Compilação bem-sucedida
```

### Testes Recomendados

1. **Upload de Mídia**
   ```bash
   # Verificar se novos uploads funcionam
   # Arquivos devem ir para subscriber-X/medias/
   ```

2. **Rota de Quota**
   ```bash
   # Testar: GET /api/media/quota/:subscriberId
   # Deve retornar dados corretos
   ```

---

## 🎯 Resumo

| Item | Status | Observação |
|------|--------|------------|
| Erro de compilação | ✅ Corrigido | `clientId` → `subscriberId` no log |
| Rota de quota | ✅ Atualizada | Parâmetro e resposta atualizados |
| Compatibilidade | ✅ Mantida | Fallbacks preservados |
| Build TypeScript | ✅ Funcionando | Sem erros de compilação |

---

## 📌 Próximos Passos (Opcional)

Para remover completamente `clientId` no futuro:

1. Migrar todos os dados do banco
2. Atualizar interfaces TypeScript
3. Remover fallbacks de compatibilidade
4. Atualizar documentação da API

**Nota:** Por enquanto, manter compatibilidade é recomendado para transição suave.
