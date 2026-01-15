# Análise: CRUD de Locals, Totems e Smart TVs

## 📋 **SITUAÇÃO ATUAL**

### ✅ **O QUE JÁ EXISTE:**

1. **Totems:**
   - ✅ `TotemService` (backend) - CRUD completo
   - ✅ Rotas `/api/totems` (backend)
   - ✅ Página `Totems.tsx` (frontend)
   - ✅ Suporta `local_id`, `uin`, `device_id`
   - ⚠️ Página frontend usa API antiga (`Player` interface)

2. **Publishers:**
   - ✅ `PublisherService` com método `getLocalsByPublisher()`
   - ✅ Rota `/api/publishers/:id/locals` (apenas GET)
   - ✅ Página `Publishers.tsx` mostra relacionamentos

### ❌ **O QUE FALTA:**

1. **Locals (Locais):**
   - ❌ **NÃO EXISTE** `LocalService`
   - ❌ **NÃO EXISTE** rotas `/api/locals`
   - ❌ **NÃO EXISTE** página frontend para gerenciar locals
   - ⚠️ Só pode ser visualizado via `PublisherService.getLocalsByPublisher()`

2. **Smart TVs:**
   - ❌ **NÃO EXISTE** `SmartTvService`
   - ❌ **NÃO EXISTE** rotas `/api/smart-tvs`
   - ❌ **NÃO EXISTE** página frontend para gerenciar Smart TVs
   - ⚠️ Só pode ser visualizado via `PublisherService.getSmartTvsByPublisher()`

3. **Totems (melhorias necessárias):**
   - ⚠️ Frontend usa interface antiga (`Player` em vez de `Totem`)
   - ⚠️ Falta campo `uin` no formulário de criação/edição
   - ⚠️ Falta seleção de `local_id` no formulário

---

## 🔐 **CONTEXTO DE SEGURANÇA E OWNERSHIP**

**IMPORTANTE:** Todos os cadastros (Locals, Totens, Smart TVs) pertencem ao universo do Publisher:

- **Publisher** → Criado apenas por **Administrador do Sistema**
- **Local** → Pertence a um Publisher (criado por Admin ou Publisher dono)
- **Totem** → Pertence a um Local (criado por Admin ou Publisher dono do Local)
- **Smart TV** → Pertence a um Totem (criado por Admin ou Publisher dono do Totem)

**Regras de Acesso:**
- **Admin:** Pode ver e gerenciar tudo
- **Publisher User:** Pode ver e gerenciar apenas seus próprios dados (locals, totens, smart TVs do seu publisher)
- **Subscriber:** Não tem acesso a esses recursos

---

## 🎯 **O QUE PRECISA SER IMPLEMENTADO**

### **1. LocalService (Backend)**

**Arquivo:** `backend/src/services/localService.ts`

**Métodos necessários:**
- `getAllLocals()` - Listar com filtros (publisherId, search, active)
  - **Validação:** Não-admin só vê locals do seu publisher
- `getLocalById()` - Obter por ID
  - **Validação:** Verificar ownership (publisher_id)
- `createLocal()` - Criar novo local
  - **Validação:** Verificar se publisher_id existe e se usuário tem acesso
- `updateLocal()` - Atualizar local
  - **Validação:** Verificar ownership antes de atualizar
- `deleteLocal()` - Deletar local (soft delete)
  - **Validação:** Verificar ownership antes de deletar
- `getTotemsByLocal()` - Listar totens de um local
  - **Validação:** Verificar ownership do local

**Campos a gerenciar:**
- `publisher_id` (obrigatório)
- `name` (obrigatório)
- `address`, `city`, `state`, `zip_code`, `country`
- `latitude`, `longitude`
- `timezone`
- `description`
- `is_active`

---

### **2. Rotas de Locals (Backend)**

**Arquivo:** `backend/src/routes/locals.ts`

**Rotas necessárias:**
- `GET /api/locals` - Listar (com filtros)
- `GET /api/locals/:id` - Obter por ID
- `POST /api/locals` - Criar
- `PUT /api/locals/:id` - Atualizar
- `DELETE /api/locals/:id` - Deletar
- `GET /api/locals/:id/totems` - Listar totens do local

---

### **3. SmartTvService (Backend)**

**Arquivo:** `backend/src/services/smartTvService.ts`

**Métodos necessários:**
- `getAllSmartTvs()` - Listar com filtros (totemId, publisherId, search, active)
  - **Validação:** Não-admin só vê Smart TVs do seu publisher (via totem → local → publisher)
- `getSmartTvById()` - Obter por ID
  - **Validação:** Verificar ownership (via totem → local → publisher)
- `createSmartTv()` - Criar nova Smart TV
  - **Validação:** Verificar se totem_id existe e se usuário tem acesso ao publisher do totem
- `updateSmartTv()` - Atualizar Smart TV
  - **Validação:** Verificar ownership antes de atualizar
- `deleteSmartTv()` - Deletar Smart TV (soft delete)
  - **Validação:** Verificar ownership antes de deletar
- `getSmartTvsByTotem()` - Listar Smart TVs de um totem
  - **Validação:** Verificar ownership do totem (via local → publisher)

