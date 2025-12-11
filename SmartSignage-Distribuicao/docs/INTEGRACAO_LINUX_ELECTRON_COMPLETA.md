# Integração SmartDisplayFX - Linux Electron (COMPLETA)

## ✅ O que foi implementado

### 1. Build Script
- ✅ `build.sh` atualizado para copiar SmartDisplayFX
- ✅ Script inclui todos os módulos necessários

### 2. Dependências
- ✅ `mqtt` adicionado ao `package.json`
- ✅ Versão: `^5.0.0`

### 3. HTML
- ✅ Canvas para FX adicionado (`fx-canvas`)
- ✅ Módulos SmartDisplayFX carregados e expostos globalmente
- ✅ MQTT disponível via npm (não precisa CDN)

### 4. App.js
- ✅ Função `initSmartDisplayFX()` implementada
- ✅ Integração com media player
- ✅ Configuração de MQTT
- ✅ Handler de efeitos conectado

## 📋 Como Funciona

### Fluxo de Inicialização

1. **HTML carrega módulos ES6**:
   - Importa `SmartDisplayFlowClient`, `FxEngine`, `PlayerBridge`
   - Expõe globalmente via `window.SmartDisplayFX`

2. **App.js inicializa SmartDisplayFX**:
   - Cria `WebPlayerBridge` conectado ao video element
   - Cria `FxEngine` com canvas para renderização
   - Cria `SmartDisplayFlowClient` com MQTT (via npm)
   - Conecta handler de efeitos

3. **Quando efeito é recebido**:
   - `SmartDisplayFlowClient` recebe via MQTT
   - Dispara handler `onEffect`
   - `FxEngine` renderiza efeito no canvas

## 🔧 Configuração

### Variáveis no CONFIG (app.js):

```javascript
const CONFIG = {
  // ... outras configs
  mqttUrl: 'ws://localhost:9001',        // URL do broker MQTT
  mqttPrefix: 'smartdisplay',              // Prefixo dos tópicos
  mqttUsername: undefined,                 // Username (opcional)
  mqttPassword: undefined,                 // Password (opcional)
  siteId: 'site-01',                      // ID do site
};
```

### Ou via config.json:

```json
{
  "mqttUrl": "ws://seu-broker:9001",
  "mqttPrefix": "smartdisplay",
  "siteId": "site-01"
}
```

## 🚀 Como Buildar e Testar

### 1. Instalar Dependências

```bash
cd player-client/platforms/linux-electron
npm install
```

Isso vai instalar:
- `electron`
- `electron-builder`
- `mqtt` (para SmartDisplayFX)

### 2. Build

```bash
./build.sh
```

Isso vai:
- Copiar arquivos core
- Copiar SmartDisplayFX
- Copiar arquivos fonte
- Instalar dependências npm

### 3. Executar Localmente

```bash
npm start
```

### 4. Build para Distribuição

```bash
# Build para Linux x64
npm run build

# Build para ARM (Raspberry Pi, Orange Pi)
npm run build:arm

# Build para ARM64
npm run build:arm64
```

Isso gera:
- `.AppImage` (executável)
- `.deb` (Debian/Ubuntu)
- `.rpm` (RedHat/CentOS)

## ⚠️ Requisitos

1. **Node.js**: 16+ (para Electron)
2. **MQTT Broker**: Deve estar rodando e acessível
3. **Configuração**: `mqttUrl` deve estar correto
4. **Canvas**: Elemento `fx-canvas` deve existir no HTML
5. **Video Element**: Deve existir para `PlayerBridge`

## 🐛 Troubleshooting

### SmartDisplayFX não inicializa
- Verificar se módulos foram carregados: `window.SmartDisplayFX`
- Verificar console para erros de import
- Verificar se `mqtt` foi instalado: `npm list mqtt`

### MQTT não conecta
- Verificar se `mqtt` foi instalado corretamente
- Verificar URL do broker
- Verificar credenciais (se necessário)
- Verificar firewall/network

### Efeitos não aparecem
- Verificar se canvas existe: `document.getElementById('fx-canvas')`
- Verificar se `FxEngine` foi inicializado
- Verificar logs de recebimento de efeitos

## 📝 Diferenças do webOS

1. **MQTT**: Via npm (`mqtt` package) em vez de CDN
2. **Build**: Gera executáveis (AppImage, .deb, .rpm)
3. **Plataforma**: Linux (x64, ARM, ARM64)
4. **Uso**: SBCs (Orange Pi, Raspberry Pi, etc.)

## 🎯 Próximos Passos

1. **Testar localmente** (`npm start`)
2. **Testar build** (`npm run build`)
3. **Testar em SBC real** (Orange Pi, Raspberry Pi)
4. **Validar comunicação MQTT**
5. **Validar efeitos FX**

---

**Status**: ✅ Integração completa, pronto para testes

