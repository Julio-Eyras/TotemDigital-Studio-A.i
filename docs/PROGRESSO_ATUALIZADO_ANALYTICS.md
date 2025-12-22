# Progresso - Analytics Service

## ✅ Atualizações Realizadas

### 1. Queries de Estatísticas Gerais
- ✅ `totalClients` → usa `subscribers` em vez de `clients`
- ✅ `newClients` → usa `subscribers` em vez de `clients`

### 2. Filtros por ClientId
- ✅ Filtro em `event_logs` → usa `subscriber_id` (derivado de campaign_id)
- ✅ Filtro em QR codes → filtra via `campaigns.subscriber_id`

### 3. Compatibilidade
- ✅ Mantido `clientId` nos filtros para compatibilidade (mapeado para `subscriberId`)

## ⏳ Pendências

- ⏳ Verificar se há queries de revenue que usam `byClient` e atualizar para `bySubscriber`
- ⏳ Verificar outras referências a `clients` no serviço

## Status

**Progresso:** ~80% concluído

