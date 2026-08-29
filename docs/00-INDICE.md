# Índice da documentação TotemDigital Studio

**Ponto de entrada de toda a documentação.**  
**Data:** 23 de agosto de 2026 · **Repo:** TotemDigital-Studio-A.i (lab A.I.) · **Branch:** `main`  
**Produto operacional:** TotemDigital-Studio · https://totemdigital.app.br  
**Baseline:** Front 2.1.22 · Back 2.1.16 · Player-AD 2.15 / 115  
**Autor:** Julio Cesar Eyras (J.C.E.) / Eyras Sistemas e Soluções  

Há centenas de ficheiros históricos em `docs/` (análises, resumos de sessão). Este índice lista a **documentação vigente** com explicação e ligação. O arquivo histórico está no fim.

---

## Como usar este índice

| Precisa de… | Ir para |
|-------------|--------|
| Instalar ou actualizar o servidor | [§2 Instalação](#2-instalação-do-servidor) |
| Usar o painel pela primeira vez | [§3 Manuais](#3-manuais-de-utilização) |
| Regras de um módulo (o que pode / não pode) | [§4 Módulos](#4-módulos-de-produto-regras-de-negócio) |
| Player / APK / TV box / Player-Linux | [§5 Player e hardware](#5-player-ad-player-linux-apk-e-hardware) |
| Vender / preços / demo | [§6 Comercial](#6-comercial-e-produto) |
| Lab A.I. / ACE (este clone) | [§6b Lab ACE](#6b-lab-ai--ace-este-clone) |
| Lab Maestro Cue | [§6c Lab Maestro](#6c-lab-maestro-cue) |
| Lab TDEP | [§6d Lab TDEP](#6d-lab-tdep--totemnet) |
| Emulação lab | [§6e Emulação](#6e-emulação-lab-in-memory) |
| API / schema / ADRs | [§7 Técnica](#7-técnica-api-schema-e-decisões) |

Índices satélite (já existentes, mais detalhados no seu tema):

| Índice | O que cobre |
|--------|-------------|
| [docs/README.md](./README.md) | Índice antigo (schema/ER); preferir **este** ficheiro |
| [instalacao/README.md](./instalacao/README.md) | Procedimentos de servidor |
| [manuais/README.md](./manuais/README.md) | Manuais de operação e telas |
| [modulos/00-INDICE.md](./modulos/00-INDICE.md) | Catálogo canónico de módulos |
| [adr/README.md](./adr/README.md) | Decisões de arquitectura |
| [hardware/README.md](./hardware/README.md) | TV box, homologação, ODM |
| [manuais/telas/README.md](./manuais/telas/README.md) | Capturas Direct Totem |

---

## 1. Começar aqui

| Documento | Explicação |
|-----------|------------|
| [../README.md](../README.md) | Visão do repositório, modos Direct/Lite/Pro, atalhos de install e Player-AD. |
| [manuais/00-VISAO-GERAL-PRE-REQUISITOS-BENEFICIOS.md](./manuais/00-VISAO-GERAL-PRE-REQUISITOS-BENEFICIOS.md) | O que é o produto, pré-requisitos e benefícios. |
| [manuais/02-GUIA-PRIMEIRA-VEZ-UTILIZADOR.md](./manuais/02-GUIA-PRIMEIRA-VEZ-UTILIZADOR.md) | Primeiro login, papéis e fluxo mínimo no painel. |
| [instalacao/05-MINI-LIVRETO-MAIN-PROD-DEV-TESTE.md](./instalacao/05-MINI-LIVRETO-MAIN-PROD-DEV-TESTE.md) | **Do zero** e **actualizar sem perder dados** em prod, DEV e TESTE. |
| [AVALIACAO-COMERCIAL-PRODUTO-TOTEMDIGITAL-STUDIO-2026-07.md](./AVALIACAO-COMERCIAL-PRODUTO-TOTEMDIGITAL-STUDIO-2026-07.md) · [PDF](./AVALIACAO-COMERCIAL-PRODUTO-TOTEMDIGITAL-STUDIO-2026-07.pdf) | Avaliação comercial v1.1.3: oferta Direct, Kit Pronto, o que falta. |

---

## 2. Instalação do servidor

Script oficial: `scripts/Instala-TotemDigital-Server.sh` (utilizador normal com `sudo`, nunca `sudo bash`).  
Wrappers: `scripts/dev-update-install-main.sh` (DEV) · `scripts/pro-update-install-main.sh` (actualizar prod **sem** wipe).  
Instalação **nova** de prod: `--modo producao` (pode recriar a BD). Actualizar: `--modo atualizar`.

| Documento | Explicação |
|-----------|------------|
| [instalacao/README.md](./instalacao/README.md) | Índice de instalação: modos, instâncias, regras de segurança. |
| [instalacao/05-MINI-LIVRETO-MAIN-PROD-DEV-TESTE.md](./instalacao/05-MINI-LIVRETO-MAIN-PROD-DEV-TESTE.md) | Guia curto do zero + update sem perder dados. |
| [instalacao/01-PRODUCAO-DIRECT-TOTEM.md](./instalacao/01-PRODUCAO-DIRECT-TOTEM.md) | Produção Direct Totem: clone `main`, `--modo producao`, HTTPS, verificação. |
| [instalacao/02-DEV-TESTE-MULTI-INSTANCIA.md](./instalacao/02-DEV-TESTE-MULTI-INSTANCIA.md) | DEV e TESTE isolados no mesmo VPS (portas, BD, clones). |
| [instalacao/03-MANUTENCAO-BACKUP-RESTORE.md](./instalacao/03-MANUTENCAO-BACKUP-RESTORE.md) | Reparar, Docker, wipe, backup e restore. |
| [instalacao/04-PLAYER-AD.md](./instalacao/04-PLAYER-AD.md) | Compilar/instalar Player-AD e Instala-Player (ADB, pendrive, logos). |
| [INSTALA-TOTEMDIGITAL-SERVER.md](./INSTALA-TOTEMDIGITAL-SERVER.md) | Referência CLI completa do instalador. |
| [manuais/01-INSTALACAO-PARAMETROS.md](./manuais/01-INSTALACAO-PARAMETROS.md) | Parâmetros do instalador para DevOps. |
| [MULTI-INSTANCIA-PROD-DEV-TESTE.md](./MULTI-INSTANCIA-PROD-DEV-TESTE.md) | Tabela de clones, portas e systemd por instância. |
| [INSTALL-PRODUCAO-COMPACT-DIRECT-TOTEM-HTTPS-443.md](./INSTALL-PRODUCAO-COMPACT-DIRECT-TOTEM-HTTPS-443.md) | Compact Direct + HTTPS unificado na 443. |
| [INSTALACAO_VPS_SSH.md](./INSTALACAO_VPS_SSH.md) | Acesso SSH / VPS (histórico operacional). |
| [PORTAS_E_SERVICOS_EXCLUSIVOS.md](./PORTAS_E_SERVICOS_EXCLUSIVOS.md) | Portas e serviços que não se podem misturar entre instâncias. |
| [README_INSTALACAO_SERVIDOR.md](./README_INSTALACAO_SERVIDOR.md) | Notas de instalação de servidor (legado; preferir `instalacao/`). |
| [CHECKLIST-POS-INSTALL.md](./CHECKLIST-POS-INSTALL.md) | Verificações após instalar. |
| [platform/08-go-live-checklist-compacto.md](./platform/08-go-live-checklist-compacto.md) | Checklist de go-live modo compacto. |

---

## 3. Manuais de utilização

| Documento | Explicação |
|-----------|------------|
| [manuais/README.md](./manuais/README.md) | Índice dos manuais operacionais. |
| [manuais/00-VISAO-GERAL-PRE-REQUISITOS-BENEFICIOS.md](./manuais/00-VISAO-GERAL-PRE-REQUISITOS-BENEFICIOS.md) | Visão, pré-requisitos, benefícios. |
| [manuais/02-GUIA-PRIMEIRA-VEZ-UTILIZADOR.md](./manuais/02-GUIA-PRIMEIRA-VEZ-UTILIZADOR.md) | Onboarding do operador / dono. |
| [manuais/03-MODULOS-E-FORMAS-DE-TRABALHO.md](./manuais/03-MODULOS-E-FORMAS-DE-TRABALHO.md) | Direct vs Lite vs Pro e como os módulos se ligam. |
| [manuais/04-MANUAL-ADMINISTRATIVO.md](./manuais/04-MANUAL-ADMINISTRATIVO.md) | Administração (`owner_system` / admin). |
| [manuais/05-MANUAL-TECNICO-MODELO-ER-API.md](./manuais/05-MANUAL-TECNICO-MODELO-ER-API.md) | Modelo E.R., API e serviços para desenvolvimento. |
| [manuais/07-MANUAL-PUBLICAR-EM-TOTEM.md](./manuais/07-MANUAL-PUBLICAR-EM-TOTEM.md) | Publicar mídias nos totens (fluxo Direct). |
| [user/01-introducao.md](./user/01-introducao.md) | Introdução clássica ao produto. |
| [user/02-manual-usuario.md](./user/02-manual-usuario.md) | Manual do utilizador (estrutura clássica). |
| [user/03-faq.md](./user/03-faq.md) | Perguntas frequentes. |
| [user/04-tutoriais.md](./user/04-tutoriais.md) | Tutoriais passo a passo. |

### Telas Direct Totem (capturas + PDF)

| Documento | Explicação |
|-----------|------------|
| [manuais/telas/README.md](./manuais/telas/README.md) | Índice das capturas 01–34. |
| [manuais/telas/08-TELAS-LOGIN-E-PUBLICAR.md](./manuais/telas/08-TELAS-LOGIN-E-PUBLICAR.md) · [PDF](./manuais/telas/08-TELAS-LOGIN-E-PUBLICAR.pdf) | Login e Publicar em Totem (telas 01–09). |
| [manuais/telas/09-TELAS-BIBLIOTECA-ORG-USUARIOS.md](./manuais/telas/09-TELAS-BIBLIOTECA-ORG-USUARIOS.md) · [PDF](./manuais/telas/09-TELAS-BIBLIOTECA-ORG-USUARIOS.pdf) | Biblioteca, organização, utilizadores, complementos (10–20). |
| [manuais/telas/10-TELAS-DISPATCHER.md](./manuais/telas/10-TELAS-DISPATCHER.md) · [PDF](./manuais/telas/10-TELAS-DISPATCHER.pdf) | Dispatcher (21–26). |
| [manuais/telas/11-TELAS-CONFIGURACOES.md](./manuais/telas/11-TELAS-CONFIGURACOES.md) · [PDF](./manuais/telas/11-TELAS-CONFIGURACOES.pdf) | Configurações, incluindo aba APK (27–34). |

---

## 4. Módulos de produto (regras de negócio)

Fonte da verdade por módulo: pasta `docs/modulos/<slug>/MODULO.md` (EARS + RN + fluxos + aceite).  
Metodologia: [modulos/00-METODOLOGIA.md](./modulos/00-METODOLOGIA.md) · template: [modulos/_template/MODULO.md](./modulos/_template/MODULO.md) · índice detalhado: [modulos/00-INDICE.md](./modulos/00-INDICE.md).

### Núcleo e modos

| Módulo | Explicação |
|--------|------------|
| [product-modes](./modulos/product-modes/MODULO.md) | Direct / Lite / Pro — nunca Direct e multi juntos. |
| [system-modules](./modulos/system-modules/MODULO.md) | Complementos do sistema (ligar/desligar capacidades). |
| [direct-totem-mode](./modulos/direct-totem-mode/MODULO.md) | UI mínima Direct (home Publicar em Totem). |

### Publicação e conteúdo

| Módulo | Explicação |
|--------|------------|
| [publish-totem](./modulos/publish-totem/MODULO.md) | Publicar em Totem (Direct). |
| [media-library](./modulos/media-library/MODULO.md) | Biblioteca de mídias. |
| [vinhetas](./modulos/vinhetas/MODULO.md) | Vinhetas (Lite/Pro). |
| [quick-publish](./modulos/quick-publish/MODULO.md) | Publicar em tela (Lite/Pro). |
| [publish-board](./modulos/publish-board/MODULO.md) | Criar conteúdo / board. |
| [menu-catalog](./modulos/menu-catalog/MODULO.md) | Cardápio por cliente. |
| [publish-templates](./modulos/publish-templates/MODULO.md) | Templates de publicação. |
| [campaigns](./modulos/campaigns/MODULO.md) | Campanhas. |
| [playlists](./modulos/playlists/MODULO.md) | Playlists. |
| [playlist-mix](./modulos/playlist-mix/MODULO.md) | Mix de playlists no totem. |
| [smart-playlist](./modulos/smart-playlist/MODULO.md) | Smart Playlist. |

### Organização e inventário

| Módulo | Explicação |
|--------|------------|
| [organization](./modulos/organization/MODULO.md) | Organizações (`publishers`). |
| [locals](./modulos/locals/MODULO.md) | Unidades / locais. |
| [totems](./modulos/totems/MODULO.md) | Totens / ecrãs. |
| [devices-smart-tvs](./modulos/devices-smart-tvs/MODULO.md) | Smart TVs e players. |
| [network-topology](./modulos/network-topology/MODULO.md) | Rede visual / topologia. |

### Multi-agência comercial

| Módulo | Explicação |
|--------|------------|
| [multi-agency](./modulos/multi-agency/MODULO.md) | Interruptor e regras multi-agência. |
| [subscribers](./modulos/subscribers/MODULO.md) | Anunciantes. |
| [subscriber-publisher-access](./modulos/subscriber-publisher-access/MODULO.md) | Vínculo anunciante ↔ organização (SPA). |
| [plans](./modulos/plans/MODULO.md) | Planos e acessos (Pro). |
| [contracts](./modulos/contracts/MODULO.md) | Contratos (Pro). |
| [billing](./modulos/billing/MODULO.md) | Faturamento (Pro). |
| [commercial-reports](./modulos/commercial-reports/MODULO.md) | Relatórios comerciais. |
| [subscriber-portal](./modulos/subscriber-portal/MODULO.md) | Portal do anunciante. |
| [commercial-purge](./modulos/commercial-purge/MODULO.md) | Purge comercial. |

### Utilizadores, admin e operação

| Módulo | Explicação |
|--------|------------|
| [users-access](./modulos/users-access/MODULO.md) | Utilizadores e papéis. |
| [auth-security](./modulos/auth-security/MODULO.md) | Autenticação e segurança. |
| [dashboard](./modulos/dashboard/MODULO.md) | Dashboard. |
| [settings](./modulos/settings/MODULO.md) | Configurações do sistema. |
| [tags](./modulos/tags/MODULO.md) | Tags. |
| [qr-codes](./modulos/qr-codes/MODULO.md) | QR-Codes. |
| [admin-tools](./modulos/admin-tools/MODULO.md) | Ferramentas de admin. |
| [backups-notifications](./modulos/backups-notifications/MODULO.md) | Backups e notificações. |
| [player-ad](./modulos/player-ad/MODULO.md) | Player-AD no produto. |
| [player-apk-settings](./modulos/player-apk-settings/MODULO.md) | Central APK (Definições → APK). |
| [remote-control](./modulos/remote-control/MODULO.md) | Controlo remoto do totem. |
| [telemetry-heartbeat](./modulos/telemetry-heartbeat/MODULO.md) | Heartbeat e telemetria. |
| [ota-updates](./modulos/ota-updates/MODULO.md) | OTA (Pro; Direct usa a aba APK). |
| [dispatcher](./modulos/dispatcher/MODULO.md) | Motor de dispatch / mix. |
| [analytics-ai](./modulos/analytics-ai/MODULO.md) | Analytics / IA. |
| [smart-display-fx](./modulos/smart-display-fx/MODULO.md) | SmartDisplayFX (opcional). |

---

## 5. Player-AD, Player-Linux, APK e hardware

### Painel e kit

| Documento | Explicação |
|-----------|------------|
| [instalacao/04-PLAYER-AD.md](./instalacao/04-PLAYER-AD.md) | Compilar, ADB, pendrive, Instala-Player (logos TotemDigital). |
| [player-apk/01-MANUAL-USUARIO.md](./player-apk/01-MANUAL-USUARIO.md) | Manual curto: instalar, activar, 3 toques, Wi‑Fi. |
| [player-apk/02-MANUAL-TECNICO.md](./player-apk/02-MANUAL-TECNICO.md) | Arquitectura, logs, cache, manutenção. |
| [player-apk/03-WORKFLOW-OPERACIONAL.md](./player-apk/03-WORKFLOW-OPERACIONAL.md) | Build, designação, rollout e rollback do APK. |
| [player-apk/04-FLUXO-FUNCIONAMENTO.md](./player-apk/04-FLUXO-FUNCIONAMENTO.md) | Heartbeat, dispatch, reprodução, telemetria. |
| [player-apk/05-REQUISITOS-E-REGRAS.md](./player-apk/05-REQUISITOS-E-REGRAS.md) | Pré-requisitos, identidade, segurança. |
| [player-apk/06-FUNCIONALIDADES-E-FUNCOES.md](./player-apk/06-FUNCIONALIDADES-E-FUNCOES.md) | Catálogo de capacidades do Player-AD. |
| [PLAYER-AD-MAESTRO-CUE-VS-MATRIZ-2026-08.md](./PLAYER-AD-MAESTRO-CUE-VS-MATRIZ-2026-08.md) · [PDF](./PLAYER-AD-MAESTRO-CUE-VS-MATRIZ-2026-08.pdf) | **Plano** Maestro: SKU A rede sincronizada (cue) vs SKU B espelho LED/TV (matriz). Sem código. |
| [../install-pendrive/README.md](../install-pendrive/README.md) | Kit pendrive (APKs oficiais no Git). |
| [../install-pendrive/LEIA-ME.txt](../install-pendrive/LEIA-ME.txt) | Início rápido no USB. |
| [../install-pendrive/KIT-VERSION.txt](../install-pendrive/KIT-VERSION.txt) | Versão pinada do kit (2.12 / 112). |
| [../install-pendrive/bootanimation/README.md](../install-pendrive/bootanimation/README.md) | Logos oficiais TotemDigital (BMP + bootanimation). |
| [../install-pendrive/docs/MANUAL-INSTALACAO-PLAYER-AD.md](../install-pendrive/docs/MANUAL-INSTALACAO-PLAYER-AD.md) | Instalação a partir do pendrive. |
| [../install-pendrive/docs/MANUAL-USUARIO-PLAYER-AD.md](../install-pendrive/docs/MANUAL-USUARIO-PLAYER-AD.md) | Manual do utilizador no kit. |

### Código Player-AD

| Documento | Explicação |
|-----------|------------|
| [../Player-AD/docs/MANUAL-USUARIO-INSTALACAO-CONFIGURACAO.md](../Player-AD/docs/MANUAL-USUARIO-INSTALACAO-CONFIGURACAO.md) | Instalação e configuração detalhada. |
| [../Player-AD/docs/MANUAL-OPERACIONAL-TVBOX.md](../Player-AD/docs/MANUAL-OPERACIONAL-TVBOX.md) | Operação 24/7, boot, kiosk, ADB. |
| [../Player-AD/docs/MANUAL-ARQUITETURA-DESENVOLVIMENTO.md](../Player-AD/docs/MANUAL-ARQUITETURA-DESENVOLVIMENTO.md) | Arquitectura Kotlin / ExoPlayer. |
| [../Player-AD/docs/RESUMO-EXECUTIVO-PLAYER-AD.md](../Player-AD/docs/RESUMO-EXECUTIVO-PLAYER-AD.md) | Resumo executivo do player. |
| [../Player-AD/docs/REGISTRO-OPERACIONAL.md](../Player-AD/docs/REGISTRO-OPERACIONAL.md) | Registo operacional de campo. |
| [../Player-AD/docs/TROUBLESHOOTING-CRASH.md](../Player-AD/docs/TROUBLESHOOTING-CRASH.md) | Diagnóstico de crashes. |
| [../Player-AD/docs/Player-AD-CACHE-E-METADADOS.md](../Player-AD/docs/Player-AD-CACHE-E-METADADOS.md) | Cache e metadados. |
| [../Player-AD/docs/HANDOFF-IA-SISTEMA-ARMAZENAMENTO-CACHE.md](../Player-AD/docs/HANDOFF-IA-SISTEMA-ARMAZENAMENTO-CACHE.md) | Handoff do sistema de cache. |
| [Player-AD-CACHE-E-METADADOS.md](./Player-AD-CACHE-E-METADADOS.md) | Notas de cache no `docs/` (espelho). |

### Player-Linux (C++ — parity AD 2.13 / 113)

| Documento | Explicação |
|-----------|------------|
| [../Player-Linux/README.md](../Player-Linux/README.md) | Player Linux C++17; build CMake; parity com Player-AD 2.13. |
| [../Player-Linux/docs/PARITY-PLAYER-AD-2.13.md](../Player-Linux/docs/PARITY-PLAYER-AD-2.13.md) | Checklist de parity Android → Linux. |
| [../Player-Linux/docs/ARQUITETURA.md](../Player-Linux/docs/ARQUITETURA.md) | Módulos C++, threads, storage. |
| [../Player-Linux/docs/API-E-CONFIG.md](../Player-Linux/docs/API-E-CONFIG.md) | Endpoints e `player-config.json`. |
| [players/EQUIVALENCIA-PLAYER-AD-2.15.md](./players/EQUIVALENCIA-PLAYER-AD-2.15.md) | Cruzamento de paridade: AD 2.15/115 vs Linux, webOS, Tizen, player-web. |

### Hardware / TV box

| Documento | Explicação |
|-----------|------------|
| [hardware/README.md](./hardware/README.md) | Índice hardware + PDFs. |
| [hardware/1-PAGER-EXECUTIVO.md](./hardware/1-PAGER-EXECUTIVO.md) · [PDF](./hardware/1-PAGER-EXECUTIVO.pdf) | One-pager executivo do totem/TV box. |
| [hardware/TV_BOX_3-SPEC.md](./hardware/TV_BOX_3-SPEC.md) · [PDF](./hardware/TV_BOX_3-SPEC.pdf) | Ficha da box homologada (TV_BOX_3). |
| [hardware/HOMOLOGACAO-TV-BOX-PLAYER-AD-2.12.md](./hardware/HOMOLOGACAO-TV-BOX-PLAYER-AD-2.12.md) · [PDF](./hardware/HOMOLOGACAO-TV-BOX-PLAYER-AD-2.12.pdf) | Homologação de campo Player-AD 2.12 / 112. |
| [hardware/SOC-BOOT-PATHS.md](./hardware/SOC-BOOT-PATHS.md) | Caminhos de boot por SoC (Allwinner, etc.). |
| [hardware/IMPORTACAO-BRASIL.md](./hardware/IMPORTACAO-BRASIL.md) | Importação de boxes para o Brasil. |
| [hardware/STATUS-PROJETO-TVBOX.md](./hardware/STATUS-PROJETO-TVBOX.md) | Estado do projecto TV box. |
| [hardware/TOTEM-ODM-SPEC-v1.md](./hardware/TOTEM-ODM-SPEC-v1.md) · [PDF](./hardware/TOTEM-ODM-SPEC-v1.pdf) | Spec ODM do totem. |
| [TVBOX-PROCUREMENT-FORNECEDORES.md](./TVBOX-PROCUREMENT-FORNECEDORES.md) | Fornecedores e catálogo. |
| [TVBOX-PROCUREMENT-COMPARISON.csv](./TVBOX-PROCUREMENT-COMPARISON.csv) | Planilha comparativa. |
| [TOTEM-DIGITAL-DOCUMENTACAO-COMPLETA.pdf](./TOTEM-DIGITAL-DOCUMENTACAO-COMPLETA.pdf) | PDF único do kit hardware. |

### Outros players (linhas alternativas)

| Documento | Explicação |
|-----------|------------|
| [../Player-WOS/docs/MANUAL-INSTALACAO-LG-WEBOS.md](../Player-WOS/docs/MANUAL-INSTALACAO-LG-WEBOS.md) | Player LG webOS. |
| [ARQUITETURA_PLAYER_CLIENT_AVANCADO.md](./ARQUITETURA_PLAYER_CLIENT_AVANCADO.md) | Arquitectura do player-client avançado. |

---

## 6. Comercial e produto

| Documento | Explicação |
|-----------|------------|
| [AVALIACAO-COMERCIAL-PRODUTO-TOTEMDIGITAL-STUDIO-2026-07.md](./AVALIACAO-COMERCIAL-PRODUTO-TOTEMDIGITAL-STUDIO-2026-07.md) · [PDF](./AVALIACAO-COMERCIAL-PRODUTO-TOTEMDIGITAL-STUDIO-2026-07.pdf) | Avaliação comercial vigente (Direct, Kit Pronto, prioridades). |
| [PRECOS-PILOTO-MERCADO-2026-08.md](./PRECOS-PILOTO-MERCADO-2026-08.md) | Preços piloto BR/LatAm (ago/2026). |
| [ONE-PAGER-COMERCIAL-TOTEMDIGITAL-2026-07.md](./ONE-PAGER-COMERCIAL-TOTEMDIGITAL-2026-07.md) · [PDF](./ONE-PAGER-COMERCIAL-TOTEMDIGITAL-2026-07.pdf) | One-pager comercial Direct. |
| [manuais/06-APRESENTACAO-COMERCIAL-SAAS.md](./manuais/06-APRESENTACAO-COMERCIAL-SAAS.md) · [PDF](./manuais/06-APRESENTACAO-COMERCIAL-SAAS.pdf) | Apresentação SaaS (Lite/Pro como upsell). |
| [manuais/12-ROTEIRO-DEMO-15-MIN.md](./manuais/12-ROTEIRO-DEMO-15-MIN.md) · [PDF](./manuais/12-ROTEIRO-DEMO-15-MIN.pdf) | Roteiro de demo Direct 15 min. |
| [CONVERSA-PROTOCOLO-DOOH-TDEP-2026-08.md](./CONVERSA-PROTOCOLO-DOOH-TDEP-2026-08.md) · [PDF](./CONVERSA-PROTOCOLO-DOOH-TDEP-2026-08.pdf) | **Plano** TDEP/TotemNet: interoperabilidade entre CMS DOOH (sem código). |
| [PLAYER-AD-MAESTRO-CUE-VS-MATRIZ-2026-08.md](./PLAYER-AD-MAESTRO-CUE-VS-MATRIZ-2026-08.md) · [PDF](./PLAYER-AD-MAESTRO-CUE-VS-MATRIZ-2026-08.pdf) | **Plano** Player-AD Maestro: cue (totens) vs matriz (LED/TV). Distinto do TDEP. |
| [INDICE_DOCUMENTOS_COMERCIAIS.md](./INDICE_DOCUMENTOS_COMERCIAIS.md) | Kit comercial legado SmartSignage Pro (pitch, investidores, scripts). |
| [DOCUMENTACAO-COMERCIAL-TECNICA.md](./DOCUMENTACAO-COMERCIAL-TECNICA.md) | Ponte comercial ↔ técnica. |
| [PRODUCT_VISION_TOTEM_DIGITAL_V3X.md](./PRODUCT_VISION_TOTEM_DIGITAL_V3X.md) | Visão de produto v3x. |
| [PLANO-ESTRATEGICO-2026-2027.md](./PLANO-ESTRATEGICO-2026-2027.md) | Plano estratégico 2026–2027. |
| [COMMERCE-QR-WIZARD-SPEC.md](./COMMERCE-QR-WIZARD-SPEC.md) · [PDF](./COMMERCE-QR-WIZARD-SPEC.pdf) | Spec QR / e-commerce (Shopify, Woo, Magento). |

---

## 6b. Lab A.I. / ACE (este clone)

Documentação de evolução **só** em `TotemDigital-Studio-A.i`. Não substitui Direct / Kit Pronto. Não altera o Studio operacional.

| Documento | Explicação |
|-----------|------------|
| [ACE-0.1-SPEC.md](./ACE-0.1-SPEC.md) | **Spec** Audience Context Engine 0.1: contrato `audience.context`, Privacy Gateway, inventário real do código. Sem player/painel. |
| [lab-ace/README.md](./lab-ace/README.md) | JSON Schema `ace/0.1`, exemplos válidos e fixture de recusa `IDENTITY_LEAK`. |
| [lab-ace/PRIVACY-GATEWAY-0.1.md](./lab-ace/PRIVACY-GATEWAY-0.1.md) | Cortes e códigos de recusa do gateway (papel + lab local). |
| [../scripts/lab-ace/README.md](../scripts/lab-ace/README.md) | Validador, emissor sintético e visão no edge (`logs/ace-synthetic.jsonl`, `logs/ace-edge.jsonl`). |
| Lab HTTP | `POST /api/lab/ace/context` · `POST /api/lab/ace/interaction` · `GET /api/lab/ace/hint/:totemId` · `GET /api/lab/ace/audit/:totemId` (auth). Hint só se `capabilities.ace_enabled`. |
| [lab-ace/EDGE-VISION-0.1.md](./lab-ace/EDGE-VISION-0.1.md) | Visão no edge: contagem/dwell sem face. |
| [lab-ace/INTERACTION-BUS-0.1.md](./lab-ace/INTERACTION-BUS-0.1.md) | NFC/QR/touch no bus ACE (bools; sem `tag_id`). |
| [lab-ace/ACE-AUDIT-0.1.md](./lab-ace/ACE-AUDIT-0.1.md) | Auditoria `ace.hint` sem PII (`event_logs`). |
| [lab-ace/FX-BRIDGE-0.1.md](./lab-ace/FX-BRIDGE-0.1.md) | Ponte FX → ACE: touch/NFC anónimos; face/mood recusados. |
| [lab-ace/OPT-IN-0.1.md](./lab-ace/OPT-IN-0.1.md) | Ligar ACE num totem (`capabilities.ace_enabled`). Default off. Verificado em lab sem Postgres (`verify_optin.py`). |
| [adr/0006-ace-audience-nao-identidade.md](./adr/0006-ace-audience-nao-identidade.md) | ADR: ACE = audiência anónima; identidade (face) permanece 501. |

---

## 6c. Lab Maestro (Cue)

SKU A: relógio + `play @ t0`. **Não** altera o Player-AD neste lote. SKU B (matriz) fica fora do JSON 0.1.

| Documento | Explicação |
|-----------|------------|
| [PLAYER-AD-MAESTRO-CUE-VS-MATRIZ-2026-08.md](./PLAYER-AD-MAESTRO-CUE-VS-MATRIZ-2026-08.md) | One-pager Cue vs Matriz. |
| [lab-maestro/README.md](./lab-maestro/README.md) | Schema `maestro/0.1` e validador. |
| [lab-maestro/NTP-0.1.md](./lab-maestro/NTP-0.1.md) | NTP em 2 boxes: lab virtual feito; hardware real opcional. `|drift|<=200`. |
| [lab-maestro/SSID-0.1.md](./lab-maestro/SSID-0.1.md) | SSID só de players 5/6 GHz. Cue recusa Wi-Fi da loja. Pitch não vende. |
| [lab-field/FIELD-0.1.md](./lab-field/FIELD-0.1.md) | Pre-voo ADB/SQL: sem 2 boxes faz skip; nunca UPDATE. |
| [adr/0007-maestro-cue-nao-e-matriz.md](./adr/0007-maestro-cue-nao-e-matriz.md) | ADR: Cue ≠ pixels. |

---

## 6d. Lab TDEP / TotemNet

Federação **entre CMS**. Sem `audience.context`. Sem `/tdep/v1` de produto. Lab HTTP: `/api/lab/tdep` + accordion Direct ([lab-tdep/UI-0.1.md](./lab-tdep/UI-0.1.md)).

| Documento | Explicação |
|-----------|------------|
| [CONVERSA-PROTOCOLO-DOOH-TDEP-2026-08.md](./CONVERSA-PROTOCOLO-DOOH-TDEP-2026-08.md) | Debate e plano TDEP. |
| [lab-tdep/README.md](./lab-tdep/README.md) | Schema dos 6 objectos `tdep/0.1`. |
| [lab-tdep/TDEP-0.1.md](./lab-tdep/TDEP-0.1.md) | Contrato curto: variantes, recusas, endpoints em papel. |
| [lab-tdep/NODES-0.1.md](./lab-tdep/NODES-0.1.md) | Dois nós fictícios (prod ↔ DEV): Flight fill + Proof. TotemNet default off. |
| [lab-tdep/LED-CMS-0.1.md](./lab-tdep/LED-CMS-0.1.md) | Segunda implementação: CMS LED fictício. Mesmo schema, outro motor. |
| [lab-tdep/LANE-0.1.md](./lab-tdep/LANE-0.1.md) | Lane TDEP no Dispatcher de lab. Local ganha. |
| [lab-tdep/UI-0.1.md](./lab-tdep/UI-0.1.md) | Accordion Direct: ceder até 10% do ar ocioso. Default off. |
| [lab-tdep/ONE-PAGER-PARCEIRO-0.1.md](./lab-tdep/ONE-PAGER-PARCEIRO-0.1.md) | Nota comercial para parceiro LED/CMS. Fora do pitch de 15 min. |
| [adr/0008-tdep-nao-transporta-audiencia.md](./adr/0008-tdep-nao-transporta-audiencia.md) | ADR: TDEP ≠ ACE. |

---

## 6e. Emulação lab (in-memory)

Mocks de Dispatcher, bus FX, player Maestro e parceiro TDEP. Sem Player-AD, MQTT, Postgres ou face.

| Documento | Explicação |
|-----------|------------|
| [../scripts/lab-emulate/README.md](../scripts/lab-emulate/README.md) | Como correr a emulação. Relatório em `logs/lab-emulation-report.json`. |
| [lab-system/SYSTEM-0.1.md](./lab-system/SYSTEM-0.1.md) | Ciclo HTTP ACE+Maestro+TDEP com player/box/câmara/parceiro mock. |
| [lab-system/UI-0.1.md](./lab-system/UI-0.1.md) | Consola `/lab/system` (fora do menu) + accordion Direct. |

```powershell
python scripts/lab-emulate/test_emulation.py
python scripts/lab-emulate/run_emulation.py
```

---

## 7. Técnica: API, schema e decisões

### API e plataforma

| Documento | Explicação |
|-----------|------------|
| [technical/07-API-INVENTARIO.md](./technical/07-API-INVENTARIO.md) | Inventário de rotas. Regenerar: `python scripts/generate-openapi-from-routes.py`. |
| [technical/openapi.json](./technical/openapi.json) | OpenAPI gerado. |
| [technical/01-api.md](./technical/01-api.md) | Manual da API (heartbeat, playlists, exemplos). |
| [technical/02-desenvolvimento.md](./technical/02-desenvolvimento.md) | Ambiente de desenvolvimento. |
| [technical/03-migracao.md](./technical/03-migracao.md) | Notas de migração. |
| [technical/04-instalacao.md](./technical/04-instalacao.md) | Instalação (visão técnica clássica). |
| [technical/05-changelog.md](./technical/05-changelog.md) | Changelog técnico. |
| [technical/06-plano-teste-unitario-compacto.md](./technical/06-plano-teste-unitario-compacto.md) | Plano de testes unitários compacto. |
| [platform/01-arquitetura.md](./platform/01-arquitetura.md) | Arquitectura da plataforma. |
| [platform/02-requisitos.md](./platform/02-requisitos.md) | Requisitos. |
| [platform/03-configuracao.md](./platform/03-configuracao.md) | Configuração. |
| [platform/04-workflows.md](./platform/04-workflows.md) | Workflows. |
| [platform/05-recursos-regras.md](./platform/05-recursos-regras.md) | Recursos e regras. |
| [platform/06-totemdigital-monousuario-er-e-fluxo.md](./platform/06-totemdigital-monousuario-er-e-fluxo.md) | Direct / monousuário: ER e fluxo. |
| [platform/07-teste-modo-compacto.md](./platform/07-teste-modo-compacto.md) | Teste rápido modo compacto. |
| [platform/09-politica-rotas-totemdigital-compacto.md](./platform/09-politica-rotas-totemdigital-compacto.md) | Política de rotas compacto. |

### Schema (fonte da verdade)

| Recurso | Explicação |
|---------|------------|
| `database/smartchannel-db-v2-refactored-part*.sql` | Schema SQL definitivo (não usar migrations paliativas). |
| `database/carga-inicial-v6.sql` | Seed / carga inicial v6. |
| `database/validate-v6.js` | Validação pós-schema. |
| [INTEGRACAO_SCHEMA_PRINCIPAL.md](./INTEGRACAO_SCHEMA_PRINCIPAL.md) | Política: schema no repo, sem workarounds. |
| [MODELO_ER_MIDIAS_SMART_TV_E_TOTENS.md](./MODELO_ER_MIDIAS_SMART_TV_E_TOTENS.md) | Modelo ER actual (medias, campaigns, totems, comandos). |
| [diagrams/SmartSignage-ER-sistema-completo.png](./diagrams/SmartSignage-ER-sistema-completo.png) | Diagrama ER do sistema. |
| [duas-formas-propaganda-chegar-ao-totem.md](./duas-formas-propaganda-chegar-ao-totem.md) | Elegibilidade campanha ↔ totem. |
| [cadastro-atrelar-campanha-totem.md](./cadastro-atrelar-campanha-totem.md) | UI: atrelar campanha ao totem. |

### ADRs (decisões)

| ADR | Explicação |
|-----|------------|
| [adr/README.md](./adr/README.md) | Índice de ADRs. |
| [ADR-0001](./adr/0001-documentacao-modulos-hibrida.md) | Documentação híbrida por módulo. |
| [ADR-0002](./adr/0002-device-id-canonico.md) | Device ID canónico (trim + uppercase). |
| [ADR-0003](./adr/0003-entrega-hibrida-comandos.md) | Comandos: sync + heartbeat. |
| [ADR-0004](./adr/0004-telemetria-observacao-sob-pedido.md) | Telemetria detalhada só com lease. |
| [ADR-0005](./adr/0005-fonte-unica-apk-designado.md) | APK oficial via `player_release_channels`. |
| [ADR-0006](./adr/0006-ace-audience-nao-identidade.md) | ACE = audiência, não identidade. |
| [ADR-0007](./adr/0007-maestro-cue-nao-e-matriz.md) | Maestro Cue ≠ matriz de pixels. |
| [ADR-0008](./adr/0008-tdep-nao-transporta-audiencia.md) | TDEP não transporta ACE. |

---

## 8. Continuidade, handoff e histórico recente

| Documento | Explicação |
|-----------|------------|
| [HANDOFF-CONTINUIDADE-PRODUTO-2026-07-21.md](./HANDOFF-CONTINUIDADE-PRODUTO-2026-07-21.md) | Handoff multi-IA (estado da branch, pendências). |
| [HANDOFF-MULTI-AGENCIA-CONTINUIDADE.md](./HANDOFF-MULTI-AGENCIA-CONTINUIDADE.md) | Continuidade multi-agência. |
| [ETAPA-E-MULTI-AGENCIA-WORKERS.md](./ETAPA-E-MULTI-AGENCIA-WORKERS.md) | Workers e bootstrap multi-agência. |
| [HISTORICO-TECNICO-2026-08-08.md](./HISTORICO-TECNICO-2026-08-08.md) | Histórico técnico de sessão (ago/2026). |
| [LACUNAS-PLANO-APLICADO-2026-08-09.md](./LACUNAS-PLANO-APLICADO-2026-08-09.md) | Lacunas do plano aplicado. |
| [COMPLEMENTOS-SISTEMA-MODULOS-FASE-A.md](./COMPLEMENTOS-SISTEMA-MODULOS-FASE-A.md) | Complementos / módulos fase A. |

---

## 9. Arquivo histórico (não é fonte da verdade)

A pasta `docs/` contém **centenas** de `RESUMO_*`, `ANALISE_*`, `CORRECAO_*`, `PROGRESSO_*` e planos de sessões antigas. Servem de rasto, **não** substituem manuais, módulos nem `instalacao/`.

| Sítio | O que é |
|-------|---------|
| [LIMPEZA_E_ARQUIVOS_CANDIDATOS_EXCLUSAO.md](./LIMPEZA_E_ARQUIVOS_CANDIDATOS_EXCLUSAO.md) | Lista de candidatos a arquivo/exclusão. |
| [`docs/_moved/`](./_moved/) | Documentação movida (player-client legado, diagramas antigos, testes). |
| `Player-AD - (Vs Operacional arrumar detalhe em rotacoes)/` | Cópia de trabalho do Player-AD; preferir `Player-AD/docs/`. |
| [INDICE_DOCUMENTOS_COMERCIAIS.md](./INDICE_DOCUMENTOS_COMERCIAIS.md) | Kit comercial SmartSignage Pro (pré-Direct 2026). |

Se um ficheiro solto contradisser `docs/modulos/`, `docs/instalacao/` ou `docs/manuais/`, **ganha o índice canónico**.

---

## 10. Regenerar PDFs

```powershell
python scripts/md_to_pdf.py docs/00-INDICE.md -o docs/00-INDICE.pdf
python scripts/md_to_pdf.py docs/PLAYER-AD-MAESTRO-CUE-VS-MATRIZ-2026-08.md -o docs/PLAYER-AD-MAESTRO-CUE-VS-MATRIZ-2026-08.pdf
python scripts/generate-comercial-pdfs.py
python scripts/generate-hardware-docs-pdf.py
python scripts/generate-telas-pdf.py
```
