# Plano: Player Web = Player-AD (versão browser) + Visual TotemDigital

**Data:** 2026-07-21  
**Branch:** `SmartSignage-direc-totem`  
**Estado:** planeamento — sem implementação neste documento  
**Repositório:** TotemDigital / SmartSignage Pro

---

## 1. Objetivo

Retomar o `player-web` (hoje desatualizado face ao Player-AD) e evoluí-lo até ser a **versão web equivalente ao Player-AD**, já preparada para integrar o **visual novo** (Amarelo Petróleo / biblioteca visual TotemDigital.BV).

O player web deve:

1. Usar o **mesmo contrato** de API do Player-AD (`/api/player/*`).
2. Reproduzir o **mesmo DispatchPlan**.
3. Executar **comandos remotos** relevantes no browser.
4. Apresentar identidade **TotemDigital / Amarelo Petróleo**.
5. Correr em Chromium kiosk, Electron ou URL directa — **sem** o Express standalone do BV.

---

## 2. Estado atual

| Peça | Situação |
|------|----------|
| `player-web/` | Player V3x oficial (JS vanilla), servido em `/player` |
| Fluxo | token → heartbeat → DispatchPlan → cache IndexedDB → playback |
| Versão tipica | 2.2.0 (`browser-cache`) |
| Lacunas vs AD | Comandos remotos só enfileiram (não executam); sem config remota completa; sem screenshot; sem OTA; sem rotação de conteúdo 9:16; visual genérico |
| `Visual.Interface/TotemDigital.BV` | Mini CMS + player isolado (JSON local) — protótipo visual, não player de produção |
| `electron-player/` | Shell que só abre URL — reutilizável depois |
| Player-AD (Android) | Referência de paridade (ExoPlayer, remote commands, config, OTA) |

**Conclusão:** não recomeçar do zero. Evoluir `player-web` e usar BV apenas como **skin / estados de ecrã** (e, opcionalmente, fonte de boards HTML no futuro).

---

## 3. Arquitetura alvo

```
Painel / controlo remoto
        │
        ▼
SmartSignage backend
  token · heartbeat · dispatch · command-result · media
        │
        ▼
player-web (runtime 3.x)
  core/     contrato igual ao Player-AD
  playback/ vídeo · imagem · html · iframe · cache
  remote/   executor de pendingCommands
  ui/       skin Amarelo Petróleo / tokens BV
        │
        ├── Chromium kiosk (V3x Linux)
        ├── Electron (shell existente)
        └── Browser / Smart TV web
```

**Regra:** o Express do TotemDigital.BV **não** substitui o player de campo.

---

## 4. Matriz de paridade Player-AD → Web

| Capacidade | Player-AD | player-web hoje | Meta |
|------------|-----------|-----------------|------|
| Ativação UIN / register | Sim | Sim | Manter + UI nova |
| Token + heartbeat + dispatch | Sim | Sim | Manter |
| Cache de mídia | FS / USB | IndexedDB | Manter e endurecer |
| Playback vídeo / imagem / html | Sim | Parcial | Paridade de tipos do plano |
| pendingCommands + command-result | Sim | Não executa | Prioridade P0 |
| apply_player_config / rotação | Sim | Não | CSS + config |
| Screenshot remoto | Sim | Não | Captação limitada no browser |
| OTA APK | Sim | N/A | Reload / version bump web |
| Áudio / mute | Configurável | Mute fixo | Config como AD |
| Debug / conectividade / playlist | Ecrã nativo | Painel fraco | Ecrã tipo config AD (web) |
| Visual marca | — | Genérico | Skin Amarelo Petróleo |

---

## 5. Fases e estimativas

### Fase 0 — Base e contrato (2–3 dias)

- Inventário de `player-web/js` vs endpoints do Player-AD.
- Spec de módulos: `core/`, `playback/`, `remote/`, `ui/`.
- Decisão: evoluir in-place (recomendado) com version bump **3.0.0**.
- Critério de saída: zero regressão no fluxo token → dispatch → play.

### Fase 1 — Motor = contrato AD (4–6 dias)

- Executor de comandos: `invalidate_*`, `refresh_dispatch`, `purge_cache`, `reload`, `apply_player_config` (subconjunto web).
- `POST /api/player/command-result`.
- Alinhar `now_playing` / métricas no heartbeat.
- Critério: controlo remoto do painel age no Chromium kiosk.

