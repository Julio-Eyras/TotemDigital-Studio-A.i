 # Resumo - Arquitetura Interativa do Player Client

## 🎯 Conceito Principal

**Player Client Inteligente** que:
1. **Armazena playlist localmente** (Local Storage) para funcionar offline
2. **Interrompe conteúdo normal** quando detecta sinal de conteúdo mais importante/interativo
3. **Reconhece rostos** para personalização
4. **Lê tags** (RFID/NFC/QR) para interação
5. **Conecta totens** em rede para interação visual coordenada

## 🔑 Componentes Principais

### 1. **LocalPlaylistManager**
- Cache de playlist no Local Storage
- Sincronização periódica com servidor
- Modo offline
- Versionamento

### 2. **InterruptionManager**
- Gerencia prioridades de conteúdo
- Interrompe conteúdo atual quando necessário
- Fila de interrupções
- Retoma conteúdo normal após interação

### 3. **FacialRecognitionService**
- Detecção de rostos via câmera
- Reconhecimento (opcional)
- Personalização de conteúdo
- Triggers de interrupção

### 4. **TagReaderService**
- Leitura de RFID/NFC/QR Code
- Busca conteúdo associado
- Triggers de interrupção
- Cache de associações

### 5. **VisualNetworkService**
- Comunicação entre totens
- Broadcast de eventos
- Sincronização visual
- Rede P2P

## 🔄 Fluxo de Interação

### Exemplo 1: Reconhecimento de Rosto
```
Pessoa se aproxima
  → Câmera detecta rosto
  → Sistema identifica (opcional)
  → Interrompe conteúdo normal
  → Mostra conteúdo personalizado
  → Após X segundos, retoma playlist
```

### Exemplo 2: Tag ID
```
Pessoa aproxima cartão/tag
  → Leitor detecta tag
  → Busca conteúdo associado
  → Interrompe conteúdo normal
  → Mostra conteúdo da tag
  → Notifica servidor (analytics)
  → Retoma playlist
```

### Exemplo 3: Rede de Totens
```
Totem A detecta rosto
  → Envia evento para rede
  → Totem B recebe evento
  → Totem B mostra conteúdo relacionado
  → Sincronização visual coordenada
```

## 📊 Níveis de Prioridade

1. **NORMAL** (0) - Playlist padrão
2. **HIGH** (1) - Conteúdo importante
3. **CRITICAL** (2) - Conteúdo crítico
4. **INTERACTIVE** (3) - Conteúdo interativo (rosto, tag)

**Regra:** Conteúdo de prioridade maior sempre interrompe conteúdo de prioridade menor.

## 💾 Estrutura de Cache Local

```
Local Storage:
├── playlist_{id} → Metadados e itens da playlist
├── media_{id} → Arquivos de mídia em cache
├── tags_{id} → Associações de tags
└── config → Configurações do player
```

## 🎯 Próximos Passos de Implementação

1. ✅ Documentação criada
2. ⏳ Implementar LocalPlaylistManager
3. ⏳ Implementar InterruptionManager
4. ⏳ Integrar FacialRecognitionService
5. ⏳ Integrar TagReaderService
6. ⏳ Implementar VisualNetworkService

## 📝 Notas Importantes

- **Offline First**: Player funciona mesmo sem internet
- **Priorização Inteligente**: Sistema decide quando interromper
- **Cache Inteligente**: Reduz uso de banda
- **Rede Coordenada**: Totens trabalham juntos
- **Privacidade**: Reconhecimento facial opcional e configurável

