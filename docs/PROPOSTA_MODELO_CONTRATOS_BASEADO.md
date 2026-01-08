# 📋 Proposta: Modelo Baseado em Contratos para Criação de Recursos

## 🎯 Objetivo

Implementar um modelo onde a criação de **Subscribers**, **Publishers** e seus recursos relacionados (Locais, Totens, Smart TVs) seja **baseada em contratos**, garantindo que:

1. **Apenas usuários administrativos** possam criar/manipular esses recursos
2. **Contratos sejam obrigatórios** antes da criação de recursos
3. **Valores contratuais** sejam informações reservadas e protegidas
4. **Rastreabilidade completa** entre contratos e recursos criados

---

## 📊 Situação Atual

### Problemas Identificados:

1. **Criação de Subscribers** (`POST /api/subscribers`)
   - ❌ **Sem restrição de role** - qualquer usuário autenticado pode criar
   - ❌ **Sem vínculo obrigatório com contrato**
   - ❌ **Sem controle de valores contratuais**

2. **Criação de Publishers** (`POST /api/publishers`)
   - ❌ **Sem restrição de role** - qualquer usuário autenticado pode criar
   - ❌ **Sem vínculo obrigatório com contrato**
   - ❌ **Sem controle de valores contratuais**

3. **Criação de Contratos** (`POST /api/contracts`)
   - ✅ **Com restrição de role** - apenas: `admin`, `admin_sql`, `owner_system`, `operador_faturamento`, `operador_comercial`
   - ✅ **Valores contratuais protegidos** (total_amount, payment_terms, etc.)

4. **Criação de Recursos (Locais, Totens, Smart TVs)**
   - ⚠️ **Parcialmente controlado** - publishers podem criar seus próprios recursos
   - ❌ **Sem vínculo direto com contratos**

---

## 🏗️ Proposta: Modelo Baseado em Contratos

### 1. **Fluxo de Criação de Subscribers**

```
┌─────────────────────────────────────────────────────────────┐
│ 1. ADMINISTRATIVO cria CONTRATO (com valores contratuais)   │
│    Roles: admin, admin_sql, owner_system,                   │
│           operador_faturamento, operador_comercial          │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. CONTRATO criado com status 'draft' ou 'active'           │
│    - subscriber_id: NULL (ainda não existe)                 │
│    - contract_number: obrigatório                            │
│    - total_amount: valor contratual (reservado)              │
│    - payment_terms: condições (reservado)                    │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. ADMINISTRATIVO cria SUBSCRIBER vinculado ao CONTRATO     │
│    - POST /api/subscribers                                   │
│    - Body: { ..., contract_id: <ID> }                       │
│    - Validação: contrato existe e está válido               │
│    - Atualização: subscriber_contracts.subscriber_id        │
└─────────────────────────────────────────────────────────────┘
```

**Regras:**
- ✅ Apenas roles administrativos podem criar subscribers
- ✅ `contract_id` é **obrigatório** na criação
- ✅ Contrato deve existir e estar em status válido (`draft` ou `active`)
- ✅ Após criar subscriber, atualizar `subscriber_contracts.subscriber_id`

---

### 2. **Fluxo de Criação de Publishers**

```
┌─────────────────────────────────────────────────────────────┐
│ 1. ADMINISTRATIVO cria CONTRATO DE PUBLISHER                 │
│    (publisher_contracts)                                     │
│    - contract_type: 'revenue_share', 'subscription',         │
│      'partnership', 'hybrid'                                 │
│    - revenue_share_percentage: % (reservado)                 │
│    - subscription_amount: valor (reservado)                  │
│    - publisher_id: NULL (ainda não existe)                  │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. ADMINISTRATIVO cria PUBLISHER vinculado ao CONTRATO      │
│    - POST /api/publishers                                    │
│    - Body: { ..., contract_id: <ID> }                      │
│    - Validação: contrato existe e está válido                │
│    - Atualização: publisher_contracts.publisher_id          │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. ADMINISTRATIVO cria RECURSOS (Locais, Totens, Smart TVs) │
│    - Vinculados ao publisher                                 │
│    - Rastreáveis via contrato                                │
└─────────────────────────────────────────────────────────────┘
```

**Regras:**
- ✅ Apenas roles administrativos podem criar publishers
- ✅ `contract_id` é **obrigatório** na criação
- ✅ Contrato deve existir e estar em status válido
- ✅ Após criar publisher, atualizar `publisher_contracts.publisher_id`

---

### 3. **Estrutura de Dados Proposta**

