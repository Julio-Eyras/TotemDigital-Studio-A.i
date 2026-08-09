# Módulos de produto — índice canónico

**Data:** 2026-08-09  
**Branch de referência:** `main`  
**Padrão:** um módulo = uma pasta = `MODULO.md` com Visão · Requisitos (EARS) · Regras (RN) · Fluxos · Estados · Aceite  
**Metodologia:** [00-METODOLOGIA.md](./00-METODOLOGIA.md)  
**Template:** [_template/MODULO.md](./_template/MODULO.md)  
**ADRs:** [../adr/README.md](../adr/README.md)

Esta é a **fonte da verdade de negócio** por módulo. Manuais de ecrã e histórico técnico são satélites.

**Profundidade:** L1 = estrutural · L2 = código como evidência · L3 = operacional (ver [00-METODOLOGIA.md](./00-METODOLOGIA.md) §9).

| Lote | Slugs | Meta |
|------|-------|------|
| A — Núcleo Direct | product-modes, system-modules, direct-totem-mode, media-library, organization, totems, users-access | L2 |
| B — Player / ops | player-ad, remote-control, telemetry-heartbeat, player-apk-settings, ota-updates, dispatcher (+ publish-totem) | L2 |
| C — Conteúdo / comercial core | locals, subscribers, SPA, campaigns, playlists, quick-publish, publish-board, vinhetas, playlist-mix | L2 |
| D — Restantes | billing, plans, contracts, tags, qr-codes, menu-catalog, publish-templates, smart-playlist, devices-smart-tvs, network-topology, multi-agency, commercial-reports, subscriber-portal, commercial-purge, auth-security, dashboard, settings, admin-tools, backups-notifications, analytics-ai, smart-display-fx | L2 |

---

## Como usar

| Precisa de… | Abrir |
|-------------|--------|
| O que o módulo pode/não pode | `03` Regras no `MODULO.md` |
| Como testar | `06` Critérios de aceite |
| Como o utilizador opera a UI | `docs/manuais/` |
| Porque uma decisão técnica | `docs/adr/` |
| O que mudou numa sessão | `docs/HISTORICO-TECNICO-*.md` |

IDs estáveis: `REQ-<MOD>-NNN`, `RN-<MOD>-NNN`, `AC-<MOD>-NNN`.

---

## A. Núcleo e modos

| Slug | Módulo | Modos | Prof. |
|------|--------|-------|:-----:|
| [product-modes](./product-modes/MODULO.md) | Modos de produto | all | L2 |
| [system-modules](./system-modules/MODULO.md) | Complementos do sistema | all | L2 |
| [direct-totem-mode](./direct-totem-mode/MODULO.md) | Direct Totem (UI mínima) | Direct | L2 |

## B. Publicação e conteúdo

| Slug | Módulo | Modos | Prof. |
|------|--------|-------|:-----:|
| [publish-totem](./publish-totem/MODULO.md) | Publicar em Totem | Direct (+ API) | L2 |
| [media-library](./media-library/MODULO.md) | Biblioteca de mídias | all | L2 |
| [vinhetas](./vinhetas/MODULO.md) | Biblioteca de vinhetas | Lite, Pro | L2 |
| [quick-publish](./quick-publish/MODULO.md) | Publicar em tela | Lite, Pro | L2 |
| [publish-board](./publish-board/MODULO.md) | Criar conteúdo | Lite, Pro | L2 |
| [menu-catalog](./menu-catalog/MODULO.md) | Cardápio por cliente | Lite, Pro | L2 |
| [publish-templates](./publish-templates/MODULO.md) | Templates de publicação | Lite, Pro | L2 |
| [campaigns](./campaigns/MODULO.md) | Campanhas | Lite, Pro | L2 |
| [playlists](./playlists/MODULO.md) | Playlists | Pro | L2 |
| [playlist-mix](./playlist-mix/MODULO.md) | Playlist Mix | all (ops) | L2 |
| [smart-playlist](./smart-playlist/MODULO.md) | Smart Playlist | Pro | L2 |

## C. Organização e inventário

| Slug | Módulo | Modos | Prof. |
|------|--------|-------|:-----:|
| [organization](./organization/MODULO.md) | Organização (publishers) | all | L2 |
| [locals](./locals/MODULO.md) | Unidades / locais | all | L2 |
| [totems](./totems/MODULO.md) | Totens / ecrãs | all | L2 |
| [devices-smart-tvs](./devices-smart-tvs/MODULO.md) | Smart TVs e players | Lite, Pro | L2 |
| [network-topology](./network-topology/MODULO.md) | Rede visual / topologia | Lite, Pro | L2 |

## D. Multi-agência comercial

