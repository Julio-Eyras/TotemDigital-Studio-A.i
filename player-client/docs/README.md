# Smart Signage Pro - Player Cliente

Player cliente multi-plataforma para Smart Signage Pro v2.1.

## 🎯 Plataformas Suportadas

1. **webOS (LG) - HLS** - ✅ **NOVO** - Alta performance, 24/7 otimizado
2. **webOS (LG) - Legacy** - ✅ Completo - PlaylistManager + SmartDisplayFX
3. **Tizen (Samsung)** - ✅ Completo - Similar ao webOS Legacy
4. **Android TV** - ✅ Completo - Kotlin/Android nativo
5. **Linux SBC (Electron)** - ✅ Completo
6. **Linux SBC (C++)** - ✅ Completo
7. **Windows (Electron)** - ✅ Completo

**📊 [Comparação Completa de Plataformas](./PLATAFORMAS_COMPARACAO.md)**

## 📁 Estrutura do Projeto

```
player-client/
├── core/                    # Lógica compartilhada
│   ├── api/                 # Cliente HTTP
│   ├── playlist/            # Gerenciador de playlist
│   ├── scheduler/           # Agendamento
│   ├── heartbeat/           # Sistema de heartbeat
│   ├── media/               # Players de mídia
│   └── utils/               # Utilitários
├── platforms/               # Implementações por plataforma
│   ├── webos/               # webOS (LG)
│   │   ├── SmartSignage-LG-PLAYER-HLS/  # ✅ NOVO - HLS otimizado
│   │   └── org/             # Legacy - PlaylistManager completo
│   ├── tizen/                # Tizen (Samsung) - ✅ Completo
│   ├── android/              # Android TV - ✅ Completo
│   ├── linux-electron/      # Linux Electron - ✅ Completo
│   ├── linux-cpp/           # Linux C++ - ✅ Completo
│   └── windows-electron/    # Windows Electron - ✅ Completo
├── shared/                  # Recursos compartilhados
└── docs/                    # Documentação
```

## 🚀 Início Rápido

### webOS (LG) - HLS (NOVO) ⭐

```bash
cd platforms/webos/SmartSignage-LG-PLAYER-HLS
# Ver: BUILD_E_INSTALACAO.md ou docs/INSTALACAO_TV.md
```

**Características:**
- ✅ HLS nativo, CPU < 10%
- ✅ Hardware decoding automático
- ✅ Ideal para operação 24/7
- ✅ Auto-registro e watchdog robusto

### webOS (LG) - Legacy

```bash
cd platforms/webos/org
# Ver: README.md
```

### Tizen (Samsung)

```bash
cd platforms/tizen
# Ver: README.md
```

### Android TV

```bash
cd platforms/android
# Ver: README.md
```

## 📚 Documentação

- [Arquitetura](./docs/architecture.md)
- [API do Backend](./docs/api.md)
- [Instalação](./docs/installation/)

## 🔧 Desenvolvimento

Ver documentação específica de cada plataforma em `platforms/[plataforma]/README.md`.

