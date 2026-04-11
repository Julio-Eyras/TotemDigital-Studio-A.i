# Pendências: Subscriber - Implementações e Validações

## 📋 Resumo Executivo

Este documento lista todas as funcionalidades pendentes, validações de regras de negócio e melhorias necessárias para o módulo de **Subscribers (Assinantes)**.

---

## 🎯 1. FUNCIONALIDADES PENDENTES - PLAYLISTS

### 1.1. Adicionar Mídias à Playlist ⚠️ **CRÍTICO**

**Status:** Não implementado

**Descrição:**
- Interface para selecionar mídias do subscriber e adicionar à playlist
- Permitir seleção múltipla de mídias
- Configurar ordem inicial ao adicionar

**Implementação Necessária:**
```typescript
// Frontend: Adicionar seção na aba Playlists
- Select múltiplo de mídias disponíveis
- Botão "Adicionar Mídias à Playlist"
- Lista de mídias já adicionadas com opção de remover
- Campo para configurar ordem (order_index)
```

**Backend:**
- Endpoint: `POST /api/playlists/:id/media`
- Validação: Mídia pertence ao mesmo subscriber da playlist
- Criar registro em `playlist_items`

---

### 1.2. Drag & Drop para Reordenar Itens ⚠️ **IMPORTANTE**

**Status:** Não implementado

**Descrição:**
- Permitir reordenar itens da playlist arrastando e soltando
- Atualizar `order_index` automaticamente

**Implementação Necessária:**
- Usar biblioteca: `react-beautiful-dnd` ou `@dnd-kit/core`
- Componente `DraggableList` para itens da playlist
- Endpoint: `PUT /api/playlists/:id/reorder` ou `PATCH /api/playlists/:id/items/:itemId/order`

---

### 1.3. Configurar Duração por Item ⚠️ **IMPORTANTE**

**Status:** Não implementado

**Descrição:**
- Permitir configurar `display_seconds` (duração de exibição) para cada item da playlist
- Validação: Duração mínima e máxima baseada no tipo de mídia

**Implementação Necessária:**
- Campo numérico na lista de itens da playlist
- Validação no frontend e backend
- Endpoint: `PATCH /api/playlists/:id/items/:itemId` com `display_seconds`

---

## 🔒 2. VALIDAÇÕES DE REGRAS DE NEGÓCIO

### 2.1. Validações de Limites do Plano ⚠️ **CRÍTICO**

**Status:** Não implementado

**Descrição:**
- Validar limites do plano ao criar/atualizar recursos:
  - Número máximo de mídias (`limits.medias` ou `limits.storage_gb`)
  - Número máximo de playlists (`limits.playlists`)
  - Número máximo de campanhas (`limits.campaigns`)
  - Armazenamento total (`limits.storage_gb`)

**Implementação Necessária:**

**Backend:**
```typescript
// Em subscriberService.ts ou campaignService.ts
async validatePlanLimits(subscriberId: number, resourceType: 'media' | 'playlist' | 'campaign') {
  // 1. Buscar contratos ativos do subscriber
  const activeContracts = await this.getActiveContracts(subscriberId);
  
  // 2. Buscar planos dos contratos
  const plans = await this.getPlansFromContracts(activeContracts);
  
  // 3. Verificar limites do plano
  const limits = this.getMaxLimits(plans); // Pega o maior limite entre os planos
  
  // 4. Contar recursos atuais do subscriber
  const currentCount = await this.getCurrentResourceCount(subscriberId, resourceType);
  
  // 5. Validar se não excede limite
  if (currentCount >= limits[resourceType]) {
    throw new Error(`Limite de ${resourceType} excedido. Limite do plano: ${limits[resourceType]}`);
  }
}
```

**Frontend:**
- Exibir alert quando próximo do limite
- Bloquear criação se limite atingido
- Mostrar contador: "X de Y mídias utilizadas"

---

### 2.2. Validação de Armazenamento (Storage) ⚠️ **CRÍTICO**

**Status:** Não implementado

**Descrição:**
- Validar espaço de armazenamento ao fazer upload de mídias
- Somar tamanho de todas as mídias do subscriber
- Comparar com `limits.storage_gb` do plano

**Implementação Necessária:**

**Backend:**
```typescript
async validateStorageLimit(subscriberId: number, newFileSizeBytes: number) {
  // 1. Buscar contratos ativos
  const activeContracts = await this.getActiveContracts(subscriberId);
  const plans = await this.getPlansFromContracts(activeContracts);
  const maxStorageGB = this.getMaxStorageLimit(plans);
  
  // 2. Calcular storage atual
  const currentStorageBytes = await this.getCurrentStorage(subscriberId);
  const newTotalBytes = currentStorageBytes + newFileSizeBytes;
  const newTotalGB = newTotalBytes / (1024 * 1024 * 1024);
  
  // 3. Validar
  if (newTotalGB > maxStorageGB) {
    throw new Error(`Limite de armazenamento excedido. Disponível: ${maxStorageGB - (currentStorageBytes / (1024 * 1024 * 1024))} GB`);
  }
}
```

