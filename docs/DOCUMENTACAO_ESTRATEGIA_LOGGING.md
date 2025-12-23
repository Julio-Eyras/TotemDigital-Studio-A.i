# 📋 Estratégia de Logging - Smart Signage Pro v2.1

**Versão:** 2.1.0  
**Data:** 2025-01-XX

---

## 🎯 **VISÃO GERAL**

O Smart Signage Pro utiliza uma estratégia híbrida de logging que combina **arquivos locais** para logs operacionais e **banco de dados** para eventos importantes de negócio.

### **Princípios**

1. **Performance**: Logs operacionais em arquivos locais (rápido, sem impacto no banco)
2. **Auditoria**: Eventos importantes no banco de dados (rastreável, consultável)
3. **Segurança**: Separação entre logs técnicos e eventos de negócio

---

## 📁 **ARQUIVOS LOCAIS - Logs Operacionais**

### **O que vai para arquivos locais:**

- ✅ **Erros de execução** (exceptions, stack traces)
- ✅ **Logs de debug** (desenvolvimento, troubleshooting)
- ✅ **Logs de execução** (inicialização, shutdown, operações do sistema)
- ✅ **Warnings** (avisos de configuração, fallbacks)
- ✅ **Logs de infraestrutura** (conexões, timeouts, retries)

### **Localização:**

```
/opt/smart-signage/Logs/
├── app-YYYY-MM-DD.log          # Logs gerais
├── error-YYYY-MM-DD.log        # Apenas erros
├── exceptions-YYYY-MM-DD.log    # Exceções não tratadas
└── rejections-YYYY-MM-DD.log   # Promise rejections
```

### **Configuração:**

- **Rotação automática**: Baseada em tamanho (padrão: 100MB) e dias (padrão: 30 dias)
- **Compactação**: Arquivos antigos são compactados automaticamente
- **Níveis**: `error`, `warn`, `info`, `debug`

### **Uso no Código:**

```typescript
import { logInfo, logError, logWarn, logDebug } from '../utils/loggerHelper';

// Log de informação
await logInfo('Arquivo salvo com sucesso', { filePath, size });

// Log de erro
await logError('Falha ao salvar arquivo', error, { fileName });

// Log de aviso
await logWarn('Caminho não encontrado, usando padrão', { path });

// Log de debug
await logDebug('Processando requisição', { requestId, userId });
```

---

## 🗄️ **BANCO DE DADOS - Eventos Importantes**

### **O que vai para o banco de dados:**

- ✅ **Playback de vídeo** (início, fim, erros)
- ✅ **Exibição de anúncios** (início, fim, skip)
- ✅ **Eventos de campanha** (início, fim, pausa, retomada)
- ✅ **Interações do usuário** (cliques, visualizações)
- ✅ **Scans de QR Code**
- ✅ **Eventos de totem** (online, offline, heartbeat)
- ✅ **Métricas para BI** (tempo de visualização, engajamento)
- ✅ **Relatórios de campanhas**

### **Tabela: `event_logs`**

```sql
CREATE TABLE event_logs (
    id SERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,        -- Tipo do evento
    entity_type TEXT NOT NULL,       -- Tipo da entidade
    entity_id INTEGER,               -- ID da entidade
    totem_id INTEGER,                -- Totem relacionado
    campaign_id INTEGER,              -- Campanha relacionada
    playlist_id INTEGER,              -- Playlist relacionada
    media_id INTEGER,                 -- Mídia relacionada
    metadata JSONB,                   -- Dados adicionais
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **Tipos de Eventos:**

```typescript
enum EventType {
  // Playback de mídia
  VIDEO_PLAYBACK_START = 'video_playback_start',
  VIDEO_PLAYBACK_END = 'video_playback_end',
  VIDEO_PLAYBACK_ERROR = 'video_playback_error',
  IMAGE_DISPLAY = 'image_display',
  AUDIO_PLAYBACK = 'audio_playback',
  
  // Exibição de anúncios
  AD_DISPLAY_START = 'ad_display_start',
  AD_DISPLAY_END = 'ad_display_end',
  AD_DISPLAY_SKIP = 'ad_display_skip',
  
  // Campanhas
  CAMPAIGN_START = 'campaign_start',
  CAMPAIGN_END = 'campaign_end',
  CAMPAIGN_PAUSE = 'campaign_pause',
  CAMPAIGN_RESUME = 'campaign_resume',
  
  // Playlists
  PLAYLIST_START = 'playlist_start',
  PLAYLIST_END = 'playlist_end',
  PLAYLIST_ITEM_PLAY = 'playlist_item_play',
  
  // Totem/Player
  TOTEM_ONLINE = 'totem_online',
  TOTEM_OFFLINE = 'totem_offline',
  TOTEM_HEARTBEAT = 'totem_heartbeat',
  TOTEM_ERROR = 'totem_error',
  
  // BI e Analytics
  USER_ACTION = 'user_action',
  INTERACTION = 'interaction',
  VIEW_TIME = 'view_time',
  ENGAGEMENT = 'engagement',
  
