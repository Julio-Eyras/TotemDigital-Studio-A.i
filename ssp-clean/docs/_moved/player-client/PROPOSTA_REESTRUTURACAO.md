# 📋 Proposta de Reestruturação - Players Base/Pro

## 🎯 Objetivo

Organizar todos os players em duas versões claras:
- **BASE**: Versões HLS minimalistas (simples, focadas em streaming HLS)
- **PRO**: Versões completas (com SmartDisplayFX, playlists avançadas, cache, etc.)

---

## 📊 Estrutura Proposta

```
player-client/
├── base/                           # VERSÕES BASE (HLS Minimalista)
│   ├── android/
│   │   └── SmartSignage-ANDROID-PLAYER-HLS/
│   ├── tizen/
│   │   └── SmartSignage-TIZEN-PLAYER-HLS/
│   ├── webos/
│   │   └── SmartSignage-LG-PLAYER-HLS/
│   ├── linux-electron/
│   ├── windows-electron/
│   └── linux-cpp/
│
├── pro/                            # VERSÕES PRO (Completo com SmartDisplayFX)
│   ├── android/
│   │   └── SmartSignage-ANDROID-PLAYER/
│   ├── tizen/
│   │   └── SmartSignage-TIZEN-PLAYER/
│   └── webos/
│       └── SmartSignage-LG-PLAYER/
│
├── shared/                         # RECURSOS COMPARTILHADOS
│   ├── smartdisplayfx/            # Efeitos visuais (usado apenas em PRO)
│   │   ├── FxEngine.js
│   │   ├── SmartDisplayFlowClient.js
│   │   ├── PlayerBridge.js
│   │   ├── ParticleSystem.js
│   │   ├── FxUtils.js
│   │   ├── config.js
│   │   ├── mqtt-wrapper.js
│   │   └── README.md
│   │
│   ├── core/                      # Código comum (usado apenas em PRO)
│   │   ├── api/
│   │   ├── cache/
│   │   ├── heartbeat/
│   │   ├── playlist/
│   │   ├── scheduler/
│   │   ├── services/
│   │   └── utils/
│   │
│   └── assets/                    # Assets compartilhados
│
└── docs/                           # DOCUMENTAÇÃO CONSOLIDADA
    ├── base/                      # Docs específicas BASE
    │   ├── HLS_SUPORTE_PLATAFORMAS.md
    │   ├── ESTRATEGIA_HLS.md
    │   └── BUILD_INSTALL_BASE.md
    │
    ├── pro/                       # Docs específicas PRO
    │   ├── SMARTDISPLAYFX.md
    │   ├── ARQUITETURA_PRO.md
    │   └── BUILD_INSTALL_PRO.md
    │
    └── common/                    # Docs comuns
        ├── README.md
        ├── ARQUITETURA_GERAL.md
        └── COMPARACAO_BASE_PRO.md
```

---

## 🔄 Mapeamento de Mudanças

### Estrutura Atual → Nova Estrutura

| **ATUAL** | **NOVO** | **Tipo** |
|-----------|----------|----------|
| `platforms/android/SmartSignage-ANDROID-PLAYER-HLS/` | `base/android/SmartSignage-ANDROID-PLAYER-HLS/` | BASE |
| `platforms/android/SmartSignage-ANDROID-PLAYER/` | `pro/android/SmartSignage-ANDROID-PLAYER/` | PRO |
| `platforms/tizen/SmartSignage-TIZEN-PLAYER-HLS/` | `base/tizen/SmartSignage-TIZEN-PLAYER-HLS/` | BASE |
| `platforms/tizen/SmartSignage-TIZEN-PLAYER/` | `pro/tizen/SmartSignage-TIZEN-PLAYER/` | PRO |
| `platforms/webos/SmartSignage-LG-PLAYER-HLS/` | `base/webos/SmartSignage-LG-PLAYER-HLS/` | BASE |
| `platforms/webos/SmartSignage-LG-PLAYER/` | `pro/webos/SmartSignage-LG-PLAYER/` | PRO |
| `platforms/linux-electron/` | `base/linux-electron/` | BASE |
| `platforms/windows-electron/` | `base/windows-electron/` | BASE |
| `platforms/linux-cpp/` | `base/linux-cpp/` | BASE |
| `shared/smartdisplayfx/` | `shared/smartdisplayfx/` | ✅ Mantém (sem mudança) |
| `shared/core/` | `shared/core/` | ✅ Mantém (sem mudança) |
| `docs/` | `docs/` (reorganizado) | Reorganizado |

---

## 📁 Detalhamento por Categoria

### BASE (HLS Minimalista)

**Características:**
- ✅ HLS nativo apenas
- ✅ Hardware decoding
- ✅ CPU baixíssimo (< 10-15%)
- ✅ 24/7 operação
- ✅ Auto-registro (UIN)
- ✅ Fallback offline
- ✅ HTTP Polling
- ✅ Heartbeat

**Estrutura típica:**
```
base/{platform}/SmartSignage-{PLATFORM}-PLAYER-HLS/
├── {manifest files}           # appinfo.json, config.xml, etc.
├── index.html                 # Entry point
├── styles.css                 # CSS minimal
├── js/                        # JavaScript puro
│   ├── device-info.js
│   ├── hls-player.js
│   ├── command-fetcher.js
│   ├── heartbeat-service.js
│   ├── fallback-manager.js
│   └── app.js
├── config/
│   └── config.example.json
├── scripts/                   # Build/deploy scripts
├── test/                      # Testes
└── README.md
```

