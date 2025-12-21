# TVs Smart - Ambientes de Desenvolvimento e Técnicas

## 📺 Visão Geral das Plataformas

### Plataformas Principais

1. **LG webOS** - 🔴 ALTA PRIORIDADE
2. **Samsung Tizen** - 🟡 MÉDIA PRIORIDADE  
3. **Android TV** - 🟡 MÉDIA PRIORIDADE
4. **Roku** - 🟢 BAIXA PRIORIDADE
5. **Fire TV (Amazon)** - 🟢 BAIXA PRIORIDADE

---

## 🎯 LG webOS

### Status Atual
- ✅ Estrutura básica criada em `player-client/platforms/webos/`
- ⚠️ Aguardando informações específicas do usuário
- ⚠️ Ambiente de desenvolvimento a configurar

### Informações Técnicas (Base)

#### Versões webOS Suportadas
- webOS 3.0+ (TVs de 2016+)
- webOS 4.0+ (TVs de 2018+)
- webOS 5.0+ (TVs de 2020+)
- webOS 6.0+ (TVs de 2021+)
- webOS 7.0+ (TVs de 2022+)

#### Tecnologias
- **Linguagem:** JavaScript (Enact framework opcional)
- **UI Framework:** Enact, React, ou vanilla JS
- **Player de Mídia:** webOS Media Player API
- **Comunicação:** HTTP/HTTPS, WebSockets
- **Armazenamento:** LocalStorage, IndexedDB

#### SDK e Ferramentas
- **webOS TV SDK** - Ambiente de desenvolvimento
- **webOS TV CLI** - Ferramentas de linha de comando
- **webOS TV Simulator** - Emulador para testes
- **ares-cli** - Ferramentas de deploy e debug

#### Arquitetura do Player

```
webOS Player
├── Configuração
│   ├── appinfo.json (metadados do app)
│   ├── info.json (configurações)
│   └── config.json (configurações do player)
├── Código Fonte
│   ├── index.html (ponto de entrada)
│   ├── js/
│   │   ├── app.js (aplicação principal)
│   │   ├── api/ (cliente HTTP)
│   │   ├── player/ (player de mídia)
│   │   ├── playlist/ (gerenciador de playlist)
│   │   └── heartbeat/ (sistema de heartbeat)
│   └── css/ (estilos)
└── Build
    └── deploy (pacote .ipk para instalação)
```

#### Recursos Específicos webOS

**Media Player API:**
```javascript
// Exemplo básico de uso do Media Player
const mediaPlayer = new webOS.MediaPlayer();
mediaPlayer.load(url);
mediaPlayer.play();
```

**HLS Nativo:**
- webOS suporta HLS nativamente
- Ideal para streaming de vídeo
- Suporte a DASH também disponível

**Comandos Remotos:**
- Suporte a comandos via WebSocket
- Atualizações de playlist em tempo real
- Controle remoto da TV

#### Limitações Conhecidas
- ⚠️ Certificados SSL podem ser problemáticos
- ⚠️ CORS pode precisar de configuração especial
- ⚠️ Alguns recursos requerem permissões específicas

---

## 📱 Samsung Tizen

### Status Atual
- ✅ Estrutura básica criada em `player-client/platforms/tizen/`
- ⚠️ Implementação pendente

### Informações Técnicas

#### Versões Tizen Suportadas
- Tizen 3.0+ (TVs de 2017+)
- Tizen 4.0+ (TVs de 2019+)
- Tizen 5.0+ (TVs de 2021+)
- Tizen 6.0+ (TVs de 2022+)

#### Tecnologias
- **Linguagem:** JavaScript (Tizen Web API)
- **UI Framework:** Tizen Web UI Framework, React, ou vanilla JS
- **Player de Mídia:** Tizen AVPlay API
- **Comunicação:** HTTP/HTTPS, WebSockets
- **Armazenamento:** LocalStorage, IndexedDB, FileSystem API

#### SDK e Ferramentas
- **Tizen Studio** - IDE oficial
- **Tizen TV Emulator** - Emulador
- **SDB (Smart Development Bridge)** - Debug e deploy
- **Tizen CLI** - Ferramentas de linha de comando

#### Arquitetura do Player

```
Tizen Player
├── config.xml (manifesto do app)
├── index.html (ponto de entrada)
├── js/
│   ├── app.js (aplicação principal)
│   └── tizen-api/ (APIs específicas Tizen)
└── css/
```

