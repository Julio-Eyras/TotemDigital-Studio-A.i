# Player Cliente - Planejamento Detalhado

## 📋 Status Atual do Frontend Administrativo

### ✅ Estrutura Existente:
- **Framework:** React 18 + TypeScript + Material-UI
- **State Management:** Redux Toolkit
- **Routing:** React Router v6
- **API Client:** Axios básico
- **Páginas Implementadas:**
  - ✅ Dashboard
  - ✅ Media
  - ✅ Playlists
  - ✅ Campaigns
  - ✅ Totems
  - ✅ Users
  - ✅ Clients
  - ✅ Analytics
  - ✅ Reports
  - ✅ Settings
  - ✅ AI
  - ✅ Smart Playlist
  - ✅ QR Codes
  - ✅ Billing
  - ✅ Admin Tools

### ⚠️ Pontos que Precisam de Revisão/Integração:

1. **Rate Limiting:**
   - Frontend não trata respostas 429 (Too Many Requests)
   - Não há retry automático com backoff
   - Não há feedback visual para usuário quando rate limit é atingido

2. **Cache:**
   - Frontend não utiliza cache do backend (Redis)
   - Todas as requisições são sempre feitas ao servidor
   - Poderia implementar React Query para cache client-side

3. **Validação de Entrada:**
   - Frontend não valida tamanho de payload antes de enviar
   - Não há feedback sobre limites de upload
   - Não sanitiza inputs antes de enviar

4. **Error Handling:**
   - ErrorBoundary existe mas pode ser melhorado
   - Não há tratamento específico para erros de validação do backend
   - Logs de erro do frontend são enviados ao backend (✅ já implementado)

5. **Segurança:**
   - JWT tokens são armazenados em localStorage (vulnerável a XSS)
   - Não há refresh token automático
   - Não há verificação de expiração de token

### 🔧 Melhorias Necessárias no Frontend:

1. **Integração com Rate Limiting:**
   ```typescript
   // Adicionar interceptor Axios para tratar 429
   axios.interceptors.response.use(
     response => response,
     async error => {
       if (error.response?.status === 429) {
         const retryAfter = error.response.headers['retry-after'];
         // Mostrar notificação ao usuário
         // Aguardar e retry
       }
     }
   );
   ```

2. **React Query para Cache:**
   ```typescript
   // Implementar React Query para cache e sincronização
   const { data } = useQuery('campaigns', fetchCampaigns, {
     staleTime: 5 * 60 * 1000, // 5 minutos
     cacheTime: 10 * 60 * 1000, // 10 minutos
   });
   ```

3. **Validação de Payload:**
   ```typescript
   // Validar tamanho antes de upload
   if (file.size > MAX_UPLOAD_SIZE) {
     showError('Arquivo muito grande');
     return;
   }
   ```

4. **Melhorar Segurança de Tokens:**
   ```typescript
   // Usar httpOnly cookies ou sessionStorage
   // Implementar refresh token automático
   ```

---

## 🎯 Player Cliente - Planejamento por Prioridade

### Prioridades Definidas (Confirmadas):

1. **webOS (LG)** - 🔴 Prioridade ALTA
2. **Android TV** - 🟡 Prioridade MÉDIA
3. **Linux (SBC)** - 🟡 Prioridade MÉDIA (Electron + C++)
4. **Windows** - 🟢 Prioridade BAIXA (Electron)
5. **Tizen (Samsung)** - 🟢 Prioridade BAIXA

### Decisões Tecnológicas Confirmadas:

- ✅ **Windows:** Electron
- ✅ **Linux (SBC - Orange Pi, etc.):** Electron + C++ (ambas versões)
- ✅ **webOS:** JavaScript + webOS TV SDK
- ✅ **Android TV:** Kotlin + Android TV SDK
- ✅ **Tizen:** JavaScript + Tizen TV SDK

---

## 1. webOS (LG Smart TVs) - Prioridade ALTA

### Tecnologias:
- **Linguagem:** JavaScript/HTML5
- **Framework:** webOS TV SDK
- **Plataforma:** webOS 3.0+ (LG Smart TVs)

### Características:
- ✅ Suporte nativo a HTML5/CSS3/JavaScript
- ✅ APIs específicas para controle de TV
- ✅ App Store oficial (LG Content Store)
- ✅ Suporte a hardware decoding de vídeo
- ✅ Controle de brilho/tela via API