  // QR Code
  QR_CODE_SCAN = 'qr_code_scan',
  
  // Outros
  SYSTEM_EVENT = 'system_event',
  CUSTOM_EVENT = 'custom_event'
}
```

### **Uso no Código:**

```typescript
import { getEventLogService, EventType } from '../services/eventLogService';

const eventLogService = getEventLogService();

// Registrar playback de vídeo
await eventLogService.logVideoPlaybackStart(
  mediaId: 123,
  totemId: 456,
  playlistId: 789,
  campaignId: 101,
  metadata: { duration: 30, quality: 'HD' }
);

// Registrar exibição de anúncio
await eventLogService.logAdDisplay(
  adId: 123,
  totemId: 456,
  campaignId: 101,
  startTime: new Date(),
  endTime: new Date(),
  metadata: { impressions: 1 }
);

// Registrar scan de QR Code
await eventLogService.logQRCodeScan(
  qrCodeId: 123,
  totemId: 456,
  metadata: { userAgent: 'Mozilla/5.0...' }
);
```

---

## 🔍 **QUANDO USAR CADA UM**

### **Use Arquivo Local (loggerHelper) quando:**

- ❌ Erro técnico (exception, timeout, conexão)
- 🔧 Debug de desenvolvimento
- ⚙️ Operações do sistema (startup, shutdown)
- ⚠️ Avisos de configuração
- 📊 Logs de performance técnica

### **Use Banco de Dados (EventLogService) quando:**

- ✅ Vídeo foi reproduzido
- ✅ Anúncio foi exibido
- ✅ Campanha iniciou/terminou
- ✅ Usuário interagiu (scan QR, clique)
- ✅ Totem ficou online/offline
- ✅ Métricas para BI
- ✅ Relatórios de campanhas

---

## 📊 **BENEFÍCIOS DA ESTRATÉGIA**

### **Performance**
- ✅ Logs operacionais não impactam o banco de dados
- ✅ Arquivos locais são mais rápidos para escrita
- ✅ Banco usado apenas para eventos importantes

### **Auditoria**
- ✅ Eventos importantes são rastreáveis e consultáveis
- ✅ Histórico completo de campanhas e interações
- ✅ Dados estruturados para relatórios

### **Segurança**
- ✅ Separação entre logs técnicos e eventos de negócio
- ✅ Logs operacionais podem ser rotacionados/removidos
- ✅ Eventos importantes preservados para compliance

### **BI e Analytics**
- ✅ Dados estruturados no banco facilitam queries
- ✅ Métricas agregadas facilmente calculáveis
- ✅ Integração com ferramentas de BI

---

## 🛠️ **IMPLEMENTAÇÃO**

### **1. Instalar Migração do Banco**

```bash
# Aplicar migração para criar tabela event_logs
psql -U smartsignage -d smartsignage -f database/migrations/add-event-logs-table.sql
```

### **2. Usar Logger Helper**

```typescript
// Substituir console.log por:
import { logInfo, logError, logWarn, logDebug } from '../utils/loggerHelper';

// Antes:
console.log('Arquivo salvo');
console.error('Erro:', error);

// Depois:
await logInfo('Arquivo salvo', { filePath });
await logError('Erro ao salvar', error, { fileName });
```

### **3. Usar EventLogService**

```typescript
// Para eventos importantes:
import { getEventLogService } from '../services/eventLogService';

const eventLog = getEventLogService();
await eventLog.logVideoPlaybackStart(mediaId, totemId, playlistId, campaignId);
```

---

## 📈 **ESTATÍSTICAS E RELATÓRIOS**

### **Consultar Eventos:**

```typescript
// Buscar eventos de uma campanha
const events = await eventLogService.getEvents({
  campaignId: 123,
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-01-31')
});

// Estatísticas para BI
const stats = await eventLogService.getEventStatistics({
  campaignId: 123,
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-01-31')
});
```

### **Queries SQL Úteis:**

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

-- Anúncios mais exibidos
SELECT campaign_id, COUNT(*) as impressions
FROM event_logs
WHERE event_type = 'ad_display_start'
GROUP BY campaign_id
ORDER BY impressions DESC;
```

---

## ✅ **CHECKLIST DE MIGRAÇÃO**

- [x] Criar tabela `event_logs` no banco
- [x] Criar `EventLogService` para eventos importantes
- [x] Criar `loggerHelper` para logs operacionais
- [ ] Substituir `console.log` por `loggerHelper` nos serviços
- [ ] Implementar logging de playback de vídeo
- [ ] Implementar logging de exibição de anúncios
- [ ] Implementar logging de campanhas
- [ ] Implementar logging de QR Code scans
- [ ] Atualizar documentação

---

## 📚 **REFERÊNCIAS**

- **Logger Config**: `backend/src/config/logger.ts`
- **Event Log Service**: `backend/src/services/eventLogService.ts`
- **Logger Helper**: `backend/src/utils/loggerHelper.ts`
- **Migration SQL**: `database/migrations/add-event-logs-table.sql`

---

**Última atualização:** 2025-01-XX

