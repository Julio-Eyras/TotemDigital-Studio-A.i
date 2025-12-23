# Progresso - Serviços Secundários

## ✅ Atualizados Nesta Sessão

### 1. Invoice Service ✅
- ✅ Método `generateMonthlyInvoices` atualizado para usar `publisherBillingService`
- ✅ Query para verificar invoices existentes atualizada para `publisher_billing`
- ✅ Query para buscar invoices de subscription atualizada
- ✅ Método `sendInvoiceNotifications` atualizado para buscar de ambas as tabelas (`subscriber_billing` e `publisher_billing`)

### 2. Dashboard Service ✅
- ✅ Queries atualizadas para usar `subscriber_id` em vez de `client_id` (medias, playlists)
- ✅ Query de totems atualizada para filtrar via `local_id -> publisher_id`
- ✅ Query de players ativos atualizada

### 3. Player Service ✅
- ✅ Interface `Player` atualizada (adicionado `publisher_id`, mantido `client_id` para compatibilidade)
- ✅ Queries atualizadas para usar `locals` e `publishers` em vez de `clients`
- ✅ Método `createPlayer` atualizado (totem precisa de `local_id`, não `client_id`)
- ✅ Método `updatePlayer` atualizado (mapear `clientId` para `local_id`)

## ⏳ Pendentes

### 4. Smart Playlist Service
- ⏳ Múltiplas referências a `client_id`
- ⏳ Método `getFirstActiveClient` precisa ser atualizado

### 5. Notification Service
- ⏳ Usa `client_id` na tabela `notifications`

### 6. FX Site Service
- ⏳ Usa `client_id` na tabela `fx_sites`

## 📊 Progresso

- **Serviços críticos:** 100% ✅
- **Serviços secundários principais:** ~75% ✅
- **Serviços secundários menores:** ~50% ⏳

---

## 🎯 Próximos Passos

1. ⏳ Atualizar `smartPlaylistService.ts`
2. ⏳ Atualizar `notificationService.ts`
3. ⏳ Atualizar `fxSiteService.ts`
4. ⏳ Verificar outros serviços menores

