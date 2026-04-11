# 🎨 Análise e Proposta: SmartDisplayFX Plus

**Data:** 2025-01-XX  
**Versão:** Plus (Paralela ao player atual)  
**Branch:** `SmartDisplayFX`

---

## 📊 RESUMO EXECUTIVO

O **SmartDisplayFX Plus** será uma versão avançada do player, especializada em:
- **Efeitos visuais fluindo entre totens** em rede estrela
- **Interfaces modernas e interativas** (glassmorphism, neon glow, partículas)
- **IA para direcionamento inteligente** de propagandas
- **Sincronização em tempo real** via WebSocket/MQTT

**Importante:** Esta versão **não substitui** o player atual - ambos evoluem em paralelo.

---

## 🔍 ANÁLISE DA ESTRUTURA ATUAL

### ✅ O que já existe:

#### 1. **Backend (SmartSignage-Pro)**
- ✅ `fxOrchestratorService.ts` - Orquestrador de efeitos FX
- ✅ `fxMessageBridge.ts` - Bridge para MQTT/WebSocket
- ✅ `routes/smartdisplayfx.ts` - Rotas de API
- ✅ Tabelas no ER:
  - `totem_network` - Rede de totens
  - `interaction_logs` - Logs de interações
  - `recognized_persons` - Pessoas reconhecidas
  - `tags` - Tags RFID/NFC/QR
  - `event_logs` - Eventos do sistema

#### 2. **Player Cliente (Base)**
- ✅ `Player-SmartDisplayFX-client/` - Estrutura inicial
- ✅ `core/fx/FxEngine.js` - Engine de efeitos
- ✅ `core/sync/SmartDisplayFlowClient.js` - Cliente de sincronização
- ✅ `prototype/SmartDisplayFX_NeonWarp.html` - Protótipo

#### 3. **Documentação**
- ✅ `ARQUITETURA_SMARTDISPLAYFX.md`
- ✅ `SmartDisplayFX_PROTOCOLO_SMARTDISPLAYFLOW.md`
- ✅ `SmartDisplayFX_OBJETIVOS_E_REQUISITOS.md`

### ❌ O que precisa ser criado/expandido:

#### 1. **Modelo ER - Novas Tabelas Necessárias**

```sql
-- Tabela para armazenar efeitos FX disponíveis
CREATE TABLE IF NOT EXISTS fx_effects (
    effect_id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    effect_type TEXT NOT NULL, -- 'neon_warp', 'ripple_sync', 'liquid_flow', etc.
    description TEXT,
    default_params JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela para regras inteligentes de acionamento
CREATE TABLE IF NOT EXISTS fx_rules (
    rule_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    site_id TEXT, -- Opcional: regra específica de site
    conditions JSONB NOT NULL, -- Condições (idade, humor, tag, etc.)
    actions JSONB NOT NULL, -- Ações (efeito, conteúdo, totens)
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela para timelines FX globais
CREATE TABLE IF NOT EXISTS fx_timelines (
    timeline_id SERIAL PRIMARY KEY,
    site_id TEXT NOT NULL,
    name TEXT,
    version INTEGER DEFAULT 1,
    events JSONB NOT NULL, -- Array de eventos FX
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    starts_at TIMESTAMP,
    ends_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela para telemetria de execução de efeitos
CREATE TABLE IF NOT EXISTS fx_telemetry (
    id SERIAL PRIMARY KEY,
    totem_id INTEGER NOT NULL,
    effect_id TEXT NOT NULL,
    event_id TEXT,
    content_id INTEGER,
    planned_start_ts TIMESTAMP,
    actual_start_ts TIMESTAMP,
    ended_at TIMESTAMP,
    avg_fps DECIMAL(5,2),
    status TEXT, -- 'success', 'failed', 'timeout'
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE CASCADE
);

-- Tabela para configurações de sites/rede estrela
CREATE TABLE IF NOT EXISTS fx_sites (
    site_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    broker_url TEXT, -- URL do broker MQTT local
    broker_type TEXT DEFAULT 'mqtt', -- 'mqtt', 'websocket', 'hybrid'
    sync_interval_ms INTEGER DEFAULT 2000,
    config JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Relação totens com sites FX
CREATE TABLE IF NOT EXISTS fx_totem_sites (
    id SERIAL PRIMARY KEY,
    totem_id INTEGER NOT NULL,
    site_id TEXT NOT NULL,
    role TEXT DEFAULT 'participant', -- 'master', 'participant', 'observer'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (totem_id) REFERENCES totems(totem_id) ON DELETE CASCADE,
    FOREIGN KEY (site_id) REFERENCES fx_sites(site_id) ON DELETE CASCADE,
    UNIQUE(totem_id, site_id)
);
```

#### 2. **Backend - Novos Serviços Necessários**

