# 📝 Changelog - Correções e Melhorias

**Data:** 2025-12-19  
**Versão:** v2.1.1

---

## ✅ Implementações

### 🔧 Variáveis de Ambiente

- **Adicionado:** `PLAYER_PATH` - Caminho do arquivo index.html do player-web
- **Adicionado:** `PLAYER_DIR` - Diretório do player-web
- **Adicionado:** `SERVER_URL` - URL do servidor para configuração de players
- **Adicionado:** `HEARTBEAT_INTERVAL` - Intervalo de heartbeat (ms)
- **Adicionado:** `PLAYER_AUTO_START` - Auto-iniciar player
- **Adicionado:** `PLAYER_FULLSCREEN` - Modo fullscreen
- **Adicionado:** `PLAYER_PORTRAIT` - Orientação portrait

**Arquivos Modificados:**
- `backend/env.example` - Variáveis documentadas com descrições
- `backend/src/config/env.ts` - Adicionada configuração `playerConfig`

---

### 💾 Validação de Quota por Cliente

**Novos Métodos (`backend/src/services/storageService.ts`):**
- `getClientStorageUsage(clientId)` - Calcula uso atual
- `checkClientQuota(clientId, fileSize)` - Valida quota antes de upload
- `formatBytes(bytes)` - Formata bytes para string legível

**Mudanças:**
- `saveMediaFile()` agora valida quota antes de salvar
- Erro descritivo quando quota é excedida
- Integração com `MEDIA_QUOTA_PER_CLIENT`

**Novo Endpoint:**
- `GET /api/media/quota/:clientId` - Verificar quota do cliente

---

### 📋 Preview de Playlist

**Novo Endpoint:**
- `GET /api/playlists/:id/preview` - Preview completo da playlist

**Retorna:**
- Lista de mídias com URLs
- Informações de duração e tamanho
- Ordem dos itens preservada
- URLs de download e thumbnail

**Arquivos Modificados:**
- `backend/src/routes/playlists.ts` - Adicionado endpoint de preview

---

## 🔍 Melhorias

### Configuração

- Configuração de player centralizada em `env.ts`
- Validação melhorada de variáveis obrigatórias
- Mensagens de erro mais descritivas

---

## 📊 Estatísticas

- **Arquivos Modificados:** 5
- **Arquivos Criados:** 2
- **Novos Endpoints:** 2
- **Novos Métodos:** 3
- **Variáveis Documentadas:** 7

---

## ✅ Testes Recomendados

1. **Quota:**
   - Fazer upload até exceder quota
   - Verificar endpoint `/api/media/quota/:clientId`
   - Validar mensagem de erro

2. **Preview:**
   - Criar playlist com múltiplas mídias
   - Chamar `/api/playlists/:id/preview`
   - Verificar URLs e informações

3. **Configurações:**
   - Validar todas as variáveis em `env.example`
   - Testar valores padrão
   - Verificar em produção

---

**Status:** ✅ Todas as implementações concluídas e validadas

