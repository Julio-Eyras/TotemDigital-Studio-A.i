# Smart Signage Pro - Player Cliente

Player cliente multi-plataforma para Smart Signage Pro v2.1.

## 🎯 Plataformas Suportadas

1. **webOS (LG)** - 🔴 ALTA prioridade
2. **Android TV** - 🟡 MÉDIA prioridade
3. **Linux SBC (Electron)** - 🟡 MÉDIA prioridade
4. **Linux SBC (C++)** - 🟡 MÉDIA prioridade
5. **Windows (Electron)** - 🟢 BAIXA prioridade
6. **Tizen (Samsung)** - 🟢 BAIXA prioridade

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
│   ├── android/              # Android TV
│   ├── linux-electron/      # Linux Electron
│   ├── linux-cpp/           # Linux C++
│   ├── windows-electron/    # Windows Electron
│   └── tizen/                # Tizen (Samsung)
├── shared/                  # Recursos compartilhados
└── docs/                    # Documentação
```

## 🚀 Início Rápido

### webOS (LG)

```bash
cd platforms/webos
# Seguir instruções em platforms/webos/README.md
```

## 📚 Documentação

- [Arquitetura](./docs/architecture.md)
- [API do Backend](./docs/api.md)
- [Instalação](./docs/installation/)

## 🔧 Desenvolvimento

Ver documentação específica de cada plataforma em `platforms/[plataforma]/README.md`.