- ❌ `fxEffectService.ts` - CRUD de efeitos FX
- ❌ `fxRuleService.ts` - CRUD de regras inteligentes
- ❌ `fxTimelineService.ts` - Gerenciamento de timelines
- ❌ `fxSiteService.ts` - Gerenciamento de sites/rede estrela
- ❌ `fxTelemetryService.ts` - Coleta e análise de telemetria
- ⚠️ `fxOrchestratorService.ts` - **Expandir** (já existe, mas precisa melhorias)
- ⚠️ `fxMessageBridge.ts` - **Expandir** (já existe, precisa integração MQTT real)

#### 3. **Backend - Novas Rotas Necessárias**

- ❌ `/api/smartdisplayfx/effects` - CRUD de efeitos
- ❌ `/api/smartdisplayfx/rules` - CRUD de regras
- ❌ `/api/smartdisplayfx/timelines` - Gerenciamento de timelines
- ❌ `/api/smartdisplayfx/sites` - Gerenciamento de sites
- ❌ `/api/smartdisplayfx/telemetry` - Consulta de telemetria
- ⚠️ `/api/smartdisplayfx/*` - **Expandir** rotas existentes

#### 4. **Player Cliente - Componentes Necessários**

- ❌ `SmartDisplayFX-Plus/` - Nova estrutura completa
  - ❌ `core/fx/FxEnginePlus.js` - Engine avançado com WebGL
  - ❌ `core/ai/EdgeAI.js` - IA de borda (MediaPipe/ONNX)
  - ❌ `core/sync/MQTTClient.js` - Cliente MQTT real
  - ❌ `core/sync/WebSocketClient.js` - Cliente WebSocket
  - ❌ `core/ui/ModernUI.js` - Componentes de UI moderna
  - ❌ `effects/` - Catálogo de efeitos:
    - ❌ `NeonWarpFlow.js`
    - ❌ `RippleSyncFlow.js`
    - ❌ `LiquidFlow.js`
    - ❌ `HolographicSwipe.js`
    - ❌ `MatrixDataFlow.js`
    - ❌ `ParticleBurst.js`
  - ❌ `platforms/` - Adaptadores por plataforma:
    - ❌ `webos/`
    - ❌ `tizen/`
    - ❌ `android-tv/`
    - ❌ `electron/`

#### 5. **Infraestrutura**

- ❌ Broker MQTT (Mosquitto/EMQX) com WebSocket
- ❌ Configuração Docker para broker
- ❌ Sistema de sincronização de tempo (NTP sync)

---

## 🎯 ARQUITETURA PROPOSTA

### 1. **Camadas do Sistema**

```
┌─────────────────────────────────────────────────────────┐
│  FRONTEND (Admin)                                        │
│  - Gerenciamento de efeitos, regras, timelines          │
│  - Visualização de telemetria                           │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  BACKEND (SmartSignage-Pro)                             │
│  ┌───────────────────────────────────────────────────┐ │
│  │  API REST (Express)                                │ │
│  │  - /api/smartdisplayfx/effects                    │ │
│  │  - /api/smartdisplayfx/rules                       │ │
│  │  │  - /api/smartdisplayfx/timelines                │ │
│  │  - /api/smartdisplayfx/sites                       │ │
│  └───────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────┐ │
│  │  FX Orchestrator Service                          │ │
│  │  - Processa eventos de IA/interação               │ │
│  │  - Aplica regras inteligentes                     │ │
│  │  - Gera timelines e efeitos                      │ │
│  └───────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────┐ │
│  │  Message Bridge (MQTT/WebSocket)                 │ │
│  │  - Publica timelines e efeitos                   │ │
│  │  - Recebe telemetria dos totens                   │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  BROKER MQTT (Mosquitto/EMQX)                           │
│  - Tópicos: smartdisplay/{site}/{totem}/*              │
│  - WebSocket habilitado                                │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  PLAYER CLIENTE (SmartDisplayFX Plus)                   │
│  ┌───────────────────────────────────────────────────┐ │
│  │  FX Engine (WebGL/Canvas)                         │ │
│  │  - Renderiza efeitos visuais                      │ │
│  │  - Three.js / PixiJS / GSAP                       │ │
│  └───────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────┐ │
│  │  Sync Client (MQTT/WebSocket)                     │ │
│  │  - Recebe timelines e efeitos                    │ │
│  │  - Envia telemetria                              │ │
│  └───────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────┐ │
│  │  Edge AI (MediaPipe/ONNX)                        │ │
│  │  - Detecção de características                   │ │
│  │  - Gera eventos anônimos                         │ │
│  └───────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────┐ │
│  │  Modern UI (HTML5/JS)                            │ │
│  │  - Glassmorphism, neon, partículas               │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 2. **Fluxo de Dados**

```
1. Totem detecta interação/IA
   ↓
