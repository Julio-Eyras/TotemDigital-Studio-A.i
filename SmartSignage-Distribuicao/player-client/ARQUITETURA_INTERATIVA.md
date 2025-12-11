# Arquitetura de Interatividade - Player Client

## 🎯 Resumo Executivo

Sistema de player client com capacidade de:
- **Cache local inteligente** de playlists
- **Interrupção dinâmica** por conteúdo de maior prioridade
- **Reconhecimento facial** para personalização
- **Leitura de tags** (RFID/NFC/QR) para interação
- **Rede de totens** interconectados

## 🔄 Fluxo de Funcionamento

### Modo Normal
```
Playlist Local → Reprodução Sequencial → Cache de Mídia
```

### Modo Interativo
```
Sensor Detecta → Verifica Prioridade → Interrompe → Exibe Interativo → Retoma
```

## 📊 Diagrama de Estados

```
[IDLE] → [PLAYING] → [INTERRUPTED] → [INTERACTIVE] → [RESUMING] → [PLAYING]
   ↑                                                                    ↓
   └──────────────────────────────────────────────────────────────────┘
```

## 🎯 Prioridades de Conteúdo

1. **NORMAL** - Playlist padrão
2. **HIGH** - Conteúdo importante
3. **CRITICAL** - Conteúdo crítico
4. **INTERACTIVE** - Conteúdo interativo (rosto, tag)

## 🔗 Integração com Backend

- **Heartbeat** - Sincronização periódica
- **WebSocket** - Eventos em tempo real
- **API REST** - Busca de conteúdo
- **Cache** - Reduz dependência de rede

