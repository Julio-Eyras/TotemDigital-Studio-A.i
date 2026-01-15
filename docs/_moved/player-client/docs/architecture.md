# Arquitetura do Player Cliente

## Visão Geral

O player cliente é uma aplicação multi-plataforma que se comunica com o backend Smart Signage Pro para exibir conteúdo digital em diferentes dispositivos.

## Componentes Core

### 1. API Client (`core/api/client.js`)
- Comunicação HTTP com o backend
- Autenticação de totem
- Download de playlist e mídia
- Envio de heartbeat
- Upload de logs

### 2. Playlist Manager (`core/playlist/manager.js`)
- Gerenciamento de playlist
- Cache local
- Validação de formato
- Navegação entre itens

### 3. Heartbeat Service (`core/heartbeat/service.js`)
- Envio periódico de status
- Monitoramento de conexão
- Recuperação automática

### 4. Media Player (específico por plataforma)
- Reprodução de vídeo
- Exibição de imagens
- Renderização de HTML/Web

### 5. Logger (`core/utils/logger.js`)
- Sistema de logging
- Upload de erros ao backend
- Níveis de log configuráveis

## Fluxo de Execução

1. **Inicialização**
   - Carregar configuração
   - Autenticar totem
   - Inicializar componentes

2. **Carregamento de Playlist**
   - Obter playlist do backend
   - Validar formato
   - Cache local

3. **Reprodução**
   - Reproduzir itens sequencialmente
   - Transições entre mídias
   - Tratamento de erros

4. **Monitoramento**
   - Envio de heartbeat
   - Atualização periódica de playlist
   - Logs de erros

## Comunicação com Backend

### Endpoints Utilizados

- `POST /api/player/register` - Autenticação de totem
- `GET /api/player/playlist` - Obter playlist
- `GET /api/player/config` - Obter configurações
- `POST /api/player/heartbeat` - Enviar heartbeat
- `GET /api/player/media/:id` - Obter informações de mídia
- `GET /api/player/media/:id/download` - Download de mídia
- `POST /api/logs/frontend-error` - Enviar log de erro

## Estrutura de Dados

### Playlist
```json
{
  "id": 1,
  "name": "Playlist Principal",
  "items": [
    {
      "id": 1,
      "type": "video",
      "url": "https://...",
      "duration": 30000,
      "order": 1
    }
  ]
}
```

### Heartbeat
```json
{
  "status": "online",
  "timestamp": "2024-01-01T00:00:00Z",
  "metrics": {
    "uptime": 3600,
    "memory": {}
  }
}
```

