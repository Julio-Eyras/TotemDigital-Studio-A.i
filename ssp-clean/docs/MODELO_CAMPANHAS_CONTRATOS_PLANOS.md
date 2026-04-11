# Modelo: Campanhas, Contratos e Planos

## 📋 Visão Geral

Este documento descreve o modelo completo de **Campanhas** no contexto de **Subscribers**, **Contratos** e **Planos**, explicando como campanhas se relacionam com contratos/planos e quais podem efetivamente ser executadas nos totens.

---

## 🏗️ Estrutura Atual vs. Necessária

### **Estrutura Atual da Tabela `campaigns`**

```sql
CREATE TABLE campaigns (
    campaign_id SERIAL PRIMARY KEY,
    subscriber_id INTEGER NOT NULL, -- FK para subscribers (anunciante)
    
    title TEXT NOT NULL,
    description TEXT,
    campaign_type TEXT DEFAULT 'general', -- general, scheduled, interactive, recurring
    priority INTEGER DEFAULT 1, -- 1-10
    
    -- Camada comercial
    commercial_tier TEXT DEFAULT 'standard', -- premium, standard, remnant
    default_time_share_percent NUMERIC(5, 2) DEFAULT 0,
    max_consecutive_slots INTEGER DEFAULT 2,
    
    -- Agendamento
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    start_time TEXT, -- HH:MM
    end_time TEXT, -- HH:MM
    days_of_week TEXT, -- JSON array
    timezone TEXT DEFAULT 'America/Sao_Paulo',
    
    status TEXT DEFAULT 'draft', -- draft, pending_approval, approved, active, paused, finished, deleted
    is_active BOOLEAN DEFAULT true,
    
    target_audience JSONB,
    metadata JSONB,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **Problema Identificado**

Atualmente, a tabela `campaigns` **NÃO possui** uma relação direta com `subscriber_contracts` ou `plans`. Isso significa que:

- ❌ Não há como vincular uma campanha a um contrato específico
- ❌ Não há como vincular uma campanha a um plano específico
- ❌ Não há validação se o subscriber tem um contrato ativo para executar a campanha
- ❌ Não há controle sobre quais campanhas podem ser executadas nos totens

---

## ✅ Modelo Proposto

### **1. Adicionar Relação com Contratos/Planos**

**Opção A: Vincular a Contrato (Recomendado)**
```sql
ALTER TABLE campaigns ADD COLUMN contract_id INTEGER;
ALTER TABLE campaigns ADD CONSTRAINT fk_campaign_contract 
    FOREIGN KEY (contract_id) REFERENCES subscriber_contracts(contract_id) ON DELETE SET NULL;
```

**Justificativa:**
- Contratos são mais específicos (têm `start_date`, `end_date`, `status`)
- Um contrato já está vinculado a um plano (`plan_id`)
- Permite rastrear qual contrato gerou a campanha
- Permite validar se o contrato está ativo e dentro do período válido

**Opção B: Vincular Diretamente ao Plano**
```sql
ALTER TABLE campaigns ADD COLUMN plan_id INTEGER;
ALTER TABLE campaigns ADD CONSTRAINT fk_campaign_plan 
    FOREIGN KEY (plan_id) REFERENCES plans(plan_id) ON DELETE SET NULL;
```

**Justificativa:**
- Mais simples (menos níveis de relacionamento)
- Mas perde a granularidade de rastrear qual contrato específico

**Recomendação: Usar Opção A (contract_id)**

---

## 🔗 Relacionamentos Propostos

```
SUBSCRIBERS (1)
  │
  ├── (1:N) SUBSCRIBER_CONTRACTS
  │     │
  │     └── (N:1) PLANS
  │           └── (N:M) PLAN_PUBLISHER_ACCESS
  │                 └── (N:1) PUBLISHERS
  │                       └── (1:N) LOCALS
  │                             └── (1:N) TOTEMS
  │
  └── (1:N) CAMPAIGNS
        ├── (N:1) SUBSCRIBER_CONTRACTS (contract_id) ⭐ NOVO
        ├── (N:M) CAMPAIGN_MEDIAS
        │     └── (N:1) MEDIAS
        ├── (N:M) CAMPAIGN_PLAYLISTS
        │     └── (N:1) PLAYLISTS
        └── (N:M) CAMPAIGN_TOTEMS
              └── (N:1) TOTEMS
