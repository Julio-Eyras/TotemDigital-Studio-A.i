# 🚀 Build e Instalação - Guia Rápido

## Passo a Passo Simplificado

### 1️⃣ Preparação (Uma vez apenas)

#### Instalar webOS SDK:
- **Windows:** [Download SDK](https://webostv.developer.lge.com/develop/sdk/installing-the-sdk/)
- **Linux/Mac:** `npm install -g @webos/tv-cli`

#### Ativar TV:
1. Instalar app **"Developer Mode"** na TV
2. Ativar Developer Mode + Key Server
3. Anotar IP da TV (ex: `192.168.1.50`)

#### Configurar dispositivo:
```bash
ares-setup-device
# Nome: lg_tv
# IP: 192.168.1.50
# Port: 22
# User: prisoner
```

---

### 2️⃣ Build

```bash
cd player-client/platforms/webos/SmartSignage-LG-PLAYER-HLS
./scripts/build.sh
```

**Resultado:** Arquivo `.ipk` criado

---

### 3️⃣ Instalação

```bash
./scripts/deploy.sh lg_tv
```

**Resultado:** App instalado na TV

---

### 4️⃣ Executar

```bash
ares-launch com.smartsignage.lgplayer.hls -d lg_tv
```

**Resultado:** App inicia na TV

---

### 5️⃣ Ver Logs

```bash
ares-log -d lg_tv
```

---

## ⚡ Comandos Únicos

**Build + Instalar + Executar:**
```bash
cd player-client/platforms/webos/SmartSignage-LG-PLAYER-HLS
./scripts/build.sh && ./scripts/deploy.sh lg_tv && ares-launch com.smartsignage.lgplayer.hls -d lg_tv
```

---

## 🔧 Configuração

Edite `config/config.example.json` antes do build:
- `api_base_url`: IP do seu servidor backend
- `stream_url`: URL do stream HLS
- `fallback_urls`: Vídeos de fallback (opcional)

---

## ❓ Problemas?

Ver documentação completa: `docs/INSTALACAO_TV.md`