2. Envia evento via MQTT/WebSocket
   ↓
3. Backend recebe e processa (FxOrchestrator)
   ↓
4. Aplica regras inteligentes
   ↓
5. Gera efeito/timeline
   ↓
6. Publica via Message Bridge
   ↓
7. Totens recebem e executam sincronizadamente
   ↓
8. Enviam telemetria de volta
```

---

## 📋 PLANO DE IMPLEMENTAÇÃO

### **Fase 1: Fundação (Backend + ER)**

#### 1.1. Atualizar Modelo ER
- [ ] Criar migration para novas tabelas FX
- [ ] Adicionar índices para performance
- [ ] Criar views para consultas complexas

#### 1.2. Criar Serviços Backend
- [ ] `FxEffectService` - CRUD de efeitos
- [ ] `FxRuleService` - CRUD de regras
- [ ] `FxTimelineService` - Gerenciamento de timelines
- [ ] `FxSiteService` - Gerenciamento de sites
- [ ] `FxTelemetryService` - Telemetria
- [ ] Expandir `FxOrchestratorService` - Lógica avançada
- [ ] Expandir `FxMessageBridge` - MQTT real

#### 1.3. Criar Rotas Backend
- [ ] `/api/smartdisplayfx/effects` - CRUD completo
- [ ] `/api/smartdisplayfx/rules` - CRUD completo
- [ ] `/api/smartdisplayfx/timelines` - CRUD completo
- [ ] `/api/smartdisplayfx/sites` - CRUD completo
- [ ] `/api/smartdisplayfx/telemetry` - Consulta e análise
- [ ] Expandir rotas existentes

### **Fase 2: Player Cliente (SmartDisplayFX Plus)**

#### 2.1. Estrutura Base
- [ ] Criar `SmartDisplayFX-Plus/` como projeto separado
- [ ] Configurar build system (Webpack/Vite)
- [ ] Estrutura de módulos ES6

#### 2.2. Core Components
- [ ] `FxEnginePlus.js` - Engine WebGL avançado
- [ ] `MQTTClient.js` - Cliente MQTT completo
- [ ] `WebSocketClient.js` - Cliente WebSocket
- [ ] `TimelineScheduler.js` - Agendador de efeitos
- [ ] `TimeSync.js` - Sincronização de tempo

#### 2.3. Catálogo de Efeitos
- [ ] `NeonWarpFlow.js` - Efeito neon warp
- [ ] `RippleSyncFlow.js` - Efeito ripple sincronizado
- [ ] `LiquidFlow.js` - Efeito líquido
- [ ] `HolographicSwipe.js` - Efeito holográfico
- [ ] `MatrixDataFlow.js` - Efeito matrix
- [ ] `ParticleBurst.js` - Efeito de partículas

#### 2.4. Edge AI
- [ ] `EdgeAI.js` - Wrapper para MediaPipe/ONNX
- [ ] Detecção de características
- [ ] Geração de eventos anônimos

#### 2.5. Modern UI
- [ ] Componentes glassmorphism
- [ ] Efeitos neon glow
- [ ] Sistema de partículas
- [ ] HUD futurista

### **Fase 3: Integração e Sincronização**

#### 3.1. Broker MQTT
- [ ] Configurar Mosquitto/EMQX
- [ ] Habilitar WebSocket
- [ ] Configurar autenticação
- [ ] Docker compose para broker

#### 3.2. Sincronização
- [ ] Implementar time sync (NTP)
- [ ] Timeline scheduler com start_ts
- [ ] Compensação de latência

#### 3.3. Integração com Backend
- [ ] Conectar Message Bridge ao broker real
- [ ] Integrar com serviços existentes
- [ ] Testes end-to-end

### **Fase 4: Plataformas**

#### 4.1. WebOS
- [ ] Adaptador para webOS
- [ ] Testes em TV real
- [ ] Otimizações específicas

#### 4.2. Tizen
- [ ] Adaptador para Tizen
- [ ] Testes em TV Samsung
- [ ] Otimizações específicas

#### 4.3. Android TV
- [ ] Adaptador para Android TV
- [ ] WebView/Chromium
- [ ] Testes em TV Android

#### 4.4. Electron (Linux/Windows)
- [ ] Adaptador Electron
- [ ] Testes em SBCs
- [ ] Otimizações de performance

---

## 🔧 DECISÕES TÉCNICAS A TOMAR

### 1. **Arquitetura de Mensageria**

**Opção A: MQTT over WebSocket (Recomendado)**
- ✅ Padrão da indústria
- ✅ Suporte nativo em TVs
- ✅ Broker dedicado (Mosquitto/EMQX)
- ❌ Requer infraestrutura adicional

**Opção B: WebSocket Puro**
- ✅ Mais simples
- ✅ Controle total
- ❌ Precisa implementar pub/sub próprio
- ❌ Mais trabalho de infraestrutura

**Opção C: Híbrido (MQTT + WebSocket fallback)**
- ✅ Melhor dos dois mundos
- ✅ Funciona offline com broker local
- ❌ Mais complexo

**Recomendação:** Opção C (Híbrido)

### 2. **Bibliotecas de Efeitos Visuais**

**Opção A: Three.js**
- ✅ 3D completo
- ✅ Shaders avançados
- ❌ Mais pesado
- ❌ Pode ser overkill para 2D

**Opção B: PixiJS**
- ✅ 2D performático
- ✅ WebGL otimizado
- ✅ Mais leve que Three.js
- ✅ Ideal para partículas

**Opção C: GSAP + Canvas**
- ✅ Animações suaves
- ✅ Timeline poderosa
- ❌ Sem WebGL nativo

**Recomendação:** Opção B (PixiJS) + GSAP para timelines

### 3. **IA de Borda**

**Opção A: MediaPipe Tasks Vision**
- ✅ Leve e rápido
- ✅ Suporta WebAssembly
- ✅ Bom para gestos e faces

**Opção B: ONNX Runtime Web**
- ✅ Modelos customizados
- ✅ Flexível
- ❌ Mais complexo

**Opção C: TensorFlow.js Lite**
- ✅ Familiar
- ✅ Boa documentação
- ❌ Pode ser mais pesado

**Recomendação:** Opção A (MediaPipe) para começar

### 4. **Estrutura de Projeto**

```
SmartSignage-Pro/
├── backend/                    # Backend atual (continua)
├── frontend/                   # Frontend atual (continua)
├── player/                     # Player atual (continua)
├── SmartDisplayFX-Plus/       # NOVO - Player FX Plus
│   ├── src/
│   │   ├── core/
│   │   │   ├── fx/
│   │   │   ├── sync/
│   │   │   ├── ai/
│   │   │   └── ui/
│   │   ├── effects/
│   │   ├── platforms/
│   │   └── utils/
│   ├── dist/
│   ├── package.json
│   └── README.md
└── docker/
    └── mosquitto/              # NOVO - Broker MQTT
