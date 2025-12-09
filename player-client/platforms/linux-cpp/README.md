# Player Linux C++ (SBC)

Player cliente para Linux SBC usando C++ nativo (versão otimizada).

## 📋 Requisitos

- CMake 3.16+
- GCC 9+ ou Clang 10+
- libcurl
- jsoncpp
- OpenSSL
- GStreamer (opcional, para media player)

## 🚀 Instalação

### 1. Instalar Dependências

```bash
# Ubuntu/Debian
sudo apt-get install build-essential cmake libcurl4-openssl-dev libjsoncpp-dev libssl-dev

# Com GStreamer (recomendado)
sudo apt-get install libgstreamer1.0-dev gstreamer1.0-plugins-base gstreamer1.0-plugins-good
```

### 2. Build

```bash
cd platforms/linux-cpp
mkdir build
cd build
cmake ..
make
```

### 3. Instalar

```bash
sudo make install
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

- [CMake Documentation](https://cmake.org/documentation/)
- [libcurl Documentation](https://curl.se/libcurl/)