**Frontend:**
- Exibir barra de progresso de armazenamento
- Mostrar: "X GB de Y GB utilizados"
- Bloquear upload se limite atingido

---

### 2.3. Validação de Propriedade (Ownership) ✅ **PARCIAL**

**Status:** Implementado parcialmente

**O que está implementado:**
- ✅ Validação básica: mídias, playlists e campanhas pertencem ao subscriber

**O que falta:**
- ⚠️ Validação mais rigorosa no backend para todas as operações
- ⚠️ Middleware de isolamento de dados por subscriber
- ⚠️ Validação ao associar mídias a playlists (mídia deve ser do mesmo subscriber)
- ⚠️ Validação ao associar playlists a campanhas (playlist deve ser do mesmo subscriber)

**Implementação Necessária:**

**Backend:**
```typescript
// Middleware de isolamento
export const validateSubscriberOwnership = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const subscriberId = req.user?.subscriber_id;
  const resourceId = req.params.id;
  const resourceType = req.route.path.includes('media') ? 'media' : 
                       req.route.path.includes('playlist') ? 'playlist' : 
                       'campaign';
  
  // Verificar se recurso pertence ao subscriber
  const belongsToSubscriber = await checkOwnership(resourceType, resourceId, subscriberId);
  
  if (!belongsToSubscriber) {
    return res.status(403).json({ error: 'Recurso não pertence ao subscriber' });
  }
  
  next();
};
```

---

### 2.4. Validação de Acesso a Publishers/Locais/Totens ⚠️ **CRÍTICO**

**Status:** Não implementado completamente

**Descrição:**
- Validar se subscriber tem acesso a publishers via contratos/planos
- Validar se totens pertencem a publishers acessíveis
- Validar ao associar campanha a totens

**Implementação Necessária:**

**Backend:**
```typescript
async validatePublisherAccess(subscriberId: number, publisherId: number): Promise<boolean> {
  // 1. Buscar contratos ativos
  const activeContracts = await this.getActiveContracts(subscriberId);
  
  // 2. Buscar acessos via subscriber_publisher_access
  const hasAccess = await this.db.findOne(`
    SELECT 1
    FROM subscriber_publisher_access spa
    WHERE spa.subscriber_id = $1
      AND spa.publisher_id = $2
      AND (spa.expires_at IS NULL OR spa.expires_at > NOW())
      AND spa.is_active = true
  `, [subscriberId, publisherId]);
  
  return !!hasAccess;
}

async validateTotemAccess(subscriberId: number, totemId: number): Promise<boolean> {
  // 1. Buscar publisher do totem
  const totem = await totemService.getTotemById(totemId);
  const publisherId = totem.publisher_id;
  
  // 2. Validar acesso ao publisher
  return await this.validatePublisherAccess(subscriberId, publisherId);
}
```

---

### 2.5. Validação de Execução de Campanhas ✅ **PARCIAL**

**Status:** Implementado parcialmente

**O que está implementado:**
- ✅ Validação de contrato ativo ao criar/atualizar campanha
- ✅ Validação de período válido do contrato

**O que falta:**
- ⚠️ Validação ao adicionar campanha à fila de totens
- ⚠️ Validação de acesso aos totens
- ⚠️ Validação de conteúdo (mídias/playlists) da campanha
- ⚠️ Validação de status da campanha (deve estar 'active' ou 'approved')

**Implementação Necessária:**

**Backend:**
```typescript
async validateCampaignExecution(campaignId: number, totemIds: number[]): Promise<ValidationResult> {
  // 1. Buscar campanha
  const campaign = await campaignService.getCampaignById(campaignId);
  
  // 2. Validar contrato
  if (!campaign.contract_id) {
    return { valid: false, error: 'Campanha não está vinculada a um contrato' };
  }
  
  const contract = await this.getContract(campaign.contract_id);
  if (contract.status !== 'active' || contract.end_date < new Date()) {
    return { valid: false, error: 'Contrato não está ativo ou expirado' };
  }
  
  // 3. Validar status da campanha
  if (!['active', 'approved'].includes(campaign.status) || !campaign.is_active) {
    return { valid: false, error: 'Campanha não está ativa' };
  }
  
  // 4. Validar conteúdo
  const hasMedia = await this.hasCampaignMedia(campaignId);
  const hasPlaylists = await this.hasCampaignPlaylists(campaignId);
  if (!hasMedia && !hasPlaylists) {
    return { valid: false, error: 'Campanha não tem conteúdo (mídias ou playlists)' };
  }
  
  // 5. Validar acesso aos totens
  for (const totemId of totemIds) {
    const hasAccess = await this.validateTotemAccess(campaign.subscriber_id, totemId);
    if (!hasAccess) {
      return { valid: false, error: `Subscriber não tem acesso ao totem ${totemId}` };
    }
  }
  
  return { valid: true };
}
```

---