### Desafios:
- ⚠️ Certificação necessária para publicação
- ⚠️ SDK específico da LG
- ⚠️ Testes requerem TV real ou emulador oficial

### Estrutura do App:
```
webos-app/
├── app/
│   ├── info.json           # Manifest do app
│   ├── appinfo.json        # Informações do app
│   ├── services/          # Background services
│   └── assets/            # Recursos
├── src/
│   ├── index.html         # Entry point
│   ├── js/
│   │   ├── app.js         # App principal
│   │   ├── api/           # Cliente API
│   │   ├── player/        # Media player
│   │   └── utils/         # Utilitários
│   └── css/
└── config/
    └── appinfo.json       # Configurações
```

### APIs webOS Necessárias:
- `webOS.service.request()` - Comunicação com serviços
- `webOS.key()` - Controle de teclas
- `webOS.platform.tv()` - Informações da TV
- `webOS.service.tvservice` - Controle de TV (brilho, etc.)

### Tempo Estimado: 3-4 semanas

---

## 2. Windows - Prioridade ALTA

### ⚠️ DECISÃO TECNOLÓGICA NECESSÁRIA:

### Opção A: Electron (Recomendado para MVP)
**O que é Electron?**
- Framework que permite criar aplicativos desktop usando tecnologias web (HTML, CSS, JavaScript)
- Usa Chromium (navegador) + Node.js
- Exemplos: VS Code, Discord, Slack, WhatsApp Desktop

**Vantagens:**
- ✅ Desenvolvimento rápido (reutiliza código web)
- ✅ Multiplataforma (Windows, Linux, macOS)
- ✅ Fácil manutenção (uma base de código)
- ✅ Acesso a APIs do Node.js
- ✅ Comunidade grande e documentação extensa
- ✅ Fácil integração com backend existente

**Desvantagens:**
- ❌ Consumo de memória maior (~100-200MB base)
- ❌ Tamanho do executável maior (~100-150MB)
- ❌ Performance ligeiramente inferior a aplicativos nativos
- ❌ Dependência do Chromium (atualizações)

**Quando usar:**
- MVP rápido
- Aplicativos que não precisam de performance extrema
- Quando já existe código web/JavaScript
- Quando precisa de multiplataforma

### Opção B: C++ Nativo
**Vantagens:**
- ✅ Performance máxima
- ✅ Consumo de memória mínimo (~10-20MB)
- ✅ Executável pequeno (~5-10MB)
- ✅ Controle total sobre o sistema
- ✅ Sem dependências externas pesadas

**Desvantagens:**
- ❌ Desenvolvimento mais lento
- ❌ Código mais complexo
- ❌ Manutenção mais difícil
- ❌ Precisa reescrever para cada plataforma
- ❌ Curva de aprendizado maior

**Quando usar:**
- Performance crítica
- Recursos limitados (SBC com pouca RAM)
- Aplicativos que precisam de controle total do hardware
- Quando já existe expertise em C++

### 🎯 DECISÃO CONFIRMADA:

**Para Windows:**
- ✅ **Electron** - Prioridade BAIXA
- Desenvolvimento rápido, fácil manutenção
- Reutiliza código do Linux Electron

**Para Linux (SBC - Orange Pi, Raspberry Pi, etc.):**
- ✅ **Electron** - Versão principal (desenvolvimento rápido)
- ✅ **C++** - Versão otimizada (performance/memória crítica)
- Ambas versões serão desenvolvidas
- Electron para SBCs com mais recursos (Orange Pi 5, Raspberry Pi 4)
- C++ para SBCs com recursos limitados (Orange Pi Zero, Raspberry Pi Zero)

### Estrutura Electron:
```
windows-app/
├── main/                   # Processo principal (Node.js)
│   ├── main.js            # Entry point
│   ├── window.js          # Gerenciamento de janelas
│   └── services/          # Serviços nativos
├── renderer/              # Processo de renderização (Web)
│   ├── index.html
│   ├── src/
│   │   ├── app.js
│   │   ├── api/
│   │   └── player/
│   └── assets/
├── package.json
└── electron-builder.yml   # Build configuration
```

### Estrutura C++ (Qt/QML):
```
windows-app-cpp/
├── src/
│   ├── main.cpp
│   ├── api/               # Cliente HTTP (libcurl)
│   ├── player/            # Media player (QtMultimedia)
│   ├── playlist/          # Gerenciador de playlist
│   └── utils/
├── qml/                   # UI declarativa
│   └── main.qml
├── CMakeLists.txt
└── resources/
```

