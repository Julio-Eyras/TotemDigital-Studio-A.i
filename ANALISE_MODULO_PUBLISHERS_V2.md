# Análise Completa: Módulo Publishers v2.0

## 📋 **RESUMO EXECUTIVO**

Este documento analisa:
1. ✅ Campos da tabela `publishers` no v2.0
2. ✅ Relacionamentos: Publishers → Locals → Totems → Smart TVs
3. ✅ Status do Frontend (atualizado para v2?)
4. ✅ Status dos CRUDs necessários
5. ✅ O que está faltando

---

## 🗄️ **1. CAMPOS DA TABELA PUBLISHERS (v2.0)**

### **Schema Atual:**

```sql
CREATE TABLE IF NOT EXISTS publishers (
    publisher_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    whatsapp TEXT,
    description TEXT,
    
    -- Flags de tipo
    is_subscriber BOOLEAN DEFAULT false,
    is_publisher BOOLEAN DEFAULT true,
    client_type TEXT NOT NULL DEFAULT 'publisher', -- 'subscriber', 'publisher', 'both'
    
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT chk_publisher_client_type 
        CHECK (client_type IN ('subscriber', 'publisher', 'both'))
);
```

### **Campos Implementados:**
- ✅ `publisher_id` (PK)
- ✅ `name` (obrigatório)
- ✅ `contact_name` (opcional)
- ✅ `email` (opcional)
- ✅ `phone` (opcional)
- ✅ `whatsapp` (opcional)
- ✅ `description` (opcional)
- ✅ `is_subscriber` (boolean)
- ✅ `is_publisher` (boolean)
- ✅ `client_type` (enum: 'subscriber', 'publisher', 'both')
- ✅ `active` (boolean)
- ✅ `created_at` (timestamp)
- ✅ `updated_at` (timestamp)

### **Campos que PODERIAM existir (mas não estão no schema):**
- ❌ `address` (endereço físico)
- ❌ `city`, `state`, `zip_code`, `country` (localização)
- ❌ `latitude`, `longitude` (coordenadas)
- ❌ `timezone` (fuso horário)
- ❌ `tax_id` / `cnpj` (identificação fiscal)
- ❌ `website` (site)
- ❌ `logo_url` (logo)
- ❌ `metadata` (JSONB para dados flexíveis)

**⚠️ CONCLUSÃO:** A tabela `publishers` tem campos básicos, mas **faltam campos de detalhamento** como endereço, localização, identificação fiscal, etc.

---

## 🔗 **2. RELACIONAMENTOS (Modelo ER)**

### **Hierarquia Completa:**

```
PUBLISHERS (1) ──< (N) LOCALS (1) ──< (N) TOTEMS (1) ──< (0..N) SMART_TVS
```

### **2.1. Publishers → Locals**

