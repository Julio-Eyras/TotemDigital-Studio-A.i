# Player Cliente - Roadmap de Desenvolvimento

## 🎯 Visão Geral

Desenvolvimento do player cliente para Smart Signage Pro v2.1, seguindo as prioridades e decisões tecnológicas confirmadas.

---

## 📅 Cronograma por Fases

### Fase 1: webOS (LG) - 🔴 ALTA PRIORIDADE
**Duração:** 3-4 semanas  
**Tecnologia:** JavaScript + webOS TV SDK

#### Objetivos:
- ✅ Estabelecer arquitetura core compartilhada
- ✅ Implementar player básico funcional
- ✅ Integrar com backend API
- ✅ Sistema de heartbeat
- ✅ Player de vídeo, imagem e HTML

#### Entregáveis:
- App webOS funcional
- Core JavaScript reutilizável
- Documentação da arquitetura
- Testes em TV real ou emulador

#### Próximos Passos:
- Criar estrutura do projeto
- Configurar ambiente de desenvolvimento webOS
- Implementar API client
- Implementar media player básico

---

### Fase 2: Android TV - 🟡 MÉDIA PRIORIDADE
**Duração:** 3-4 semanas  
**Tecnologia:** Kotlin + Android TV SDK

#### Objetivos:
- ✅ App Android TV funcional
- ✅ Integração com backend
- ✅ Leanback UI (interface TV)
- ✅ Suporte a D-pad/remote

#### Entregáveis:
- APK Android TV funcional
- Core Kotlin (lógica similar ao JavaScript)
- Interface Leanback
- Testes em Android TV real

#### Dependências:
- Fase 1 completa (para referência de arquitetura)

---

### Fase 3: Linux SBC - 🟡 MÉDIA PRIORIDADE
**Duração:** 4-6 semanas (ambas versões)  
**Tecnologias:** Electron + C++

#### 3.1: Electron (3 semanas)
**Hardware Alvo:** Orange Pi 5, Raspberry Pi 4, SBCs com RAM >= 1GB

#### Objetivos:
- ✅ App Electron funcional
- ✅ Modo kiosk (tela cheia)
- ✅ Auto-start (systemd)
- ✅ Reutilizar core JavaScript do webOS

#### Entregáveis:
- App Electron para Linux
- Scripts de instalação
- Service systemd
- Documentação de instalação

#### 3.2: C++ (3 semanas)
**Hardware Alvo:** Orange Pi Zero, Raspberry Pi Zero, SBCs com RAM < 1GB

#### Objetivos:
- ✅ App C++ nativo funcional
- ✅ Performance otimizada
- ✅ Consumo mínimo de recursos
- ✅ Auto-start (systemd)

#### Entregáveis:
- Binário C++ para Linux ARM
- Scripts de instalação
- Service systemd
- Documentação de instalação

#### Dependências:
- Fase 1 completa (para referência de arquitetura)
- Pode ser desenvolvido em paralelo com Electron

---

### Fase 4: Windows - 🟢 BAIXA PRIORIDADE
**Duração:** 2 semanas  
**Tecnologia:** Electron

#### Objetivos:
- ✅ App Electron para Windows
- ✅ Modo kiosk
- ✅ Auto-start (Windows service)
- ✅ Reutilizar código do Linux Electron

#### Entregáveis:
- App Electron para Windows
- Instalador (.exe)
- Windows service
- Documentação de instalação

#### Dependências:
- Fase 3.1 completa (reutiliza código Electron)

---

### Fase 5: Tizen (Samsung) - 🟢 BAIXA PRIORIDADE
**Duração:** 3-4 semanas  
**Tecnologia:** JavaScript + Tizen TV SDK

#### Objetivos:
- ✅ App Tizen funcional
- ✅ Reutilizar código do webOS (similaridades)
- ✅ Integração com backend
- ✅ Testes em TV Samsung

#### Entregáveis:
- App Tizen funcional
- Documentação
- Testes em TV real

#### Dependências:
- Fase 1 completa (reutiliza muito código)

