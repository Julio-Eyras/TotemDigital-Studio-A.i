# Plano de Implementação: CRUD Locals, Totems e Smart TVs

## 🎯 **OBJETIVO**

Implementar CRUD completo para:
1. **Locals** - Locais físicos dos Publishers
2. **Totems** - Atualizar para incluir `uin` e `local_id` corretamente
3. **Smart TVs** - TVs controladas pelos Totens

**Contexto:** Todos pertencem ao universo do Publisher cadastrado pelo Administrador.

---

## 🔐 **REGRAS DE ACESSO (RBAC)**

### **Admin (Sistema):**
- ✅ Pode criar Publishers
- ✅ Pode ver e gerenciar todos os Publishers
- ✅ Pode ver e gerenciar todos os Locals
- ✅ Pode ver e gerenciar todos os Totens
- ✅ Pode ver e gerenciar todas as Smart TVs

### **Publisher User:**
- ❌ NÃO pode criar Publishers (apenas Admin)
- ✅ Pode ver apenas seu próprio Publisher
- ✅ Pode criar/editar/deletar Locals do seu Publisher
- ✅ Pode criar/editar/deletar Totens dos seus Locals
- ✅ Pode criar/editar/deletar Smart TVs dos seus Totens

### **Subscriber:**
- ❌ Sem acesso a Publishers, Locals, Totens ou Smart TVs

---

## 📋 **HIERARQUIA DE OWNERSHIP**

```
Publisher (criado por Admin)
  └── Local (criado por Admin ou Publisher dono)
      └── Totem (criado por Admin ou Publisher dono)
          └── Smart TV (criado por Admin ou Publisher dono)
```

**Validações necessárias:**
- Ao criar Local: verificar se `publisher_id` existe e se usuário tem acesso
- Ao criar Totem: verificar se `local_id` existe e se usuário tem acesso ao publisher do local
- Ao criar Smart TV: verificar se `totem_id` existe e se usuário tem acesso ao publisher do totem

---

## 🚀 **ORDEM DE IMPLEMENTAÇÃO**

### **Fase 1: Backend - LocalService**
1. Criar `backend/src/services/localService.ts`
2. Implementar métodos com validações de ownership
3. Criar `backend/src/routes/locals.ts`
4. Registrar rotas em `backend/src/index.ts`

### **Fase 2: Backend - SmartTvService**
1. Criar `backend/src/services/smartTvService.ts`
2. Implementar métodos com validações de ownership
3. Criar `backend/src/routes/smart-tvs.ts`
4. Registrar rotas em `backend/src/index.ts`

### **Fase 3: Backend - Atualizar TotemService**
1. Garantir que `uin` é salvo corretamente
2. Garantir que `local_id` é validado (ownership)
3. Atualizar queries para incluir publisher_id derivado

### **Fase 4: Frontend - API Client**
1. Adicionar `localApi` em `frontend/src/services/api/index.ts`
2. Adicionar `smartTvApi` em `frontend/src/services/api/index.ts`
3. Atualizar `totemApi` para incluir `uin` e `local_id`

### **Fase 5: Frontend - Páginas**
1. Criar `frontend/src/pages/Locals/Locals.tsx`
2. Criar `frontend/src/pages/SmartTvs/SmartTvs.tsx`
3. Atualizar `frontend/src/pages/Totems/Totems.tsx`
4. Adicionar rotas em `frontend/src/App.tsx`
5. Adicionar itens de menu em `frontend/src/components/Layout/Layout.tsx`

---

## 📝 **DETALHES TÉCNICOS**

### **LocalService - Validações**

```typescript
// Exemplo de validação de ownership
async getLocalById(localId: number, requestPublisherId?: number, isAdmin: boolean = false): Promise<Local | null> {
  const local = await this.db.findFirst(`
    SELECT l.*, p.publisher_id
    FROM locals l
    JOIN publishers p ON l.publisher_id = p.publisher_id
    WHERE l.local_id = $1
  `, [localId]);

  if (!local) return null;

  // Validação de ownership
  if (!isAdmin && requestPublisherId && local.publisher_id !== requestPublisherId) {
    throw new Error('Acesso negado: Local não pertence ao seu publisher');
  }

  return local;
}
```

### **SmartTvService - Validações**

