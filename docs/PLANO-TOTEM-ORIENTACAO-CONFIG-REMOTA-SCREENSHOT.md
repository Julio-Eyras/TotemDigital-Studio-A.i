# Plano — Orientação por totem, config remota e controlo operacional

**Estado:** código A–D + OTA stubs + bake mídia v3 + defaults instalação Player-AD — **2026-07-19**  
**Data:** 2026-07-17 · **Actualizado:** 2026-07-19  
**Público:** equipa de desenvolvimento  
**Continuidade:** validar em totem real; reprocessar mídias de telemóvel; OTA install/rollback real só quando priorizado

### Defaults de instalação Player-AD (kit ADB / pendrive)

| Campo | Valor padrão |
|-------|----------------|
| `uin` | `T1000` |
| `deviceId` (nome no painel) | `T1000 - Exterminator` |
| `allowPlaybackAudio` | `false` (áudio desligado) |
| `batimentoCardiaco` | `15` (segundos) |
| `displayRotation` | `0` (retrato) |
| `serverUrl` | `http://217.216.91.135:8080` |

Fonte: `install-pendrive/config/exemplo-player-config.json` + defaults em `PlayerConfig` / `PlayerConfigLoader`.


Documentos relacionados:

- [IMPLEMENTACAO_CONTROLE_REMOTO_P1.md](./IMPLEMENTACAO_CONTROLE_REMOTO_P1.md)
- [PROGRESSO_P1_CONTROLE_REMOTO.md](./PROGRESSO_P1_CONTROLE_REMOTO.md)
- [CONTROLE_REMOTO_FRONTEND_COMPLETO.md](./CONTROLE_REMOTO_FRONTEND_COMPLETO.md)
- `Player-AD/docs/MANUAL-OPERACIONAL-TVBOX.md`
- `Player-AD/docs/MANUAL-USUARIO-INSTALACAO-CONFIGURACAO.md`

---

## 1. Objectivo

1. Cada **totem (Player-AD)** aplica a rotação/adequação de mídia conforme a **sua** configuração (`displayRotation` / `screenOrientation`), para montagens diferentes (direita/esquerda, retrato/invertido) não partilharem um bake único errado.
2. Permitir **administrar a distância** as configurações do player (em especial orientação).
3. Tornar o **controlo remoto** operacional de ponta a ponta — em especial **screenshot/hardcopy** (hoje quebrado).
4. Avaliar depois **visibilidade do que está a reproduzir** (now playing / snapshots); streaming contínuo só se necessário.

**Regra:** este documento é o plano. Não implica alterações de código até a sessão de implementação.

---

## 2. Contexto e diagnóstico (investigação 2026-07-16/17)

### 2.1 Rotação de imagens hoje

| Camada | Comportamento |
|--------|----------------|
| **Servidor** (`mediaService.ts`) | No upload, bakeia imagem em **1920×1080** com ângulo **90° ou 180°** (`resolveDeliveryRotationFromStream` + `normalizeImageToTotemDelivery`). Um ficheiro para todos os totens. |
| **UI web** | Preview correcto via undo CSS de `_delivery_rotation` / thumbnail 9:16. Não simula o `displayRotation` de um totem concreto. |
| **Player-AD** | `MediaViewportRotation.ENABLED = false` — **não** corrige imagem em runtime. Config local (`player-config.json`) define montagem do painel (`user_rotation`), não a mídia bakeada. |

**Problemas observados:** imagens de cabeça para baixo; reprocessar várias vezes encolhe o conteúdo (`rotate` + `contain` 1920×1080 repetido).

**Conclusão:** a UI pode estar certa e totens com montagens opostas ficarem errados, porque a entrega **não** considera o parâmetro do Player-AD.

### 2.2 Orientação no Player-AD (por aparelho)

| `displayRotation` | Label na app | `user_rotation` SO |
|-------------------|--------------|--------------------|
| 0 | Retrato (topo para cima) | 1 |
| 2 | Retrato invertido (topo para baixo) | 3 |
| 1 | Paisagem (90° direita) | 0 |
| 3 | Paisagem invertida (90° esquerda) | 2 |

Código esboçado (desactivado): `MediaViewportRotation.correctionRotation` → **90°** vs **270°** conforme montagem.

### 2.3 Comandos remotos (auditoria)

Canal: painel → `remote_commands` → heartbeat → Player → `POST /api/player/command-result`.

| Comando | Estado |
|---------|--------|
| `restart` / `restart_app` | Operacional |
| `refresh_dispatch` / `sync_now` | Operacional |
| `content_version_check` | Operacional |
| `invalidate_media` / playlist / campaign | Operacional |
| `purge_cache` | Operacional |
| `reboot` / `reset_board` | Parcial (UI fraca; root) |
| `screenshot` / `capture_screen` | **Quebrado ponta-a-ponta** |
| `config` | Tipo existe; **não implementado** |
| `clear_cache`, `play`/`pause`, `custom`, … | Legado / morto |
| OTA APK | **Baixa prioridade** — alinhar na **fila** `update` **e** no heartbeat; ver §9 |

