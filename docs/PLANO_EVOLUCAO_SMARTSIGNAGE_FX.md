# 🚀 Plano de Evolução - SmartSignage Pro + SmartDisplayFX

**Continuidade e Próximos Passos do Projeto**  
*Roadmap Detalhado para Completar a Implementação FX*

---

## 📊 Status Atual (Resumo)

| Componente | Status | Próximo Passo Crítico |
|------------|--------|----------------------|
| Backend Core | ✅ 95% | Manutenção e otimizações |
| Frontend Admin | ✅ 95% | Melhorias de UX |
| SmartDisplayFX Backend | ✅ 80% | Completar geração de timeline |
| SmartDisplayFX Client | ✅ 90% | **Testes em hardware real** |
| Player Base | ✅ 85% | **Testes e validação** |
| Builds Plataforma | ✅ 95% | **Testes em hardware real** |

---

## 🎯 Fase 3: SmartDisplayFX Client (PRIORIDADE ALTA)

### Objetivo
Completar a integração do SmartDisplayFX nos players, removendo o mock LocalStorage e implementando MQTT real.

### Tarefas Detalhadas

#### 3.1. Integração MQTT Real no SmartDisplayFlowClient

**Arquivo**: `player-client/shared/smartdisplayfx/core/sync/SmartDisplayFlowClient.js`

**Ações**:
1. Remover `LocalStorageTransport` como padrão
2. Implementar detecção automática de ambiente (browser vs Node.js)
3. Configurar `MqttTransport` como padrão quando MQTT disponível
4. Adicionar fallback gracioso (log-only quando MQTT indisponível)

**Código base**:
```javascript
// Detectar transporte disponível
function getDefaultTransport() {
  // 1. Tentar MQTT (se disponível)
  if (typeof window !== 'undefined' && window.mqtt) {
    return new MqttTransport();
  }
  
  // 2. Fallback: WebSocket (se disponível)
  if (typeof WebSocket !== 'undefined') {
    return new WebSocketTransport();
  }
  
  // 3. Último fallback: Log-only (desenvolvimento)
  console.warn('SmartDisplayFX: MQTT/WebSocket não disponível, usando modo log-only');
  return new LogOnlyTransport();
}
```

**Estimativa**: 2-3 dias

#### 3.2. Incluir MQTT Client nos Builds

**Plataformas**:
- **Web (HTML5)**: Incluir via CDN ou bundle
- **webOS**: Incluir via `index.html`
- **Tizen**: Incluir via `index.html`
- **Android TV**: Usar Paho MQTT Android
- **Windows/Linux Electron**: Incluir via `package.json`

**Ações**:
1. Adicionar script MQTT no `index.html` de cada plataforma
2. Configurar variáveis de ambiente para broker URL
3. Testar conexão em cada plataforma

**Estimativa**: 3-4 dias

#### 3.3. Integrar FxEngine nos Players

**Arquivo**: `player-client/core/fx/FxEngine.js`

**Ações**:
1. Inicializar FxEngine no player principal
2. Conectar FxEngine ao SmartDisplayFlowClient
3. Implementar handlers para `effect_transfer` e `timeline_update`
4. Integrar com sistema de renderização do player

**Código base**:
```javascript
// No player principal
import { FxEngine } from './core/fx/FxEngine.js';
import { SmartDisplayFlowClient } from './shared/smartdisplayfx/core/sync/SmartDisplayFlowClient.js';

class Player {
  constructor() {
    // Inicializar FX
    this.fxClient = new SmartDisplayFlowClient({
      siteId: this.config.siteId,
      totemId: this.config.totemId,
      brokerUrl: this.config.brokerUrl
    });
    
    this.fxEngine = new FxEngine({
      canvas: this.canvas,
      client: this.fxClient
    });
    
    // Conectar handlers
    this.fxClient.on('effect_transfer', (msg) => {
      this.fxEngine.executeEffect(msg);
    });
    
    this.fxClient.on('timeline_update', (msg) => {
      this.fxEngine.scheduleTimeline(msg);
    });
  }
}
```

