# Player Client - Smart Signage Pro

Sistema de players multiplataforma para Smart Signage Pro, suportando Android, webOS, Tizen, Linux e Windows.

## 📋 Visão Geral

O Player Client é o componente responsável por reproduzir conteúdo em dispositivos de sinalização digital (totens e Smart TVs). Ele se integra com o sistema Dispatcher-Totem para obter conteúdo personalizado e utiliza cache local para funcionamento offline.

## 🏗️ Arquitetura

### Plataformas Suportadas

- **Android** - Totens e Android TV
- **webOS** - Smart TVs LG
- **Tizen** - Smart TVs Samsung
- **Linux/Windows** - Totens desktop

### Componentes Principais

1. **Dispatcher Integration** - Integração com Dispatcher-Totem
2. **Local Cache** - Cache local de mídias
3. **Local HTTP Server** - Servidor HTTP local (totens)
4. **Totem Discovery** - Descoberta automática de totem local

## 🚀 Início Rápido

### Android

```kotlin
// Inicialização automática via PlayerViewModel
val viewModel = ViewModelProvider(this)[PlayerViewModel::class.java]
viewModel.initialize()
```

### webOS

```javascript
// Inicialização automática via app.js
await init();
```

### Tizen

```javascript
// Inicialização automática via app.js
const app = new SmartSignageApp();
await app.init();
```

### Linux/Windows (Servidor HTTP Local)

```bash
cd platforms/linux-windows
PORT=8080 CACHE_DIR=./cache/media node local-http-server.js
```

## 📚 Documentação

- [Guia Completo de Implementação](GUIA_COMPLETO_IMPLEMENTACAO.md)
- [Refatoração Dispatcher Completa](REFATORACAO_DISPATCHER_COMPLETA.md)
- [Implementação Cache e Servidor Local](IMPLEMENTACAO_CACHE_SERVIDOR_LOCAL.md)
- [Integração TotemConnectionManager](INTEGRACAO_TOTEM_CONNECTION_MANAGER.md)

## 🧪 Testes

```bash
cd test
node test-dispatcher-integration.js
```

## 📝 Estrutura de Diretórios

```
player-client/
├── core/                    # Componentes core compartilhados
│   ├── api/                 # Cliente API
│   ├── cache/               # Sistema de cache
│   ├── server/              # Servidor HTTP local
│   └── adapters/            # Adaptadores multiplataforma
├── platforms/               # Implementações específicas
│   ├── android/             # Android
│   ├── webos/               # webOS
│   ├── tizen/               # Tizen
│   └── linux-windows/       # Linux/Windows
└── test/                    # Scripts de teste
```

## 🔧 Configuração

Veja [GUIA_COMPLETO_IMPLEMENTACAO.md](GUIA_COMPLETO_IMPLEMENTACAO.md) para detalhes de configuração por plataforma.

## 📊 Fluxo de Funcionamento

1. **Descoberta de Totem** - Detecta totem local ou usa servidor central
2. **Autenticação** - Obtém token de dispositivo
3. **DispatchPlan** - Obtém plano de exibição do dispatcher
4. **Cache Local** - Baixa e armazena mídias localmente
5. **Reprodução** - Prioriza caminhos locais (totem → cache → remoto)

## ✅ Status

- ✅ Dispatcher Integration - Completo
- ✅ Local Cache - Completo
- ✅ Local HTTP Server - Completo
- ✅ Totem Discovery - Completo
- ⏳ Testes em Dispositivos Reais - Pendente

## 📞 Suporte

Para mais informações, consulte a documentação completa em `docs/`.