---

## 🏗️ Arquitetura Core Compartilhada

### Estrutura do Projeto:

```
player-client/
├── core/                          # Lógica compartilhada
│   ├── api/                       # Cliente HTTP
│   │   ├── client.js              # Base (webOS/Tizen)
│   │   ├── client.kt              # Android
│   │   └── client.cpp             # C++
│   ├── playlist/                  # Gerenciador de playlist
│   │   ├── manager.js
│   │   ├── manager.kt
│   │   └── manager.cpp
│   ├── scheduler/                 # Agendamento
│   ├── heartbeat/                 # Sistema de heartbeat
│   └── utils/                     # Utilitários
│
├── platforms/
│   ├── webos/                     # Fase 1
│   │   ├── app/
│   │   ├── src/
│   │   └── config/
│   │
│   ├── android/                    # Fase 2
│   │   ├── app/
│   │   └── build.gradle
│   │
│   ├── linux-electron/            # Fase 3.1
│   │   ├── main/
│   │   ├── renderer/
│   │   └── package.json
│   │
│   ├── linux-cpp/                 # Fase 3.2
│   │   ├── src/
│   │   ├── CMakeLists.txt
│   │   └── systemd/
│   │
│   ├── windows-electron/           # Fase 4
│   │   ├── main/
│   │   ├── renderer/
│   │   └── package.json
│   │
│   └── tizen/                      # Fase 5
│       ├── app/
│       └── src/
│
├── shared/                         # Recursos compartilhados
│   ├── assets/
│   └── config/
│
└── docs/                           # Documentação
    ├── architecture.md
    ├── installation/
    └── api/
```

---

## 🔧 Componentes Core Necessários

### 1. API Client
- Autenticação de totem
- Download de playlist
- Download de mídia
- Upload de heartbeat
- Upload de logs

### 2. Playlist Manager
- Parse de playlist JSON
- Cache local
- Validação de mídia
- Ordenação por agendamento

### 3. Media Player
- Vídeo (MP4, WebM)
- Imagem (JPG, PNG, GIF)
- HTML/Web (iframe)
- Transições entre mídias

### 4. Scheduler
- Verificação de horários
- Ativação/desativação de conteúdo
- Timezone handling

### 5. Heartbeat System
- Envio periódico de status
- Reconexão automática
- Tratamento de erros

### 6. Error Handling & Logging
- Logs locais
- Upload de logs ao backend
- Recuperação automática de erros

---

## 📊 Estimativa Total

| Fase | Plataforma | Duração | Prioridade |
|------|-----------|---------|------------|
| 1 | webOS | 3-4 semanas | 🔴 ALTA |
| 2 | Android TV | 3-4 semanas | 🟡 MÉDIA |
| 3.1 | Linux Electron | 3 semanas | 🟡 MÉDIA |
| 3.2 | Linux C++ | 3 semanas | 🟡 MÉDIA |
| 4 | Windows Electron | 2 semanas | 🟢 BAIXA |
| 5 | Tizen | 3-4 semanas | 🟢 BAIXA |
| **Total** | | **17-22 semanas** | |

**Nota:** Fases 3.1 e 3.2 podem ser desenvolvidas em paralelo, reduzindo tempo total.

---

## 🚀 Próximos Passos Imediatos

1. ✅ **Criar estrutura base do projeto**
2. ✅ **Configurar repositório Git**
3. ✅ **Criar documentação de arquitetura**
4. ✅ **Iniciar Fase 1: webOS**

---

## 📝 Notas Importantes

- **Core JavaScript:** Desenvolvido na Fase 1 (webOS), será reutilizado em Tizen e Electron
- **Core Kotlin:** Desenvolvido na Fase 2 (Android), lógica similar mas reimplementada
- **Core C++:** Desenvolvido na Fase 3.2, lógica similar mas reimplementada
- **Compatibilidade:** Todas as versões devem ser compatíveis com a mesma API do backend
- **Testes:** Cada fase deve incluir testes em hardware real quando possível