### Fase 2 — Visual BV / Amarelo Petróleo (2–4 dias)

- Tokens CSS a partir da apresentação / BV (`theme-petroleo.css`).
- Ecrãs: loading, online/offline, sem mídia, aguardando aprovação, erro de rede.
- Não embutir CRUD Express do BV no player.
- Critério: identidade TotemDigital no primeiro viewport.

### Fase 3 — Orientação e playback (3–5 dias)

- `displayRotation` 0–3 via CSS (espelho AD).
- FIT/contain alinhado à biblioteca (bake v3/v4).
- Áudio configurável; watchdog reforçado.
- Critério: mesmo plano no AD e no web com layout coerente em 9:16.

### Fase 4 — Conteúdo do visual novo (opcional, 3–7 dias)

- Boards BV → mídia `html` / `iframe` no SmartSignage → DispatchPlan.
- Player web só consome o plano (Opção A do handoff BV).
- Critério: conteúdo dinâmico BV no totem web sem segundo backend.

### Fase 5 — Empacote e operações (2–3 dias)

- Atualizar `install-player-v3x-linux-kiosk.sh` e documentação.
- Electron carrega a mesma URL.
- Checklist de teste paralelo AD ↔ Web no mesmo UIN.

**Total Fases 0–3:** cerca de 2–3 semanas  
**Com Fases 4–5:** cerca de 3–4 semanas

---

## 6. O que não fazer

1. Não fundir o Express do BV com o player de produção.
2. Não transformar o player de totem numa app React do admin (manter fullscreen leve).
3. Não abandonar `player-web` a favor só do `TotemDigital.BV`.
4. Não prometer OTA APK / reboot de hardware no browser.
5. Não alterar código até autorização explícita da Fase 0 (ou do pacote escolhido).

---

## 7. Decisões pendentes

- [ ] Escopo da 1ª entrega: só comandos + visual, ou também rotação?
- [ ] Nome: manter `player-web` 3.0 ou criar `player-web-ad`?
- [ ] BV nesta vaga: só skin (Fase 2) ou também boards no DispatchPlan (Fase 4)?
- [ ] Hardware prioritário: Chromium kiosk Linux primeiro, ou também browser em Smart TV?

---

## 8. Recomendação

Começar por **Fases 0 + 1 + 2**:

1. Contrato AD operacional (comandos remotos).
2. Skin Amarelo Petróleo.
3. Em cima do `player-web` existente.

Depois: orientação (Fase 3) e boards BV (Fase 4).

**Autorização sugerida:** «autorizo Fase 0 e 1» ou «0–2 com só skin BV».

---

## 9. Referências no repositório

| Tema | Caminho |
|------|---------|
| Player web atual | `player-web/` |
| Player Android | `Player-AD/` |
| Visual / BV | `Visual.Interface/TotemDigital.BV/` |
| Handoff continuidade | `docs/HANDOFF-CONTINUIDADE-PRODUTO-2026-07-21.md` |
| Player oficial V3x | `docs/PLAYER_OFICIAL_V3X.md` |
| Fluxo web + dispatcher | `docs/FLUXO_COMPLETO_PLAYER_WEB_CACHE_UIN_DISPATCHER_APROVACAO.md` |
| Controlo remoto | `docs/PLANO-TOTEM-ORIENTACAO-CONFIG-REMOTA-SCREENSHOT.md` |
| Kiosk Linux | `scripts/install-player-v3x-linux-kiosk.sh` |

---

## 10. Prompt para continuar com outra IA

```
Contexto: TotemDigital, branch SmartSignage-direc-totem.
Lê: docs/PLANO-PLAYER-WEB-AD-VISUAL-2026-07-21.md (e este PDF).
Também: docs/HANDOFF-CONTINUIDADE-PRODUTO-2026-07-21.md
Tarefa: implementar apenas as fases autorizadas do player-web = Player-AD web.
Não misturar Express do TotemDigital.BV no runtime do player.
Português; não alterar código sem autorização da fase.
```

---

*Documento de planeamento. Não substitui o schema SQL nem o código do Player-AD; define o caminho de evolução do player-web.*
