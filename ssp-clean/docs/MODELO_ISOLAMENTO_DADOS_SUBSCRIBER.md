# Modelo de Isolamento de Dados por Subscriber

## 📋 Princípios Fundamentais

### 1. **Propriedade dos Dados**
- ✅ **Mídia** → Pertence sempre a um `subscriber_id`
- ✅ **Playlist** → Pertence sempre a um `subscriber_id`
- ✅ **Campanha** → Pertence sempre a um `subscriber_id`

### 2. **Isolamento de Dados**
- ✅ **Apenas o subscriber** pode visualizar seu universo de dados
- ✅ **Multi-tenancy** no nível de subscriber (não no nível de publisher)
- ✅ **Queries devem sempre filtrar por `subscriber_id`**

### 3. **Compartilhamento Controlado**
- ✅ **Campanha** pode estar atrelada a **múltiplos publishers** via `campaign_publishers`
- ✅ **Publisher** recebe campanhas de **múltiplos subscribers**
- ✅ **Publisher mixa** todas as campanhas apontadas para ele sob regras determinadas

---

## 🔒 Isolamento de Dados - Regras de Negócio

### Regra 1: Visualização de Dados

**Subscriber só vê seus próprios dados:**
- Suas próprias mídias (`medias.subscriber_id = ?`)
- Suas próprias playlists (`playlists.subscriber_id = ?`)
- Suas próprias campanhas (`campaigns.subscriber_id = ?`)

**Publisher vê:**
- Campanhas atribuídas a ele via `campaign_publishers`
- Mídias e playlists dessas campanhas (read-only, para exibição)
- Seus próprios totens, locals, etc.

**Tenant (Admin) vê:**
- Todos os dados (para administração e aprovação)

### Regra 2: Criação de Dados

**Subscriber pode criar:**
- Mídias (requerem aprovação)
- Playlists (usando apenas suas mídias aprovadas)
- Campanhas (usando apenas suas playlists)
- Atribuir campanhas a publishers

**Publisher pode:**
- Ver campanhas atribuídas a ele
- Configurar regras de mixagem
- Não pode criar/modificar campanhas de subscribers

---

## 📊 Modelo de Relacionamento

```
┌─────────────────────────────────────────────────────────────┐
│                    SUBSCRIBER (Anunciante)                  │
│                  (Isolamento de Dados)                      │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         │ 1:N                │ 1:N                │ 1:N
         │                    │                    │
    ┌────▼────┐         ┌────▼────┐         ┌────▼────┐
    │ Medias  │         │Playlists│         │Campaigns│
    │         │         │         │         │         │
    │sub_id=1 │         │sub_id=1 │         │sub_id=1 │
    └─────────┘         └────┬────┘         └────┬────┘
                             │                    │
                             │ N:M                │ N:M
                             │                    │
                    ┌────────▼────────┐   ┌───────▼────────┐
                    │campaign_playlists│   │campaign_publishers│
                    └─────────────────┘   └───────┬────────┘
                                                   │
                                                   │ N:M
                                                   │
                                    ┌──────────────▼──────────────┐
                                    │      PUBLISHER              │
                                    │  (Mixagem de Campanhas)     │
                                    │                             │
                                    │ • Recebe campanhas de       │
                                    │   múltiplos subscribers     │
                                    │ • Mixa sob regras           │
                                    │ • Exibe em seus totens     │
                                    └─────────────────────────────┘
```

---

## 🔧 Implementação Técnica

### 1. **Queries com Isolamento**

**❌ ERRADO:**
```typescript
// Sem filtro de subscriber - expõe dados de outros subscribers
async getCampaigns() {
    return await db.findMany(`
        SELECT * FROM campaigns
    `);
}
```

**✅ CORRETO:**
```typescript
// Sempre filtrar por subscriber_id
async getCampaigns(subscriberId: number) {
    return await db.findMany(`
        SELECT * FROM campaigns
        WHERE subscriber_id = $1
    `, [subscriberId]);
}
```

