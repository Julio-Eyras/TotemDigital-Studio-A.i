# Player Linux/Windows

Player completo para totens desktop (Linux/Windows) com suporte a DispatchPlan nativo, cache local, servidor HTTP local e **descoberta automática via mDNS**.

## 🚀 Uso

### Instalação

```bash
cd platforms/linux-windows
npm install
```

### Requisitos

**Para descoberta automática (mDNS):**
```bash
# Linux
sudo apt update
sudo apt install avahi-daemon avahi-utils -y

# Windows
# Instalar Bonjour Print Services (inclui mDNS)
# Ou usar Chocolatey: choco install bonjour
```

### Execução

```bash
# Com variáveis de ambiente
API_BASE_URL=http://servidor-central:3000 \
TOTEM_UIN=TOTEM_001 \
TOTEM_SECRET=secret \
HTTP_PORT=8080 \
node player-app.js
```

### Configuração

```javascript
const SmartSignagePlayer = require('./player-app');

const player = new SmartSignagePlayer({
    apiBaseURL: 'http://servidor-central:3000',
    totemUIN: 'TOTEM_001',
    totemSecret: 'secret',
    deviceId: 'linux-device-123',
    platform: 'linux', // ou 'windows'
    cacheEnabled: true,
    cacheMaxSize: 32 * 1024 * 1024 * 1024, // 32GB
    httpServerPort: 8080,
    autoDiscovery: true
});

player.on('initialized', () => {
    player.playNext();
});

player.init();
```

## 📋 Componentes

### player-app.js
Aplicativo principal que integra todos os componentes.

### api/client.js
Cliente HTTP para comunicação com backend.

### cache/MediaCacheManager.js
Gerenciador de cache local de mídias.

### totem/TotemConnectionManager.js
Gerenciador de descoberta de totem local (melhorado com mDNS).

### media/MediaPlayer.js
Player de mídia multiplataforma (VLC, mpv, WMP).

### local-http-server.js
Servidor HTTP local para servir mídias às Smart TVs.

### mdns/MDNSAnnouncer.js ⭐ NOVO
Anuncia totem via mDNS (Avahi) para descoberta automática.

## 🎯 Funcionalidades

- ✅ DispatchPlan nativo (sem conversão)
- ✅ Cache local de mídias (32GB)
- ✅ Servidor HTTP local (porta 8080)
- ✅ **Descoberta automática via mDNS** ⭐ NOVO
- ✅ Validação temporal (validityStart/validityEnd)
- ✅ Modo offline
- ✅ Heartbeat periódico
- ✅ Sincronização automática

## 🔍 Descoberta Automática (mDNS)

### Como Funciona

1. **Totem anuncia via mDNS:**
   - Nome: `Publisher-{hostname}.local`
   - Serviço: `_smartsignage-totem._tcp`
   - Porta: 8080
   - Atributos TXT: role, player, version, totemUIN

2. **Smart TVs descobrem automaticamente:**
   - webOS: via `webOS.service.mdns`
   - Tizen: via SSDP ou mDNS
   - Não requer configuração manual de IP

3. **Fallback:**
   - Se mDNS não disponível, usa scan básico (IPs 1-10)
   - Se scan falhar, usa servidor central

### Verificar Descoberta

```bash
# Verificar se totem está anunciado
avahi-browse -rt _smartsignage-totem._tcp

# Resolver nome do totem
avahi-resolve -n Publisher-totem23.local
```

### Troubleshooting

**Problema**: Totem não aparece na descoberta
- Verificar se Avahi está instalado: `systemctl status avahi-daemon`
- Verificar se serviço foi criado: `cat /etc/avahi/services/smartdisplay.service`
- Verificar logs: `journalctl -u avahi-daemon`

**Problema**: Permissão negada ao criar serviço
- Executar com sudo: `sudo node player-app.js`
- Ou configurar sudo sem senha para comandos específicos

## 📝 Requisitos

- Node.js >= 18.0.0
- VLC ou mpv (para reprodução de vídeo)
- Navegador padrão (para HTML)
- **Avahi (para mDNS)** ⭐ NOVO

## 🔧 Variáveis de Ambiente

- `API_BASE_URL` - URL base da API
- `TOTEM_UIN` - UIN do totem
- `TOTEM_SECRET` - Secret do totem
- `HTTP_PORT` - Porta do servidor HTTP local (padrão: 8080)
- `CACHE_DIR` - Diretório de cache (padrão: ./cache/media)

## 📚 Documentação Relacionada

- `docs/ANALISE_MDNS_SSDP_SCAN.md` - Análise completa de mDNS/SSDP
- `docs/ANALISE_MDNS_SSDP_SCAN_ANDROID.md` - Detalhes Android
- `docs/ARQUITETURA-DESCOBERTA-TOTEM-LOCAL.md` - Arquitetura de descoberta