**Campos a gerenciar:**
- `totem_id` (obrigatório)
- `identifier` (obrigatório, único)
- `device_id` (único)
- `name`
- `brand`, `model`, `platform`
- `firmware_version`
- `resolution_width`, `resolution_height`
- `orientation` (landscape/portrait)
- `status`
- `capabilities` (JSONB)
- `settings` (JSONB)
- `is_active`

---

### **4. Rotas de Smart TVs (Backend)**

**Arquivo:** `backend/src/routes/smart-tvs.ts`

**Rotas necessárias:**
- `GET /api/smart-tvs` - Listar (com filtros)
- `GET /api/smart-tvs/:id` - Obter por ID
- `POST /api/smart-tvs` - Criar
- `PUT /api/smart-tvs/:id` - Atualizar
- `DELETE /api/smart-tvs/:id` - Deletar
- `GET /api/smart-tvs/totem/:totemId` - Listar Smart TVs de um totem

---

### **5. Página Locals (Frontend)**

**Arquivo:** `frontend/src/pages/Locals/Locals.tsx`

**Funcionalidades:**
- Listar locals (com filtros por publisher)
- Criar novo local (selecionando publisher)
- Editar local existente
- Deletar local
- Visualizar totens do local
- Mapa (opcional) com latitude/longitude

---

### **6. Página Smart TVs (Frontend)**

**Arquivo:** `frontend/src/pages/SmartTvs/SmartTvs.tsx`

**Funcionalidades:**
- Listar Smart TVs (com filtros por totem, publisher)
- Criar nova Smart TV (selecionando totem)
- Editar Smart TV existente
- Deletar Smart TV
- Visualizar informações técnicas (brand, model, platform, resolution)

---

### **7. Atualizar Página Totems (Frontend)**

**Arquivo:** `frontend/src/pages/Totems/Totems.tsx`

**Melhorias necessárias:**
- Adicionar campo `uin` no formulário
- Adicionar seleção de `local_id` (dropdown com locals do publisher)
- Atualizar interface para usar `Totem` em vez de `Player`
- Mostrar relacionamento com Smart TVs

---

### **8. API Client (Frontend)**

**Arquivo:** `frontend/src/services/api/index.ts`

**Adicionar:**
- `localApi` - CRUD de locals
- `smartTvApi` - CRUD de Smart TVs
- Atualizar `totemApi` para incluir `uin` e `local_id`

---

## 📊 **FLUXO DE CADASTRO RECOMENDADO**

### **Ordem de Cadastro:**

1. **Publisher** → Criar publisher primeiro
2. **Local** → Criar local vinculado ao publisher
3. **Totem** → Criar totem vinculado ao local (com UIN)
4. **Smart TV** → Criar Smart TV vinculada ao totem

### **Hierarquia:**

```
Publisher (1) ──< (N) Locals (1) ──< (N) Totems (1) ──< (0..N) Smart TVs
```

---

## 🔧 **IMPLEMENTAÇÃO SUGERIDA**

### **Opção 1: Páginas Separadas (Recomendada)**
- `/publishers` - Gerenciar publishers (apenas Admin)
- `/locals` - Gerenciar locals (Admin vê todos, Publisher vê apenas os seus)
- `/totems` - Gerenciar totens (Admin vê todos, Publisher vê apenas os seus)
- `/smart-tvs` - Gerenciar Smart TVs (Admin vê todas, Publisher vê apenas as suas)

**Vantagens:**
- CRUD completo e independente
- Fácil navegação
- Filtros claros por publisher/local/totem

### **Opção 2: Páginas Integradas**
- `/publishers/:id` - Detalhes do publisher com abas:
  - Informações
  - Locals (com CRUD inline)
  - Totens (com CRUD inline)
  - Smart TVs (com CRUD inline)

### **Opção 3: Híbrida (Recomendada)**
- Páginas separadas para CRUD completo
- Abas de detalhes para visualização rápida
- Navegação contextual (ex: criar totem a partir de um local)

---

## ✅ **CHECKLIST DE IMPLEMENTAÇÃO**

### **Backend:**
- [ ] Criar `LocalService`
- [ ] Criar rotas `/api/locals`
- [ ] Criar `SmartTvService`
- [ ] Criar rotas `/api/smart-tvs`
- [ ] Atualizar `TotemService` para garantir suporte completo a `uin` e `local_id`

### **Frontend:**
- [ ] Criar `localApi` no API client
- [ ] Criar `smartTvApi` no API client
- [ ] Atualizar `totemApi` para incluir `uin` e `local_id`
- [ ] Criar página `Locals.tsx`
- [ ] Criar página `SmartTvs.tsx`
- [ ] Atualizar página `Totems.tsx`
- [ ] Adicionar rotas no `App.tsx`
- [ ] Adicionar itens de menu no `Layout.tsx`

---

## 🎯 **PRIORIDADE**

1. **Alta:** LocalService e rotas (necessário para cadastrar totens)
2. **Alta:** Atualizar Totems para incluir `local_id` e `uin`
3. **Média:** SmartTvService e rotas
4. **Média:** Páginas frontend

---

## 📝 **OBSERVAÇÕES**

- O schema do banco já está correto e completo
- Os relacionamentos (FKs) já estão definidos
- Falta apenas implementar os serviços, rotas e páginas frontend
- A página `Totems.tsx` atual usa a interface antiga `Player` - precisa ser atualizada