| Slug | Módulo | Modos | Prof. |
|------|--------|-------|:-----:|
| [multi-agency](./multi-agency/MODULO.md) | Multi-agência | Lite, Pro | L2 |
| [subscribers](./subscribers/MODULO.md) | Anunciantes | Lite, Pro | L2 |
| [subscriber-publisher-access](./subscriber-publisher-access/MODULO.md) | Anunciante ↔ Organização (SPA) | Lite, Pro | L2 |
| [plans](./plans/MODULO.md) | Planos e acessos | Pro | L2 |
| [contracts](./contracts/MODULO.md) | Contratos | Pro | L2 |
| [billing](./billing/MODULO.md) | Faturamento e cobrança | Pro | L2 |
| [commercial-reports](./commercial-reports/MODULO.md) | Relatórios comerciais | Pro | L2 |
| [subscriber-portal](./subscriber-portal/MODULO.md) | Portal do anunciante | Lite/Pro opc. | L2 |
| [commercial-purge](./commercial-purge/MODULO.md) | Purge comercial | Lite, Pro admin | L2 |

## E. Utilizadores, autenticação e admin

| Slug | Módulo | Modos | Prof. |
|------|--------|-------|:-----:|
| [users-access](./users-access/MODULO.md) | Usuários e acessos | all | L2 |
| [auth-security](./auth-security/MODULO.md) | Autenticação e segurança | all | L2 |
| [dashboard](./dashboard/MODULO.md) | Dashboard | Lite, Pro | L2 |
| [settings](./settings/MODULO.md) | Configurações | all | L2 |
| [tags](./tags/MODULO.md) | Tags | all | L2 |
| [qr-codes](./qr-codes/MODULO.md) | QR-Codes | Lite, Pro | L2 |
| [admin-tools](./admin-tools/MODULO.md) | Admin Tools | all | L2 |
| [backups-notifications](./backups-notifications/MODULO.md) | Backups e notificações | all | L2 |

## F. Operação de dispositivos e Player

| Slug | Módulo | Modos | Prof. |
|------|--------|-------|:-----:|
| [player-ad](./player-ad/MODULO.md) | Player-AD | all | L2 |
| [player-apk-settings](./player-apk-settings/MODULO.md) | Central APK | all | L2 |
| [remote-control](./remote-control/MODULO.md) | Controlo remoto | all | L2 |
| [telemetry-heartbeat](./telemetry-heartbeat/MODULO.md) | Telemetria e heartbeat | all | L2 |
| [ota-updates](./ota-updates/MODULO.md) | Atualizações OTA | Pro | L2 |
| [dispatcher](./dispatcher/MODULO.md) | Dispatcher | all (locked) | L2 |
| [analytics-ai](./analytics-ai/MODULO.md) | Analytics / IA | Pro | L2 |
| [smart-display-fx](./smart-display-fx/MODULO.md) | SmartDisplayFX | Lite/Pro opc. | L2 |

---

## Matriz rápida Direct / Lite / Pro

| Área | Direct | Lite | Pro |
|------|:------:|:----:|:---:|
| Publicar em Totem + Biblioteca | ✓ | API | API |
| Org / locais / totens / users / settings | ✓ | ✓ | ✓ |
| Player / remoto / telemetria / dispatcher / APK | ✓ | ✓ | ✓ |
| Anunciantes + SPA + quick-publish + campanhas | — | ✓ | ✓ |
| Planos + contratos + billing + OTA + analytics | — | — | ✓ |

---

## Manutenção

1. Nova regra de negócio ⇒ actualizar o `MODULO.md` no **mesmo PR** do código.  
2. Não duplicar RNs nos manuais de UI — referenciar `RN-xxx`.  
3. Regeneração assistida: `python scripts/generate-modulos-docs.py` — **não sobrescreve** ficheiros com `Profundidade: L2/L3`. Usar `--force` só em emergência.  
4. Decisões técnicas estruturais ⇒ novo ADR em `docs/adr/`.

## Candidatos a revisão L3 / evidência frágil

Documentados em L2, mas com gaps código↔produto a validar antes de L3:

| Slug | Motivo |
|------|--------|
| [backups-notifications](./backups-notifications/MODULO.md) | UI de backup fraca; DDL `notifications` ausente no schema v2 |
| [tags](./tags/MODULO.md) | Desalinhamento schema↔serviço; não são labels de mídia |
| [smart-playlist](./smart-playlist/MODULO.md) | `client_id` legado; geração IA parcial |
| [analytics-ai](./analytics-ai/MODULO.md) | mismatch FE `/ai/generate` vs BE; `ai_requests` sem DDL |
| [qr-codes](./qr-codes/MODULO.md) | `qr_code_scans` inexistente (scans stub) |
| [subscriber-portal](./subscriber-portal/MODULO.md) | settings/DNS fortes; FE só subset |
| [commercial-purge](./commercial-purge/MODULO.md) | só painel em Complementos |
| [network-topology](./network-topology/MODULO.md) | read-model sem tabela dedicada |
| [plans](./plans/MODULO.md) | sem página `/plans`; CRUD noutros ecrãs |
| [publish-board](./publish-board/MODULO.md) | `PublishBoardStudio` órfão; redirect para quick-publish |
| [campaigns](./campaigns/MODULO.md) | menu `/campaigns/stats` sem Route React |
