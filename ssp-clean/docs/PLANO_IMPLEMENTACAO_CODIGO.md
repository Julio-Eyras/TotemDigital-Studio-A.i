# Plano de Implementação: Alterações no Código (Backend + Frontend)

## 📋 Baseado em
- `PLANO_ACAO_RENOMENACOES_METICULOSO.md`
- `CONSOLIDACAO_FINAL_ANALISE_MODELO.md`
- Schema SQL refatorado (v2.0)

---

## 🎯 Objetivo
Atualizar todo o código backend e frontend para refletir as mudanças do schema:
- `clients` → `subscribers`
- `hosts` → `publishers`
- `client_id` → `subscriber_id`
- `host_id` → `publisher_id`
- Novas estruturas de billing e contratos

---

## 📊 Fases de Implementação

### FASE 1: Backend - Renomeações Básicas
- [ ] Renomear arquivos e rotas (`clients.ts` → `subscribers.ts`, `hosts.ts` → `publishers.ts`)
- [ ] Atualizar serviços (`clientService.ts` → `subscriberService.ts`)
- [ ] Atualizar queries SQL (todas as referências)
- [ ] Atualizar interfaces TypeScript
- [ ] Atualizar middleware de autenticação

### FASE 2: Backend - Estruturas de Billing
- [ ] Criar `subscriberBillingService.ts`
- [ ] Criar `publisherBillingService.ts`
- [ ] Criar rotas de billing separadas
- [ ] Atualizar lógica de revenue share

### FASE 3: Backend - Contratos
- [ ] Criar `subscriberContractService.ts`
- [ ] Criar `publisherContractService.ts`
- [ ] Criar rotas de contratos
- [ ] Implementar upload de documentos

### FASE 4: Backend - Users e Autenticação
- [ ] Atualizar `users` para usar `publisher_id`
- [ ] Adicionar `is_tenant_user` e `user_type`
- [ ] Atualizar middleware de autenticação
- [ ] Atualizar lógica de permissões

### FASE 5: Backend - Outras Tabelas
- [ ] Atualizar `campaigns` (subscriber_id)
- [ ] Atualizar `medias` (subscriber_id)
- [ ] Atualizar `playlists` (polimórfico)
- [ ] Atualizar `execution_logs` (polimórfico)
- [ ] Remover `totems.client_id` de queries

### FASE 6: Frontend - Renomeações
- [ ] Renomear componentes (`Clients.tsx` → `Subscribers.tsx`)
- [ ] Atualizar APIs (`clientApi.ts` → `subscriberApi.ts`)
- [ ] Atualizar stores Redux
- [ ] Atualizar tipos TypeScript

### FASE 7: Frontend - Novas Funcionalidades
- [ ] Componentes de billing separados
- [ ] Componentes de contratos
- [ ] Atualizar dashboard e relatórios

### FASE 8: Testes e Validação
- [ ] Testar todas as rotas atualizadas
- [ ] Validar integração com banco
- [ ] Testar fluxos completos

---

## 🔍 Arquivos a Modificar

### Backend
```
backend/src/
├── routes/
│   ├── clients.ts → subscribers.ts
│   ├── hosts.ts → publishers.ts
│   ├── billing.ts → (dividir em subscriber-billing.ts e publisher-billing.ts)
│   └── (outros arquivos que usam client_id/host_id)
├── services/
│   ├── clientService.ts → subscriberService.ts
│   ├── hostService.ts → publisherService.ts
│   ├── billingService.ts → (dividir)
│   └── (outros serviços)
├── middleware/
│   └── auth.middleware.ts (atualizar client_id → publisher_id)
└── types/
    └── (atualizar interfaces)
```

### Frontend
```
frontend/src/
├── pages/
│   ├── Clients/ → Subscribers/
│   ├── Hosts/ → Publishers/
│   └── (outros componentes)
├── services/api/
│   ├── clientApi.ts → subscriberApi.ts
│   ├── hostApi.ts → publisherApi.ts
│   └── (outros APIs)
├── store/slices/
│   └── (atualizar tipos)
└── types/
    └── (atualizar interfaces)
```

---

## ⚠️ Ordem de Execução

1. **Backend primeiro** (dependências de API)
2. **Frontend depois** (consome APIs do backend)
3. **Testes incrementais** (validar cada fase)

---

## 📝 Checklist Detalhado

### ✅ FASE 1: Backend - Renomeações Básicas

#### 1.1 Renomear Arquivos
- [ ] `backend/src/routes/clients.ts` → `subscribers.ts`
- [ ] `backend/src/routes/hosts.ts` → `publishers.ts`
- [ ] `backend/src/services/clientService.ts` → `subscriberService.ts`
- [ ] `backend/src/services/hostService.ts` → `publisherService.ts`

#### 1.2 Atualizar Queries SQL
- [ ] Todas as queries que usam `clients` → `subscribers`
- [ ] Todas as queries que usam `hosts` → `publishers`
- [ ] Todas as queries que usam `client_id` → `subscriber_id`
- [ ] Todas as queries que usam `host_id` → `publisher_id`

#### 1.3 Atualizar Interfaces TypeScript
- [ ] Interfaces `Client` → `Subscriber`
- [ ] Interfaces `Host` → `Publisher`
- [ ] Propriedades `clientId` → `subscriberId`
- [ ] Propriedades `hostId` → `publisherId`

#### 1.4 Atualizar Rotas
- [ ] `/api/clients` → `/api/subscribers`
- [ ] `/api/hosts` → `/api/publishers`
- [ ] Atualizar `index.ts` de rotas

---

## 🚀 Iniciando Implementação

Vou começar pela FASE 1, implementando as renomeações básicas no backend primeiro.

