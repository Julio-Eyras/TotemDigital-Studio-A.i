# Resumo Executivo: Renomeações e Refatoração do Modelo E.R.

## 🎯 Objetivo

Renomear e refatorar o modelo E.R. para refletir corretamente o modelo de negócio:
- **CLIENT** → **SUBSCRIBER** (assinantes que compram espaço publicitário)
- **HOST** → **PUBLISHER** (publishers que exibem conteúdo em totens/Smart TVs)
- Implementar estrutura de billing separada
- Modelo híbrido de billing para publishers

---

## 📊 Mudanças Principais

### 1. Renomeações de Tabelas

| Antigo | Novo | Justificativa |
|--------|------|---------------|
| `clients` | `subscribers` | Reflete: assinantes que compram espaço publicitário |
| `hosts` | `publishers` | Reflete: publishers que publicam/exibem conteúdo |

### 2. Renomeações de Colunas

| Tabela | Campo Antigo | Campo Novo | Justificativa |
|--------|--------------|------------|---------------|
| Todas | `client_id` | `subscriber_id` | FK para subscribers |
| Todas | `host_id` | `publisher_id` | FK para publishers |
| `users` | `client_id` | `publisher_id` | Users pertencem ao publisher |
| `subscriptions` | `client_id` | `publisher_id` | Subscription é do publisher |
| `locals` | `host_id` | `publisher_id` | Local pertence ao publisher |

### 3. Remoções

| Tabela | Campo | Ação | Justificativa |
|--------|-------|------|---------------|
| `totems` | `client_id` | **REMOVER** | Totem pertence a publisher via local_id |

### 4. Novas Tabelas

| Tabela | Propósito |
|--------|-----------|
| `subscriber_billing` | Billing de subscribers (anunciantes pagam) |
| `publisher_billing` | Billing de publishers (recebem % ou pagam subscription) |
| `publisher_contracts` | Contratos de publishers (regras de revenue share, documentos) |
| `subscriber_contracts` | Contratos de subscribers (regras de pagamento, documentos) |

### 5. Novos Campos

#### `publishers`
- `is_subscriber` BOOLEAN
- `is_publisher` BOOLEAN
- `client_type` TEXT ('subscriber', 'publisher', 'both')

#### `publisher_billing`
- `revenue_share_percentage` NUMERIC(5, 2)
- `original_campaign_amount` NUMERIC(12, 2)
- `platform_fee_amount` NUMERIC(12, 2)
- `approved_by` INTEGER (FK → users)
- `approved_at` TIMESTAMP

---

## 🔄 Fluxo de Billing

### Subscriber Billing (Anunciante Paga)

```
SUBSCRIBER → Paga → TENANT (SmartSignage Pro)
  ↓
subscriber_billing:
  - billing_type: 'advertisement', 'exhibition_lot', 'totem_quantity', etc.
  - amount: valor pago
  - direction: 'incoming' (plataforma recebe)
```

### Publisher Billing (Publisher Recebe ou Paga)

#### Cenário A: Revenue Share
```
SUBSCRIBER paga R$ 1.000 → TENANT
  ↓
TENANT retém 30% (R$ 300)
TENANT paga 70% (R$ 700) → PUBLISHER
  ↓
publisher_billing:
  - billing_type: 'revenue_share'
  - direction: 'outgoing' (plataforma paga)
  - revenue_share_percentage: 70.00
  - amount: 700.00
```

#### Cenário B: Subscription
```
PUBLISHER → Paga R$ 500/mês → TENANT
  ↓
publisher_billing:
  - billing_type: 'subscription'
  - direction: 'incoming' (plataforma recebe)
  - amount: 500.00
```

#### Cenário C: Híbrido
```
PUBLISHER:
  - Recebe revenue share (outgoing)
  - Paga subscription (incoming)
  - Saldo líquido = recebimentos - pagamentos
```

---

## 🏗️ Estrutura de Relacionamentos (Corrigida)