### 2. **Middleware de Isolamento**

**Criar middleware que garante isolamento:**

```typescript
// middleware/subscriberIsolation.middleware.ts
export const subscriberIsolationMiddleware = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
) => {
    // Se usuário é subscriber, garantir que só vê seus dados
    if (req.user.role === 'subscriber' || req.user.role === 'client') {
        // Adicionar subscriber_id ao request
        req.subscriberId = req.user.subscriberId || req.user.clientId;
        
        // Validar que subscriber_id existe
        if (!req.subscriberId) {
            return res.status(403).json({
                error: 'Acesso negado: subscriber_id não identificado'
            });
        }
    }
    
    next();
};
```

### 3. **Validação em Serviços**

**Todos os serviços devem validar:**

```typescript
// Exemplo: campaignService.ts
async getCampaignById(campaignId: number, subscriberId: number) {
    const campaign = await this.db.findFirst(`
        SELECT * FROM campaigns
        WHERE campaign_id = $1 AND subscriber_id = $2
    `, [campaignId, subscriberId]);
    
    if (!campaign) {
        throw new Error('Campanha não encontrada ou acesso negado');
    }
    
    return campaign;
}
```

---

## 🎯 Mixagem de Campanhas pelos Publishers

### Regras de Mixagem

**Publisher recebe campanhas de múltiplos subscribers e precisa mixá-las:**

1. **Prioridade** (`campaigns.priority`)
   - Campanhas com maior prioridade têm preferência
   - Range: 1-10 (maior = mais prioridade)

2. **Agendamento Temporal**
   - `campaigns.start_date` / `campaigns.end_date`
   - `campaigns.start_time` / `campaigns.end_time`
   - `campaigns.days_of_week`

3. **Agendamento por Totem**
   - `campaign_totems.start_date` / `campaign_totems.end_date`
   - `campaign_totems.start_time` / `campaign_totems.end_time`
   - `campaign_totems.days_of_week`

4. **Status da Campanha**
   - Apenas campanhas com `status = 'active'` e `is_active = true`

5. **Status da Associação**
   - `campaign_publishers.is_active = true`
   - `campaign_totems.is_active = true`

### Algoritmo de Mixagem

```sql
-- Query para obter campanhas mixadas para um publisher
SELECT DISTINCT
    c.campaign_id,
    c.title,
    c.priority,
    c.start_date,
    c.end_date,
    c.start_time,
    c.end_time,
    c.days_of_week,
    cp.revenue_share_percentage,
    ct.totem_id,
    ct.start_date as totem_start_date,
    ct.end_date as totem_end_date,
    ct.start_time as totem_start_time,
    ct.end_time as totem_end_time,
    ct.days_of_week as totem_days_of_week
FROM campaigns c
INNER JOIN campaign_publishers cp ON c.campaign_id = cp.campaign_id
INNER JOIN campaign_totems ct ON c.campaign_id = ct.campaign_id
WHERE cp.publisher_id = $1  -- Publisher específico
  AND cp.is_active = true
  AND ct.is_active = true
  AND c.status = 'active'
  AND c.is_active = true
  AND (
      -- Verificar agendamento global da campanha
      (c.start_date IS NULL OR c.start_date <= CURRENT_DATE)
      AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)
  )
ORDER BY 
    c.priority DESC,  -- Prioridade maior primeiro
    c.created_at ASC   -- Mais antigas primeiro (em caso de empate)
```

---

## ✅ Checklist de Implementação

### Backend - Isolamento de Dados

- [ ] Criar middleware `subscriberIsolationMiddleware`
- [ ] Aplicar middleware em todas as rotas de subscribers
- [ ] Validar `subscriber_id` em todos os serviços:
  - [ ] `mediaService.ts`
  - [ ] `playlistService.ts`
  - [ ] `campaignService.ts`
- [ ] Garantir que queries sempre filtram por `subscriber_id`
- [ ] Adicionar validação de propriedade antes de operações