Riscos: heartbeat não marca `sent`/`executing` → possível reexecução do mesmo comando.

### 2.4 Screenshot / hardcopy — ponto de erro

**Onde visualizar na UI:** `frontend/src/components/TotemRemoteControl/TotemRemoteControl.tsx` — botão «Capturar Tela» + separador «Capturas de Tela» (Totems / PublishTotem / TotemMediaPage).

**Fluxo actual:**

1. Painel: `POST /api/totems/:id/screenshot`
2. Player: `screencap -p` → PNG **só no Android** (`…/screenshots/screen-*.png`)
3. Player reporta `{ filePath, fileSize, format }` (path **local do device**)
4. Backend grava esse path em `remote_screenshots` e o download lê o path **no disco do servidor** → erro típico: «Arquivo de screenshot não encontrado»

**Gaps confirmados:**

- Upload da imagem do player para o servidor **nunca implementado** (nota já em `PROGRESSO_P1_CONTROLE_REMOTO.md`).
- Tabela `remote_screenshots` **ausente** do schema v2 definitivo (`part6` tem `remote_commands`, não screenshots) — instalação limpa falha no INSERT de metadata.

### 2.5 Streaming do vídeo em reprodução

**Não existe.** Opções futuras: screenshot periódico; “now playing” (mediaId); WebRTC/RTSP (fase tardia, custo alto).

### 2.6 Config remota

Hoje só local: `/sdcard/smartsignage/player-config.json`, ecrã de debug (5 toques), ADB. Campo `orientation` no cadastro de totem/smart_tv **não** sincroniza o Player-AD.

---

## 3. Decisão de arquitectura (acordada no plano)

1. **Rotação / adequação visual da mídia:** preferência por trabalho **no totem**, segundo a config local — um ficheiro partilhado não pode servir montagens opostas se o bake for “cego”.
2. **Servidor:** evitar re-normalizar ficheiros já em entrega 1920×1080; reduzir ou clarificar bake agressivo (90°/180°) vs metadado + correcção no player.
3. **UI biblioteca:** manter preview actual (já OK); não é obrigatório espelhar cada totem.
4. **Config:** espelho no servidor + comando remoto `apply_player_config` / `config`.
5. **Screenshot:** corrigir ponta-a-ponta antes de “live preview” avançado.
6. **Streaming contínuo:** só após A–C estáveis e com requisito explícito.

---

## 4. Plano por fases

### Fase A — Fundações do controlo remoto (prioridade curta)

| # | Tarefa | Notas |
|---|--------|-------|
| A1 | Schema definitivo `remote_screenshots` | Actualizar SQL v2 + `apply-schema` / instalador (regra schema-as-source-of-truth) |
| A2 | Upload real do PNG no screenshot | Multipart ou body no `command-result` / endpoint dedicado; gravar em storage do servidor |
| A3 | Download/galeria UI a funcionar | Validar `TotemRemoteControl` + GET download |
| A4 | Anti-duplicado de comandos | Marcar `sent`/`executing` no heartbeat |
| A5 | Limpeza de tipos mortos na UI/API | Documentar reboot; esconder play/pause/custom se não existirem |

**Critério de pronto:** capturar no painel → aparecer imagem na galeria → download OK.

### Contrato B1 — `deliveryRotation` × `displayRotation` (implementado)

| Fonte | Papel |
|-------|--------|
| Servidor | Bake entrega 1920×1080 + tag `_delivery_rotation:N` (conteúdo pensado para montagem **standard** `displayRotation=0`) |
| Player | `MediaViewportRotation.ENABLED=true`: com tag de entrega, se montagem invertida (2/3) aplica **+180°**; legacy `deliveryRotation=0` em faixa landscape aplica flip Allwinner; sem tag, landscape→90°/270° por mount |

**Não** re-aplicar bake 90/180+contain em ficheiro já 1920×1080 (guard no `mediaService`).

---

### Fase C — Config remota

| # | Tarefa | Notas |
|---|--------|-------|
| C1 | Persistência server-side por totem | Tabela ou JSON em settings; espelho de campos seguros |
| C2 | Comando `apply_player_config` | Whitelist; Player grava JSON + aplica orientação/kiosk |
| C3 | UI no `TotemRemoteControl` | Orientação em primeiro lugar; depois kiosk/intervalos |
| C4 | Heartbeat reporta config efectiva | Orientação, versionName, storage |
| C5 | Políticas para `serverUrl` / `uin` | Confirmação forte — risco de totem órfão |

**Critério de pronto:** alterar orientação no painel → totem aplica sem ADB / 5 toques.

### Fase D — Visibilidade operacional

| # | Tarefa | Notas |
|---|--------|-------|
| D1 | Galeria de screenshots estável | Retenção, limpeza, permissões |
| D2 | “A reproduzir agora” | mediaId / nome via evento ou heartbeat |
| D3 | Snapshot periódico (opcional) | Quase-live sem WebRTC |
| D4 | Streaming contínuo (opcional) | Só com requisito de suporte; avaliar WebRTC/RTSP |

---

## 5. Ordem sugerida de valor