## 🔄 3. INTEGRAÇÃO COM PLANOS E CONTRATOS

### 3.1. Exibição de Informações do Plano/Contrato ⚠️ **IMPORTANTE**

**Status:** Parcialmente implementado

**O que está implementado:**
- ✅ Exibição de contratos ativos na aba Campanhas

**O que falta:**
- ⚠️ Dashboard com informações do plano atual
- ⚠️ Exibição de limites e uso atual
- ⚠️ Histórico de contratos
- ⚠️ Alertas de expiração de contratos

**Implementação Necessária:**

**Frontend:**
- Nova aba "Planos e Contratos" no dialog de edição
- Exibir:
  - Contratos ativos com período válido
  - Limites do plano (mídias, playlists, campanhas, storage)
  - Uso atual vs. limite
  - Alertas de expiração próxima

---

### 3.2. Renovação e Gestão de Contratos ⚠️ **FUTURO**

**Status:** Não implementado

**Descrição:**
- Interface para visualizar contratos
- Solicitar renovação
- Histórico de pagamentos

**Nota:** Esta funcionalidade pode ser implementada em uma fase futura.

---

## 🎨 4. MELHORIAS DE UX/UI

### 4.1. Filtros e Busca ⚠️ **IMPORTANTE**

**Status:** Não implementado

**Descrição:**
- Filtros nas listas de mídias, playlists e campanhas
- Busca por nome, tags, tipo
- Ordenação (data, nome, tipo)

---

### 4.2. Paginação ⚠️ **IMPORTANTE**

**Status:** Não implementado

**Descrição:**
- Paginação para grandes volumes de dados
- Limite atual: 1000 itens (hardcoded)
- Implementar paginação real com `limit` e `offset`

---

### 4.3. Preview de Campanhas ⚠️ **FUTURO**

**Status:** Não implementado

**Descrição:**
- Visualizar como a campanha será exibida
- Preview de sequência de mídias/playlists

---

## 📊 5. RELATÓRIOS E ESTATÍSTICAS

### 5.1. Estatísticas de Uso ⚠️ **IMPORTANTE**

**Status:** Não implementado

**Descrição:**
- Dashboard com:
  - Número de mídias, playlists, campanhas
  - Armazenamento utilizado
  - Campanhas ativas
  - Totens com campanhas ativas

**Implementação Necessária:**
- Endpoint: `GET /api/subscribers/:id/stats` (já existe, mas pode ser expandido)
- Gráficos de uso ao longo do tempo
- Comparação com limites do plano

---

## 🔐 6. SEGURANÇA E PERMISSÕES

### 6.1. Isolamento de Dados por Subscriber ⚠️ **CRÍTICO**

**Status:** Parcialmente implementado

**O que está implementado:**
- ✅ Validação básica de propriedade

**O que falta:**
- ⚠️ Middleware global de isolamento
- ⚠️ Validação em todas as rotas
- ⚠️ Prevenção de acesso cross-subscriber

**Implementação Necessária:**
- Middleware que valida `subscriber_id` em todas as requisições
- Filtros automáticos em queries do banco de dados
- Validação de JWT com `subscriber_id`

---

## 📝 7. CHECKLIST DE IMPLEMENTAÇÃO

### Prioridade CRÍTICA (Fazer primeiro):
- [ ] 1.1. Adicionar mídias à playlist
- [ ] 2.1. Validações de limites do plano
- [ ] 2.2. Validação de armazenamento
- [ ] 2.4. Validação de acesso a publishers/totens
- [ ] 2.5. Validação completa de execução de campanhas
- [ ] 6.1. Isolamento de dados por subscriber

### Prioridade IMPORTANTE (Fazer depois):
- [ ] 1.2. Drag & drop para reordenar
- [ ] 1.3. Configurar duração por item
- [ ] 2.3. Validação rigorosa de propriedade
- [ ] 3.1. Exibição de informações do plano/contrato
- [ ] 4.1. Filtros e busca
- [ ] 4.2. Paginação
- [ ] 5.1. Estatísticas de uso

### Prioridade FUTURO (Pode esperar):
- [ ] 3.2. Renovação e gestão de contratos
- [ ] 4.3. Preview de campanhas
- [ ] Agendamento avançado de campanhas

---

## 🎯 Próximos Passos Recomendados

1. **Implementar validações de limites do plano** (2.1, 2.2)
2. **Implementar adicionar mídias à playlist** (1.1)
3. **Implementar validação de acesso a totens** (2.4)
4. **Melhorar isolamento de dados** (6.1)
5. **Implementar drag & drop** (1.2)
6. **Implementar configuração de duração** (1.3)

---

## 📚 Referências

- `docs/ESTADO_ATUAL_CRUD_ASSINANTE.md` - Estado atual das funcionalidades
- `docs/MODELO_ER_SUBSCRIBERS_PLANOS_PUBLISHERS.md` - Modelo E.R completo
- `docs/MODELO_CAMPANHAS_CONTRATOS_PLANOS.md` - Modelo de campanhas
