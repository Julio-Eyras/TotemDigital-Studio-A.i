# Player Linux Electron (SBC)

Player cliente para Linux SBC usando Electron.

## 📋 Requisitos

- Node.js 18+
- npm 9+
- Linux (ARM ou x64)
- Display conectado

## 🚀 Instalação

### 1. Instalar Dependências

```bash
cd platforms/linux-electron
npm install
```

### 2. Build

```bash
# Build para arquitetura atual
npm run build

# Build para ARM (Raspberry Pi, Orange Pi)
npm run build:arm

# Build para ARM64
npm run build:arm64
```

### 3. Instalar

```bash
# AppImage
./dist/Smart Signage Player-1.0.0.AppImage

# Debian package
sudo dpkg -i dist/smartsignage-player_1.0.0_amd64.deb
```

## 🔧 Configuração

### Variáveis de Ambiente

```bash
export API_BASE_URL=http://localhost:3000
export TOTEM_UIN=your-uin
export TOTEM_SECRET=your-secret
```

### Auto-start (systemd)

```bash
# Copiar service file
sudo cp systemd/smartsignage-player.service /etc/systemd/system/

# Editar configurações
sudo nano /etc/systemd/system/smartsignage-player.service

# Habilitar e iniciar
sudo systemctl enable smartsignage-player
sudo systemctl start smartsignage-player
```

## 📚 Documentação

- [Electron Documentation](https://www.electronjs.org/docs)

