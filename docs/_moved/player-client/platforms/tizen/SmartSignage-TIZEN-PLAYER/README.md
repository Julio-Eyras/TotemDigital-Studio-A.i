# Player Tizen (Samsung Smart TVs)

Player cliente para Tizen (Samsung Smart TVs) - reutiliza muito código do webOS.

## 📋 Requisitos

- Tizen Studio
- Tizen TV SDK 4.0+
- Samsung Smart TV com Tizen 4.0+

## 🚀 Instalação

### 1. Instalar Tizen Studio

```bash
# Baixar e instalar do site oficial da Samsung
# https://developer.tizen.org/development/tizen-studio
```

### 2. Build

```bash
cd platforms/tizen
tizen package -t wgt -s <certificate-profile>
```

### 3. Instalar no TV

```bash
tizen install -n SmartSignagePlayer.wgt -t <TV_IP>
```

## 🔧 Desenvolvimento

### Estrutura

```
tizen/
├── app/
│   └── config.xml
└── src/
    ├── index.html
    ├── js/
    └── css/
```

## 📚 Documentação

- [Tizen TV Developer Guide](https://developer.tizen.org/development/tv)
- [Tizen TV API Reference](https://developer.tizen.org/development/api-references)