### Tempo Estimado:
- **Electron:** 2-3 semanas
- **C++ (Qt):** 4-6 semanas

---

## 3. Android TV - Prioridade MÉDIA

### Tecnologias:
- **Linguagem:** Kotlin (recomendado) ou Java
- **Framework:** Android TV SDK
- **Plataforma:** Android 7.0+ (API 24+)

### Características:
- ✅ Suporte nativo a Android
- ✅ Google Play Store
- ✅ Hardware decoding de vídeo
- ✅ Controle via D-pad/remote
- ✅ Leanback UI (interface TV)

### Estrutura:
```
android-app/
├── app/
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/smartsignage/
│   │   │   │   ├── MainActivity.kt
│   │   │   │   ├── api/
│   │   │   │   ├── player/
│   │   │   │   └── services/
│   │   │   ├── res/
│   │   │   └── AndroidManifest.xml
│   │   └── test/
│   └── build.gradle
├── build.gradle
└── settings.gradle
```

### Tempo Estimado: 3-4 semanas

---

## 4. Linux (SBC) - Prioridade MÉDIA

### ⚠️ DECISÃO TECNOLÓGICA:

### Opção 1: Electron (Recomendado se Windows também usar)
- ✅ Mesma base de código do Windows
- ✅ Desenvolvimento mais rápido
- ✅ Fácil manutenção
- ❌ Consumo de memória maior

### Opção 2: C++ Nativo (Recomendado para SBC com pouca RAM)
- ✅ Performance máxima
- ✅ Consumo mínimo de recursos
- ✅ Ideal para Raspberry Pi
- ❌ Desenvolvimento mais lento

### Opção 3: Qt/QML (Boa opção intermediária)
- ✅ C++ com UI declarativa
- ✅ Boa performance
- ✅ Multiplataforma (Linux, Windows, Android)
- ✅ Menor consumo que Electron
- ⚠️ Curva de aprendizado

### 🎯 DECISÃO CONFIRMADA:

**Para Linux SBC (Orange Pi, Raspberry Pi, etc.):**
- ✅ **Electron** - Versão principal para SBCs com RAM >= 1GB
- ✅ **C++** - Versão otimizada para SBCs com RAM < 1GB ou performance crítica
- Ambas versões serão mantidas e desenvolvidas em paralelo

### Estrutura C++ (Linux):
```
linux-app-cpp/
├── src/
│   ├── main.cpp
│   ├── api/               # HTTP client (libcurl)
│   ├── player/            # Media player (GStreamer ou VLC)
│   ├── playlist/
│   └── utils/
├── CMakeLists.txt
└── systemd/
    └── smartsignage.service  # Auto-start
```

### Tempo Estimado:
- **Electron:** 2 semanas (reutiliza código Windows)
- **C++:** 4-5 semanas
- **Qt/QML:** 3-4 semanas

---

## 5. Tizen (Samsung) - Prioridade BAIXA

### Tecnologias:
- **Linguagem:** JavaScript/HTML5
- **Framework:** Tizen TV SDK
- **Plataforma:** Tizen 4.0+ (Samsung Smart TVs)

### Similar ao webOS:
- ✅ HTML5/CSS3/JavaScript
- ✅ APIs específicas para TV
- ✅ Samsung App Store
- ✅ Hardware decoding

### Tempo Estimado: 3-4 semanas

---

## 🏗️ Arquitetura Core Compartilhada

### Componentes Comuns (Independente da Plataforma):

```
core/
├── api/
│   ├── client.ts/js       # Cliente HTTP
│   ├── auth.ts/js         # Autenticação
│   └── endpoints.ts/js    # Endpoints da API
├── playlist/
│   ├── manager.ts/js      # Gerenciador de playlist
│   ├── scheduler.ts/js    # Agerenciamento de horários
│   └── cache.ts/js        # Cache local
├── media/
│   ├── player.ts/js       # Interface do player
│   ├── video.ts/js        # Player de vídeo
│   ├── image.ts/js        # Player de imagem
│   └── html.ts/js         # Player de HTML
├── heartbeat/
│   ├── service.ts/js      # Serviço de heartbeat
│   └── monitor.ts/js      # Monitoramento
└── utils/
    ├── logger.ts/js       # Sistema de logs
    ├── config.ts/js       # Configurações
    └── errors.ts/js       # Tratamento de erros
```

### Estratégia de Compartilhamento:

1. **Para webOS/Tizen (JavaScript):**
   - Core em JavaScript puro
   - Compartilhamento direto de código

2. **Para Electron (Windows/Linux):**
   - Core em TypeScript/JavaScript
   - Compartilhamento direto com webOS/Tizen

3. **Para Android (Kotlin):**
   - Core em Kotlin
   - Lógica similar, mas reimplementada

4. **Para C++ (Linux/Windows):**
   - Core em C++
   - Lógica similar, mas reimplementada

---

## 📊 Comparação de Tecnologias

| Plataforma | Tecnologia | Tempo Dev | Performance | Memória | Complexidade |
|------------|-----------|-----------|-------------|---------|--------------|
| webOS | JavaScript | 3-4 sem | Alta | Média | Média |
| Windows | Electron | 2-3 sem | Média | Alta | Baixa |
| Windows | C++/Qt | 4-6 sem | Alta | Baixa | Alta |
| Android | Kotlin | 3-4 sem | Alta | Média | Média |
| Linux | Electron | 2 sem* | Média | Alta | Baixa |
| Linux | C++ | 4-5 sem | Alta | Baixa | Alta |
| Linux | Qt/QML | 3-4 sem | Alta | Média | Média |
| Tizen | JavaScript | 3-4 sem | Alta | Média | Média |

*Reutiliza código do Windows

---

## 🎯 Estratégia de Desenvolvimento Confirmada

### Ordem de Implementação:

1. **Fase 1: webOS (LG) - ALTA (3-4 semanas)**
   - JavaScript puro + webOS TV SDK
   - Estabelece padrões do core compartilhado
   - Define arquitetura base

2. **Fase 2: Android TV - MÉDIA (3-4 semanas)**
   - Kotlin + Android TV SDK
   - Mercado grande, alta demanda
   - Reutiliza lógica do core (mas reimplementado em Kotlin)

3. **Fase 3: Linux SBC - MÉDIA (4-6 semanas)**
   - **3.1: Electron (3 semanas)**
     - Reutiliza lógica do core webOS
     - Desenvolvimento rápido
     - Para SBCs com RAM >= 1GB (Orange Pi 5, Raspberry Pi 4)
   - **3.2: C++ (3 semanas em paralelo ou sequencial)**
     - Versão otimizada
     - Para SBCs com RAM < 1GB ou performance crítica
     - Orange Pi Zero, Raspberry Pi Zero

4. **Fase 4: Windows - BAIXA (2 semanas)**
   - Electron
   - Reutiliza código do Linux Electron
   - Desenvolvimento rápido (prioridade baixa)

5. **Fase 5: Tizen (Samsung) - BAIXA (3-4 semanas)**
   - JavaScript + Tizen TV SDK
   - Reutiliza muito código do webOS (similaridades)
   - Desenvolvimento mais rápido por causa da experiência com webOS

### ✅ Decisões Confirmadas:

1. **Windows:** Electron (prioridade baixa)
   - ✅ Decisão tomada
   - Reutiliza código do Linux Electron

2. **Linux SBC:** Electron + C++ (ambas versões)
   - ✅ Decisão tomada
   - Electron para SBCs com mais recursos (Orange Pi 5, Raspberry Pi 4, etc.)
   - C++ para SBCs com recursos limitados (Orange Pi Zero, Raspberry Pi Zero, etc.)

3. **Hardware alvo confirmado:**
   - Orange Pi (vários modelos)
   - Raspberry Pi (vários modelos)
   - Outros SBCs compatíveis

---

## 📋 Resumo das Decisões

| Plataforma | Tecnologia | Prioridade | Tempo Estimado | Hardware Alvo |
|------------|-----------|------------|----------------|---------------|
| webOS (LG) | JavaScript + webOS SDK | 🔴 ALTA | 3-4 semanas | LG Smart TVs |
| Android TV | Kotlin + Android TV SDK | 🟡 MÉDIA | 3-4 semanas | Android TV devices |
| Linux SBC | Electron | 🟡 MÉDIA | 3 semanas | Orange Pi 5, RPi 4 (RAM >= 1GB) |
| Linux SBC | C++ | 🟡 MÉDIA | 3 semanas | Orange Pi Zero, RPi Zero (RAM < 1GB) |
| Windows | Electron | 🟢 BAIXA | 2 semanas | Windows 10+ |
| Tizen (Samsung) | JavaScript + Tizen SDK | 🟢 BAIXA | 3-4 semanas | Samsung Smart TVs |

