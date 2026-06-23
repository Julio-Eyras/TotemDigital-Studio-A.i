# Relatório de situação — TotemDigital / Smart Signage Studio

**Data:** 17 de junho de 2026  
**Escopo:** análise do repositório (código + documentação), sem alterações de código.  
**Branch de referência:** `Smart-Signage-Studio-Vx5`  
**Últimos commits relevantes:** `7ca24aa` (duração vídeo), `5d8464c` (campanhas/contratos), `92db5ce` (editor campanha)

---

## 1. Resumo executivo

| Área | Situação geral |
|------|----------------|
| **Núcleo operacional** (anunciantes, mídias, playlists, campanhas, contratos, dispatcher, Player-AD) | **Funcional** — caminho principal de negócio implementado |
| **Modo Studio compacto** (`TOTEMDIGITAL_COMPACT=true`) | **Perfil de produção atual** — menu, faturamento, Publicar em Tela |
| **Modo Pro completo** | Código preservado; SmartDisplayFX, filas Bull export, multi-agência **desligados** no compacto |
| **Players** | **Player-AD (Android)** = player de referência em campo; webOS/Linux/outros = **imaturas** |
| **IA / Ondas B e C** | Backend implementado; **depende de variáveis de ambiente** não geradas pelo instalador |
| **Testes automatizados** | **Parcial** — ~73 ficheiros de teste no backend; E2E Playwright; cobertura insuficiente para release formal |
| **Documentação em `docs/`** | **Muitos ficheiros desatualizados** (jan–mai 2026); não refletem o código atual |
| **Staging** (`217.216.91.135:8080`) | Código no GitHub **à frente** do servidor; deploy manual pendente |

---

## 2. Perfis e feature flags

### 2.1 Modo Studio (compacto) — ativo por defeito no build

| Flag / conceito | Efeito |
|-----------------|--------|
| `TOTEMDIGITAL_COMPACT` / `REACT_APP_TOTEMDIGITAL_COMPACT` | UI «Smart Signage Studio», rotas compactas, faturamento anunciante+exibidor |
| `isStudioRuntime()` / `isStudioMode()` | Runtime derivado de env + `system_settings.installation.profile` |
| `DISABLE_DIRECT_CAMPAIGN_TOTEM` | Se `true`, desativa vínculo direto campanha↔totem; **padrão = forma 2 ativa** |
| `SMARTDISPLAYFX_ENABLED` | `false` no compacto |
| `capabilities.smartDisplayFx`, `bullExportQueues` | Desligados em `installationPolicy` no perfil `single_publisher` |

### 2.2 Diferenças Studio vs Pro

- **Studio:** campanhas por **contrato + totens do plano**; menu reduzido; mídia entra **já aprovada**; sem SmartDisplayFX no menu.
- **Pro:** abas extra (organizações/publicadores, Smart TVs); SmartDisplayFX e filas de exportação disponíveis se o perfil permitir.

**Ficheiros de referência:** `backend/src/config/featureFlags.ts`, `frontend/src/config/featureFlags.ts`, `backend/src/policy/installationPolicy.ts`

---

## 3. Funcionalidades por módulo

### 3.1 Maduro / em uso em produção (Studio)

| Módulo | Estado | Notas |
|--------|--------|-------|
| Login, roles, isolamento por anunciante | ✅ | Credenciais demo removidas da UI (homologar) |
| Anunciantes — CRUD, abas Mídias/Playlists/Campanhas/Contratos | ✅ | Playlist: adicionar mídias, drag-and-drop, duração por item **implementados** |
| Editor completo de campanha (`CampaignFullEditorDialog`) | ✅ | Contrato → rede do plano → aba Totens; «Selecionar todos» |
| Contratos anunciante (4 intervalos, valor negociado) | ✅ | Exige status **Ativo** + vigência para campanhas |
| Dispatcher + mix de playlist | ✅ | Worker Playlist Mix; seeds `seeds-playlist-mix.sql` |
| Upload mídia (imagem/vídeo/áudio/HTML) | ✅ | Vídeo: `ffprobe` no upload; duração real no dispatch (`7ca24aa`) |
| Player-AD Android | ✅ | v1.18 (versionCode 19); ExoPlayer + fallback local |
| Publicar em Tela — Onda A (HTML + publicar) | ✅ código | Homologação em campo por marcar (checklist §11) |
| Faturamento anunciante/exibidor, workers financeiros | ✅ código | SMTP/PIX/Stripe = config manual pós-install |
| Cardápio por cliente | ✅ código | Poll HTML via `/api/publish-board/public-menu/:id` |
| Planos, limites, topologia locais/totens | ✅ | `plan_local_access` crítico para totens elegíveis |

### 3.2 Parcial / depende de configuração