---

## 📱 Android TV

### Status Atual
- ✅ Estrutura básica criada em `player-client/platforms/android/`
- ✅ Implementação parcial (Kotlin)
- ⚠️ Testes pendentes

### Informações Técnicas

#### Versões Android TV Suportadas
- Android TV 5.0+ (Lollipop)
- Android TV 7.0+ (Nougat)
- Android TV 8.0+ (Oreo)
- Android TV 9.0+ (Pie)
- Android TV 10+ (Q)
- Android TV 11+ (R)
- Android TV 12+ (S)

#### Tecnologias
- **Linguagem:** Kotlin (recomendado) ou Java
- **UI Framework:** Android TV Leanback Library
- **Player de Mídia:** ExoPlayer (recomendado) ou MediaPlayer
- **Comunicação:** Retrofit/OkHttp, WebSockets
- **Armazenamento:** SharedPreferences, Room Database

#### SDK e Ferramentas
- **Android Studio** - IDE oficial
- **Android TV Emulator** - Emulador
- **ADB (Android Debug Bridge)** - Debug e deploy
- **Gradle** - Build system

#### Arquitetura do Player

```
Android TV Player
├── app/
│   ├── src/main/
│   │   ├── AndroidManifest.xml
│   │   ├── java/kotlin/
│   │   │   ├── MainActivity.kt
│   │   │   ├── api/ (cliente HTTP)
│   │   │   ├── player/ (player de mídia)
│   │   │   ├── playlist/ (gerenciador)
│   │   │   └── services/ (serviços em background)
│   │   └── res/ (recursos)
│   └── build.gradle
└── build.gradle
```

---

## 🔄 Sistema de Mensageria para Players

### Arquitetura Proposta

```
┌─────────────────┐
│   Backend API   │
│   (Node.js)     │
└────────┬────────┘
         │
         ├─── HTTP/HTTPS (REST API)
         │    ├── Autenticação
         │    ├── Playlists
         │    ├── Mídias
         │    └── Configurações
         │
         ├─── WebSockets
         │    ├── Comandos remotos
         │    ├── Atualizações em tempo real
         │    └── Status do player
         │
         └─── MQTT (Opcional - para FX)
              ├── Efeitos visuais
              ├── Sincronização
              └── Telemetria
```

### Opções de Mensageria

#### 1. HTTP Polling (Simples)
**Vantagens:**
- ✅ Fácil de implementar
- ✅ Funciona em todas as plataformas
- ✅ Não requer infraestrutura adicional

**Desvantagens:**
- ❌ Latência maior
- ❌ Consumo de bateria/rede
- ❌ Não é tempo real

**Uso:** Heartbeat periódico, verificação de atualizações

#### 2. WebSockets (Recomendado)
**Vantagens:**
- ✅ Comunicação bidirecional em tempo real
- ✅ Baixa latência
- ✅ Eficiente

**Desvantagens:**
- ⚠️ Requer suporte na plataforma
- ⚠️ Pode precisar de reconexão automática
- ⚠️ Firewall/proxy podem bloquear

**Uso:** Comandos remotos, atualizações de playlist, status

#### 3. MQTT (Para FX e Sincronização)
**Vantagens:**
- ✅ Pub/Sub eficiente
- ✅ Ideal para múltiplos players
- ✅ Sincronização precisa

**Desvantagens:**
- ⚠️ Requer broker MQTT
- ⚠️ Configuração adicional

**Uso:** Efeitos visuais sincronizados, telemetria

### Implementação Proposta

#### Camada de Abstração

```javascript
// Interface comum para todas as plataformas
class MessagingService {
  connect() {}
  disconnect() {}
  send(command) {}
  on(event, callback) {}
  heartbeat() {}
}
```

#### Implementações por Plataforma

```javascript
// webOS
class WebOSMessagingService extends MessagingService {
  // WebSocket nativo do webOS
}

// Tizen
class TizenMessagingService extends MessagingService {
  // WebSocket via Tizen Web API
}

// Android TV
class AndroidMessagingService extends MessagingService {
  // WebSocket via OkHttp ou Socket.IO
}
```

### Protocolo de Comunicação

#### Mensagens do Player → Backend

