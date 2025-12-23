# ✅ Checklist de Validação - Implementação de Logging

**Data:** 2025-01-XX  
**Versão:** 2.1.0

---

## 🗄️ **1. MIGRAÇÃO DO BANCO DE DADOS**

### **Aplicar Migração:**
- [ ] Executar script: `./database/migrations/apply-event-logs-migration.sh`
- [ ] Verificar se tabela `event_logs` foi criada
- [ ] Verificar se todos os índices foram criados (7+ índices)
- [ ] Verificar se foreign keys foram criadas (4 foreign keys)

### **Verificar Estrutura:**
```sql
-- Verificar tabela
\d event_logs

-- Verificar índices
SELECT indexname FROM pg_indexes WHERE tablename = 'event_logs';

-- Verificar foreign keys
SELECT tc.constraint_name, kcu.column_name, ccu.table_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name 
JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name 
WHERE tc.table_name = 'event_logs' AND tc.constraint_type = 'FOREIGN KEY';

-- Testar inserção
INSERT INTO event_logs (event_type, entity_type) 
VALUES ('test_event', 'test') 
RETURNING id;
```

---

## 🎬 **2. PLAYER - LOGGING DE PLAYBACK**

### **Testar Endpoint:**
- [ ] Endpoint `/api/player/event` está acessível
- [ ] Validação de token funciona
- [ ] Eventos são registrados no banco

### **Testar Eventos do Player:**
- [ ] Reproduzir vídeo → Verificar `video_playback_start` no banco
- [ ] Vídeo termina → Verificar `video_playback_end` no banco
- [ ] Exibir imagem → Verificar `image_display` no banco
- [ ] Playlist inicia → Verificar `playlist_start` no banco
- [ ] Playlist termina ciclo → Verificar `playlist_end` no banco
- [ ] Erro na reprodução → Verificar `video_playback_error` no banco

### **Queries de Validação:**
```sql
-- Ver eventos de playback
SELECT * FROM event_logs 
WHERE event_type IN ('video_playback_start', 'video_playback_end', 'image_display')
ORDER BY timestamp DESC 
LIMIT 10;

-- Ver eventos de playlist
SELECT * FROM event_logs 
WHERE event_type IN ('playlist_start', 'playlist_end')
ORDER BY timestamp DESC 
LIMIT 10;
```

---

## 📢 **3. CAMPANHAS - LOGGING DE EVENTOS**

### **Testar Criação:**
- [ ] Criar campanha ativa → Verificar eventos de início para totems
- [ ] Criar campanha inativa → Não deve registrar eventos

### **Testar Ativação:**
- [ ] Ativar campanha → Verificar `campaign_start` para todos os totems
- [ ] Verificar eventos no banco com `campaign_id` correto

### **Testar Pausa:**
- [ ] Pausar campanha → Verificar `campaign_pause` para todos os totems
- [ ] Verificar eventos no banco

### **Testar Finalização:**
- [ ] Finalizar campanha → Verificar `campaign_end` para todos os totems
- [ ] Verificar eventos no banco

### **Testar Totems:**
- [ ] Adicionar totem a campanha ativa → Verificar `campaign_start` para o totem
- [ ] Remover totem de campanha ativa → Verificar `campaign_end` para o totem

### **Queries de Validação:**
```sql
-- Ver eventos de campanha
SELECT * FROM event_logs 
WHERE event_type IN ('campaign_start', 'campaign_end', 'campaign_pause')
ORDER BY timestamp DESC 
LIMIT 20;

-- Estatísticas de campanha
SELECT 
    campaign_id,
    event_type,
    COUNT(*) as count
FROM event_logs
WHERE campaign_id = 1
GROUP BY campaign_id, event_type;
```

---

## 📊 **4. ESTATÍSTICAS E BI**

### **Testar EventLogService.getEventStatistics():**
- [ ] Buscar estatísticas por totem
- [ ] Buscar estatísticas por campanha
- [ ] Buscar estatísticas por período
- [ ] Verificar cálculos de tempo médio de visualização

### **Queries Úteis:**
```sql
-- Total de playbacks por totem
SELECT totem_id, COUNT(*) as total_playbacks
FROM event_logs
WHERE event_type IN ('video_playback_start', 'image_display')
GROUP BY totem_id;

-- Tempo médio de visualização
SELECT AVG((metadata->>'duration')::numeric) as avg_duration
FROM event_logs
WHERE event_type = 'video_playback_end'
  AND metadata->>'duration' IS NOT NULL;

-- Campanhas mais ativas
SELECT campaign_id, COUNT(*) as total_events
FROM event_logs
WHERE campaign_id IS NOT NULL
GROUP BY campaign_id
ORDER BY total_events DESC
LIMIT 10;
```

---

## 🔍 **5. LOGS OPERACIONAIS (ARQUIVOS LOCAIS)**

### **Verificar Logs:**
- [ ] Logs sendo escritos em `/opt/smart-signage/Logs/`
- [ ] Arquivo `app-YYYY-MM-DD.log` existe
- [ ] Arquivo `error-YYYY-MM-DD.log` existe
- [ ] Rotação de logs funcionando

### **Verificar Conteúdo:**
```bash
# Ver últimos logs
tail -n 50 /opt/smart-signage/Logs/app-current.log

# Ver últimos erros
tail -n 50 /opt/smart-signage/Logs/error-current.log

# Verificar se console.log foi substituído
grep -r "console.log" backend/src/services/storageService.ts
# (não deve encontrar nada)
```

---

## ✅ **6. VALIDAÇÃO FINAL**

### **Checklist Completo:**
- [ ] Migração aplicada com sucesso
- [ ] Tabela `event_logs` criada e funcionando
- [ ] Player enviando eventos corretamente
- [ ] Campanhas registrando eventos importantes
- [ ] Logs operacionais em arquivos locais
- [ ] Eventos importantes no banco de dados
- [ ] Sem erros de compilação
- [ ] Sem erros de linter

---

## 📝 **NOTAS**

- **Senha PostgreSQL padrão:** `smartsignage123`
- **Scripts de migração:** `database/migrations/`
- **Documentação:** `DOCUMENTACAO_ESTRATEGIA_LOGGING.md`

---

**Status:** ⏳ Aguardando Validação