1. **Fase A** — screenshot ponta-a-ponta  
2. **Fase B** — rotação no totem conforme config  
3. **Fase C** — config remota (orientação primeiro)  
4. **Fase D** — now playing / snapshots  
5. **Fase E (OTA)** — **sem prioridade**, só no fim (§9)

---

## 9. OTA — alinhamento (baixa prioridade; mocks aceites)

**Objectivo de produto:** padronizar OTA também como **comando remoto** (`update` na fila `remote_commands`), sem abandonar de imediato o anúncio via heartbeat (rollout automático). Painel deve mostrar **em que totem** e **histórico** de tentativas; funções principais podem ficar **mock** até a Fase E estar completa.

### 9.1 Duplo canal (padronização)

| Canal | Uso |
|-------|-----|
| Heartbeat `otaUpdate` | Rollout automático / disponível (já existe) |
| Comando remoto `update` | Pedido explícito do painel («Actualizar APK neste totem») |

O Player trata o payload OTA da mesma forma (`OtaUpdateCoordinator`), seja vindo do heartbeat ou do comando `update`.

### 9.2 Backup / rollback — responsabilidade do **Player-AD**

Não depender do servidor para guardar APKs antigos de cada totem. O app guarda até **3 instalações anteriores** em armazenamento externo da app:

```text
…/Android/data/br.com.smartchannel.playerad/files/OTA/
  current.apk          (ou versão-nomeada)
  backup-1.apk         (mais recente anterior)
  backup-2.apk
  backup-3.apk         (mais antiga; a seguir é reciclada)
  ota-history.json     (opcional: versão, data, checksum, resultado)
```

**Fluxo desejado:**

1. Antes de instalar OTA nova → copiar APK actual (se acessível) / pacote anterior para a rotação de backups (máx. 3).  
2. Instalar nova versão.  
3. Se falhar ou operador pedir «voltar atrás» → reinstalar o `backup-1` (comando remoto futuro `ota_rollback` — mock na 1.ª iteração).  

Histórico no **servidor** (quem / quando / versão pedida) pode ficar só em `remote_commands` + eventos; o **ficheiro** para rollback fica no totem.

### 9.3 Implementação nesta ronda

- Stubs/mocks: comando `update` enfileirável + UI «OTA (em breve)» + `OtaApkBackupStore` no Player com pasta `files/OTA` e retenção 3.  
- Download/instalação OTA completa e `ota_rollback` operacional → só quando Fase E for priorizada.

---

## 6. Ficheiros-chave

### Backend
- `backend/src/services/mediaService.ts` — bake / `_delivery_rotation`
- `backend/src/services/remoteCommandService.ts` — fila + `saveScreenshot`
- `backend/src/routes/totems.ts` — restart / screenshot / commands / screenshots
- `backend/src/routes/player.ts` — `command-result`, OTA
- `backend/src/utils/dispatchMediaItem.ts` — `deliveryRotation` no dispatch
- `database/smartchannel-db-v2-refactored-part6-tables-other.sql` — `remote_commands` + `remote_screenshots`
- `database/smartchannel-db-v2-compat-remote-screenshots.sql` — upgrade idempotente

### Frontend
- `frontend/src/components/TotemRemoteControl/TotemRemoteControl.tsx`
- `frontend/src/hooks/useMediaRotationTransform.ts` — preview UI
- `frontend/src/services/api/index.ts` — `totemApi.screenshot` / download

### Player-AD
- `Player-AD/.../util/MediaViewportRotation.kt`
- `Player-AD/.../playback/PlayerController.kt` — comandos + `executeCaptureScreen`
- `Player-AD/.../config/PlayerConfig.kt` / `PlayerConfigStore.kt` / `DebugConfigActivity.kt`
- `Player-AD/.../ui/DisplayPresentationController.kt`
- `Player-AD/src/main/res/values/arrays.xml` — labels de orientação

---

## 7. Checklist de validação pós-implementação

- [x] Schema `remote_screenshots` + `player_settings` / `now_playing` (part3/part6 + compat + ensure no startup)
- [x] Upload `imageBase64` no screenshot + gravação no servidor
- [x] Anti-duplicado: `claimPendingCommands` (status `sent`)
- [x] Preview/galeria via blob autenticado + reboot UI
- [x] Retenção: poda 20 capturas/totem
- [x] Rotação no player conforme mount + guard anti-reprocess no servidor
- [x] Config remota `config` / orientação na UI
- [x] Now playing no heartbeat + chip no painel
- [x] OTA stubs (`update` / `ota_rollback`) + pasta `files/OTA` (máx. 3 backups)
- [ ] Defaults kit: `uin=T1000`, `deviceId=T1000 - Exterminator`, áudio off, heartbeat 15s

---

## 8. Fora de âmbito neste plano

- Alterações já feitas / commits (este ficheiro apenas documenta o plano)
- Streaming WebRTC como MVP
- Reescrita total do sistema de mídia fora do fluxo totem/direct-totem

---

*Última actualização: 2026-07-19 — defaults instalação T1000 / Exterminator / áudio off / heartbeat 15s; bake v3 + Player-AD; validar em hardware.*