```json
{
  "type": "heartbeat",
  "totemId": "123",
  "timestamp": "2025-12-19T18:00:00Z",
  "status": {
    "playing": true,
    "currentMedia": "media-456",
    "playlist": "playlist-789",
    "position": 120.5
  }
}
```

#### Mensagens do Backend → Player

```json
{
  "type": "command",
  "command": "update_playlist",
  "playlist": { /* dados da playlist */ },
  "timestamp": "2025-12-19T18:00:00Z"
}
```

### Heartbeat System

**Frequência:**
- Normal: 30 segundos
- Em reprodução: 10 segundos
- Em standby: 60 segundos

**Dados enviados:**
- Status do player
- Mídia atual
- Posição de reprodução
- Erros/avisos
- Uso de recursos (opcional)

---

## 🛠️ Ambiente de Desenvolvimento - LG webOS

### Pré-requisitos

**Sistema Operacional:**
- Windows 10/11
- macOS 10.14+
- Ubuntu 18.04+ / Debian 10+

**Ferramentas Necessárias:**
- Node.js 14+
- webOS TV SDK
- webOS TV CLI (ares-cli)
- Editor de código (VS Code recomendado)

### Instalação

#### 1. Instalar Node.js
```bash
# Verificar versão
node --version

# Instalar via nvm (recomendado)
nvm install 18
nvm use 18
```

#### 2. Instalar webOS TV CLI
```bash
npm install -g @webos/tv-cli
```

#### 3. Instalar webOS TV SDK
- Baixar do site oficial da LG
- Instalar seguindo instruções do fabricante
- Configurar variáveis de ambiente

#### 4. Configurar TV para Desenvolvimento
- Ativar "Developer Mode" na TV
- Obter IP da TV
- Configurar certificados (se necessário)

### Estrutura de Desenvolvimento

```
player-client/platforms/webos/
├── app/
│   ├── appinfo.json          # Metadados do app
│   └── info.json             # Configurações
├── config/
│   └── config.json           # Configurações do player
├── src/
│   ├── index.html            # Ponto de entrada
│   ├── js/
│   │   ├── app.js            # Aplicação principal
│   │   ├── api/
│   │   │   └── client.js     # Cliente HTTP
│   │   ├── player/
│   │   │   └── media-player.js # Player de mídia
│   │   ├── playlist/
│   │   │   └── manager.js    # Gerenciador de playlist
│   │   └── heartbeat/
│   │       └── service.js    # Sistema de heartbeat
│   └── css/
│       └── style.css         # Estilos
├── build.sh                  # Script de build
├── install.sh                # Script de instalação
└── README.md                 # Documentação
```

### Comandos Úteis

```bash
# Build do app
./build.sh

# Instalar na TV
./install.sh <TV_IP>

# Debug remoto
ares-inspect <TV_IP> -d <APP_ID>

# Ver logs
ares-log <TV_IP> -d <APP_ID>
```

---

## 📝 Próximos Passos

### Para LG webOS (Aguardando Informações do Usuário)

- [ ] **Informações sobre ambiente de desenvolvimento específico**
  - Versão do SDK utilizada
  - Configurações especiais necessárias
  - Limitações conhecidas
  - Melhores práticas

- [ ] **Técnicas específicas de mensageria**
  - WebSocket vs HTTP Polling
  - Configuração de certificados
  - Tratamento de reconexão

- [ ] **Recursos específicos do webOS**
  - APIs disponíveis
  - Limitações de segurança
  - Performance

### Implementação

- [ ] Configurar ambiente de desenvolvimento
- [ ] Implementar player base
- [ ] Implementar sistema de mensageria
- [ ] Testar em TV real
- [ ] Otimizar performance
- [ ] Documentar processo

---

## 📚 Recursos e Referências

### LG webOS
- [Documentação Oficial](https://webostv.developer.lge.com/)
- [Guia de Desenvolvimento](https://webostv.developer.lge.com/develop/guides/)
- [API Reference](https://webostv.developer.lge.com/api/web-api/)

### Samsung Tizen
- [Documentação Oficial](https://developer.samsung.com/tv)
- [Tizen TV Developer Guide](https://developer.tizen.org/development/guides/)

### Android TV
- [Documentação Oficial](https://developer.android.com/tv)
- [Android TV Developer Guide](https://developer.android.com/guide/tv)

---

**Última atualização:** 2025-12-19
**Versão:** 1.0
**Status:** Aguardando informações específicas sobre LG webOS