#### 3.1. **Subscriber Contracts - Modificação**

```sql
-- Adicionar campo para permitir criação de contrato antes do subscriber
ALTER TABLE subscriber_contracts
  ADD COLUMN IF NOT EXISTS created_before_subscriber BOOLEAN DEFAULT false;

-- Permitir subscriber_id NULL temporariamente
ALTER TABLE subscriber_contracts
  ALTER COLUMN subscriber_id DROP NOT NULL; -- Temporário até subscriber ser criado

-- Adicionar constraint: subscriber_id OU created_before_subscriber deve ser true
ALTER TABLE subscriber_contracts
  ADD CONSTRAINT chk_subscriber_contract_creation
    CHECK (
      (subscriber_id IS NOT NULL) OR 
      (created_before_subscriber = true AND subscriber_id IS NULL)
    );
```

#### 3.2. **Publisher Contracts - Modificação**

```sql
-- Adicionar campo para permitir criação de contrato antes do publisher
ALTER TABLE publisher_contracts
  ADD COLUMN IF NOT EXISTS created_before_publisher BOOLEAN DEFAULT false;

-- Permitir publisher_id NULL temporariamente
ALTER TABLE publisher_contracts
  ALTER COLUMN publisher_id DROP NOT NULL; -- Temporário até publisher ser criado

-- Adicionar constraint: publisher_id OU created_before_publisher deve ser true
ALTER TABLE publisher_contracts
  ADD CONSTRAINT chk_publisher_contract_creation
    CHECK (
      (publisher_id IS NOT NULL) OR 
      (created_before_publisher = true AND publisher_id IS NULL)
    );
```

#### 3.3. **Rastreabilidade de Recursos**

```sql
-- Adicionar contract_id aos recursos para rastreabilidade
ALTER TABLE locals
  ADD COLUMN IF NOT EXISTS created_via_contract_id INTEGER REFERENCES subscriber_contracts(contract_id) ON DELETE SET NULL;

ALTER TABLE totems
  ADD COLUMN IF NOT EXISTS created_via_contract_id INTEGER REFERENCES subscriber_contracts(contract_id) ON DELETE SET NULL;

ALTER TABLE smart_tvs
  ADD COLUMN IF NOT EXISTS created_via_contract_id INTEGER REFERENCES subscriber_contracts(contract_id) ON DELETE SET NULL;
```

---

### 4. **Permissões e Roles**

#### 4.1. **Roles com Permissão para Criar Contratos**

```typescript
const CONTRACT_CREATION_ROLES = [
  'admin',
  'admin_sql',
  'owner_system',
  'operador_faturamento',
  'operador_comercial'
];
```

#### 4.2. **Roles com Permissão para Criar Subscribers/Publishers**

```typescript
const RESOURCE_CREATION_ROLES = [
  'admin',
  'admin_sql',
  'owner_system',
  'operador_faturamento',
  'operador_comercial'
];
```

#### 4.3. **Roles com Permissão para Visualizar Valores Contratuais**

```typescript
const CONTRACT_VALUES_VIEW_ROLES = [
  'admin',
  'admin_sql',
  'owner_system',
  'operador_faturamento'
  // operador_comercial NÃO vê valores (apenas cria contratos)
];
```

---

### 5. **Validações Propostas**

#### 5.1. **Criação de Subscriber**

```typescript
// Validações obrigatórias:
1. contract_id existe e é válido
2. Contrato está em status 'draft' ou 'active'
3. Contrato não tem subscriber_id já vinculado (se created_before_subscriber = false)
4. Usuário tem role administrativo
5. Se contrato tem created_before_subscriber = true, vincular subscriber_id
```

#### 5.2. **Criação de Publisher**

```typescript
// Validações obrigatórias:
1. contract_id existe e é válido (publisher_contracts)
2. Contrato está em status 'draft' ou 'active'
3. Contrato não tem publisher_id já vinculado (se created_before_publisher = false)
4. Usuário tem role administrativo
5. Se contrato tem created_before_publisher = true, vincular publisher_id
```

#### 5.3. **Criação de Recursos (Locais, Totens, Smart TVs)**

```typescript
// Validações opcionais (para rastreabilidade):
1. Se contract_id fornecido, validar que existe e está ativo
2. Se contract_id fornecido, validar que pertence ao publisher/subscriber correto
3. Registrar created_via_contract_id para auditoria
```

---

### 6. **Proteção de Informações Reservadas**

#### 6.1. **Campos Reservados em Contratos**