**Estimativa**: 4-5 dias

#### 3.4. Conectar PlayerBridge

**Arquivo**: `player-client/shared/smartdisplayfx/core/bridge/PlayerBridge.js`

**Ações**:
1. Conectar PlayerBridge ao player principal
2. Implementar métodos de controle remoto via FX
3. Sincronizar estado entre player e FX

**Estimativa**: 2-3 dias

**Total Fase 3**: 11-15 dias úteis

---

## 🏗️ Fase 4: Builds por Plataforma (PRIORIDADE ALTA)

### Objetivo
Completar scripts de build para todas as plataformas, incluindo SmartDisplayFX.

### Tarefas por Plataforma

#### 4.1. webOS (LG)

**Arquivo**: `player-client/platforms/webos/build.sh`

**Ações**:
1. Incluir SmartDisplayFX no bundle
2. Incluir MQTT client (via CDN ou bundle)
3. Configurar `appinfo.json` com permissões de rede
4. Testar build em TV real

**Script atualizado**:
```bash
#!/bin/bash
# Incluir SmartDisplayFX
cp -r ../../shared/smartdisplayfx ./app/smartdisplayfx

# Incluir MQTT (via CDN no index.html ou bundle)
# Adicionar ao index.html: <script src="https://unpkg.com/mqtt/dist/mqtt.min.js"></script>

# Build
ares-package app -o dist/
```

**Estimativa**: 2-3 dias

#### 4.2. Tizen (Samsung)

**Arquivo**: `player-client/platforms/tizen/build.sh`

**Ações**:
1. Incluir SmartDisplayFX no bundle
2. Incluir MQTT client
3. Configurar `config.xml` com permissões
4. Testar build em TV real

**Estimativa**: 2-3 dias

#### 4.3. Android TV

**Arquivo**: `player-client/platforms/android/build.gradle`

**Ações**:
1. Adicionar dependência Paho MQTT Android
2. Incluir SmartDisplayFX no WebView
3. Configurar permissões de rede no `AndroidManifest.xml`
4. Testar em Android TV box

**Dependência**:
```gradle
dependencies {
    implementation 'org.eclipse.paho:org.eclipse.paho.client.mqttv3:1.2.5'
}
```

**Estimativa**: 3-4 dias

#### 4.4. Windows/Linux Electron

**Arquivo**: `player-client/platforms/windows-electron/package.json`

**Ações**:
1. Adicionar dependência `mqtt` no `package.json`
2. Incluir SmartDisplayFX no bundle
3. Configurar build para produção
4. Testar em Windows/Linux

**Dependência**:
```json
{
  "dependencies": {
    "mqtt": "^5.14.1"
  }
}
```

**Estimativa**: 2-3 dias

**Total Fase 4**: 9-13 dias úteis

---

## 🔧 Fase 5: Melhorias Backend (PRIORIDADE MÉDIA)

### 5.1. Completar Geração de Timeline

**Arquivo**: `backend/src/services/fxOrchestratorService.ts`

**Ações**:
1. Implementar lógica real de geração de timeline
2. Considerar campanhas ativas
3. Considerar horários e segmentação
4. Otimizar sequência de eventos

**Código base**:
```typescript
async generateTimeline(siteId: string): Promise<FxTimeline> {
  // 1. Buscar campanhas ativas do site
  const campaigns = await this.campaignService.getActiveCampaignsForSite(siteId);
  
  // 2. Buscar totens do site
  const totems = await this.siteService.getTotemsForSite(siteId);
  
  // 3. Gerar sequência de eventos baseada em:
  //    - Campanhas ativas
  //    - Horários
  //    - Segmentação
  //    - Regras FX
  
  const events: FxTimelineEvent[] = [];
  
  // Lógica de geração...
  
  return {
    siteId,
    timelineId: `tl_${Date.now()}`,
    version: 1,
    generatedAt: new Date().toISOString(),
    events
  };
}
```