| Módulo | Estado | O que falta |
|--------|--------|-------------|
| Publicar em Tela — Onda B (cardápio ao vivo) | ⚠️ | `MENU_LIVE_REFRESH_SECONDS` no `.env` — **não está no instalador** |
| Publicar em Tela — Onda C (vídeo IA) | ⚠️ | `AI_VIDEO_PROVIDER`, `AI_VIDEO_API_URL`, `AI_VIDEO_API_KEY` |
| Sugerir textos com IA | ⚠️ | Requer `AI_PROVIDER` configurado |
| Duração de vídeos antigos | ⚠️ | Registos com `display_seconds=10` na BD precisam correção |
| Campanha sem contrato ativo | ⚠️ UX | Utilizador deve ativar contrato na aba Contratos |
| Analytics / relatórios | ⚠️ | Algumas rotas devolvem vazio se tabelas ausentes |
| OTA updates | ⚠️ | UI simula progresso de upload |
| E-mail / SMTP | ⚠️ | Placeholders no `.env` gerado pelo instalador |
| Stripe | ⚠️ | Price IDs por intervalo; webhook a homologar |
| MQTT / SmartDisplayFX | ⚠️ | Broker opcional; FX desligado no Studio |
| Testes E2E Ondas B/C | ⚠️ | `e2e/tests/publish-ondas-bc.spec.ts` usa mocks |

### 3.3 Incompleto, mock ou não pronto para produção

| Módulo | Tipo | Detalhe |
|--------|------|---------|
| Reconhecimento facial | MOCK | `facialRecognitionService.matchFace()` — primeira pessoa, confiança 0.7 |
| QR Code — histórico de scans | VAZIO | `qrcodeService.getQRCodeScans()` → `[]` |
| Restauro de backup | STUB | `backupService.restoreBackup()` — sucesso falso |
| Desencriptação config player | STUB | `totemEncryption.decryptPlayerConfig()` → `null` |
| Espaço em disco (storage) | HARDCODED | `getAvailableSpace()` → 1 GB fixo |
| Alertas | PARCIAL | Heurísticas simplificadas |
| WebSocket broadcast | PARCIAL | Broadcast global; escopo por empresa incompleto |
| Validação técnica dispatcher | STUB | `validateTechnicalCompatibility()` → sempre válido |
| AI Context Dashboard — gráficos | MOCK | Históricos inventados no frontend |
| Widgets dashboard customizável | PLACEHOLDER | «Será implementado com recharts» |
| Contratos de exibidor (publisher) | INCOMPLETO | CRUD frontend limitado |
| Player webOS / Linux / player-client | IMATURO | Integração real fraca |
| SmartDisplayFX player-fx | PARCIAL | Efeitos avançados por implementar |
| RFID / TagReader | NÃO IMPLEMENTADO | `TagReaderService.js` |
| Prometheus/Grafana | NÃO IMPLEMENTADO | Roadmap |
| App mobile admin | NÃO IMPLEMENTADO | Roadmap |

---

## 4. Inventário técnico — mocks e stubs (backend)

| Ficheiro | Descrição |
|----------|-----------|
| `backend/src/services/facialRecognitionService.ts` | Match simplificado (sem ML real) |
| `backend/src/utils/totemEncryption.ts` | Decrypt não implementado |
| `backend/src/services/backupService.ts` | Restore pendente |
| `backend/src/services/qrcodeService.ts` | Scans sempre vazios |
| `backend/src/services/alertService.ts` | Checks parciais |
| `backend/src/services/storageService.ts` | Espaço disco fixo 1 GB |
| `backend/src/services/websocketService.ts` | Broadcast sem escopo por cliente |
| `backend/src/services/dispatcherTotemService.ts` | Validação técnica sempre OK |
| `backend/src/services/fxOrchestratorService.ts` | Bridge MQTT/WebSocket TODO |
| `backend/src/index.ts` | SVG placeholder para assets ausentes |

---

## 5. Inventário técnico — frontend

| Ficheiro | Descrição |
|----------|-----------|
| `frontend/src/pages/AIContext/AIContextDashboard.tsx` | Gráficos mock (pedestrian/sentiment history) |
| `frontend/src/components/Dashboard/Widget.tsx` | Placeholders chart/table/list |
| `frontend/src/components/OTAUpdates/OTAUpdates.tsx` | Progresso de upload simulado |
| `frontend/src/pages/Auth/ForgotPassword.tsx` | Token de reset visível em development |

---

## 6. Player e dispositivos

| Player | Versão / estado | Uso recomendado |
|--------|-----------------|-----------------|
| **Player-AD** | v1.18 (versionCode 19) | **Produção** — TV BOX Android, kiosk |
| **player-web** (browser) | Variável | Depende de staging atualizado |
| **SmartSignage-ANDROID-PLAYER** (legado) | Config hardcoded | Não é o caminho atual |
| **webOS / LG** | Não testado em TV real | Experimental |
| **Linux C++** | Estrutura | Experimental |