```

---

## 📊 Regras de Negócio

### **1. Criação de Campanha**

**Campos Obrigatórios:**
- `subscriber_id` (já existe)
- `title` (já existe)
- `contract_id` ⭐ **NOVO** (opcional, mas recomendado)

**Validações:**
- ✅ Se `contract_id` for fornecido, verificar se:
  - O contrato pertence ao `subscriber_id`
  - O contrato está com `status = 'active'`
  - O contrato está dentro do período válido (`start_date <= NOW() <= end_date` ou `end_date IS NULL`)
- ✅ Se `contract_id` for NULL, a campanha pode ser criada, mas **não pode ser executada** nos totens

### **2. Execução de Campanha (Adicionar às Filas de Totens)**

**Validações Obrigatórias:**
- ✅ Campanha deve ter `contract_id` vinculado
- ✅ Contrato deve estar ativo (`status = 'active'`)
- ✅ Contrato deve estar dentro do período válido
- ✅ Campanha deve estar com `status = 'active'` ou `status = 'approved'`
- ✅ Campanha deve estar com `is_active = true`
- ✅ Campanha deve ter pelo menos uma mídia ou playlist associada
- ✅ Totens devem pertencer a publishers acessíveis via `subscriber_publisher_access` (gerado pelo contrato/plano)

**Fluxo:**
1. Subscriber cria campanha e vincula a um contrato ativo
2. Subscriber adiciona mídias e/ou playlists à campanha
3. Subscriber associa campanha a totens (via `campaign_totems`)
4. Sistema valida se:
   - Contrato está ativo e válido
   - Totens pertencem a publishers acessíveis via contrato/plano
5. Se válido, campanha é adicionada às filas de playlists dos totens

---

## 🎯 Campos Completos da Campanha

### **Campos Básicos**
- `campaign_id` (PK)
- `subscriber_id` (FK) - **Obrigatório**
- `contract_id` (FK) ⭐ **NOVO** - **Opcional, mas recomendado para execução**
- `title` - **Obrigatório**
- `description`

### **Campos de Tipo e Prioridade**
- `campaign_type` - general, scheduled, interactive, recurring
- `priority` - 1-10 (maior = mais prioridade)

### **Campos Comerciais**
- `commercial_tier` - premium, standard, remnant
- `default_time_share_percent` - % alvo de share de tempo
- `max_consecutive_slots` - máximo de slots consecutivos

### **Campos de Agendamento**
- `start_date` - Data de início
- `end_date` - Data de término
- `start_time` - Horário de início (HH:MM)
- `end_time` - Horário de término (HH:MM)
- `days_of_week` - JSON array: ["mon", "tue", "wed"]
- `timezone` - Fuso horário

### **Campos de Status**
- `status` - draft, pending_approval, approved, active, paused, finished, deleted
- `is_active` - Ativo/Inativo

### **Campos de Conteúdo**
- `target_audience` (JSONB) - Critérios de público-alvo
- `metadata` (JSONB) - Metadados adicionais

### **Relacionamentos N:M**
- **Mídias Individuais**: Via `campaign_medias` (campaign_id, media_id)
- **Playlists**: Via `campaign_playlists` (campaign_id, playlist_id)
- **Totens**: Via `campaign_totems` (campaign_id, totem_id)

---

## 🔍 Validações de Execução

### **Checklist para Executar Campanha**

```sql
-- Verificar se campanha pode ser executada
SELECT 
    c.campaign_id,
    c.title,
    c.status,
    c.is_active,
    c.contract_id,
    sc.status AS contract_status,
    sc.start_date AS contract_start,
    sc.end_date AS contract_end,
    CASE 
        WHEN c.contract_id IS NULL THEN false
        WHEN sc.status != 'active' THEN false
        WHEN sc.start_date > CURRENT_DATE THEN false
        WHEN sc.end_date IS NOT NULL AND sc.end_date < CURRENT_DATE THEN false
        WHEN c.status NOT IN ('active', 'approved') THEN false
        WHEN c.is_active = false THEN false
        ELSE true
    END AS can_execute