**Estimativa**: 3-4 dias

### 5.2. Adicionar Metadata JSONB na Tabela Tags

**Arquivo**: `database/migrations/add_tags_metadata.sql`

**Ações**:
1. Criar migration para adicionar campo `metadata JSONB`
2. Atualizar `tagService` para usar metadata
3. Atualizar API para suportar metadata

**SQL**:
```sql
ALTER TABLE tags ADD COLUMN metadata JSONB DEFAULT '{}';
CREATE INDEX idx_tags_metadata ON tags USING GIN (metadata);
```

**Estimativa**: 1-2 dias

**Total Fase 5**: 4-6 dias úteis

---

## 🎨 Fase 6: Melhorias Frontend (PRIORIDADE MÉDIA)

### 6.1. Dashboard de Rede Estrela

**Arquivo**: `frontend/src/pages/SmartDisplayFx/SmartDisplayFx.tsx`

**Ações**:
1. Criar visualização gráfica da rede estrela
2. Mostrar totens e suas conexões
3. Exibir status em tempo real
4. Permitir interação (adicionar/remover totens)

**Biblioteca sugerida**: D3.js ou vis.js

**Estimativa**: 5-7 dias

### 6.2. Analytics Avançado de FX

**Ações**:
1. Criar dashboard de métricas FX
2. Gráficos de execução de efeitos
3. Análise de performance
4. Relatórios exportáveis

**Estimativa**: 4-5 dias

**Total Fase 6**: 9-12 dias úteis

---

## 🧪 Fase 7: Testes e Validação (PRIORIDADE ALTA)

### 7.1. Testes em Hardware Real

**Plataformas**:
- [ ] webOS (LG Smart TV)
- [ ] Tizen (Samsung Smart TV)
- [ ] Android TV (TV Box)
- [ ] Windows (PC)
- [ ] Linux (Raspberry Pi)

**Checklist por plataforma**:
- [ ] Conexão MQTT funciona
- [ ] Efeitos FX executam corretamente
- [ ] Sincronização de timeline funciona
- [ ] Telemetria é enviada
- [ ] Performance aceitável (60 FPS)

**Estimativa**: 5-7 dias

### 7.2. Testes Automatizados

**Ações**:
1. Criar testes unitários para FxEngine
2. Criar testes de integração para SmartDisplayFlowClient
3. Criar testes E2E para fluxo completo
4. Configurar CI/CD

**Estimativa**: 4-5 dias

**Total Fase 7**: 9-12 dias úteis

---

## 📅 Cronograma Consolidado

### Q1 2025 (Janeiro - Março)

**Semanas 1-3**: Fase 3 - SmartDisplayFX Client
- Integração MQTT real
- Integração FxEngine
- Conectar PlayerBridge

**Semanas 4-6**: Fase 4 - Builds por Plataforma
- webOS e Tizen
- Android TV
- Windows/Linux Electron

**Semanas 7-8**: Fase 7 - Testes
- Testes em hardware real
- Correções e ajustes

### Q2 2025 (Abril - Junho)

**Semanas 1-2**: Fase 5 - Melhorias Backend
- Completar geração de timeline
- Adicionar metadata em tags

**Semanas 3-5**: Fase 6 - Melhorias Frontend
- Dashboard de rede estrela
- Analytics avançado

**Semanas 6-8**: Fase 7 - Testes Finais
- Testes automatizados
- Validação completa
- Documentação final

---

## 🎯 Métricas de Sucesso

### Critérios de Conclusão

#### Fase 3 (SmartDisplayFX Client)
- [ ] MQTT real funcionando (sem LocalStorage mock)
- [ ] FxEngine integrado e executando efeitos
- [ ] PlayerBridge conectado
- [ ] Testes básicos passando

#### Fase 4 (Builds)
- [ ] Builds funcionando para todas as plataformas
- [ ] SmartDisplayFX incluído em todos os builds
- [ ] MQTT configurado em todas as plataformas
- [ ] Documentação de build atualizada