**Tabela `locals`:**
```sql
CREATE TABLE IF NOT EXISTS locals (
    local_id SERIAL PRIMARY KEY,
    publisher_id INTEGER NOT NULL, -- FK para publishers
    name TEXT NOT NULL,
    address TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    country TEXT DEFAULT 'BR',
    latitude REAL,
    longitude REAL,
    timezone TEXT DEFAULT 'America/Sao_Paulo',
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Relacionamento:**
- ✅ **1 Publisher** → **N Locals** (um publisher pode ter múltiplos locais)
- ✅ **FK definida:** `locals.publisher_id` → `publishers.publisher_id`
- ✅ **ON DELETE CASCADE:** Se publisher for deletado, locals são deletados

**Status:** ✅ **CORRETO**

---

### **2.2. Locals → Totems**

**Tabela `totems`:**
```sql
CREATE TABLE IF NOT EXISTS totems (
    totem_id SERIAL PRIMARY KEY,
    identifier TEXT UNIQUE NOT NULL,
    uin TEXT UNIQUE,
    device_id TEXT UNIQUE,
    
    local_id INTEGER NOT NULL, -- FK para locals
    
    name TEXT,
    description TEXT,
    model TEXT,
    manufacturer TEXT,
    firmware_version TEXT,
    hardware_version TEXT,
    os_version TEXT,
    
    status TEXT DEFAULT 'offline',
    last_heartbeat TIMESTAMP,
    heartbeat_interval INTEGER DEFAULT 60,
    
    network_info JSONB,
    capabilities JSONB,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Relacionamento:**
- ✅ **1 Local** → **N Totems** (um local pode ter múltiplos totens)
- ✅ **FK definida:** `totems.local_id` → `locals.local_id`
- ✅ **ON DELETE CASCADE:** Se local for deletado, totens são deletados

**Status:** ✅ **CORRETO**

---

### **2.3. Totems → Smart TVs**

**Tabela `smart_tvs`:**
```sql
CREATE TABLE IF NOT EXISTS smart_tvs (
    tv_id SERIAL PRIMARY KEY,
    totem_id INTEGER NOT NULL, -- FK para totems
    
    identifier TEXT UNIQUE NOT NULL,
    device_id TEXT UNIQUE,
    name TEXT,
    brand TEXT,
    model TEXT,
    platform TEXT,
    firmware_version TEXT,
    
    resolution_width INTEGER,
    resolution_height INTEGER,
    orientation TEXT DEFAULT 'landscape',
    
    status TEXT DEFAULT 'offline',
    last_seen TIMESTAMP,
    
    capabilities JSONB,
    settings JSONB,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Relacionamento:**
- ✅ **1 Totem** → **0..N Smart TVs** (um totem pode ter nenhuma, uma ou múltiplas TVs)
- ✅ **FK definida:** `smart_tvs.totem_id` → `totems.totem_id`
- ✅ **ON DELETE CASCADE:** Se totem for deletado, smart TVs são deletadas

**⚠️ OBSERVAÇÃO:** O comentário no schema diz `(1 totem : 1 TV)`, mas a FK permite múltiplas TVs. O relacionamento real é **1:N**, não 1:1.

**Status:** ✅ **CORRETO** (mas comentário está incorreto)

---

### **2.4. Resumo dos Relacionamentos**

| Relacionamento | Cardinalidade | FK Definida? | ON DELETE | Status |
|----------------|---------------|--------------|-----------|--------|
| **Publishers → Locals** | 1:N | ✅ Sim | CASCADE | ✅ OK |
| **Locals → Totems** | 1:N | ✅ Sim | CASCADE | ✅ OK |
| **Totems → Smart TVs** | 1:0..N | ✅ Sim | CASCADE | ✅ OK |

**Caminho Completo:**
```
Publisher → Local → Totem → Smart TV(s)
```

---

## 🖥️ **3. STATUS DO FRONTEND**

### **3.1. Interface TypeScript (API Client)**

**Arquivo:** `frontend/src/services/api/index.ts`

```typescript
export interface Publisher {
  publisher_id: number;
  name: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  description?: string;
  is_subscriber?: boolean;
  is_publisher?: boolean;
  client_type?: string;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
}
```

**Análise:**
- ✅ `publisher_id`, `name`, `email`, `phone`, `whatsapp`, `description`
- ✅ `is_subscriber`, `is_publisher`, `client_type`
- ✅ `active`, `created_at`, `updated_at`
- ❌ **FALTA:** `contact_name` (existe no backend mas não no frontend!)

**Status:** ⚠️ **PARCIALMENTE ATUALIZADO** (falta `contact_name`)

---

### **3.2. API Client Methods**

```typescript
export const publisherApi = {
  getAll: async (params?: {
    search?: string;
    active?: boolean;
  }): Promise<PublisherListResponse> => {
    const response = await api.get('/publishers', { params });
    return response.data;
  },

  getById: async (id: number): Promise<Publisher> => {
    const response = await api.get(`/publishers/${id}`);
    return response.data.data;
  },
};
```

**Análise:**
- ✅ `getAll` - Listar publishers
- ✅ `getById` - Obter por ID
- ❌ **FALTA:** `create` - Criar publisher
- ❌ **FALTA:** `update` - Atualizar publisher
- ❌ **FALTA:** `delete` - Deletar publisher

**Status:** ❌ **INCOMPLETO** (só tem GET, falta POST, PUT, DELETE)

---

### **3.3. Página Frontend**

**Busca por:** `Publishers.tsx` ou `Publishers/`

**Resultado:** ❌ **NÃO ENCONTRADO**

Não existe página frontend para gerenciar publishers!

**Status:** ❌ **NÃO EXISTE**

---

## 🔧 **4. STATUS DO BACKEND**

### **4.1. PublisherService**

**Arquivo:** `backend/src/services/publisherService.ts`

**Métodos Implementados:**
- ✅ `getAllPublishers()` - Listar com paginação e filtros
- ✅ `getPublisherById()` - Obter por ID
- ✅ `createPublisher()` - Criar novo
- ✅ `updatePublisher()` - Atualizar
- ✅ `deletePublisher()` - Deletar (soft delete)

**Campos Suportados:**
- ✅ `name`, `contact_name`, `email`, `phone`, `whatsapp`, `description`
- ✅ `is_subscriber`, `is_publisher`, `client_type`
- ✅ `active`

**Status:** ✅ **COMPLETO**

---

### **4.2. Publisher Routes**

**Arquivo:** `backend/src/routes/publishers.ts`

**Rotas Implementadas:**
- ✅ `GET /api/publishers` - Listar
- ✅ `GET /api/publishers/:id` - Obter por ID
- ✅ `POST /api/publishers` - Criar
- ✅ `PUT /api/publishers/:id` - Atualizar
- ✅ `DELETE /api/publishers/:id` - Deletar

**Validações:**
- ✅ Validação de `name` (obrigatório)
- ✅ Validação de `email` (opcional, mas se fornecido deve ser válido)
- ✅ Validação de `client_type` (enum)

**Status:** ✅ **COMPLETO**

---

### **4.3. Relacionamentos no Backend**

**Verificação:**
- ❓ Métodos para listar `locals` de um publisher?
- ❓ Métodos para listar `totems` de um publisher?
- ❓ Métodos para listar `smart_tvs` de um publisher?

**Busca no código:**
```typescript
// Não encontrado métodos específicos para:
// - getLocalsByPublisher()
// - getTotemsByPublisher()
// - getSmartTvsByPublisher()
```

**Status:** ⚠️ **FALTA** métodos para relacionamentos

---

## 📊 **5. RESUMO COMPARATIVO**

### **5.1. Campos da Tabela**

| Campo | Backend | Frontend | Status |
|-------|---------|----------|--------|
| `publisher_id` | ✅ | ✅ | OK |
| `name` | ✅ | ✅ | OK |
| `contact_name` | ✅ | ❌ | **FALTA** |
| `email` | ✅ | ✅ | OK |
| `phone` | ✅ | ✅ | OK |
| `whatsapp` | ✅ | ✅ | OK |
| `description` | ✅ | ✅ | OK |
| `is_subscriber` | ✅ | ✅ | OK |
| `is_publisher` | ✅ | ✅ | OK |
| `client_type` | ✅ | ✅ | OK |
| `active` | ✅ | ✅ | OK |
| `created_at` | ✅ | ✅ | OK |
| `updated_at` | ✅ | ✅ | OK |

**Total:** 12/13 campos no frontend (falta `contact_name`)

---

### **5.2. CRUDs**

| Operação | Backend | Frontend API | Frontend Page | Status |
|----------|---------|--------------|---------------|--------|
| **Listar** | ✅ | ✅ | ❌ | ⚠️ Falta página |
| **Obter por ID** | ✅ | ✅ | ❌ | ⚠️ Falta página |
| **Criar** | ✅ | ❌ | ❌ | ❌ Falta tudo |
| **Atualizar** | ✅ | ❌ | ❌ | ❌ Falta tudo |
| **Deletar** | ✅ | ❌ | ❌ | ❌ Falta tudo |

**Status:** ⚠️ **BACKEND COMPLETO, FRONTEND INCOMPLETO**

---

### **5.3. Relacionamentos**

| Relacionamento | Schema | Backend Service | Frontend | Status |
|----------------|--------|----------------|----------|--------|
| **Publishers → Locals** | ✅ | ❌ | ❌ | ⚠️ Falta implementação |
| **Locals → Totems** | ✅ | ❌ | ❌ | ⚠️ Falta implementação |
| **Totems → Smart TVs** | ✅ | ❌ | ❌ | ⚠️ Falta implementação |

**Status:** ⚠️ **SCHEMA OK, IMPLEMENTAÇÃO FALTA**

---

## ❌ **6. O QUE ESTÁ FALTANDO**

### **6.1. Frontend - Interface TypeScript**

```typescript
// FALTA adicionar:
export interface Publisher {
  // ...
  contact_name?: string; // ← FALTA ESTE CAMPO
}
```

---

### **6.2. Frontend - API Client**

```typescript
// FALTA adicionar:
export const publisherApi = {
  // ... métodos existentes ...
  
  create: async (data: CreatePublisherRequest): Promise<Publisher> => {
    const response = await api.post('/publishers', data);
    return response.data.data;
  },
  
  update: async (id: number, data: UpdatePublisherRequest): Promise<Publisher> => {
    const response = await api.put(`/publishers/${id}`, data);
    return response.data.data;
  },
  
  delete: async (id: number): Promise<void> => {
    await api.delete(`/publishers/${id}`);
  },
};
```

---

### **6.3. Frontend - Página de Gerenciamento**

**FALTA CRIAR:** `frontend/src/pages/Publishers/Publishers.tsx`

**Funcionalidades necessárias:**
- ✅ Listar publishers (com paginação)
- ✅ Criar novo publisher
- ✅ Editar publisher existente
- ✅ Deletar publisher
- ✅ Visualizar detalhes (incluindo relacionamentos)
- ✅ Filtrar por `client_type`, `active`
- ✅ Buscar por nome/email

---

### **6.4. Backend - Métodos de Relacionamento**

**FALTA ADICIONAR em `PublisherService`:**

```typescript
// Listar locals de um publisher
async getLocalsByPublisher(publisherId: number): Promise<Local[]>

// Listar totems de um publisher (via locals)
async getTotemsByPublisher(publisherId: number): Promise<Totem[]>

// Listar smart TVs de um publisher (via totems)
async getSmartTvsByPublisher(publisherId: number): Promise<SmartTv[]>

// Estatísticas do publisher
async getPublisherStats(publisherId: number): Promise<{
  localsCount: number;
  totemsCount: number;
  smartTvsCount: number;
  activeCampaignsCount: number;
}>
```

---

### **6.5. Backend - Rotas de Relacionamento**

**FALTA ADICIONAR em `routes/publishers.ts`:**

```typescript
// GET /api/publishers/:id/locals
router.get('/:id/locals', ...)

// GET /api/publishers/:id/totems
router.get('/:id/totems', ...)

// GET /api/publishers/:id/smart-tvs
router.get('/:id/smart-tvs', ...)

// GET /api/publishers/:id/stats
router.get('/:id/stats', ...)
```

---

## ✅ **7. CHECKLIST DE IMPLEMENTAÇÃO**

### **Backend:**
- [x] ✅ Schema da tabela `publishers` completo
- [x] ✅ Relacionamentos definidos (FKs)
- [x] ✅ `PublisherService` com CRUD completo
- [x] ✅ Rotas de CRUD implementadas
- [ ] ❌ Métodos de relacionamento (locals, totems, smart_tvs)
- [ ] ❌ Rotas de relacionamento
- [ ] ❌ Método de estatísticas

### **Frontend:**
- [ ] ❌ Interface `Publisher` completa (falta `contact_name`)
- [ ] ❌ API client completo (falta create, update, delete)
- [ ] ❌ Página de gerenciamento (`Publishers.tsx`)
- [ ] ❌ Componentes de relacionamento (listar locals, totems, smart_tvs)

---

## 🎯 **8. PRIORIDADES DE IMPLEMENTAÇÃO**

### **Alta Prioridade:**
1. ✅ Adicionar `contact_name` na interface TypeScript do frontend
2. ✅ Completar `publisherApi` (create, update, delete)
3. ✅ Criar página `Publishers.tsx` com CRUD completo

### **Média Prioridade:**
4. ✅ Adicionar métodos de relacionamento no backend
5. ✅ Adicionar rotas de relacionamento
6. ✅ Exibir relacionamentos na página frontend

### **Baixa Prioridade:**
7. ✅ Adicionar campos extras na tabela `publishers` (address, city, etc.)
8. ✅ Método de estatísticas do publisher

---

## 📝 **9. CONCLUSÃO**

### **✅ O que está OK:**
- Schema do banco de dados (relacionamentos corretos)
- Backend CRUD completo
- Relacionamentos definidos no ER

### **❌ O que está faltando:**
- Frontend completamente ausente (sem página de gerenciamento)
- API client incompleto (falta create, update, delete)
- Interface TypeScript incompleta (falta `contact_name`)
- Métodos de relacionamento no backend
- Rotas de relacionamento

### **🎯 Próximos Passos:**
1. Completar interface TypeScript
2. Completar API client
3. Criar página de gerenciamento
4. Adicionar métodos de relacionamento
5. Adicionar rotas de relacionamento