FROM campaigns c
LEFT JOIN subscriber_contracts sc ON c.contract_id = sc.contract_id
WHERE c.campaign_id = :campaign_id;
```

---

## 📝 Interface do Usuário (Aba Campanhas)

### **Formulário de Criação/Edição**

**Seção 1: Informações Básicas**
- Título * (obrigatório)
- Descrição
- Tipo (general, scheduled, interactive, recurring)
- Prioridade (1-10)
- Status (draft, pending_approval, approved, active, paused, finished, deleted)
- Status Ativo (checkbox)

**Seção 2: Vinculação com Contrato/Plano** ⭐ **NOVO**
- Contrato * (Select com contratos ativos do subscriber)
  - Mostrar: `contract_number` - `plan_name` (Período: `start_date` a `end_date`)
  - Filtrar apenas contratos com `status = 'active'` e dentro do período válido
  - Alert se não houver contratos ativos: "Você precisa ter um contrato ativo para executar campanhas"

**Seção 3: Agendamento**
- Data de Início
- Data de Término
- Horário de Início (HH:MM)
- Horário de Término (HH:MM)
- Dias da Semana (checkboxes: Seg, Ter, Qua, Qui, Sex, Sáb, Dom)
- Fuso Horário

**Seção 4: Configurações Comerciais**
- Camada Comercial (premium, standard, remnant)
- % de Share de Tempo (0-100)
- Máximo de Slots Consecutivos

**Seção 5: Conteúdo**
- **Mídias Individuais**: 
  - Lista de mídias do subscriber
  - Checkboxes para selecionar mídias
  - Configurar duração, ordem, prioridade por mídia
- **Playlists**:
  - Lista de playlists do subscriber
  - Checkboxes para selecionar playlists
  - Configurar prioridade por playlist

**Seção 6: Público-Alvo** (JSONB)
- Critérios de público-alvo (formulário dinâmico)

---

## ⚠️ Regras Importantes

### **1. Campanhas sem Contrato**
- ✅ Podem ser criadas (para rascunho)
- ❌ **NÃO podem ser executadas** nos totens
- ⚠️ Alert na UI: "Esta campanha não está vinculada a um contrato. Vincule a um contrato ativo para executá-la."

### **2. Campanhas com Contrato Expirado**
- ✅ Podem existir no banco
- ❌ **NÃO podem ser executadas** nos totens
- ⚠️ Alert na UI: "O contrato vinculado a esta campanha está expirado ou inativo."

### **3. Validação de Totens**
- ✅ Apenas totens de publishers acessíveis via `subscriber_publisher_access` podem receber campanhas
- ✅ Acessos são gerados automaticamente quando um contrato é ativado
- ✅ Acessos podem expirar (`expires_at`)

---

## 🎯 Resumo

### **O que é necessário:**

1. **Adicionar `contract_id` à tabela `campaigns`**
   - FK opcional para `subscriber_contracts`
   - Permite vincular campanha a um contrato específico

2. **Validações no Backend**
   - Verificar se contrato está ativo e válido antes de executar
   - Verificar se totens pertencem a publishers acessíveis

3. **Interface do Usuário**
   - Campo "Contrato" no formulário de campanha
   - Listar apenas contratos ativos e válidos
   - Alert se campanha não pode ser executada

4. **Regra de Execução**
   - **Apenas campanhas vinculadas a contratos ativos podem ser executadas nos totens**

---

## ✅ Confirmação

Este modelo está correto? Devo prosseguir com:

1. ✅ Adicionar `contract_id` à tabela `campaigns` (migration)
2. ✅ Atualizar interfaces TypeScript (CreateCampaignRequest, UpdateCampaignRequest, Campaign)
3. ✅ Atualizar backend (validações, service, routes)
4. ✅ Atualizar frontend (formulário com campo de contrato, validações, alerts)
5. ✅ Implementar validações de execução (verificar contrato ativo antes de adicionar às filas)