#### Fase 5 (Backend)
- [ ] Geração de timeline implementada
- [ ] Metadata em tags funcionando
- [ ] Testes unitários passando

#### Fase 6 (Frontend)
- [ ] Dashboard de rede estrela funcional
- [ ] Analytics avançado implementado
- [ ] Interface responsiva e intuitiva

#### Fase 7 (Testes)
- [ ] Testes em hardware real bem-sucedidos
- [ ] Testes automatizados com cobertura > 70%
- [ ] Performance aceitável em todas as plataformas

---

## 🚨 Riscos e Mitigações

### Riscos Identificados

#### 1. Compatibilidade MQTT entre Plataformas
**Risco**: MQTT pode não funcionar igual em todas as plataformas  
**Mitigação**: 
- Usar bibliotecas testadas (Paho MQTT, mqtt.js)
- Implementar fallback WebSocket
- Testar em cada plataforma cedo

#### 2. Performance de Efeitos FX
**Risco**: Efeitos podem ser pesados em hardware limitado  
**Mitigação**:
- Otimizar efeitos (WebGL quando possível)
- Implementar detecção de performance
- Permitir desabilitar FX em hardware fraco

#### 3. Sincronização de Timeline
**Risco**: Drift de tempo entre totens  
**Mitigação**:
- Implementar sincronização NTP
- Usar timestamps relativos quando possível
- Tolerância configurável

#### 4. Complexidade de Builds
**Risco**: Builds podem ser complexos e propensos a erros  
**Mitigação**:
- Automatizar ao máximo
- Documentar cada passo
- CI/CD para validação

---

## 📚 Documentação Necessária

### Documentos a Criar/Atualizar

1. **Guia de Integração SmartDisplayFX**
   - Como integrar FX em um player novo
   - Configuração de MQTT
   - Exemplos de código

2. **Guia de Build por Plataforma**
   - Passo a passo para cada plataforma
   - Troubleshooting comum
   - Requisitos de hardware

3. **API Reference SmartDisplayFX**
   - Documentação completa da API
   - Exemplos de uso
   - Changelog

4. **Guia de Testes**
   - Como testar em cada plataforma
   - Checklist de validação
   - Relatórios de teste

---

## 💡 Próximos Passos Imediatos

### Esta Semana

1. **Dia 1-2**: Integrar MQTT real no SmartDisplayFlowClient
   - Remover LocalStorage mock
   - Implementar MqttTransport como padrão
   - Testar em browser

2. **Dia 3-4**: Incluir MQTT nos builds webOS/Tizen
   - Adicionar script MQTT no index.html
   - Configurar variáveis de ambiente
   - Testar build

3. **Dia 5**: Integrar FxEngine no player base
   - Conectar FxEngine ao SmartDisplayFlowClient
   - Implementar handlers básicos
   - Testar execução de efeitos

### Próxima Semana

1. Completar integração FxEngine
2. Conectar PlayerBridge
3. Iniciar builds Android TV
4. Testes iniciais em hardware

---

## 📞 Recursos Necessários

### Equipe
- **1 Desenvolvedor Backend**: Melhorias backend (Fase 5)
- **1 Desenvolvedor Frontend**: Melhorias frontend (Fase 6)
- **1 Desenvolvedor Full-Stack**: Integração FX (Fase 3-4)
- **1 QA/Tester**: Testes e validação (Fase 7)

### Hardware para Testes
- LG Smart TV (webOS)
- Samsung Smart TV (Tizen)
- Android TV Box
- Raspberry Pi (Linux)
- PC Windows

### Infraestrutura
- Broker MQTT (Mosquitto ou EMQX)
- Ambiente de testes isolado
- CI/CD pipeline

---

**Documento criado em**: 2025-01-15  
**Versão**: 1.0  
**Status**: ✅ Plano Ativo

**Próxima Revisão**: Semanal durante execução

