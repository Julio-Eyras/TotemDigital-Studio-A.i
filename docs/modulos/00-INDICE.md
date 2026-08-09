# Módulos de produto — índice canónico

**Data:** 2026-08-09  
**Branch de referência:** `main`  
**Padrão:** um módulo = uma pasta = `MODULO.md` com Visão · Requisitos (EARS) · Regras (RN) · Fluxos · Estados · Aceite  
**Metodologia:** [00-METODOLOGIA.md](./00-METODOLOGIA.md)  
**Template:** [_template/MODULO.md](./_template/MODULO.md)  
**ADRs:** [../adr/README.md](../adr/README.md)

Esta é a **fonte da verdade de negócio** por módulo. Manuais de ecrã e histórico técnico são satélites.

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

| Slug | Módulo | Modos |
|------|--------|-------|
| [product-modes](./product-modes/MODULO.md) | Modos de produto | all |
| [system-modules](./system-modules/MODULO.md) | Complementos do sistema | all |
| [direct-totem-mode](./direct-totem-mode/MODULO.md) | Direct Totem (UI mínima) | Direct |

## B. Publicação e conteúdo

| Slug | Módulo | Modos |
|------|--------|-------|
| [publish-totem](./publish-totem/MODULO.md) | Publicar em Totem | Direct (+ API) |
| [media-library](./media-library/MODULO.md) | Biblioteca de mídias | all |
| [vinhetas](./vinhetas/MODULO.md) | Biblioteca de vinhetas | Lite, Pro |
| [quick-publish](./quick-publish/MODULO.md) | Publicar em tela | Lite, Pro |
| [publish-board](./publish-board/MODULO.md) | Criar conteúdo | Lite, Pro |
| [menu-catalog](./menu-catalog/MODULO.md) | Cardápio por cliente | Lite, Pro |
| [publish-templates](./publish-templates/MODULO.md) | Templates de publicação | Lite, Pro |
| [campaigns](./campaigns/MODULO.md) | Campanhas | Lite, Pro |
| [playlists](./playlists/MODULO.md) | Playlists | Pro |
| [playlist-mix](./playlist-mix/MODULO.md) | Playlist Mix | all (ops) |
| [smart-playlist](./smart-playlist/MODULO.md) | Smart Playlist | Pro |

## C. Organização e inventário

| Slug | Módulo | Modos |
|------|--------|-------|
| [organization](./organization/MODULO.md) | Organização (publishers) | all |
| [locals](./locals/MODULO.md) | Unidades / locais | all |
| [totems](./totems/MODULO.md) | Totens / ecrãs | all |
| [devices-smart-tvs](./devices-smart-tvs/MODULO.md) | Smart TVs e players | Lite, Pro |
| [network-topology](./network-topology/MODULO.md) | Rede visual / topologia | Lite, Pro |

## D. Multi-agência comercial

| Slug | Módulo | Modos |
|------|--------|-------|
| [multi-agency](./multi-agency/MODULO.md) | Multi-agência | Lite, Pro |
| [subscribers](./subscribers/MODULO.md) | Anunciantes | Lite, Pro |
| [subscriber-publisher-access](./subscriber-publisher-access/MODULO.md) | Anunciante ↔ Organização (SPA) | Lite, Pro |
| [plans](./plans/MODULO.md) | Planos e acessos | Pro |
| [contracts](./contracts/MODULO.md) | Contratos | Pro |
| [billing](./billing/MODULO.md) | Faturamento e cobrança | Pro |
| [commercial-reports](./commercial-reports/MODULO.md) | Relatórios comerciais | Pro |
| [subscriber-portal](./subscriber-portal/MODULO.md) | Portal do anunciante | Lite/Pro opc. |
| [commercial-purge](./commercial-purge/MODULO.md) | Purge comercial | Lite, Pro admin |

## E. Utilizadores, autenticação e admin

| Slug | Módulo | Modos |
|------|--------|-------|
| [users-access](./users-access/MODULO.md) | Usuários e acessos | all |
| [auth-security](./auth-security/MODULO.md) | Autenticação e segurança | all |
| [dashboard](./dashboard/MODULO.md) | Dashboard | Lite, Pro |
| [settings](./settings/MODULO.md) | Configurações | all |
| [tags](./tags/MODULO.md) | Tags | all |
| [qr-codes](./qr-codes/MODULO.md) | QR-Codes | Lite, Pro |
| [admin-tools](./admin-tools/MODULO.md) | Admin Tools | all |
| [backups-notifications](./backups-notifications/MODULO.md) | Backups e notificações | all |

## F. Operação de dispositivos e Player

| Slug | Módulo | Modos |
|------|--------|-------|
| [player-ad](./player-ad/MODULO.md) | Player-AD | all |
| [player-apk-settings](./player-apk-settings/MODULO.md) | Central APK | all |
| [remote-control](./remote-control/MODULO.md) | Controlo remoto | all |
| [telemetry-heartbeat](./telemetry-heartbeat/MODULO.md) | Telemetria e heartbeat | all |
| [ota-updates](./ota-updates/MODULO.md) | Atualizações OTA | Pro |
| [dispatcher](./dispatcher/MODULO.md) | Dispatcher | all (locked) |
| [analytics-ai](./analytics-ai/MODULO.md) | Analytics / IA | Pro |
| [smart-display-fx](./smart-display-fx/MODULO.md) | SmartDisplayFX | Lite/Pro opc. |

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
3. Regeneração assistida: `python scripts/generate-modulos-docs.py` (sobrescreve conteúdo gerado; edições manuais finas devem ir ao script ou ao ficheiro com cuidado).  
4. Decisões técnicas estruturais ⇒ novo ADR em `docs/adr/`.
