# Player webOS (LG Smart TVs)

Player cliente para webOS 3.0+ (LG Smart TVs).

## 📋 Requisitos

- webOS TV SDK 3.0+
- LG Smart TV com webOS 3.0 ou superior
- Certificado de desenvolvedor LG (para publicação)

## 🚀 Instalação

### 1. Instalar webOS TV SDK

```bash
# Baixar e instalar webOS TV SDK do site oficial da LG
# https://webostv.developer.lge.com/
```

### 2. Configurar Projeto

```bash
cd platforms/webos
ares-package app/
```

### 3. Instalar no TV

```bash
# Conectar TV via IP
ares-install --device <TV_IP> com.smartsignage.player_1.0.0_all.ipk
```

## 🔧 Desenvolvimento

### Estrutura

```
webos/
├── app/
│   ├── info.json           # Manifest do app
│   ├── appinfo.json        # Informações do app
│   └── services/          # Background services
├── src/
│   ├── index.html          # Entry point
│   ├── js/
│   │   ├── app.js         # App principal
│   │   ├── api/           # Cliente API
│   │   ├── player/        # Media player
│   │   └── utils/         # Utilitários
│   └── css/
└── config/
    └── appinfo.json       # Configurações
```

### Executar Localmente

```bash
# Servir app localmente
ares-package app/
ares-install --device <TV_IP> com.smartsignage.player_1.0.0_all.ipk
ares-launch --device <TV_IP> com.smartsignage.player
```

## 📚 Documentação

- [webOS TV SDK Documentation](https://webostv.developer.lge.com/develop/specifications/web-api)
- [LG Developer Portal](https://webostv.developer.lge.com/)