---

### PRO (Versão Completa)

**Características:**
- ✅ Tudo do BASE +
- ✅ SmartDisplayFX (efeitos visuais)
- ✅ PlaylistManager avançado
- ✅ Cache local
- ✅ Scheduler
- ✅ Serviços interativos (Facial Recognition, Tag Reader, etc.)
- ✅ InterruptionManager
- ✅ Integração MQTT

**Estrutura típica:**
```
pro/{platform}/SmartSignage-{PLATFORM}-PLAYER/
├── {manifest files}
├── src/                        # Código fonte
│   ├── index.html
│   ├── js/
│   │   ├── app.js
│   │   ├── api/
│   │   ├── player/
│   │   ├── playlist/
│   │   └── utils/
│   └── css/
├── assets/                     # Assets (inclui smartdisplayfx se necessário)
├── config/
├── scripts/
└── README.md
```

**Para Android:**
```
pro/android/SmartSignage-ANDROID-PLAYER/
├── app/
│   ├── build.gradle
│   └── src/main/
│       ├── java/com/smartsignage/player/
│       ├── assets/smartdisplayfx/    # Copiado de shared/
│       └── res/
└── README.md
```

---

## 🔗 Paths que Serão Atualizados

### Scripts de Build

**Atual:**
- `platforms/webos/SmartSignage-LG-PLAYER-HLS/scripts/build.sh`
- `platforms/android/SmartSignage-ANDROID-PLAYER/build.gradle`

**Novo:**
- `base/webos/SmartSignage-LG-PLAYER-HLS/scripts/build.sh`
- `pro/android/SmartSignage-ANDROID-PLAYER/app/build.gradle`

### Referências em Código

**HTML/JS (BASE):**
- `<script src="js/...">` → ✅ Mantém (paths relativos)
- Referências a `../shared/` → Atualizar para `../../shared/`

**Kotlin/Android (PRO):**
- `import com.smartsignage.player.*` → ✅ Mantém (package interno)
- Assets: `assets/smartdisplayfx/` → ✅ Mantém (cópia local)

**Build Scripts:**
- Referências a `../platforms/` → Atualizar para `../base/` ou `../pro/`
- Referências a `../../shared/` → Atualizar paths relativos

### Documentação

- Todos os links internos entre docs
- READMEs que referenciam outras plataformas
- Scripts de build que referenciam paths

---

## 📝 Arquivos que Serão Modificados

### Scripts
1. `base/*/scripts/*.sh` - Atualizar paths relativos
2. `base/*/scripts/*.bat` - Atualizar paths relativos
3. `pro/*/scripts/*.sh` - Atualizar paths relativos
4. `pro/*/build.sh` - Atualizar paths relativos
5. `pro/android/*/build.gradle` - Verificar paths de assets

### Código Fonte
6. HTML files que importam de `../shared/` → Atualizar para `../../shared/`
7. JavaScript que referencia `shared/` → Atualizar paths
8. Kotlin/Java que referencia assets → Verificar paths

### Documentação
9. Todos os README.md
10. Docs em `docs/` que referenciam `platforms/`
11. Links entre documentos

---

## ✅ Checklist de Validação

Após a reestruturação, validar:

- [ ] Todos os scripts de build funcionam
- [ ] Paths relativos corrigidos em todos os arquivos
- [ ] Referências a `shared/` funcionam corretamente
- [ ] Documentação atualizada com novos paths
- [ ] READMEs atualizados
- [ ] Links entre docs funcionando
- [ ] Testes ainda passam (se existirem)
- [ ] Builds geram corretamente

---

## 🚀 Plano de Execução

1. **Fase 1: Criar nova estrutura**
   - Criar diretórios `base/` e `pro/`
   - Mover arquivos para novos locais

2. **Fase 2: Atualizar paths**
   - Scripts de build
   - Código fonte (HTML/JS/Kotlin)
   - Referências em documentação

3. **Fase 3: Validar**
   - Testar builds
   - Validar paths
   - Verificar documentação

4. **Fase 4: Limpar**
   - Remover diretório `platforms/` antigo (após validação)

---

## ❓ Decisões Pendentes

1. **Electron e Linux-CPP**: Devem ficar apenas em BASE ou também ter versão PRO?
   - **Sugestão**: Apenas BASE por enquanto (podem evoluir depois)

2. **shared/core**: Usado apenas em PRO ou também em BASE?
   - **Análise**: BASE tem código próprio, PRO usa core compartilhado
   - **Sugestão**: Manter core apenas para PRO (BASE é independente)

3. **docs/**: Como organizar melhor?
   - **Sugestão**: Separar em `base/`, `pro/`, `common/` como proposto

---

## 📌 Próximos Passos

**AGUARDANDO APROVAÇÃO** para:
1. ✅ Executar reestruturação completa
2. ✅ Atualizar todos os paths
3. ✅ Validar tudo funcionando
4. ✅ Documentar mudanças

---

**Data da Proposta:** 2025-12-19
**Status:** ⏳ Aguardando Aprovação