```typescript
const RESERVED_CONTRACT_FIELDS = [
  'total_amount',           // Valor total do contrato
  'payment_terms',          // Condições de pagamento
  'revenue_share_percentage', // % de revenue share (publishers)
  'subscription_amount',    // Valor de subscription (publishers)
  'minimum_payout_amount',  // Valor mínimo para payout (publishers)
  'document_path',          // Caminho do documento
  'metadata'                // Metadados adicionais
];
```

#### 6.2. **Middleware de Proteção**

```typescript
// Middleware para ocultar campos reservados baseado em role
function protectContractValues(req: any, res: any, next: any) {
  if (!CONTRACT_VALUES_VIEW_ROLES.includes(req.user.role)) {
    // Remover campos reservados da resposta
    if (res.locals.contract) {
      RESERVED_CONTRACT_FIELDS.forEach(field => {
        delete res.locals.contract[field];
      });
    }
  }
  next();
}
```

---

### 7. **Fluxo de UI Proposto**

#### 7.1. **Criação de Subscriber**

```
1. Usuário administrativo acessa "Contratos" → "Criar Contrato"
2. Preenche dados do contrato (valores, condições, etc.)
3. Salva contrato com status 'draft'
4. Vai para "Assinantes" → "Criar Assinante"
5. Seleciona o contrato criado (obrigatório)
6. Preenche dados do subscriber
7. Sistema vincula subscriber ao contrato automaticamente
```

#### 7.2. **Criação de Publisher**

```
1. Usuário administrativo acessa "Contratos" → "Criar Contrato de Publisher"
2. Preenche dados do contrato (revenue share, subscription, etc.)
3. Salva contrato com status 'draft'
4. Vai para "Publicadores" → "Criar Publicador"
5. Seleciona o contrato criado (obrigatório)
6. Preenche dados do publisher
7. Sistema vincula publisher ao contrato automaticamente
8. Pode criar locais, totens, smart TVs vinculados ao publisher
```

---

### 8. **Vantagens do Modelo Proposto**

✅ **Segurança:**
- Apenas administrativos criam recursos
- Valores contratuais protegidos
- Rastreabilidade completa

✅ **Auditoria:**
- Todo recurso vinculado a um contrato
- Histórico de criação baseado em contratos
- Valores e condições registrados antes da criação

✅ **Negócio:**
- Contratos definem valores antes da criação
- Controle financeiro centralizado
- Informações reservadas protegidas

✅ **Flexibilidade:**
- Contratos podem ser criados antes dos recursos
- Permite negociação antes da criação
- Status de contrato controla criação de recursos

---

### 9. **Impactos e Considerações**

#### 9.1. **Breaking Changes**

⚠️ **Criação de Subscribers:**
- `contract_id` se torna obrigatório
- Roles não administrativos não podem mais criar

⚠️ **Criação de Publishers:**
- `contract_id` se torna obrigatório
- Roles não administrativos não podem mais criar

⚠️ **Mudanças no Schema:**
- `subscriber_contracts.subscriber_id` pode ser NULL temporariamente
- `publisher_contracts.publisher_id` pode ser NULL temporariamente
- Novos campos de rastreabilidade em recursos

#### 9.2. **Migração de Dados Existentes**

```sql
-- Para subscribers existentes sem contrato:
-- Criar contratos "retroativos" com status 'active'
-- Vincular subscribers existentes

-- Para publishers existentes sem contrato:
-- Criar contratos "retroativos" com status 'active'
-- Vincular publishers existentes
```

---

### 10. **Próximos Passos (Se Aprovado)**

1. ✅ **Análise e Aprovação** desta proposta
2. ⏳ **Atualização do Schema** (migrations)
3. ⏳ **Atualização do Backend** (validações, permissões)
4. ⏳ **Atualização do Frontend** (UI, fluxos)
5. ⏳ **Migração de Dados** (contratos retroativos)
6. ⏳ **Testes e Validação**

---

## 📝 Resumo Executivo

**Problema:** Recursos (Subscribers, Publishers) podem ser criados sem vínculo com contratos, sem controle de valores contratuais e sem restrição adequada de roles.

**Solução:** Implementar modelo onde:
- Contratos são criados primeiro (com valores reservados)
- Subscribers/Publishers são criados vinculados a contratos
- Apenas roles administrativos podem criar
- Valores contratuais são informações reservadas

**Benefícios:** Segurança, auditoria, controle financeiro, rastreabilidade.

---

**Status:** ⏸️ **AGUARDANDO APROVAÇÃO** - Nenhuma alteração será feita até confirmação.