```typescript
// Exemplo de validação de ownership via totem → local → publisher
async getSmartTvById(tvId: number, requestPublisherId?: number, isAdmin: boolean = false): Promise<SmartTv | null> {
  const smartTv = await this.db.findFirst(`
    SELECT st.*, 
           t.totem_id,
           l.local_id,
           p.publisher_id
    FROM smart_tvs st
    JOIN totems t ON st.totem_id = t.totem_id
    JOIN locals l ON t.local_id = l.local_id
    JOIN publishers p ON l.publisher_id = p.publisher_id
    WHERE st.tv_id = $1
  `, [tvId]);

  if (!smartTv) return null;

  // Validação de ownership
  if (!isAdmin && requestPublisherId && smartTv.publisher_id !== requestPublisherId) {
    throw new Error('Acesso negado: Smart TV não pertence ao seu publisher');
  }

  return smartTv;
}
```

---

## ✅ **CHECKLIST DE VALIDAÇÕES**

### **LocalService:**
- [ ] Verificar se `publisher_id` existe ao criar
- [ ] Verificar ownership ao listar (não-admin só vê seus locals)
- [ ] Verificar ownership ao obter por ID
- [ ] Verificar ownership ao atualizar
- [ ] Verificar ownership ao deletar
- [ ] Verificar se local tem totens antes de deletar (opcional: aviso)

### **SmartTvService:**
- [ ] Verificar se `totem_id` existe ao criar
- [ ] Verificar ownership do totem (via local → publisher)
- [ ] Verificar ownership ao listar (não-admin só vê suas Smart TVs)
- [ ] Verificar ownership ao obter por ID
- [ ] Verificar ownership ao atualizar
- [ ] Verificar ownership ao deletar

### **TotemService (atualização):**
- [ ] Garantir que `uin` é salvo ao criar/atualizar
- [ ] Verificar se `local_id` existe ao criar/atualizar
- [ ] Verificar ownership do local (via publisher)
- [ ] Atualizar queries para incluir publisher_id derivado

---

## 🎨 **INTERFACE DO USUÁRIO**

### **Página Locals:**
- Filtro por Publisher (Admin vê todos, Publisher vê apenas o seu)
- Formulário de criação com seleção de Publisher (Admin) ou automático (Publisher)
- Campos: name, address, city, state, zip_code, country, latitude, longitude, timezone, description
- Lista de Totens do Local (link para página de Totens filtrada)

### **Página Totens:**
- Filtro por Publisher e Local
- Formulário de criação com:
  - Seleção de Local (dropdown filtrado por publisher do usuário)
  - Campo `identifier` (obrigatório, único)
  - Campo `uin` (opcional, único)
  - Campo `device_id` (opcional, único)
  - Outros campos técnicos
- Lista de Smart TVs do Totem (link para página de Smart TVs filtrada)

### **Página Smart TVs:**
- Filtro por Publisher, Local e Totem
- Formulário de criação com:
  - Seleção de Totem (dropdown filtrado por publisher do usuário)
  - Campo `identifier` (obrigatório, único)
  - Campos técnicos (brand, model, platform, resolution, etc.)
- Informações técnicas detalhadas

---

## 🔄 **FLUXO DE NAVEGAÇÃO SUGERIDO**

1. **Admin cria Publisher** → `/publishers` (já existe)
2. **Admin/Publisher cria Local** → `/locals` (criar)
3. **Admin/Publisher cria Totem** → `/totems` (criar, selecionando Local)
4. **Admin/Publisher cria Smart TV** → `/smart-tvs` (criar, selecionando Totem)

**Navegação contextual:**
- Na página do Publisher → Ver Locals → Criar Local
- Na página do Local → Ver Totens → Criar Totem
- Na página do Totem → Ver Smart TVs → Criar Smart TV

---

## 📊 **ESTRUTURA DE DADOS**

### **Local:**
```typescript
interface Local {
  local_id: number;
  publisher_id: number; // FK obrigatória
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  publisher_name?: string; // Derivado
}
```

### **Smart TV:**
```typescript
interface SmartTv {
  tv_id: number;
  totem_id: number; // FK obrigatória
  identifier: string; // Único
  device_id?: string; // Único
  name?: string;
  brand?: string;
  model?: string;
  platform?: string;
  firmware_version?: string;
  resolution_width?: number;
  resolution_height?: number;
  orientation?: 'landscape' | 'portrait';
  status?: string;
  capabilities?: any; // JSONB
  settings?: any; // JSONB
  is_active: boolean;
  created_at: string;
  updated_at: string;
  totem_name?: string; // Derivado
  local_name?: string; // Derivado
  publisher_name?: string; // Derivado
}
```

---

## 🎯 **PRÓXIMOS PASSOS**

1. Implementar LocalService e rotas
2. Implementar SmartTvService e rotas
3. Atualizar TotemService
4. Criar páginas frontend
5. Testar validações de ownership
6. Testar RBAC (Admin vs Publisher User)