```
┌─────────────────────────────────────────────────────────────┐
│              SMARTDISPLAY ECOSYSTEM                         │
│                                                             │
│  TENANT = SmartSignage Pro                                 │
│  - Admin e Operador em users (is_tenant_user = true)       │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────┐        ┌──────────────────────┐
│   SUBSCRIBERS        │        │   PUBLISHERS         │
│ (Anunciantes)        │        │ (Publicadores)       │
│                      │        │                      │
│ • Cria campanhas     │        │ • Instala totens     │
│ • Cria mídias        │        │ • Instala Smart TVs  │
│ • Cria playlists     │        │ • Gerencia conteúdo  │
│ • Paga por espaço    │        │ • Recebe % ou paga   │
│ • Aprovação necessária│       │ • Tem users          │
│                      │        │                      │
│ → campaigns          │        │ → users              │
│ → medias             │        │ → locals             │
│ → playlists          │        │ → totems             │
│ → subscriber_billing │        │ → smart_tvs          │
└──────────┬───────────┘        │ → publisher_billing  │
           │                    │ → subscriptions      │
           │                    └──────────┬───────────┘
           │                               │
           │              campaign_totems  │
           └──────────────┬────────────────┘
                          │
                    ┌─────▼─────┐
                    │  totems   │
                    └───────────┘
```

---

## ✅ Checklist de Implementação

### Fase 1: Preparação
- [ ] Responder todas as questões em `QUESTOES_ESCLARECER_MODELO_NEGOCIO.md`
- [ ] Validar modelo proposto
- [ ] Criar backup completo do banco

### Fase 2: Criar Novas Estruturas
- [ ] Criar tabela `subscribers` (cópia de `clients`)
- [ ] Criar tabela `publishers` (cópia de `hosts` + flags)
- [ ] Criar `subscriber_billing`
- [ ] Criar `publisher_billing`
- [ ] Criar `publisher_contracts`
- [ ] Criar `subscriber_contracts` (se necessário)

### Fase 3: Migrar Dados
- [ ] Migrar dados `clients` → `subscribers`
- [ ] Migrar dados `hosts` → `publishers`
- [ ] Popular flags `is_subscriber`, `is_publisher`, `client_type`

### Fase 4: Atualizar FKs
- [ ] Adicionar `subscriber_id` em todas as tabelas necessárias
- [ ] Adicionar `publisher_id` em todas as tabelas necessárias
- [ ] Popular novos campos a partir de dados antigos
- [ ] Validar integridade

### Fase 5: Remover Estruturas Antigas
- [ ] Remover `totems.client_id`
- [ ] Remover FKs antigas
- [ ] Remover colunas antigas
- [ ] Remover tabelas antigas (se migração completa)

### Fase 6: Atualizar Código
- [ ] Backend: atualizar serviços, rotas, queries
- [ ] Frontend: atualizar APIs, componentes, queries
- [ ] Scripts: atualizar scripts de instalação/migração

### Fase 7: Testes
- [ ] Testar todas as funcionalidades
- [ ] Validar integridade de dados
- [ ] Validar performance
- [ ] Testar billing (subscriber e publisher)

---

## ⚠️ Pontos Críticos de Atenção

1. **NÃO criar scripts de migração de dados** (você confirmou que não quer preservar dados)
2. **Implementar modelo híbrido** (publisher recebe % E paga subscription)
3. **RBAC para aprovação de payouts** (usuários com permissão específica)
4. **Armazenamento de documentos** (contratos em PDF, DOC, DOCX)
5. **Revenue share variável** (conforme contrato de cada publisher)

---

## 📋 Próximos Passos Imediatos

1. **Responder questões** em `QUESTOES_ESCLARECER_MODELO_NEGOCIO.md`
2. **Validar modelo** após respostas
3. **Criar DDL completo** com todas as mudanças
4. **Criar scripts de migração** (sem preservar dados, apenas estrutura)
5. **Documentar impactos** no código backend/frontend

---

**Status:** Aguardando respostas às questões para finalizar modelo e criar scripts de migração.

