# Guia Completo: Instalação e Distribuição dos Players-Client

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Android TV](#android-tv)
3. [webOS (LG Smart TVs)](#webos-lg-smart-tvs)
4. [Tizen (Samsung Smart TVs)](#tizen-samsung-smart-tvs)
5. [Linux Electron](#linux-electron)
6. [Linux C++](#linux-c)
7. [Windows Electron](#windows-electron)
8. [Processo de Distribuição](#processo-de-distribuição)
9. [Configuração e UIN](#configuração-e-uin)

---

## 🎯 Visão Geral

Os **players-client** são aplicações que rodam nos dispositivos (Smart TVs, SBCs, etc.) e se conectam ao servidor central para reproduzir conteúdo. Cada plataforma tem seu próprio processo de compilação e instalação.

### Fluxo Geral

```
┌─────────────────────────────────────┐
│  1. Desenvolvimento/Compilação       │
│     - Código fonte no repositório    │
│     - Build para cada plataforma     │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  2. Geração de Pacote               │
│     - APK (Android)                 │
│     - IPK (webOS)                   │
│     - WGT (Tizen)                   │
│     - AppImage/DEB (Linux)          │
│     - EXE (Windows)                 │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  3. Distribuição                     │
│     - Transferir para dispositivo    │
│     - Instalar via ADB/Studio/etc   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  4. Configuração                     │
│     - Configurar UIN                │
│     - Configurar URL do servidor    │
│     - Registrar no servidor         │
└─────────────────────────────────────┘
```

---

## 📱 Android TV

### Pré-requisitos

1. **Android Studio** (versão mais recente)
2. **Android SDK** (API 24+)
3. **Android TV SDK**
4. **ADB** (Android Debug Bridge)
5. **Dispositivo Android TV** ou emulador

### Instalação do Ambiente

```bash
# 1. Instalar Android Studio
# Download: https://developer.android.com/studio

# 2. Configurar variáveis de ambiente
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools

# 3. Verificar instalação
adb version
```

### Compilação

```bash
# 1. Navegar para o diretório do player Android
cd player-client/platforms/android

# 2. Build Debug (para testes)
./gradlew assembleDebug

# APK gerado em:
# app/build/outputs/apk/debug/app-debug.apk

# 3. Build Release (para produção)
./gradlew assembleRelease

# APK gerado em:
# app/build/outputs/apk/release/app-release.apk
```

### Assinatura do APK (Release)

Para instalar em dispositivos reais, o APK precisa ser assinado:

```bash
# 1. Criar keystore (apenas primeira vez)
keytool -genkey -v -keystore smartsignage.keystore \
  -alias smartsignage -keyalg RSA -keysize 2048 -validity 10000

# 2. Configurar em app/build.gradle
signingConfigs {
    release {
        storeFile file('smartsignage.keystore')
        storePassword 'sua_senha'
        keyAlias 'smartsignage'
        keyPassword 'sua_senha'
    }
}

# 3. Build assinado
./gradlew assembleRelease
```

### Instalação no Dispositivo

#### Método 1: Via ADB (Recomendado)

```bash
# 1. Conectar dispositivo Android TV
#    - Habilitar "Depuração USB" nas configurações
#    - Conectar via USB ou configurar ADB over network

# 2. Verificar conexão
adb devices

# Saída esperada:
# List of devices attached
# 192.168.1.100:5555    device

# 3. Instalar APK
adb install app/build/outputs/apk/debug/app-debug.apk

# Ou para release:
adb install app/build/outputs/apk/release/app-release.apk

# 4. Verificar instalação
adb shell pm list packages | grep smartsignage
```

#### Método 2: ADB over Network

```bash
# 1. Conectar dispositivo via USB primeiro
adb devices

# 2. Habilitar TCP/IP
adb tcpip 5555

# 3. Conectar via IP
adb connect 192.168.1.100:5555

# 4. Verificar conexão
adb devices

# 5. Instalar APK
adb install app/build/outputs/apk/debug/app-debug.apk
```

#### Método 3: Via Android Studio

1. Abrir projeto em Android Studio
2. Conectar dispositivo
3. Clicar em **Run** → **Run 'app'**
4. O Android Studio compila e instala automaticamente

### Configuração Inicial

Após instalação, configurar o player:

```bash
# 1. Abrir app no dispositivo
# 2. Na primeira execução, o app solicita:
#    - URL do servidor (ex: http://192.168.1.105:3000)
#    - UIN (será gerado automaticamente na primeira conexão)
```

### Publicação no Google Play Store (Opcional)

1. Criar conta de desenvolvedor Google Play
2. Criar app no Play Console
3. Fazer upload do APK assinado
4. Preencher informações do app
5. Enviar para revisão

---

## 📺 webOS (LG Smart TVs)

### Pré-requisitos

1. **webOS TV SDK** (3.0+)
2. **LG Smart TV** com webOS 3.0+
3. **Certificado de desenvolvedor** (para publicação)
4. **TV em modo desenvolvedor**

### Instalação do Ambiente

```bash
# 1. Baixar webOS TV SDK
# Download: https://webostv.developer.lge.com/

# 2. Instalar SDK
# Seguir instruções do instalador

# 3. Configurar variáveis de ambiente
export PATH=$PATH:/opt/webOS_TV_SDK/CLI/bin
```

### Habilitar Modo Desenvolvedor na TV

1. Ir em **Configurações** → **Geral** → **Sobre esta TV**
2. Pressionar **0** sete vezes no controle remoto
3. Ir em **Configurações** → **Geral** → **Desenvolvedor**
4. Habilitar **Modo Desenvolvedor**
5. Anotar o **IP da TV**

### Compilação

```bash
# 1. Navegar para o diretório do player webOS
cd player-client/platforms/webos

# 2. Instalar dependências (se houver)
npm install

# 3. Criar pacote IPK
ares-package app/

# IPK gerado em:
# com.smartsignage.player_1.0.0_all.ipk
```

### Instalação no TV

```bash
# 1. Conectar TV via IP
ares-setup-device -d "LG TV" -i 192.168.1.100

# 2. Instalar app
ares-install --device "LG TV" com.smartsignage.player_1.0.0_all.ipk

# 3. Lançar app
ares-launch --device "LG TV" com.smartsignage.player

# 4. Verificar logs
ares-log --device "LG TV" com.smartsignage.player
```

### Configuração

Editar `app/appinfo.json` ou `config/config.json`:

```json
{
  "apiBaseUrl": "http://192.168.1.105:3000",
  "totemUin": "auto-generate",
  "totemSecret": "your-secret"
}
```

---

## 📺 Tizen (Samsung Smart TVs)

### Pré-requisitos

1. **Tizen Studio**
2. **Tizen TV SDK** (4.0+)
3. **Samsung Smart TV** com Tizen 4.0+
4. **Certificado de desenvolvedor**

### Instalação do Ambiente

```bash
# 1. Baixar Tizen Studio
# Download: https://developer.tizen.org/development/tizen-studio

# 2. Instalar Tizen Studio
# Seguir instruções do instalador

# 3. Instalar TV Extension
# Tizen Studio → Tools → Extension Manager → TV Extension
```

### Habilitar Modo Desenvolvedor na TV

1. Ir em **Configurações** → **Geral** → **Sobre esta TV**
2. Pressionar **0**, **1**, **8**, **2** no controle remoto
3. Ir em **Configurações** → **Geral** → **Desenvolvedor**
4. Habilitar **Modo Desenvolvedor**
5. Anotar o **IP da TV**

### Compilação

```bash
# 1. Navegar para o diretório do player Tizen
cd player-client/platforms/tizen

# 2. Criar perfil de certificado (primeira vez)
tizen certificate --alias smartsignage --name "Smart Signage" --filename smartsignage

# 3. Criar pacote WGT
tizen package -t wgt -s smartsignage

# WGT gerado em:
# SmartSignagePlayer.wgt
```

### Instalação no TV

```bash
# 1. Conectar TV
tizen connect 192.168.1.100

# 2. Instalar app
tizen install -n SmartSignagePlayer.wgt -t 192.168.1.100

# 3. Lançar app
tizen run -p com.smartsignage.player -t 192.168.1.100
```

---

## 🐧 Linux Electron

### Pré-requisitos

1. **Node.js 18+**
2. **npm 9+**
3. **Linux** (ARM, ARM64 ou x64)
4. **Display conectado**

### Compilação

```bash
# 1. Navegar para o diretório do player Linux Electron
cd player-client/platforms/linux-electron

# 2. Instalar dependências
npm install

# 3. Build para arquitetura atual
npm run build

# 4. Build para ARM (Raspberry Pi, Orange Pi)
npm run build:arm

# 5. Build para ARM64
npm run build:arm64
```

### Formatos de Saída

O build gera diferentes formatos:

- **AppImage**: `dist/Smart Signage Player-1.0.0.AppImage`
- **DEB**: `dist/smartsignage-player_1.0.0_amd64.deb`
- **TAR.GZ**: `dist/smartsignage-player-1.0.0.tar.gz`

### Instalação

#### Método 1: AppImage (Recomendado - Portátil)

```bash
# 1. Tornar executável
chmod +x "dist/Smart Signage Player-1.0.0.AppImage"

# 2. Executar
./dist/Smart\ Signage\ Player-1.0.0.AppImage
```

#### Método 2: DEB Package

```bash
# 1. Instalar
sudo dpkg -i dist/smartsignage-player_1.0.0_amd64.deb

# 2. Resolver dependências (se necessário)
sudo apt-get install -f
```

#### Método 3: TAR.GZ

```bash
# 1. Extrair
tar -xzf dist/smartsignage-player-1.0.0.tar.gz

# 2. Executar
cd smartsignage-player-1.0.0
./smartsignage-player
```

### Auto-start (systemd)

```bash
# 1. Copiar service file
sudo cp systemd/smartsignage-player.service /etc/systemd/system/

# 2. Editar configurações
sudo nano /etc/systemd/system/smartsignage-player.service

# 3. Habilitar e iniciar
sudo systemctl enable smartsignage-player
sudo systemctl start smartsignage-player

# 4. Verificar status
sudo systemctl status smartsignage-player
```

### Configuração do Service

Editar `/etc/systemd/system/smartsignage-player.service`:

```ini
[Unit]
Description=Smart Signage Player
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/opt/smart-signage/player
ExecStart=/opt/smart-signage/player/smartsignage-player
Environment="API_BASE_URL=http://192.168.1.105:3000"
Environment="TOTEM_UIN=auto-generate"
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

---

## 🐧 Linux C++

### Pré-requisitos

1. **CMake 3.16+**
2. **GCC 9+** ou **Clang 10+**
3. **libcurl**
4. **jsoncpp**
5. **OpenSSL**
6. **GStreamer** (opcional, para media player)

### Instalação de Dependências

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y \
  build-essential \
  cmake \
  libcurl4-openssl-dev \
  libjsoncpp-dev \
  libssl-dev

# Com GStreamer (recomendado para reprodução de mídia)
sudo apt-get install -y \
  libgstreamer1.0-dev \
  gstreamer1.0-plugins-base \
  gstreamer1.0-plugins-good \
  gstreamer1.0-plugins-bad \
  gstreamer1.0-plugins-ugly
```

### Compilação

```bash
# 1. Navegar para o diretório do player Linux C++
cd player-client/platforms/linux-cpp

# 2. Criar diretório de build
mkdir build
cd build

# 3. Configurar com CMake
cmake ..

# 4. Compilar
make -j$(nproc)

# 5. Instalar (opcional)
sudo make install
```

### Instalação Manual

```bash
# 1. Copiar binário
sudo cp build/smartsignage-player /usr/local/bin/

# 2. Tornar executável
sudo chmod +x /usr/local/bin/smartsignage-player

# 3. Criar diretório de configuração
sudo mkdir -p /etc/smartsignage-player

# 4. Copiar arquivo de configuração
sudo cp config.json.example /etc/smartsignage-player/config.json
```

### Auto-start (systemd)

```bash
# 1. Copiar service file
sudo cp systemd/smartsignage-player.service /etc/systemd/system/

# 2. Editar configurações
sudo nano /etc/systemd/system/smartsignage-player.service

# 3. Habilitar e iniciar
sudo systemctl daemon-reload
sudo systemctl enable smartsignage-player
sudo systemctl start smartsignage-player
```

---

## 🪟 Windows Electron

### Pré-requisitos

1. **Node.js 18+**
2. **npm 9+**
3. **Windows 10+**

### Compilação

```bash
# 1. Navegar para o diretório do player Windows Electron
cd player-client/platforms/windows-electron

# 2. Instalar dependências
npm install

# 3. Build
npm run build

# Instalador gerado em:
# dist/Smart Signage Player Setup 1.0.0.exe
```

### Instalação

1. Executar o instalador: `dist/Smart Signage Player Setup 1.0.0.exe`
2. Seguir o assistente de instalação
3. O instalador pode configurar auto-start automaticamente

### Auto-start Manual

#### Método 1: Task Scheduler

1. Abrir **Agendador de Tarefas**
2. Criar nova tarefa
3. Configurar para executar na inicialização
4. Ação: Executar `C:\Program Files\Smart Signage Player\smartsignage-player.exe`

#### Método 2: Startup Folder

```cmd
# Copiar atalho para pasta de inicialização
copy "C:\Program Files\Smart Signage Player\smartsignage-player.exe" "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\"
```

---

## 📦 Processo de Distribuição

### Opção 1: Compilar Localmente e Distribuir

```bash
# 1. Compilar para cada plataforma
cd player-client/platforms/android && ./gradlew assembleRelease
cd ../webos && ares-package app/
cd ../tizen && tizen package -t wgt
cd ../linux-electron && npm run build
cd ../windows-electron && npm run build

# 2. Coletar pacotes gerados
mkdir -p dist/players
cp android/app/build/outputs/apk/release/app-release.apk dist/players/
cp webos/*.ipk dist/players/
cp tizen/*.wgt dist/players/
cp linux-electron/dist/* dist/players/
cp windows-electron/dist/*.exe dist/players/

# 3. Criar ZIP de distribuição
zip -r players-distribution.zip dist/players/
```

### Opção 2: Usar Script de Instalação

O script `install-smartsignage.sh` pode compilar e instalar automaticamente:

```bash
# Instalar todos os players
./install-smartsignage.sh --all-players

# Instalar players específicos
./install-smartsignage.sh \
  --player-android \
  --player-webos \
  --player-linux-electron
```

### Opção 3: Distribuir Código Fonte

Para clientes que querem compilar localmente:

```bash
# 1. Criar pacote com código fonte
tar -czf player-client-source.tar.gz player-client/

# 2. Incluir instruções de compilação
# Cada plataforma tem seu README.md com instruções
```

---

## 🔐 Configuração e UIN

### Geração Automática de UIN

O player gera automaticamente um UIN na primeira execução baseado em hardware:

```javascript
// Exemplo de geração (JavaScript/HTML5)
const hardwareInfo = {
  mac: getMacAddress(),
  cpuId: getCpuId(),
  hostname: getHostname(),
  platform: getPlatform(),
  arch: getArchitecture()
};

const uin = generateUIN(hardwareInfo);
// Exemplo: "SSP-3a8f9b2c1d4e5f6a7b8c9d0e1f2a3b4c"
```

### Configuração Manual

#### Android (Kotlin)

Editar `app/src/main/java/com/smartsignage/player/PlayerViewModel.kt`:

```kotlin
object PlayerConfig {
    const val API_BASE_URL = "http://192.168.1.105:3000"
    const val TOTEM_UIN = "SSP-..." // ou "auto-generate"
    const val TOTEM_SECRET = "your-secret"
}
```

#### Linux/Windows (Electron)

Criar arquivo `config.json`:

```json
{
  "apiBaseUrl": "http://192.168.1.105:3000",
  "totemUin": "auto-generate",
  "totemSecret": "your-secret",
  "heartbeatInterval": 30000,
  "autoStart": true,
  "fullscreen": true
}
```

#### Linux C++

Editar `config.json`:

```json
{
  "api_base_url": "http://192.168.1.105:3000",
  "totem_uin": "auto-generate",
  "totem_secret": "your-secret",
  "heartbeat_interval": 30000
}
```

### Registro no Servidor

Após configurar, o player se registra automaticamente:

1. **Primeira conexão**: Player envia informações de hardware
2. **Servidor**: Cria totem com status `pending_approval`
3. **Admin**: Aprova totem no painel web
4. **Player**: Recebe playlist e inicia reprodução

---

## 📋 Resumo por Plataforma

| Plataforma | Compilação | Formato | Instalação | Auto-start |
|------------|------------|---------|------------|------------|
| **Android TV** | `./gradlew assembleRelease` | APK | `adb install` | Configurar manualmente |
| **webOS** | `ares-package` | IPK | `ares-install` | Configurar na TV |
| **Tizen** | `tizen package` | WGT | `tizen install` | Configurar na TV |
| **Linux Electron** | `npm run build` | AppImage/DEB | Executar/`dpkg` | systemd |
| **Linux C++** | `cmake && make` | Binário | `make install` | systemd |
| **Windows Electron** | `npm run build` | EXE | Executar instalador | Task Scheduler |

---

## 🚀 Fluxo Recomendado de Distribuição

### Para Desenvolvimento/Testes

1. Compilar localmente
2. Instalar via ADB/Studio diretamente
3. Testar e ajustar

### Para Produção

1. **Compilar** para cada plataforma
2. **Assinar** (Android, webOS, Tizen)
3. **Empacotar** em ZIP de distribuição
4. **Distribuir** para clientes
5. **Instalar** em dispositivos
6. **Configurar** UIN e servidor
7. **Registrar** no servidor central

---

## 📝 Checklist de Distribuição

Antes de distribuir, verificar:

- [ ] APK Android assinado e testado
- [ ] IPK webOS testado em TV real
- [ ] WGT Tizen testado em TV real
- [ ] AppImage/DEB Linux testado
- [ ] EXE Windows testado
- [ ] Documentação incluída
- [ ] Scripts de instalação incluídos
- [ ] Configurações de exemplo incluídas
- [ ] UIN configurado ou auto-geração habilitada

---

**Documentação criada em:** 2025-12-13  
**Versão:** 2.1.0  
**Status:** ✅ Completo

