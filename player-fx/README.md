# SmartDisplayFX Plus Player

Player cliente para SmartDisplayFX Plus com suporte a efeitos visuais avançados, sincronização MQTT e renderização WebGL.

## 🚀 Início Rápido

### Instalação

```bash
cd player-fx
npm install
```

### Desenvolvimento

```bash
npm run dev
```

Acesse: `http://localhost:5173?totemId=100&siteId=loja-centro-01`

### Build

```bash
npm run build
```

## 📋 Configuração

### Parâmetros da URL

- `totemId` (obrigatório): ID do totem
- `siteId` (obrigatório): ID do site
- `brokerUrl` (opcional): URL do broker MQTT
- `apiBaseUrl` (opcional): URL da API backend (padrão: http://localhost:3000)

### Exemplo

```
http://localhost:5173?totemId=100&siteId=loja-centro-01&brokerUrl=ws://mqtt.local:9001
```

## 🏗️ Estrutura

```
player-fx/
├── src/
│   ├── core/          # Core do player (Config, State, Player)
│   ├── mqtt/          # Cliente MQTT
│   ├── effects/       # Engine de efeitos
│   └── ai/            # IA de borda (futuro)
├── public/            # Arquivos públicos
└── dist/              # Build de produção
```

## 🎨 Efeitos

Efeitos implementados:
- [ ] Neon Warp Flow
- [ ] Ripple Sync Flow
- [ ] Holographic Swipe
- [ ] Matrix Data Flow
- [ ] Particle Burst
- [ ] Glow Line Sweep
- [ ] Fade + Blur Dynamic

## 📡 MQTT

O player se conecta automaticamente ao broker MQTT configurado no site e subscreve nos seguintes topics:

- `smartdisplay/{siteId}/effect` - Efeitos FX
- `smartdisplay/{siteId}/timeline` - Timelines
- `smartdisplay/{siteId}/sync_time` - Sincronização de tempo
- `smartdisplay/{siteId}/telemetry` - Telemetria

## 🔄 Sincronização

O player sincroniza automaticamente o tempo com o servidor para garantir efeitos coordenados entre múltiplos totens.

## 📊 Status

A barra de status mostra:
- Status de conexão MQTT
- Totem ID
- Site ID
- Efeitos ativos
- Offset de tempo

## 🐛 Debug

Pressione `F12` para abrir o console e ver logs detalhados.

O player é exposto globalmente como `window.player` para debug.

## 📝 TODO

- [ ] Implementar efeitos visuais completos
- [ ] Cache local de timelines
- [ ] IA de borda (MediaPipe)
- [ ] Otimizações de performance
- [ ] Suporte a múltiplas telas

