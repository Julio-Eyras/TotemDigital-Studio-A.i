# 🎯 Plano de Execução - Correções e Melhorias

**Data:** 2025-12-19  
**Baseado em:** `ANALISE_COMPLETA_SISTEMA_SMARTSIGNAGE.md`

---

## 📋 Resumo das Correções

### Alta Prioridade (Implementar Primeiro)

1. ✅ **Documentar Variáveis de Ambiente**
   - Adicionar `PLAYER_PATH`, `PLAYER_DIR` em `env.example`
   - Adicionar `PLAYER_AUTO_START`, `PLAYER_FULLSCREEN`, `PLAYER_PORTRAIT`
   - Adicionar `SERVER_URL`, `HEARTBEAT_INTERVAL`
   - Consolidar `env.example` (raiz) e `backend/env.example`

2. ✅ **Corrigir Inconsistências de Paths**
   - Garantir consistência entre `PLAYER_PATH` e `PLAYER_DIR`
   - Documentar relação entre variáveis

3. ✅ **Validação de Quota por Cliente**
   - Implementar validação antes de upload
   - Adicionar endpoint para verificar quota
   - Melhorar `StorageService.uploadFile()`

4. ✅ **Validação de Variáveis Obrigatórias**
   - Melhorar mensagens de erro na inicialização
   - Documentar claramente obrigatórias vs opcionais

### Média Prioridade

5. ✅ **Preview de Playlist**
   - Adicionar endpoint `/api/playlists/:id/preview`
   - Retornar lista de mídias com URLs

6. ✅ **Health Check Avançado**
   - Adicionar checks para Database, Redis, Disk, Memory
   - Melhorar endpoint `/health`

### Baixa Prioridade (Opcional)

7. ⏳ **Timezone em Totens**
   - Adicionar campo `timezone` na tabela `totems`
   - Implementar conversão de timestamps

8. ⏳ **Logs Estruturados**
   - Garantir consistência de `LOG_LEVEL`
   - Adicionar formato JSON

---

## 🚀 Ordem de Execução

### Fase 1: Variáveis de Ambiente (Alta Prioridade)
1. Consolidar `env.example`
2. Adicionar variáveis faltantes
3. Documentar obrigatórias vs opcionais
4. Atualizar `backend/src/config/env.ts` se necessário

### Fase 2: Validações (Alta Prioridade)
1. Implementar validação de quota
2. Melhorar validação de variáveis obrigatórias

### Fase 3: Funcionalidades (Média Prioridade)
1. Adicionar preview de playlist
2. Melhorar health check

---

## ✅ Status de Execução

- [ ] Fase 1: Variáveis de Ambiente
- [ ] Fase 2: Validações
- [ ] Fase 3: Funcionalidades

---

**Iniciando execução...**