```

---

## 📊 COMPARAÇÃO: Player Atual vs SmartDisplayFX Plus

| Aspecto | Player Atual | SmartDisplayFX Plus |
|--------|-------------|---------------------|
| **Foco** | Reprodução de playlists | Efeitos visuais e interatividade |
| **Tecnologia** | HTML5 básico | WebGL, Canvas avançado, GSAP |
| **Sincronização** | Independente | Sincronizado entre totens |
| **IA** | Não | Sim (edge + backend) |
| **Efeitos** | Transições simples | Catálogo completo de efeitos |
| **Rede** | Individual | Rede estrela coordenada |
| **Mensageria** | REST API | MQTT/WebSocket real-time |
| **UI** | Funcional | Moderna e futurista |

---

## 🚀 PRÓXIMOS PASSOS IMEDIATOS

1. **Criar branch `SmartDisplayFX`**
   ```bash
   git checkout -b SmartDisplayFX
   ```

2. **Criar estrutura de diretórios**
   - `SmartDisplayFX-Plus/`
   - `database/migrations/fx-tables.sql`

3. **Começar pela Fase 1:**
   - Migration das tabelas FX
   - Serviços básicos (FxEffectService, FxRuleService)
   - Rotas CRUD básicas

4. **Prototipar efeito visual:**
   - Expandir `SmartDisplayFX_NeonWarp.html`
   - Integrar com PixiJS/GSAP
   - Testar sincronização básica

---

## ❓ DÚVIDAS PARA ESCLARECER

1. **Prioridade:** Qual fase começar primeiro?
   - Backend (tabelas + serviços)?
   - Player cliente (efeitos visuais)?
   - Ambos em paralelo?

2. **Broker MQTT:** Prefere Mosquitto ou EMQX?
   - Mosquitto: mais leve, simples
   - EMQX: mais recursos, dashboard

3. **Efeitos iniciais:** Quais efeitos implementar primeiro?
   - Neon Warp Flow (já tem protótipo)
   - Ripple Sync Flow
   - Outro?

4. **Plataformas:** Qual plataforma priorizar?
   - WebOS
   - Tizen
   - Android TV
   - Todas em paralelo?

5. **IA:** Começar com IA de borda ou focar nos efeitos primeiro?

---

## 📝 CONCLUSÃO

O SmartDisplayFX Plus é uma evolução natural do sistema, adicionando:
- ✅ Experiência visual premium
- ✅ Sincronização entre totens
- ✅ Direcionamento inteligente via IA
- ✅ Interfaces modernas e interativas

**Recomendação:** Começar pela **Fase 1 (Backend + ER)** para estabelecer a fundação, depois partir para o player cliente.

---

**Pronto para começar?** 🚀

