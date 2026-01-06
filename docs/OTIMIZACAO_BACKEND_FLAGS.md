# Otimização Backend - Sistema de Flags

## ✅ MELHORIAS IMPLEMENTADAS

### 1. Uso da Função SQL `get_user_effective_flags()`

**Antes:**
- Backend fazia múltiplas queries (user_flags + role_flags_default)
- Lógica de combinação no TypeScript
- 2-3 queries por requisição autenticada

**Agora:**
- Usa função SQL `get_user_effective_flags(user_id)` quando disponível
- 1 query única, mais eficiente
- Fallback para lógica TypeScript se função não existir

---

## 📊 IMPLEMENTAÇÃO

### Backend: `backend/src/utils/flagChecker.ts`

```typescript
export async function getUserEffectiveFlags(user: UserWithFlags): Promise<UserFlags> {
  // 1. Owner system tem todas
  if (user.role === 'owner_system') {
    return { /* todas true */ };
  }
  
  // 2. Tentar usar função SQL (mais eficiente)
  try {
    const result = await db.findFirst<UserFlags>(`
      SELECT * FROM get_user_effective_flags($1)
    `, [user.id]);
    
    if (result) {
      return result;
    }
  } catch (error) {
    // Fallback para lógica manual
  }
  
  // 3. Fallback: lógica manual (compatibilidade)
  // ...
}
```

### Backend: `backend/src/middleware/auth.middleware.ts`

```typescript
// Carregar flags efetivas do usuário
try {
  const flagsTableExists = await db.tableExists('user_flags');
  if (flagsTableExists) {
    // Tentar usar função SQL
    try {
      const effectiveFlags = await db.findFirst<UserFlags>(`
        SELECT * FROM get_user_effective_flags($1)
      `, [user.id]);
      
      if (effectiveFlags) {
        userFlags = effectiveFlags;
      } else {
        // Fallback: usar função TypeScript
        userFlags = await getUserEffectiveFlags({...});
      }
    } catch (sqlError) {
      // Se função SQL não existir, usar função TypeScript
      userFlags = await getUserEffectiveFlags({...});
    }
  }
} catch (error) {
  // Continuar sem flags se sistema não estiver disponível
}
```

---

## 🎯 VANTAGENS

1. **Performance**: 1 query em vez de 2-3
2. **Consistência**: Lógica centralizada na função SQL
3. **Compatibilidade**: Fallback automático se função não existir
4. **Manutenibilidade**: Código mais limpo e eficiente

---

## 🔄 FLUXO DE EXECUÇÃO

```
1. Usuário faz login/requisição autenticada
   ↓
2. authMiddleware verifica token
   ↓
3. Carrega flags efetivas:
   a) Tenta função SQL get_user_effective_flags(user_id)
   b) Se falhar, usa função TypeScript getUserEffectiveFlags()
   ↓
4. Flags são adicionadas a req.user.flags
   ↓
5. Rotas podem usar requireFlag() para verificar permissões
```

---

## ✅ COMPATIBILIDADE

- ✅ Funciona mesmo se função SQL não existir (fallback)
- ✅ Funciona mesmo se tabelas não existirem (graceful degradation)
- ✅ Mantém compatibilidade com código existente
- ✅ Não quebra instalações antigas

---

**Documento criado em:** 2024-12-XX
**Versão:** 1.0
**Status:** ✅ Implementado e Testado
