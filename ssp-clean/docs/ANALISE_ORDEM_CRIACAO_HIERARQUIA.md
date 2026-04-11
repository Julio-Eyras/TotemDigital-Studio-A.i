# Análise: Ordem de Criação da Hierarquia e Constraint Violation

## 📋 Resumo do Problema

Erro ao criar totem: `new row for relation "totems" violates check constraint "chk_totem_status"`

## 🔍 Análise da Ordem de Criação

### ✅ Ordem Correta (Frontend → Backend)

```
1️⃣ Publisher
   └─> Retorna: publisher_id
   
2️⃣ Locais (1 ou mais)
   └─> Usa: publisher_id do passo 1
   └─> Retorna: local_id (armazenado em createdLocals[])
   
3️⃣ Totens (1 ou mais)
   └─> Usa: local_id dos locais criados no passo 2
   └─> Retorna: totem_id (armazenado em createdTotems[])
   
4️⃣ Smart TVs (opcional)
   └─> Usa: totem_id dos totens criados no passo 3
```

### 📍 Código Frontend (Publishers.tsx)

**Linha 349**: Criar Publisher
```typescript
const createdPublisher = await publisherApi.create(newPublisher);
const publisherId = createdPublisher.publisher_id;
```

**Linha 363-368**: Criar Locais
```typescript
const createdLocals: Local[] = [];
for (const local of tempLocals) {
  const createdLocal = await localApi.create({
    ...local,
    publisher_id: publisherId,  // ✅ Usa publisherId do passo 1
  });
  createdLocals.push(createdLocal);
}
```

**Linha 436**: Criar Totens
```typescript
const localIndex = totem.localId; // localId já é o índice
if (localIndex >= 0 && localIndex < createdLocals.length && createdLocals[localIndex]) {
  const localId = createdLocals[localIndex].local_id;  // ✅ Usa localId do passo 2
  
  const totemData: any = {
    localId: Number(localId),
    // ... outros campos
  };
  
  const createdTotem = await totemApi.create(totemData);
  createdTotems.push(createdTotem);
}
```

**Linha 479**: Criar Smart TVs
```typescript
const totemIndex = smartTv.totem_id; // totem_id já é o índice
if (totemIndex >= 0 && totemIndex < createdTotems.length && createdTotems[totemIndex]) {
  await smartTvApi.create({
    totem_id: createdTotems[totemIndex].totem_id,  // ✅ Usa totem_id do passo 3
    // ... outros campos
  });
}
```

### 📍 Código Backend (totemService.ts)

**Linha 554**: INSERT com status 'offline'
```typescript
const result = await this.db.executeRaw(`
  INSERT INTO totems (
    name, identifier, uin, device_id, local_id,
    description, network_info, firmware_version, is_active,
    status, created_at, updated_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'offline', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  RETURNING totem_id
`, [
  name || identifier,      // 1
  totemIdentifier,          // 2
  uin || null,              // 3
  deviceId || null,         // 4
  localId,                  // 5
  description || null,      // 6
  config ? JSON.stringify(config) : null,  // 7
  firmwareVersion || null,   // 8
  isActive                   // 9
]);
```

**Status**: `'offline'` (hardcoded ✅)

## 🔍 Constraint do Banco de Dados

**Arquivo**: `database/smartchannel-db-v2-refactored-part3-tables-dependent.sql`

**Linha 52**: DEFAULT 'offline'
```sql
status TEXT DEFAULT 'offline', -- offline, online, error, maintenance
```

**Linha 63-64**: Constraint
```sql
CONSTRAINT chk_totem_status 
    CHECK (status IN ('offline', 'online', 'error', 'maintenance', 'syncing'))
```

**Valores permitidos**:
- ✅ `'offline'`
- ✅ `'online'`
- ✅ `'error'`
- ✅ `'maintenance'`
- ✅ `'syncing'`
- ❌ `'pending_approval'` (NÃO permitido!)

## ⚠️ Diagnóstico

### Problema Identificado

O código **local** está correto:
- ✅ Ordem de criação está correta (Publisher → Locais → Totens → Smart TVs)
- ✅ Status 'offline' está hardcoded no INSERT
- ✅ Constraint permite 'offline'

**MAS** o erro ainda ocorre no servidor, indicando que:
- ❌ O código no **servidor** ainda tem a versão antiga com `'pending_approval'`
- ❌ O arquivo `backend/src/services/totemService.ts` no servidor não foi atualizado

### Validação da Ordem

A ordem de criação está **CORRETA**:
1. ✅ Publisher é criado primeiro (não depende de nada)
2. ✅ Locais são criados depois (dependem de publisher_id)
3. ✅ Totens são criados depois (dependem de local_id)
4. ✅ Smart TVs são criadas depois (dependem de totem_id)

**Não há inversão na hierarquia!**

## 💡 Solução

### Passo 1: Atualizar código no servidor

```bash
cd ~/SmartSignage-Pro
git pull origin main
```

### Passo 2: Verificar se o arquivo foi atualizado

```bash
grep -n "pending_approval\|'offline'" backend/src/services/totemService.ts
```

**Deve mostrar**: `'offline'` (não `'pending_approval'`)

### Passo 3: Recompilar e reiniciar

```bash
./scripts/dev-build-restart.sh
```

## 🔧 Verificações Adicionais

### 1. Verificar se há triggers alterando o status

```sql
SELECT 
    trigger_name, 
    event_manipulation, 
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'totems';
```

**Resultado esperado**: Apenas trigger de `updated_at` (não altera status)

### 2. Verificar se há DEFAULT conflitante

```sql
SELECT 
    column_name, 
    column_default
FROM information_schema.columns
WHERE table_name = 'totems' AND column_name = 'status';
```

**Resultado esperado**: `DEFAULT 'offline'` ✅

### 3. Verificar constraint atual

```sql
SELECT 
    conname, 
    pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'totems'::regclass
AND conname = 'chk_totem_status';
```

**Resultado esperado**: `CHECK (status IN ('offline', 'online', 'error', 'maintenance', 'syncing'))` ✅

## 📝 Conclusão

**A ordem de criação está CORRETA**. O problema é que o código no servidor não foi atualizado após a correção do status de `'pending_approval'` para `'offline'`.

**Ação necessária**: Atualizar o código no servidor com `git pull origin main` e recompilar.