**Config demo:** `DEMO-UIN-001`, `http://217.216.91.135:8080` em `install-pendrive/config/exemplo-player-config.json`.

---

## 7. Bugs e riscos conhecidos

### 7.1 Operacionais (staging / install)

| Sintoma | Causa provável |
|---------|----------------|
| 502 em `/api/*` | Backend parado ou Nginx incorreto |
| 401 após tempo | Sessão expirada |
| 400 em deletes | Regra de negócio (mídia em uso) |
| Contrato não aparece na campanha | Status Rascunho ou fora da vigência |
| Nenhum totem na campanha | Plano sem `plan_local_access` |
| Vídeo com ~10 s no player | Dados antigos ou staging sem deploy `7ca24aa` |
| WebSocket instável | Infraestrutura / proxy |

### 7.2 TODOs relevantes no backend

- `dispatcherTotemService` — scoring Fase 2, validações técnicas
- `dispatcherRouter` — busca comandos/playlist
- `qrcodeService` — histórico de scans
- `backupService` — restore real
- `totemEncryption` — OpenSSL decrypt
- `fxOrchestratorService` — bridge MQTT/WebSocket
- `alertService` — reconhecimento de alertas

---

## 8. Testes e qualidade

| Tipo | Situação |
|------|----------|
| Testes unitários backend | ~73 ficheiros em `backend/src/__tests__/` |
| Testes integração API | publish-board, campaigns, billing, scope |
| E2E Playwright | `e2e/`; Ondas B/C com mocks |
| Roteiro manual integral | `docs/ROTEIRO_TESTES_MANUAIS_INTEGRAIS.md` |
| Smoke staging | `docs/CHECKLIST_STUDIO_STAGING.md` — maioria por marcar |
| Homologação Publicar em Tela Vx5 | PDF + checklist §11 |

---

## 9. Documentação — fiabilidade

| Documento | Fiabilidade | Nota |
|-----------|-------------|------|
| `docs/AUDITORIA_SISTEMA_2026-01.md` | Média | Testes e itens já evoluíram |
| `docs/CHECKLIST_STUDIO_STAGING.md` | **Alta** | Smoke/homologação atual |
| `docs/ROTEIRO_TESTES_MANUAIS_INTEGRAIS.md` | **Alta** | Roteiro completo |
| `docs/ESTADO_ATUAL_CRUD_ASSINANTE.md` | **Baixa** | Playlist desatualizada |
| `docs/O_QUE_FALTA_IMPLEMENTAR.md` | **Baixa** | Testes «não implementados» — falso |
| `docs/ESTADO_REAL_PROJETO_SMARTSIGNAGE.md` | **Baixa** | Percentagens players desatualizadas |
| `docs/SEEDS_E_MODO_DEMO.md` | Média | Referencia ficheiro inexistente |

---

## 10. Trabalho recente no Git (deploy staging pendente)

| Commit | Conteúdo |
|--------|----------|
| `7ca24aa` | Duração real de vídeo (playlist, dispatch, ffprobe, Player-AD 1.18) |
| `5d8464c` | Campanha: contratos rascunho visíveis, refresh, Abrir Contratos |
| `92db5ce` | Campanha: editor completo, totens do contrato por defeito |

**Deploy:** `bash scripts/deploy-staging-vx5.sh` no servidor staging.

---

## 11. Prioridades sugeridas

1. Deploy staging com commits recentes e fechar checklist §11 (Publicar em Tela).
2. Homologar campanha fim-a-fim: contrato ativo → totens → dispatch → Player-AD.
3. Incluir `MENU_LIVE_*` e `AI_VIDEO_*` no instalador / `.env.example`.
4. Atualizar ou arquivar documentação desatualizada (`ESTADO_ATUAL_CRUD_ASSINANTE.md`, etc.).
5. Corrigir dados legados: vídeos com `display_seconds=10`.
6. Médio prazo: QR scans, backup restore, validação técnica dispatcher, E2E sem mocks B/C.

---

## 12. Conclusão

O **caminho principal do TotemDigital em modo Studio está implementado e utilizável**: anunciante → contrato/plano → mídia/playlist → campanha → totens → dispatcher → Player-AD.

O que mais distancia uma produção formal:

- homologação em campo não concluída;
- staging desatualizado face ao Git;
- funcionalidades premium (IA vídeo, cardápio ao vivo) sem env no instalador;
- módulos satélite em mock (facial, QR histórico, gráficos AI Context, players não-Android);
- documentação interna contraditória com o código.

---

*Relatório gerado automaticamente com base na análise do repositório TotemDigital — junho 2026.*