### Backend - Mixagem de Campanhas

- [ ] Criar serviço `publisherCampaignMixService.ts`
- [ ] Implementar algoritmo de mixagem
- [ ] Criar endpoint `/api/publishers/:id/campaigns/mixed`
- [ ] Considerar prioridades, agendamentos, status
- [ ] Retornar campanhas ordenadas por prioridade

### Frontend - Isolamento de Dados

- [ ] Garantir que subscriber só vê seus dados
- [ ] Não permitir acesso a dados de outros subscribers
- [ ] Mostrar apenas campanhas do subscriber logado
- [ ] Validar permissões antes de operações

### Frontend - Publisher View

- [ ] Criar view de campanhas mixadas para publisher
- [ ] Mostrar campanhas de múltiplos subscribers
- [ ] Exibir regras de mixagem
- [ ] Visualizar prioridades e agendamentos

---

## 🔐 Segurança

### Validações Críticas

1. **Subscriber não pode acessar dados de outros subscribers**
   ```typescript
   // Sempre validar
   if (campaign.subscriber_id !== req.user.subscriberId) {
       throw new Error('Acesso negado');
   }
   ```

2. **Publisher só vê campanhas atribuídas a ele**
   ```typescript
   // Validar via campaign_publishers
   const hasAccess = await db.findFirst(`
       SELECT 1 FROM campaign_publishers
       WHERE campaign_id = $1 AND publisher_id = $2 AND is_active = true
   `, [campaignId, publisherId]);
   ```

3. **Subscriber só pode atribuir suas próprias campanhas**
   ```typescript
   // Validar propriedade antes de atribuir
   const campaign = await getCampaignById(campaignId, subscriberId);
   // Se não encontrou, lança erro
   ```

---

## 📝 Exemplos de Uso

### Exemplo 1: Subscriber lista suas campanhas

```typescript
// GET /api/campaigns?subscriberId=1
async getCampaigns(req: AuthenticatedRequest, res: Response) {
    const subscriberId = req.user.subscriberId; // Do middleware
    
    const campaigns = await campaignService.getCampaigns(subscriberId);
    
    res.json({ data: campaigns });
}
```

### Exemplo 2: Publisher vê campanhas mixadas

```typescript
// GET /api/publishers/:id/campaigns/mixed
async getMixedCampaigns(req: AuthenticatedRequest, res: Response) {
    const publisherId = parseInt(req.params.id);
    
    // Validar que usuário tem acesso a este publisher
    if (req.user.role !== 'admin' && req.user.publisherId !== publisherId) {
        return res.status(403).json({ error: 'Acesso negado' });
    }
    
    const mixedCampaigns = await publisherCampaignMixService.getMixedCampaigns(publisherId);
    
    res.json({ data: mixedCampaigns });
}
```

### Exemplo 3: Subscriber atribui campanha a publisher

```typescript
// POST /api/campaigns/:id/publishers
async assignCampaignToPublisher(req: AuthenticatedRequest, res: Response) {
    const campaignId = parseInt(req.params.id);
    const subscriberId = req.user.subscriberId;
    const { publisherId, revenueSharePercentage } = req.body;
    
    // Validar que campanha pertence ao subscriber
    const campaign = await campaignService.getCampaignById(campaignId, subscriberId);
    
    // Atribuir a publisher
    await campaignService.assignToPublisher(campaignId, publisherId, revenueSharePercentage);
    
    res.json({ success: true });
}
```

---

## 🎯 Resumo

1. ✅ **Mídia, Playlist e Campanha pertencem sempre a um subscriber**
2. ✅ **Apenas o subscriber pode visualizar seu universo de dados**
3. ✅ **Campanhas podem ser atreladas a múltiplos publishers**
4. ✅ **Publishers mixam campanhas sob regras determinadas**
5. ✅ **Isolamento de dados deve ser garantido em todas as queries**
6. ✅ **Mixagem considera prioridade, agendamento e status**

