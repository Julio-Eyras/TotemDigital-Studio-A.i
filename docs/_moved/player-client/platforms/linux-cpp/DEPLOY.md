# Guia de Deploy - Linux C++ Player

## Build para Diferentes Arquiteturas

### ARM (Raspberry Pi, Orange Pi)

```bash
# Cross-compile ou compilar no dispositivo
# No dispositivo ARM:
cd platforms/linux-cpp
mkdir build
cd build
cmake ..
make
```

### x64

```bash
cd platforms/linux-cpp
mkdir build
cd build
cmake ..
make
```

## Instalação

### Manual

```bash
sudo cp build/smartsignage-player /usr/local/bin/
sudo chmod +x /usr/local/bin/smartsignage-player
```

### Systemd Service

```bash
sudo cp systemd/smartsignage-player.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable smartsignage-player
sudo systemctl start smartsignage-player
```

## Verificar Status

```bash
sudo systemctl status smartsignage-player
```

## Logs

```bash
sudo journalctl -u smartsignage-player -f
```

## Troubleshooting

### Erro de compilação
- Verificar dependências instaladas
- Verificar versão do compilador (C++17 requerido)

### Erro de execução
- Verificar permissões
- Verificar variáveis de ambiente
- Verificar conectividade com backend

