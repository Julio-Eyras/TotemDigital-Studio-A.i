#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Gera documentação canónica de módulos (docs/modulos/<slug>/MODULO.md)."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "docs" / "modulos"
TODAY = "2026-08-09"

# Cada módulo: slug, nome, modos, atores, ui, api, proposito, escopo_in, escopo_out,
# vocab, reqs[(id,tipo,texto)], rns[(id,titulo,quando,se,entao,exceto,motivo)],
# fluxos_md, estados[(nome,significado,transicoes)], aceite[(id,dado,quando,entao,prio)],
# deps, refs


def rn(i, titulo, quando, se, entao, excepto="—", motivo=""):
    return {
        "id": i,
        "titulo": titulo,
        "quando": quando,
        "se": se,
        "entao": entao,
        "excepto": excepto,
        "motivo": motivo,
    }


def req(i, tipo, texto):
    return {"id": i, "tipo": tipo, "texto": texto}


def ac(i, dado, quando, entao, prio="P0"):
    return {"id": i, "dado": dado, "quando": quando, "entao": entao, "prio": prio}


MODULES = []


def add(**kwargs):
    MODULES.append(kwargs)


# ---------------------------------------------------------------------------
# Núcleo / modos
# ---------------------------------------------------------------------------
add(
    slug="product-modes",
    nome="Modos de produto",
    modos="all",
    atores="owner_system, admin_sql",
    ui="/settings/system-modules",
    api="PUT /api/installation/multi-agency",
    proposito="Define o perfil da instalação: Direct Totem (off), Multi Lite (lite) ou Multi Pro (full), aplicando o preset de módulos.",
    escopo_in=["Alternar mode off|lite|full", "Aplicar presets de installation.modules", "Impedir Direct + multi-agência simultâneos"],
    escopo_out=["Apagar dados comerciais (isso é commercial-purge)", "Permissões por utilizador (flag_smart_*)"],
    vocab=[("mode", "off | lite | full"), ("Direct Totem", "mode=off, UI mínima, uma org"), ("Multi Lite", "várias orgs + anunciantes sem ERP"), ("Multi Pro", "agência completa com planos/billing/OTA")],
    reqs=[
        req("REQ-MOD-001", "Ubiquitous", "A instalação deve estar sempre num único mode válido: off, lite ou full."),
        req("REQ-MOD-002", "Event-driven", "Quando o owner altera o mode, o sistema deve aplicar o preset de módulos correspondente."),
        req("REQ-MOD-003", "Unwanted", "O sistema não deve permitir Direct Totem e multi-agência activos ao mesmo tempo."),
        req("REQ-MOD-004", "Unwanted", "A mudança para mode=off não deve apagar dados comerciais automaticamente."),
    ],
    rns=[
        rn("RN-MOD-001", "Mutua exclusão Direct/Multi", "Owner muda o mode", "escolhe off", "multi_agency e UI comercial ficam off; direct_totem_mode on", motivo="Produto mono vs rede"),
        rn("RN-MOD-002", "OFF sem purge", "Owner escolhe Direct (off)", "existem dados Lite/Pro", "dados permanecem; purge é acção separada", motivo="Segurança operacional"),
        rn("RN-MOD-003", "Só owner/admin_sql", "Utilizador abre Complementos", "role ≠ owner_system/admin_sql", "menu/API de mode é negado", motivo="Governança"),
    ],
    fluxos="""```mermaid
flowchart TD
  A[Owner abre Complementos] --> B{Escolhe mode}
  B -->|off| C[Preset Direct]
  B -->|lite| D[Preset Lite]
  B -->|full| E[Preset Pro]
  C --> F[Hot-reload workers/menu]
  D --> F
  E --> F
```""",
    estados=[("off", "Direct Totem", "→ lite|full"), ("lite", "Multi Lite", "→ off|full"), ("full", "Multi Pro", "→ off|lite")],
    aceite=[
        ac("AC-MOD-001", "instalação em lite", "owner muda para off", "UI Direct activa e APIs de plans/billing respondem MODULE_DISABLED"),
        ac("AC-MOD-002", "dados comerciais existentes", "owner muda para off", "nenhuma tabela comercial é apagada"),
    ],
    deps=["system-modules"],
    refs=["docs/manuais/03-MODULOS-E-FORMAS-DE-TRABALHO.md", "backend/src/policy/installationModules.ts"],
)

add(
    slug="system-modules",
    nome="Complementos do sistema",
    modos="all",
    atores="owner_system, admin_sql",
    ui="/settings/system-modules",
    api="/api/installation/*",
    proposito="Painel de módulos de instalação (catálogo, opções avançadas, portal, purge). Distinto das flags por utilizador.",
    escopo_in=["Ligar/desligar módulos não locked", "Ver catálogo e presets", "Acesso a portal e purge"],
    escopo_out=["CRUD de utilizadores", "flag_smart_*"],
    vocab=[("installation.modules", "JSON de módulos activos"), ("locked", "módulo que não pode ser desligado (ex. dispatcher_admin)"), ("flag_smart_*", "permissões por utilizador")],
    reqs=[
        req("REQ-SYS-001", "Ubiquitous", "O catálogo de módulos deve distinguir núcleo, comercial e ops."),
        req("REQ-SYS-002", "Unwanted", "Módulos locked não devem ser desligados pela UI."),
        req("REQ-SYS-003", "Event-driven", "Quando um módulo muda, rotas protegidas por requireModule devem reflectir o novo estado."),
    ],
    rns=[
        rn("RN-SYS-001", "Separação instalação vs flags", "Admin gere menus", "sempre", "Complementos controlam produto; flags controlam menu fino do utilizador", motivo="Evitar ambiguidade"),
        rn("RN-SYS-002", "Dispatcher locked", "Qualquer mode", "sempre", "dispatcher_admin permanece on", motivo="Operação e suporte"),
    ],
    fluxos="""```mermaid
flowchart LR
  A[Complementos] --> B[Catálogo]
  B --> C[Toggle módulo]
  C --> D[Persistir settings]
  D --> E[Gates UI/API]
```""",
    estados=[("enabled", "módulo on", "→ disabled"), ("disabled", "módulo off / 403 MODULE_DISABLED", "→ enabled"), ("locked", "sempre on", "—")],
    aceite=[
        ac("AC-SYS-001", "mode lite", "chamar GET /api/plans", "403 MODULE_DISABLED"),
        ac("AC-SYS-002", "mode off", "owner vê Complementos", "pode alternar para lite/full"),
    ],
    deps=["product-modes"],
    refs=["docs/manuais/03-MODULOS-E-FORMAS-DE-TRABALHO.md", "docs/manuais/04-MANUAL-ADMINISTRATIVO.md"],
)

add(
    slug="direct-totem-mode",
    nome="Direct Totem (UI mínima)",
    modos="Direct",
    atores="owner_system, admin_sql, admin, operator",
    ui="/publish-totem (home), /media, /publishers, /users, /dispatcher-*, /settings",
    api="perfil compact / single_publisher",
    proposito="Experiência monousuário: publicar mídias nos totens da própria organização sem menus comerciais.",
    escopo_in=["Menu curto", "Home em Publicar em Totem", "Uma organização implícita"],
    escopo_out=["Anunciantes, planos, billing, OTA admin (presets off)"],
    vocab=[("single_publisher", "perfil Direct"), ("core_publish", "publicação + mídias")],
    reqs=[
        req("REQ-DIR-001", "State-driven", "Enquanto mode=off, o menu Direct deve ser o menu principal."),
        req("REQ-DIR-002", "Unwanted", "Itens exclusivos Lite/Pro não devem aparecer no menu Direct."),
    ],
    rns=[
        rn("RN-DIR-001", "Home Direct", "Login em mode=off", "sempre", "destino operacional principal é Publicar em Totem", motivo="Ciclo curto de publicação"),
    ],
    fluxos="""```mermaid
flowchart TD
  Login --> Home[Publicar em Totem]
  Home --> Midia[Biblioteca]
  Home --> Org[Sua organização]
  Home --> Users[Usuários]
  Home --> Disp[Dispatcher]
  Home --> Settings
```""",
    estados=[("activo", "mode=off", "→ inactivo quando lite/full")],
    aceite=[ac("AC-DIR-001", "mode=off e owner_system", "abrir menu", "vê Publicar, Biblioteca, Organização, Usuários, Complementos, Dispatcher, Configurações")],
    deps=["product-modes", "publish-totem", "media-library"],
    refs=["docs/manuais/02-GUIA-PRIMEIRA-VEZ-UTILIZADOR.md"],
)

# ---------------------------------------------------------------------------
# Publicação e conteúdo
# ---------------------------------------------------------------------------
add(
    slug="publish-totem",
    nome="Publicar em Totem",
    modos="Direct (menu principal); API disponível noutros modos",
    atores="owner_system, admin_sql, admin, operator, publisher_user",
    ui="/publish-totem, /publish-totem/:id",
    api="/api/totems, /api/simple-publish, totem direct media",
    proposito="Central operacional Direct: cards de totens, publicação de mídias, telemetria, diagnóstico e atalho a controlo remoto.",
    escopo_in=["Listar totens", "Adicionar mídia (biblioteca/upload)", "Ver reprodução e horário", "Diagnóstico ao vivo", "Habilitar/desabilitar/excluir", "Abrir remoto"],
    escopo_out=["Campanhas multi-anunciante", "Quick-publish comercial", "Planos/billing"],
    vocab=[("UIN/Ativação", "identidade do totem no Player"), ("Device ID", "id canónico UPPERCASE"), ("lease de diagnóstico", "janela temporária de amostras detalhadas"), ("direct media", "associação mídia↔totem sem campanha")],
    reqs=[
        req("REQ-PUB-001", "Ubiquitous", "Cada card deve mostrar estado operacional Online/Offline/Erro/Pendente."),
        req("REQ-PUB-002", "Event-driven", "Quando o rato entra num card habilitado, o painel deve subscrever telemetria desse totem."),
        req("REQ-PUB-003", "Unwanted", "Totem com mídias associadas não pode ser excluído."),
        req("REQ-PUB-004", "State-driven", "Enquanto o totem estiver desabilitado, telemetria e diagnóstico devem ficar inactivos no card."),
        req("REQ-PUB-005", "Optional", "O operador pode iniciar diagnóstico ao vivo por ~120s e expandir métricas."),
    ],
    rns=[
        rn("RN-PUB-001", "Exclusão só sem mídias", "Operador clica excluir", "media_count_total > 0", "lixeira desactivada / exclusão bloqueada", motivo="Evitar órfãos"),
        rn("RN-PUB-002", "Desabilitado sem telemetria", "Totem isActive=false", "sempre", "card não inicia hover telemetry nem diagnóstico", motivo="Reduzir tráfego e ruído"),
        rn("RN-PUB-003", "UIN de activação", "Novo totem criado", "sempre", "exibe código de activação copiável usado pelo Player", motivo="Pareamento"),
        rn("RN-PUB-004", "Diagnóstico opcional", "Operador activa diagnóstico", "lease activo", "Player envia observation.sample sem alterar a fila", motivo="Observabilidade sob pedido"),
        rn("RN-PUB-005", "Device ID canónico", "Qualquer tratamento de deviceId", "sempre", "valor TRIM + UPPER", motivo="Evitar mismatch case-sensitive"),
    ],
    fluxos="""### Publicar mídia
```mermaid
flowchart TD
  A[Card do totem] -->|+ Mídia| B{Origem}
  B -->|Biblioteca| C[Seleccionar]
  B -->|Disco| D[Upload]
  C --> E[Associar ao totem]
  D --> E
  E --> F[Player recebe plano no próximo sync/dispatch]
```
### Excluir
```mermaid
flowchart TD
  A[Lixeira] --> B{Tem mídias?}
  B -->|Sim| C[Bloqueado]
  B -->|Não| D[Confirmar]
  D --> E[Apagar totem]
```""",
    estados=[
        ("Online", "heartbeat recente", "→ Offline/Erro"),
        ("Offline", "sem presença", "→ Online"),
        ("Desabilitado", "isActive=false", "→ Habilitado"),
        ("playing/idle/display_off/error", "estado de reprodução no card", "via telemetria"),
    ],
    aceite=[
        ac("AC-PUB-001", "totem online habilitado com mídia", "passar rato no card", "mostra playing ou idle e chip de tempo real/fallback"),
        ac("AC-PUB-002", "totem com 3 mídias", "tentar excluir", "acção bloqueada"),
        ac("AC-PUB-003", "diagnóstico activo com amostra", "clicar Exibir métricas", "painel mostra ExoPlayer/saúde/dispositivo"),
    ],
    deps=["media-library", "totems", "telemetry-heartbeat", "remote-control", "player-ad"],
    refs=["docs/manuais/07-MANUAL-PUBLICAR-EM-TOTEM.md", "frontend/src/pages/PublishTotem/PublishTotem.tsx"],
)

add(
    slug="media-library",
    nome="Biblioteca de mídias",
    modos="all",
    atores="owner/admin, marketing, publisher",
    ui="/media",
    api="/api/media",
    proposito="Upload, catalogação, aprovação e reutilização de vídeos/imagens/HTML para publicação.",
    escopo_in=["Upload", "Metadados", "Aprovação/activação", "Thumbnails", "Associação a totens via publicação"],
    escopo_out=["Edição gráfica publish-board", "Motor de campanhas"],
    vocab=[("media_id", "PK da mídia"), ("approval_status", "pending/approved/rejected"), ("is_active", "disponível para publicação")],
    reqs=[
        req("REQ-MED-001", "Ubiquitous", "Toda mídia deve ter tipo, nome e armazenamento associado."),
        req("REQ-MED-002", "Unwanted", "Mídia inactiva não deve aparecer como disponível para adicionar a totem."),
        req("REQ-MED-003", "Event-driven", "Quando o upload conclui, a mídia deve ficar referenciável por media_id."),
    ],
    rns=[
        rn("RN-MED-001", "Disponibilidade", "Listar biblioteca para totem", "is_active=false", "mídia omitida da lista disponível", motivo="Evitar conteúdo desactivado"),
        rn("RN-MED-002", "Sem duplicar no totem", "Adicionar da biblioteca", "já associada ao totem", "não listar novamente", motivo="Evitar duplicatas na fila"),
    ],
    fluxos="""```mermaid
flowchart TD
  Upload --> Storage
  Storage --> Catalogo
  Catalogo --> Aprovacao
  Aprovacao --> Publicacao[Publicar em Totem / Quick Publish]
```""",
    estados=[("pending_approval", "aguarda aprovação", "→ approved/rejected"), ("approved/active", "publicável", "→ inactive"), ("inactive", "oculta", "→ active")],
    aceite=[ac("AC-MED-001", "mídia inactiva na biblioteca", "abrir Da biblioteca num totem", "mídia não aparece")],
    deps=["publish-totem", "quick-publish"],
    refs=["frontend/src/pages", "backend/src/routes"],
)

add(
    slug="vinhetas",
    nome="Biblioteca de vinhetas",
    modos="Lite, Pro",
    atores="admin, marketing, subscriber",
    ui="/vinhetas",
    api="/api/media (domínio vinheta)",
    proposito="Gestão de vinhetas intercaladas na programação, separada da biblioteca geral.",
    escopo_in=["Cadastro e uso de vinhetas no mix"],
    escopo_out=["Publicação Direct pura"],
    vocab=[("vinheta", "peça intercalada entre propagandas")],
    reqs=[req("REQ-VIN-001", "Ubiquitous", "Vinhetas devem ser distinguíveis de mídias de campanha no motor de fila.")],
    rns=[rn("RN-VIN-001", "Intercalação", "Gerar fila", "há vinhetas e ratio configurado", "inserir vinheta conforme fallbackPropagandasPerVinheta / regras", motivo="Branding de rede")],
    fluxos="```mermaid\nflowchart LR\n  Cadastro --> Mix --> FilaTotem\n```",
    estados=[("activa", "pode entrar no mix", "→ inactiva")],
    aceite=[ac("AC-VIN-001", "ratio configurado e vinhetas activas", "gerar dispatch", "fila contém vinhetas intercaladas")],
    deps=["media-library", "playlist-mix", "player-ad"],
    refs=[],
)

add(
    slug="quick-publish",
    nome="Publicar em tela (quick-publish)",
    modos="Lite, Pro",
    atores="admin, marketing, subscriber_user, comercial",
    ui="/quick-publish",
    api="/api/quick-publish",
    proposito="Atalho comercial para publicar mídias de anunciante em totens elegíveis sem fluxo completo de campanha.",
    escopo_in=["Seleccionar anunciante", "Totens elegíveis", "Publicar"],
    escopo_out=["Editor de layout avançado (publish-board)", "Contratos no Lite"],
    vocab=[("elegibilidade", "totem alcançável via SPA ou plano/contrato")],
    reqs=[
        req("REQ-QP-001", "Ubiquitous", "Só totens elegíveis para o anunciante podem ser alvo."),
        req("REQ-QP-002", "State-driven", "No Lite a elegibilidade vem de SPA; no Pro também de contrato/plano."),
    ],
    rns=[
        rn("RN-QP-001", "Sem SPA/plano", "Anunciante sem acesso", "lista de totens", "lista vazia", motivo="Sem autorização comercial"),
        rn("RN-QP-002", "Lite sem contrato obrigatório", "mode=lite", "quick-publish", "contrato opcional", motivo="Ciclo curto Lite"),
    ],
    fluxos="```mermaid\nflowchart TD\n  A[Anunciante] --> B{Acesso}\n  B -->|SPA Lite| C[Totens]\n  B -->|Contrato+Plano Pro| C\n  C --> D[Seleccionar mídias]\n  D --> E[Publicar]\n```",
    estados=[("rascunho", "selecção", "→ publicado"), ("publicado", "conteúdo em fila/campanha", "—")],
    aceite=[ac("AC-QP-001", "anunciante sem SPA no Lite", "abrir quick-publish", "nenhum totem elegível")],
    deps=["subscribers", "subscriber-publisher-access", "plans", "contracts", "media-library"],
    refs=["docs/manuais/02-GUIA-PRIMEIRA-VEZ-UTILIZADOR.md"],
)

add(
    slug="publish-board",
    nome="Criar conteúdo (publish-board)",
    modos="Lite, Pro",
    atores="marketing, admin, anunciante",
    ui="/publish-board, /quick-publish?mode=create",
    api="/api/publish-board, /api/subscribers/:id/publish-board",
    proposito="Editor de layouts/presets (menu, promoção, anúncio) para gerar peças publicáveis.",
    escopo_in=["Presets", "Edição por anunciante", "Geração de mídia/artefacto"],
    escopo_out=["Reprodução no Player"],
    vocab=[("preset", "modelo de layout")],
    reqs=[req("REQ-PB-001", "Ubiquitous", "Conteúdo criado deve ficar associado ao anunciante dono.")],
    rns=[rn("RN-PB-001", "Ownership", "Guardar board", "sempre", "subscriber_id obrigatório", motivo="Isolamento multi-tenant")],
    fluxos="```mermaid\nflowchart LR\n  Preset --> Edit --> Export --> Biblioteca\n```",
    estados=[("editing", "em edição", "→ published"), ("published", "disponível", "—")],
    aceite=[ac("AC-PB-001", "anunciante A", "criar peça", "peça não aparece no contexto do anunciante B")],
    deps=["subscribers", "media-library", "menu-catalog"],
    refs=[],
)

add(
    slug="menu-catalog",
    nome="Cardápio por cliente",
    modos="Lite, Pro",
    atores="admin, marketing, anunciante",
    ui="/menu-catalog",
    api="/api/subscribers/:id/menu-catalog",
    proposito="Catálogo de produtos/cardápio digital por anunciante, integrado ao publish-board.",
    escopo_in=["CRUD itens", "Preços/categorias", "Uso em presets"],
    escopo_out=["POS/caixa"],
    vocab=[("menu item", "produto do cardápio")],
    reqs=[req("REQ-MC-001", "Ubiquitous", "Itens pertencem a um subscriber.")],
    rns=[rn("RN-MC-001", "Isolamento", "Listar cardápio", "subscriber X", "só itens de X", motivo="Multi-tenant")],
    fluxos="```mermaid\nflowchart LR\n  Itens --> Board --> Midia\n```",
    estados=[("activo", "usável", "→ inactivo")],
    aceite=[ac("AC-MC-001", "dois anunciantes", "listar catálogo de A", "não inclui itens de B")],
    deps=["subscribers", "publish-board"],
    refs=[],
)

add(
    slug="publish-templates",
    nome="Templates de publicação",
    modos="Lite, Pro",
    atores="owner_system, admin_sql, admin",
    ui="/publish-templates-admin",
    api="/api/publish-templates",
    proposito="Administração de templates/presets usados no quick-publish/board.",
    escopo_in=["CRUD templates"],
    escopo_out=["Conteúdo final do anunciante"],
    vocab=[("template", "definição reutilizável de publicação")],
    reqs=[req("REQ-PT-001", "Ubiquitous", "Templates activos devem ser listáveis pelos editores autorizados.")],
    rns=[rn("RN-PT-001", "Inactivo oculto", "template is_active=false", "listar para criação", "omitir", motivo="Controlo editorial")],
    fluxos="```mermaid\nflowchart LR\n  Admin --> Template --> QuickPublish\n```",
    estados=[("active", "disponível", "→ inactive")],
    aceite=[ac("AC-PT-001", "template inactivo", "abrir criação", "template não aparece")],
    deps=["quick-publish", "publish-board"],
    refs=[],
)

add(
    slug="campaigns",
    nome="Campanhas",
    modos="Lite, Pro",
    atores="admin, comercial, marketing, subscriber_user",
    ui="/campaigns",
    api="/api/campaigns",
    proposito="Campanhas publicitárias com elegibilidade, prioridade e calendário sobre a rede de totens.",
    escopo_in=["CRUD campanha", "Vínculo a mídias/playlists", "Elegibilidade de totens", "Estados draft→active"],
    escopo_out=["Publicação Direct sem anunciante"],
    vocab=[("campaign", "unidade comercial de entrega"), ("schedule_config", "janelas e dias")],
    reqs=[
        req("REQ-CMP-001", "Ubiquitous", "Campanha deve ter subscriber dono."),
        req("REQ-CMP-002", "State-driven", "No Pro, execução em totens exige contrato/plano válido quando aplicável."),
    ],
    rns=[
        rn("RN-CMP-001", "Pro com contrato", "mode=full e campanha a executar", "sem contrato activo", "não entra no dispatch", motivo="Modelo comercial Pro"),
        rn("RN-CMP-002", "Lite via SPA", "mode=lite", "SPA concede org", "campanha pode atingir totens da org", motivo="Caminho Lite"),
    ],
    fluxos="```mermaid\nflowchart TD\n  Draft --> Approval --> Active --> Dispatch\n  Active --> Paused\n  Active --> Finished\n```",
    estados=[("draft", "rascunho", "→ pending_approval/active"), ("active", "elegível ao motor", "→ paused/finished/cancelled"), ("paused", "suspensa", "→ active")],
    aceite=[ac("AC-CMP-001", "Pro sem contrato", "activar campanha para dispatch", "totens não recebem itens da campanha")],
    deps=["subscribers", "plans", "contracts", "subscriber-publisher-access", "dispatcher"],
    refs=["docs/manuais/03-MODULOS-E-FORMAS-DE-TRABALHO.md"],
)

add(
    slug="playlists",
    nome="Playlists",
    modos="Pro (preset)",
    atores="admin, marketing, técnico",
    ui="/playlists, /totem-playlists",
    api="/api/playlists, /api/playlist-engine",
    proposito="Composição avançada de playlists e associação a totens/campanhas.",
    escopo_in=["CRUD playlist", "Itens ordenados", "Engine de geração"],
    escopo_out=["Direct media simples"],
    vocab=[("playlist_engine", "gera fila efectiva por totem")],
    reqs=[req("REQ-PL-001", "Ubiquitous", "Playlist deve manter ordem estável dos itens.")],
    rns=[rn("RN-PL-001", "Ordem", "Gerar dispatch", "playlist activa", "respeitar order dos itens", motivo="Previsibilidade")],
    fluxos="```mermaid\nflowchart LR\n  Playlist --> Engine --> DispatchPlan\n```",
    estados=[("active", "usada pelo engine", "→ inactive")],
    aceite=[ac("AC-PL-001", "playlist com order 1..n", "gerar plano", "sequência reflecte order")],
    deps=["campaigns", "dispatcher", "media-library"],
    refs=[],
)

add(
    slug="playlist-mix",
    nome="Playlist Mix",
    modos="all (via dispatcher_admin); uso típico Pro/ops",
    atores="owner/admin, operador técnico",
    ui="/playlist-mix, /groups, /rules, /analytics",
    api="/api/playlist-mix",
    proposito="Mix por totem/grupos/regras e analytics de composição.",
    escopo_in=["Regras de mix", "Grupos", "Analytics de composição"],
    escopo_out=["Billing"],
    vocab=[("mix rule", "regra de composição")],
    reqs=[req("REQ-PMX-001", "Ubiquitous", "Regras de mix devem ser aplicáveis por totem ou grupo.")],
    rns=[rn("RN-PMX-001", "Precedência", "Conflito de regras", "sempre", "aplicar precedência documentada no engine", motivo="Determinismo")],
    fluxos="```mermaid\nflowchart TD\n  Rules --> Groups --> Totem --> Engine\n```",
    estados=[("rule_active", "aplica", "→ inactive")],
    aceite=[ac("AC-PMX-001", "duas regras conflitantes", "gerar mix", "resultado segue precedência definida")],
    deps=["dispatcher", "playlists", "totems"],
    refs=[],
)

add(
    slug="smart-playlist",
    nome="Smart Playlist",
    modos="Pro",
    atores="admin, marketing",
    ui="/smart-playlist",
    api="/api/smart-playlist",
    proposito="Sugestões e playlists inteligentes assistidas.",
    escopo_in=["Sugestão de composição"],
    escopo_out=["Substitui aprovação humana obrigatória"],
    vocab=[("smart suggestion", "proposta automática")],
    reqs=[req("REQ-SPL-001", "Optional", "O sistema pode sugerir playlists; a publicação continua sujeita a regras comerciais.")],
    rns=[rn("RN-SPL-001", "Sugestão ≠ publicação", "gerar sugestão", "sempre", "não publica sem confirmação/autorização", motivo="Controlo editorial")],
    fluxos="```mermaid\nflowchart LR\n  Dados --> Sugestao --> Revisao --> Playlist\n```",
    estados=[("suggested", "proposta", "→ accepted/rejected")],
    aceite=[ac("AC-SPL-001", "sugestão gerada", "sem confirmação", "dispatch não muda")],
    deps=["playlists", "analytics-ai"],
    refs=[],
)

# ---------------------------------------------------------------------------
# Organização
# ---------------------------------------------------------------------------
add(
    slug="organization",
    nome="Organização (publishers)",
    modos="all",
    atores="owner/admin, comercial, publisher_user",
    ui="/publishers",
    api="/api/publishers",
    proposito="Cadastro da organização dona dos ecrãs. No Direct: uma org; no multi: N orgs.",
    escopo_in=["CRUD publisher", "Dados cadastrais"],
    escopo_out=["Totens sem local"],
    vocab=[("publisher", "organização"), ("single_publisher", "modo Direct")],
    reqs=[
        req("REQ-ORG-001", "State-driven", "No Direct a operação assume uma organização principal."),
        req("REQ-ORG-002", "Ubiquitous", "Toda org multi deve poder possuir locais."),
    ],
    rns=[
        rn("RN-ORG-001", "Inventário sob org", "Criar local/totem", "sempre", "local pertence a publisher", motivo="Cadeia publisher→locals→totems"),
    ],
    fluxos="```mermaid\nflowchart LR\n  Publisher --> Locals --> Totems\n```",
    estados=[("active", "operacional", "→ inactive")],
    aceite=[ac("AC-ORG-001", "Direct", "listar organizações na operação diária", "fluxo cabe em Sua organização / publishers")],
    deps=["locals", "totems"],
    refs=["docs/manuais/03-MODULOS-E-FORMAS-DE-TRABALHO.md"],
)

add(
    slug="locals",
    nome="Unidades / locais",
    modos="all",
    atores="admin, publisher, comercial",
    ui="/locals",
    api="/api/locals",
    proposito="Locais físicos/lógicos da organização onde os totens são instalados.",
    escopo_in=["CRUD local", "Vínculo a publisher"],
    escopo_out=["Autorização comercial (SPA/planos)"],
    vocab=[("local", "unidade da org")],
    reqs=[req("REQ-LOC-001", "Ubiquitous", "Cada local deve referenciar um publisher.")],
    rns=[rn("RN-LOC-001", "Totem exige local", "criar totem", "sem local válido", "criação inválida/bloqueada", motivo="Integridade inventário")],
    fluxos="```mermaid\nflowchart LR\n  Org --> Local --> Totem\n```",
    estados=[("active", "aceita totens", "→ inactive")],
    aceite=[ac("AC-LOC-001", "local inactivo", "atribuir novo totem", "operação rejeitada ou impedida na UI")],
    deps=["organization", "totems"],
    refs=[],
)

add(
    slug="totems",
    nome="Totens / ecrãs",
    modos="all",
    atores="admin, técnico, publisher",
    ui="/totems, /totems/status, /totems/config, /publish-totem",
    api="/api/totems",
    proposito="Inventário e estado dos totens: identidade (UIN/device), heartbeat, settings e now_playing.",
    escopo_in=["CRUD totem", "Status online", "player_settings", "activação"],
    escopo_out=["Reprodução local (Player-AD)"],
    vocab=[("UIN", "identificador de activação"), ("device_id", "canónico UPPER"), ("heartbeat", "presença periódica")],
    reqs=[
        req("REQ-TOT-001", "Ubiquitous", "Totem deve ter UIN único e pertencer a um local."),
        req("REQ-TOT-002", "Ubiquitous", "device_id armazenado deve ser canónico (trim+upper) quando presente."),
        req("REQ-TOT-003", "Event-driven", "Quando chega heartbeat válido, status tende a Online e last_heartbeat actualiza."),
    ],
    rns=[
        rn("RN-TOT-001", "Device ID canónico", "criar/atualizar/lookup", "device_id informado", "normalizar UPPER(TRIM)", motivo="Evitar falhas de pareamento"),
        rn("RN-TOT-002", "isActive", "isActive=false", "telemetria UI Direct", "desliga observação no card", motivo="Operação controlada"),
    ],
    fluxos="```mermaid\nflowchart TD\n  Cadastro --> Ativacao[UIN no Player] --> Heartbeat --> Online\n```",
    estados=[("pending_activation", "aguardando player", "→ online/offline"), ("online", "heartbeat ok", "→ offline/error"), ("offline", "sem heartbeat", "→ online"), ("maintenance/error/syncing", "estados especiais", "→ online/offline")],
    aceite=[ac("AC-TOT-001", "device_id 'abc'", "guardar", "persistido como 'ABC'")],
    deps=["locals", "telemetry-heartbeat", "player-ad"],
    refs=["docs/manuais/07-MANUAL-PUBLICAR-EM-TOTEM.md"],
)

add(
    slug="devices-smart-tvs",
    nome="Smart TVs e players",
    modos="Lite, Pro",
    atores="admin, operador técnico",
    ui="/smart-tvs, /players",
    api="/api/smart-tvs, /api/players",
    proposito="Inventário técnico de Smart TVs e players registados além do fluxo Direct simples.",
    escopo_in=["Registo de devices", "Status"],
    escopo_out=["Substitui totems"],
    vocab=[("smart_tv", "display controlado")],
    reqs=[req("REQ-DEV-001", "Ubiquitous", "Devices devem normalizar device_id canónico quando aplicável.")],
    rns=[rn("RN-DEV-001", "Canonical ID", "lookup por device_id", "sempre", "comparar forma canónica", motivo="Consistência")],
    fluxos="```mermaid\nflowchart LR\n  Registo --> Pairing --> Monitorizacao\n```",
    estados=[("online", "activo", "→ offline")],
    aceite=[ac("AC-DEV-001", "device registado", "consultar por id em case diferente", "encontra o mesmo registo")],
    deps=["totems", "player-ad"],
    refs=[],
)

add(
    slug="network-topology",
    nome="Rede visual / topologia",
    modos="Lite, Pro",
    atores="admin, técnico, publisher/subscriber",
    ui="/network-topology",
    api="/api/network",
    proposito="Visualização da hierarquia org → locais → totens / anunciantes.",
    escopo_in=["Visualização", "Navegação"],
    escopo_out=["Alterar ACL comercial"],
    vocab=[("topologia", "grafo da rede")],
    reqs=[req("REQ-NET-001", "Ubiquitous", "A topologia deve reflectir apenas entidades autorizadas ao utilizador.")],
    rns=[rn("RN-NET-001", "Escopo por role", "abrir topologia", "publisher_user", "só a sua org", motivo="Isolamento")],
    fluxos="```mermaid\nflowchart TD\n  Org --> Local --> Totem\n  Subscriber -.SPA/Plano.-> Org\n```",
    estados=[("view", "somente leitura", "—")],
    aceite=[ac("AC-NET-001", "publisher A", "abrir topologia", "não vê totens da org B")],
    deps=["organization", "locals", "totems", "subscribers"],
    refs=[],
)

# ---------------------------------------------------------------------------
# Multi comercial
# ---------------------------------------------------------------------------
add(
    slug="multi-agency",
    nome="Multi-agência",
    modos="Lite, Pro",
    atores="owner/admin, comercial, publisher_user",
    ui="/publishers (N orgs)",
    api="/api/publishers, perfil multi_agency",
    proposito="Capacidade de várias organizações na mesma instalação; base do Lite/Pro.",
    escopo_in=["N publishers", "Isolamento por org"],
    escopo_out=["Direct single_publisher UX"],
    vocab=[("multi_agency", "módulo/perfil")],
    reqs=[req("REQ-MA-001", "State-driven", "Enquanto mode lite|full, multi_agency deve estar on.")],
    rns=[rn("RN-MA-001", "Isolamento", "listagens", "utilizador de org A", "não vê dados de org B sem ACL", motivo="Multi-tenant")],
    fluxos="```mermaid\nflowchart LR\n  ModeLitePro --> MultiAgency --> Orgs\n```",
    estados=[("on", "activo", "→ off com mode=off")],
    aceite=[ac("AC-MA-001", "duas orgs", "admin lista publishers", "ambas visíveis; publisher_user só a sua")],
    deps=["product-modes", "organization"],
    refs=["docs/HANDOFF-MULTI-AGENCIA-CONTINUIDADE.md"],
)

add(
    slug="subscribers",
    nome="Anunciantes",
    modos="Lite, Pro",
    atores="owner/admin, comercial, marketing",
    ui="/subscribers",
    api="/api/subscribers",
    proposito="Cadastro de anunciantes (subscribers) que publicam conteúdo na rede de organizações.",
    escopo_in=["CRUD anunciante", "Associação a conteúdo"],
    escopo_out=["Inventário de totens"],
    vocab=[("subscriber", "anunciante")],
    reqs=[req("REQ-SUB-001", "Ubiquitous", "Anunciante precisa existir antes de SPA/contrato/campanha.")],
    rns=[rn("RN-SUB-001", "Ordem comercial", "tentar publicar sem anunciante", "sempre", "fluxo bloqueado", motivo="Cadeia comercial")],
    fluxos="```mermaid\nflowchart TD\n  Cadastro --> SPA_ou_Contrato --> Publicacao\n```",
    estados=[("active", "operacional", "→ inactive")],
    aceite=[ac("AC-SUB-001", "sem anunciante", "quick-publish", "não inicia publicação")],
    deps=["subscriber-publisher-access", "contracts", "campaigns"],
    refs=["docs/manuais/02-GUIA-PRIMEIRA-VEZ-UTILIZADOR.md"],
)

add(
    slug="subscriber-publisher-access",
    nome="Anunciante ↔ Organização (SPA)",
    modos="Lite (essencial), Pro (também aceite)",
    atores="owner_system, admin_sql, admin",
    ui="/subscriber-publisher-access",
    api="/api/subscriber-access",
    proposito="Vínculo directo anunciante→organização/rede (override). Caminho principal no Lite.",
    escopo_in=["Conceder/revogar acesso", "access_type=override"],
    escopo_out=["Substitui planos no Pro (é paralelo)"],
    vocab=[("SPA", "subscriber_publisher_access"), ("override", "acesso directo Lite")],
    reqs=[
        req("REQ-SPA-001", "Ubiquitous", "No Lite, publicação comercial exige SPA activo para a org alvo."),
        req("REQ-SPA-002", "Event-driven", "Quando SPA é revogado, totens da org deixam de ser elegíveis para esse anunciante."),
    ],
    rns=[
        rn("RN-SPA-001", "Lite obrigatório", "mode=lite e quick-publish", "sem SPA", "totens vazios", motivo="Autorização Lite"),
        rn("RN-SPA-002", "Pro aceita SPA", "mode=full", "SPA presente", "engine pode usar SPA além de plano", motivo="Compatibilidade"),
    ],
    fluxos="```mermaid\nflowchart TD\n  Anunciante --> SPA --> Org --> Locais --> Totens\n```",
    estados=[("granted", "activo", "→ revoked"), ("revoked", "sem elegibilidade", "→ granted")],
    aceite=[ac("AC-SPA-001", "Lite sem SPA", "listar totens no quick-publish", "lista vazia")],
    deps=["subscribers", "organization", "quick-publish"],
    refs=["docs/manuais/03-MODULOS-E-FORMAS-DE-TRABALHO.md"],
)

add(
    slug="plans",
    nome="Planos e acessos",
    modos="Pro",
    atores="owner/admin, comercial, faturamento",
    ui="/plan-publisher-access, /expired",
    api="/api/plans",
    proposito="Planos comerciais com acessos a publishers/locais e limites de rede.",
    escopo_in=["CRUD plano", "plan_publisher_access", "plan_local_access"],
    escopo_out=["SPA Lite"],
    vocab=[("plan_id", "plano comercial")],
    reqs=[
        req("REQ-PLN-001", "State-driven", "Módulo plans só disponível em mode=full."),
        req("REQ-PLN-002", "Ubiquitous", "Contrato Pro referencia plan_id para execução."),
    ],
    rns=[
        rn("RN-PLN-001", "Lite bloqueado", "mode=lite", "API /plans", "403 MODULE_DISABLED", motivo="Preset Lite"),
        rn("RN-PLN-002", "Limites de rede", "plano com limites", "exceder", "impedir novos acessos/publicações conforme regra do plano", motivo="Comercial"),
    ],
    fluxos="```mermaid\nflowchart TD\n  Plano --> AccessPub --> AccessLocal --> Totens\n  Plano --> Contrato\n```",
    estados=[("active", "vendável/associável", "→ expired/inactive")],
    aceite=[ac("AC-PLN-001", "mode lite", "GET /api/plans", "403")],
    deps=["contracts", "organization", "locals"],
    refs=["docs/manuais/03-MODULOS-E-FORMAS-DE-TRABALHO.md"],
)

add(
    slug="contracts",
    nome="Contratos",
    modos="Pro",
    atores="admin, faturamento, comercial",
    ui="/subscriber-contracts, /publisher-contracts, /contracts/*",
    api="/api/contracts",
    proposito="Contratos de anunciantes/organizações; no Pro amarram campanhas ao plan_id.",
    escopo_in=["CRUD contrato", "Vínculo plan_id", "Vigência"],
    escopo_out=["Obrigatório no Lite"],
    vocab=[("contrato activo", "dentro da vigência e status válido")],
    reqs=[req("REQ-CTR-001", "State-driven", "Campanhas Pro executáveis devem estar ligadas a contrato activo com plano.")],
    rns=[rn("RN-CTR-001", "Sem contrato", "campanha Pro", "contrato ausente/expirado", "não despacha", motivo="Modelo Pro")],
    fluxos="```mermaid\nflowchart LR\n  Subscriber --> Contrato --> Plano --> Rede\n```",
    estados=[("draft", "rascunho", "→ active"), ("active", "vigente", "→ expired/cancelled")],
    aceite=[ac("AC-CTR-001", "contrato expirado", "dispatch de campanha Pro", "itens não entram")],
    deps=["plans", "subscribers", "campaigns", "billing"],
    refs=[],
)

add(
    slug="billing",
    nome="Faturamento e cobrança",
    modos="Pro",
    atores="owner/admin, operador_faturamento, publisher_user, subscriber_user",
    ui="/billing, Settings Financeiro",
    api="/api/subscriber-billing, /api/publisher-billing, /api/billing-control, /api/financial-admin",
    proposito="Faturas, KPIs, cobrança (ex. PIX), bloqueio por atraso.",
    escopo_in=["Emissão/consulta faturas", "Status pagamento", "Bloqueio operacional por atraso"],
    escopo_out=["Direct Totem (aba financeira oculta)"],
    vocab=[("overdue", "atraso"), ("payout", "pagamento a publisher")],
    reqs=[
        req("REQ-BIL-001", "State-driven", "Módulo billing apenas em mode=full."),
        req("REQ-BIL-002", "Event-driven", "Quando fatura fica overdue conforme política, o sistema pode restringir publicações."),
    ],
    rns=[
        rn("RN-BIL-001", "Direct sem Financeiro", "mode=off", "Settings", "aba Financeiro oculta", motivo="Preset Direct"),
        rn("RN-BIL-002", "Bloqueio por atraso", "política activa e overdue", "tentar publicar", "bloqueio conforme billing-control", motivo="Risco financeiro"),
    ],
    fluxos="```mermaid\nflowchart TD\n  Contrato --> Fatura --> Pagamento --> Quitado\n  Fatura --> Overdue --> Bloqueio\n```",
    estados=[("pending", "a pagar", "→ paid/overdue"), ("overdue", "atrasada", "→ paid"), ("paid", "quitada", "—")],
    aceite=[ac("AC-BIL-001", "mode off", "abrir Settings", "sem aba Financeiro")],
    deps=["contracts", "plans", "subscribers"],
    refs=["docs/manuais/03-MODULOS-E-FORMAS-DE-TRABALHO.md"],
)

add(
    slug="commercial-reports",
    nome="Relatórios comerciais",
    modos="Pro",
    atores="admin, comercial, faturamento",
    ui="/reports",
    api="/api/reports",
    proposito="Relatórios e visão comercial avançada da rede/anunciantes.",
    escopo_in=["Geração e download de relatórios"],
    escopo_out=["Telemetria técnica de player"],
    vocab=[("report", "artefacto gerado")],
    reqs=[req("REQ-REP-001", "State-driven", "Disponível só com commercial_reports on (Pro).")],
    rns=[rn("RN-REP-001", "Escopo", "gerar relatório", "role limitado", "só dados autorizados", motivo="Privacidade/ACL")],
    fluxos="```mermaid\nflowchart LR\n  Pedido --> Geracao --> Download\n```",
    estados=[("pending", "fila", "→ generating/completed/failed")],
    aceite=[ac("AC-REP-001", "mode lite", "abrir /reports via API module gate", "403 ou item oculto")],
    deps=["billing", "campaigns", "subscribers"],
    refs=[],
)

add(
    slug="subscriber-portal",
    nome="Portal do anunciante",
    modos="Lite/Pro (opcional)",
    atores="owner/admin_sql; publisher_user; subscriber_user",
    ui="Complementos → Portal; /subscriber-login; /subscriber/*",
    api="settings portal.*; autenticação portal",
    proposito="Self-service por slug/subdomínio para organizações e anunciantes.",
    escopo_in=["Tenancy por slug", "Login portal", "Subset de funções"],
    escopo_out=["Mudar mode da instalação"],
    vocab=[("slug", "identificador de portal"), ("subdomínio", "publisher|subscriber.base")],
    reqs=[req("REQ-POR-001", "Optional", "Portal pode ser activado sem ser o master switch.")],
    rns=[rn("RN-POR-001", "Isolamento portal", "subscriber_user autentica", "sempre", "vê só o seu tenant", motivo="SaaS multi-tenant")],
    fluxos="```mermaid\nflowchart TD\n  DNS --> PortalLogin --> AppRestrita\n```",
    estados=[("portal_off", "desligado", "→ portal_on"), ("portal_on", "activo", "→ portal_off")],
    aceite=[ac("AC-POR-001", "portal on", "login subscriber A", "não acede dados de B")],
    deps=["subscribers", "organization", "system-modules"],
    refs=["docs/manuais/04-MANUAL-ADMINISTRATIVO.md"],
)

add(
    slug="commercial-purge",
    nome="Purge comercial",
    modos="Lite, Pro (admin)",
    atores="owner_system, admin_sql",
    ui="Complementos → Purge",
    api="/api/installation/commercial-purge/*",
    proposito="Apagar dados comerciais de forma explícita (dry-run, scopes, audit). Nunca ligado ao OFF do multi.",
    escopo_in=["Dry-run", "Purge por scope", "Auditoria"],
    escopo_out=["Apagar inventário de totens sem confirmação explícita de scope"],
    vocab=[("dry-run", "simulação sem delete"), ("scope", "conjunto de entidades")],
    reqs=[
        req("REQ-PRG-001", "Unwanted", "Mode=off não deve disparar purge."),
        req("REQ-PRG-002", "Ubiquitous", "Purge real exige confirmação explícita após dry-run."),
    ],
    rns=[
        rn("RN-PRG-001", "OFF ≠ purge", "mudar para Direct", "sempre", "dados comerciais permanecem", motivo="Segurança"),
        rn("RN-PRG-002", "Só owner/admin_sql", "outro role", "chamar purge", "negado", motivo="Governança"),
    ],
    fluxos="```mermaid\nflowchart TD\n  DryRun --> Revisao --> Confirm --> AuditLog\n```",
    estados=[("preview", "dry-run", "→ executed/cancelled")],
    aceite=[ac("AC-PRG-001", "dados Lite existentes", "mode off", "dados ainda consultáveis até purge explícito")],
    deps=["system-modules", "product-modes"],
    refs=["docs/manuais/04-MANUAL-ADMINISTRATIVO.md"],
)

# ---------------------------------------------------------------------------
# Users / admin
# ---------------------------------------------------------------------------
add(
    slug="users-access",
    nome="Usuários e acessos",
    modos="all",
    atores="owner_system, admin_sql, admin",
    ui="/users",
    api="/api/users, /api/roles, /api/permissions",
    proposito="CRUD de utilizadores, roles e flags de menu (flag_smart_*).",
    escopo_in=["Criar/editar users", "Roles", "Flags"],
    escopo_out=["Módulos de instalação"],
    vocab=[("role", "papel global"), ("flag_smart_*", "atalhos/permissões finas")],
    reqs=[req("REQ-USR-001", "Ubiquitous", "Todo acesso autenticado deve ter role válida.")],
    rns=[
        rn("RN-USR-001", "Owner soberano", "acções de mode/purge", "role owner/admin_sql", "permitido; demais negado", motivo="Governança"),
        rn("RN-USR-002", "Flags ≠ módulos", "esconder item de menu", "flag off", "não desliga API module se módulo on", motivo="Separação de conceitos"),
    ],
    fluxos="```mermaid\nflowchart LR\n  Admin --> User --> Role --> Flags --> Menu\n```",
    estados=[("active", "pode autenticar", "→ disabled")],
    aceite=[ac("AC-USR-001", "utilizador sem flag técnica", "menu dispatcher em alguns perfis", "item oculto embora módulo on")],
    deps=["auth-security", "system-modules"],
    refs=["docs/manuais/03-MODULOS-E-FORMAS-DE-TRABALHO.md"],
)

add(
    slug="auth-security",
    nome="Autenticação e segurança",
    modos="all",
    atores="todos",
    ui="/login, /forgot-password, /reset-password, Settings 2FA/Senha",
    api="/api/auth",
    proposito="Login, recuperação de senha, 2FA e sessão JWT do painel.",
    escopo_in=["Login", "Reset", "2FA", "Sessão"],
    escopo_out=["Auth do Player por UIN/token de dispositivo"],
    vocab=[("JWT", "token do painel"), ("device token", "token do Player")],
    reqs=[
        req("REQ-AUTH-001", "Ubiquitous", "Rotas autenticadas do painel exigem JWT válido."),
        req("REQ-AUTH-002", "Unwanted", "JWT de painel não deve ser usado como credencial permanente do Player."),
    ],
    rns=[rn("RN-AUTH-001", "Player separado", "Player autentica", "sempre", "usa UIN/token de dispositivo", motivo="Modelo edge")],
    fluxos="```mermaid\nflowchart TD\n  Login --> JWT --> API\n  Forgot --> ResetLink --> NovaSenha\n```",
    estados=[("anonymous", "sem sessão", "→ authenticated"), ("authenticated", "JWT válido", "→ expired/logged_out")],
    aceite=[ac("AC-AUTH-001", "JWT expirado", "chamar API autenticada", "401")],
    deps=["users-access"],
    refs=["docs/websocket-nginx-unexpected-response-200.md"],
)

add(
    slug="dashboard",
    nome="Dashboard",
    modos="Lite, Pro (Direct usa Publicar como home)",
    atores="todos com painel",
    ui="/dashboard",
    api="/api/dashboard, /api/alerts",
    proposito="Visão operacional/comercial (totens offline, KPIs).",
    escopo_in=["Widgets de estado", "Alertas"],
    escopo_out=["Substitui Publicar em Totem no Direct"],
    vocab=[("KPI", "indicador")],
    reqs=[req("REQ-DSH-001", "State-driven", "No Direct a home operacional é Publicar em Totem.")],
    rns=[rn("RN-DSH-001", "Escopo", "dashboard", "role publisher", "só dados da org", motivo="ACL")],
    fluxos="```mermaid\nflowchart LR\n  Metrics --> Widgets --> Alerts\n```",
    estados=[("ok", "sem alertas críticos", "→ warning/critical")],
    aceite=[ac("AC-DSH-001", "totem offline", "abrir dashboard", "alerta/indicador reflecte offline")],
    deps=["totems", "telemetry-heartbeat"],
    refs=[],
)

add(
    slug="settings",
    nome="Configurações",
    modos="all",
    atores="owner/admin/operator; subset publisher/subscriber",
    ui="/settings",
    api="/api/settings, /api/logs, /api/player-apk",
    proposito="Definições gerais, logs, APK, 2FA/senha; financeiro só fora do Direct.",
    escopo_in=["Abas gerais", "APK", "Logs", "Segurança"],
    escopo_out=["Complementos (página própria)"],
    vocab=[("aba APK", "central de download Player-AD")],
    reqs=[
        req("REQ-SET-001", "Ubiquitous", "Settings deve expor a aba APK após Geral."),
        req("REQ-SET-002", "State-driven", "Aba Financeiro oculta em Direct."),
    ],
    rns=[
        rn("RN-SET-001", "APK por papel", "download APK", "role não autorizada", "bloqueado", motivo="Controlo de distribuição"),
        rn("RN-SET-002", "Financeiro Pro", "mode off", "Settings", "sem Financeiro", motivo="Preset"),
    ],
    fluxos="```mermaid\nflowchart TD\n  Settings --> Geral\n  Settings --> APK\n  Settings --> Logs\n  Settings --> Seguranca\n```",
    estados=[("ok", "config carregada", "—")],
    aceite=[ac("AC-SET-001", "mode off", "abrir Settings", "há APK; não há Financeiro")],
    deps=["player-apk-settings", "auth-security", "billing"],
    refs=["docs/instalacao/04-PLAYER-AD.md"],
)

add(
    slug="tags",
    nome="Tags",
    modos="all (menu típico Lite/Pro)",
    atores="admin",
    ui="/tags",
    api="/api/tags",
    proposito="Etiquetas para organização de entidades/conteúdo.",
    escopo_in=["CRUD tags", "Associação"],
    escopo_out=["ACL"],
    vocab=[("tag", "rótulo")],
    reqs=[req("REQ-TAG-001", "Ubiquitous", "Tags devem ser reutilizáveis entre entidades suportadas.")],
    rns=[rn("RN-TAG-001", "Opcional", "publicar sem tags", "sempre", "permitido", motivo="Não bloquear operação")],
    fluxos="```mermaid\nflowchart LR\n  Tag --> Entidade\n```",
    estados=[("active", "usável", "→ archived")],
    aceite=[ac("AC-TAG-001", "criar tag", "associar a mídia", "mídia lista a tag")],
    deps=["media-library"],
    refs=[],
)

add(
    slug="qr-codes",
    nome="QR-Codes",
    modos="Lite, Pro",
    atores="admin",
    ui="/qr-codes",
    api="/api/qrcodes, /api/qr-codes",
    proposito="Geração e gestão de QR codes ligados a campanhas/conteúdo.",
    escopo_in=["Gerar", "Listar", "Download"],
    escopo_out=["Pagamentos"],
    vocab=[("qr", "código QR")],
    reqs=[req("REQ-QR-001", "Ubiquitous", "QR gerado deve manter URL/alvo estável.")],
    rns=[rn("RN-QR-001", "Alvo válido", "gerar QR", "alvo inválido", "rejeitar", motivo="Evitar links quebrados")],
    fluxos="```mermaid\nflowchart LR\n  Alvo --> Gerar --> Download\n```",
    estados=[("active", "válido", "→ revoked")],
    aceite=[ac("AC-QR-001", "alvo válido", "gerar", "ficheiro/imagem disponível")],
    deps=["campaigns"],
    refs=[],
)

add(
    slug="admin-tools",
    nome="Admin Tools",
    modos="all (menu típico Lite/Pro/técnico)",
    atores="owner/admin/técnico",
    ui="/admin-tools",
    api="/api/export-*, /api/advanced-schedules",
    proposito="Ferramentas administrativas: exports, schedules e utilitários de ops.",
    escopo_in=["Exports", "Agendamentos avançados"],
    escopo_out=["Purge comercial (Complementos)"],
    vocab=[("export", "extracção de dados")],
    reqs=[req("REQ-ADM-001", "Ubiquitous", "Ferramentas destrutivas exigem role elevada.")],
    rns=[rn("RN-ADM-001", "Auditoria", "export sensível", "sempre", "registar quem executou quando possível", motivo="Compliance")],
    fluxos="```mermaid\nflowchart LR\n  Admin --> Tool --> Resultado\n```",
    estados=[("idle", "—", "→ running/completed/failed")],
    aceite=[ac("AC-ADM-001", "role insuficiente", "abrir tool sensível", "negado")],
    deps=["users-access", "dispatcher"],
    refs=[],
)

add(
    slug="backups-notifications",
    nome="Backups e notificações",
    modos="all",
    atores="admin",
    ui="Admin/Settings",
    api="/api/backups, /api/notifications, /api/email, /api/webhooks",
    proposito="Backups do sistema e canais de notificação operacional.",
    escopo_in=["Agendar/restaurar backup", "Notificações email/webhook"],
    escopo_out=["Backup do APK Player"],
    vocab=[("retention", "retenção de backups")],
    reqs=[req("REQ-BKP-001", "Ubiquitous", "Backups completados devem respeitar retenção configurada.")],
    rns=[rn("RN-BKP-001", "Retenção", "backup antigo além da política", "job de limpeza", "remover ficheiro+registo", motivo="Disco")],
    fluxos="```mermaid\nflowchart TD\n  Schedule --> Backup --> Store --> Retention\n```",
    estados=[("pending", "agendado", "→ running/completed/failed")],
    aceite=[ac("AC-BKP-001", "retenção N dias", "passar N", "backups antigos removidos")],
    deps=["settings"],
    refs=[],
)

# ---------------------------------------------------------------------------
# Player / ops
# ---------------------------------------------------------------------------
add(
    slug="player-ad",
    nome="Player-AD",
    modos="all",
    atores="técnico de campo, admin; processo no TV Box",
    ui="App Android; docs/instalação; sem menu próprio",
    api="/api/player/*",
    proposito="Cliente Android TV Box: reproduz fila, heartbeat/sync, OTA, comandos remotos e telemetria.",
    escopo_in=["Playback", "Cache", "Agenda de tela", "Sync/comandos", "OTA client"],
    escopo_out=["UI administrativa web"],
    vocab=[("DispatchPlan", "plano de mídias"), ("EMPTY_PLAN", "plano vazio intencional"), ("displayIdle", "tela off por agenda")],
    reqs=[
        req("REQ-PAD-001", "Ubiquitous", "Player deve autenticar com UIN e deviceId canónico."),
        req("REQ-PAD-002", "State-driven", "Em displayIdle o Player não reproduz mídias mas mantém presença/comandos."),
        req("REQ-PAD-003", "Unwanted", "Comandos destrutivos não devem ser reexecutados automaticamente após reboot sem recibo."),
        req("REQ-PAD-004", "Event-driven", "Troca vídeo→vídeo deve preservar último frame durante prepare quando possível."),
    ],
    rns=[
        rn("RN-PAD-001", "EMPTY_PLAN passivo", "servidor devolve plano vazio válido", "sempre", "não reiniciar agressivamente; aguardar nova versão", motivo="Poupar I/O"),
        rn("RN-PAD-002", "Recibo antes de reboot", "comando reboot/restart/config destrutiva", "antes do efeito", "persistir ID em disco", motivo="At-most-once"),
        rn("RN-PAD-003", "Thread UI", "mexer ExoPlayer", "sempre", "Dispatchers.Main", motivo="Crash wrong thread"),
        rn("RN-PAD-004", "Agenda off", "entra idle", "sempre", "index=0 para retomar na primeira mídia", motivo="Previsibilidade"),
    ],
    fluxos="""```mermaid
flowchart TD
  Start --> Heartbeat
  Heartbeat --> Commands
  Heartbeat --> NeedsDispatch{needsDispatch?}
  NeedsDispatch -->|sim| Dispatch
  Dispatch --> PlayLoop
  PlayLoop --> SyncEventos
  SyncEventos --> Commands
```""",
    estados=[("ACTIVE", "reproduzindo", "→ EMPTY/IDLE/OFF"), ("EMPTY_PLAN", "sem mídias", "→ ACTIVE"), ("displayIdle", "tela off", "→ playing"), ("ERROR", "falha média/rede", "→ retry")],
    aceite=[
        ac("AC-PAD-001", "agenda off", "passar horário", "para reprodução e mantém heartbeat"),
        ac("AC-PAD-002", "mesmo reboot command reentregue", "após reboot com recibo", "não reinicia de novo"),
    ],
    deps=["telemetry-heartbeat", "remote-control", "ota-updates", "dispatcher"],
    refs=["docs/instalacao/04-PLAYER-AD.md", "docs/HISTORICO-TECNICO-2026-08-08.md"],
)

add(
    slug="player-apk-settings",
    nome="Central APK",
    modos="all",
    atores="owner/admin/técnico (download); admin OTA",
    ui="/settings aba APK",
    api="/api/player-apk",
    proposito="Fonte oficial da versão Android designada, download autenticado e documentação do Player-AD.",
    escopo_in=["Versão designada", "Download", "Documentos", "Link OTA"],
    escopo_out=["Compilar APK no servidor"],
    vocab=[("player_release_channels", "ponteiro da versão oficial"), ("designated", "versão de produção/testing")],
    reqs=[
        req("REQ-APK-001", "Ubiquitous", "Deve existir no máximo uma designação por plataforma/canal."),
        req("REQ-APK-002", "Ubiquitous", "Download exige autenticação e role autorizada."),
    ],
    rns=[
        rn("RN-APK-001", "Activar OTA designa", "activar update Android", "sempre", "actualiza player_release_channels production", motivo="Fonte única"),
        rn("RN-APK-002", "Docs autenticados", "abrir manual via API", "sem JWT", "401", motivo="Não expor docs públicos sem controlo"),
    ],
    fluxos="```mermaid\nflowchart TD\n  OTAUpload --> Activate --> Designate --> SettingsAPK --> Download\n```",
    estados=[("no_designation", "aviso na UI", "→ designated"), ("designated", "download disponível", "→ replaced")],
    aceite=[ac("AC-APK-001", "sem designação", "abrir aba APK", "aviso para activar OTA"), ac("AC-APK-002", "subscriber", "GET designated", "negado se fora das roles")],
    deps=["ota-updates", "settings"],
    refs=["docs/player-apk/", "docs/instalacao/04-PLAYER-AD.md"],
)

add(
    slug="remote-control",
    nome="Controlo remoto",
    modos="all",
    atores="admin, técnico, operadores em Publicar",
    ui="TotemRemoteControl em /publish-totem",
    api="POST /api/totems/:id/commands*; /api/player/command-result; pendingCommands no sync",
    proposito="Enfileirar e entregar comandos ao Player (restart, sync, screenshot, orientação, cache, display force).",
    escopo_in=["Criar comando", "Histórico", "Screenshots", "Entrega híbrida sync+heartbeat"],
    escopo_out=["SSH no aparelho"],
    vocab=[("pending", "à entrega"), ("sent", "entregue à espera de ACK"), ("lease", "janela de reentrega só para idempotentes")],
    reqs=[
        req("REQ-RMT-001", "Ubiquitous", "Comandos devem ser entregues pelo sync de eventos quando houver tráfego; heartbeat é fallback."),
        req("REQ-RMT-002", "Unwanted", "Comandos destrutivos (reboot/restart/config/purge/invalidate/screenshot) não devem ser reentregues automaticamente."),
        req("REQ-RMT-003", "Event-driven", "Quando o Player confirma completed/failed, o comando deixa de ser elegível."),
    ],
    rns=[
        rn("RN-RMT-001", "Idempotentes reentregáveis", "sent sem ACK >60s", "tipo sync/display_force/ping", "até 3 reentregas", motivo="Fiabilidade sem efeito colateral"),
        rn("RN-RMT-002", "Destrutivos one-shot", "sent sem ACK", "reboot/restart/…", "não reclamar de novo", motivo="Evitar loop de reset"),
        rn("RN-RMT-003", "Duplicata no Player", "mesmo id já processado", "sempre", "ACK completed duplicate sem reexecutar", motivo="At-most-once"),
    ],
    fluxos="""```mermaid
flowchart TD
  UI --> Pending
  Pending --> Claim[claim no sync/heartbeat]
  Claim --> PlayerExec
  PlayerExec --> ACK
  ACK --> Completed
```""",
    estados=[("pending", "na fila", "→ sent"), ("sent", "entregue", "→ completed/failed/timeout"), ("completed", "fim", "—"), ("failed", "fim com erro", "—")],
    aceite=[
        ac("AC-RMT-001", "comando sync_now pending", "player faz sync de eventos", "recebe pendingCommands"),
        ac("AC-RMT-002", "reboot sent sem ACK", "próximo claim", "reboot não volta à fila automaticamente"),
    ],
    deps=["player-ad", "telemetry-heartbeat", "totems"],
    refs=["docs/IMPLEMENTACAO_CONTROLE_REMOTO_P1.md", "docs/HISTORICO-TECNICO-2026-08-08.md"],
)

add(
    slug="telemetry-heartbeat",
    nome="Telemetria e heartbeat",
    modos="all",
    atores="Player-AD; admin/técnico (monitorização)",
    ui="cards Publicar; dashboard; WS totem_playback_state / observation_sample",
    api="/api/player/heartbeat, /api/player/sync, /api/player/events*, observation leases",
    proposito="Presença, estado actual de reprodução, eventos históricos e observação detalhada sob pedido.",
    escopo_in=["Heartbeat adaptativo", "Eventos play start/end", "Sync unificado", "Leases de observação", "Broadcast WS"],
    escopo_out=["Logs de SO Android"],
    vocab=[("presence", "online via heartbeat"), ("playback state", "now playing"), ("observation sample", "métricas detalhadas")],
    reqs=[
        req("REQ-TEL-001", "Ubiquitous", "Estado normal de mídia actualiza por eventos/WS independente do diagnóstico."),
        req("REQ-TEL-002", "Optional", "Observação detalhada só com lease activo e totem habilitado."),
        req("REQ-TEL-003", "Unwanted", "Telemetria de totem inactivo deve ser rejeitada/ignorada na UI."),
    ],
    rns=[
        rn("RN-TEL-001", "Hover subscreve", "rato no card habilitado", "sempre", "subscribe_playback_state", motivo="Economia de tráfego"),
        rn("RN-TEL-002", "Lease 120s", "start observation", "sempre", "Player só amostra enquanto lease válido", motivo="Custo de rede"),
        rn("RN-TEL-003", "Clock drift", "deviceClock no heartbeat", "sempre", "anotar serverReceivedAtMs e clockDriftMs", motivo="Diagnóstico de agenda"),
    ],
    fluxos="""```mermaid
flowchart TD
  Player -->|heartbeat| Presence
  Player -->|events/sync| PlaybackState
  UI -->|lease start| Observation
  Observation --> Samples
  PlaybackState --> WS
  Samples --> WS
```""",
    estados=[("connected_ws", "tempo real", "→ fallback_rest"), ("lease_active", "diagnóstico", "→ expired"), ("stale", "estado velho", "→ fresh")],
    aceite=[
        ac("AC-TEL-001", "card com lease e amostra", "Exibir métricas", "mostra posição/buffer/heap"),
        ac("AC-TEL-002", "totem desabilitado", "hover", "sem telemetria activa"),
    ],
    deps=["player-ad", "publish-totem", "totems"],
    refs=["docs/HISTORICO-TECNICO-2026-08-08.md", "docs/manuais/07-MANUAL-PUBLICAR-EM-TOTEM.md"],
)

add(
    slug="ota-updates",
    nome="Atualizações OTA",
    modos="Pro (preset); capacidade ligada a player-apk",
    atores="owner/admin",
    ui="/ota-updates, /history; Settings APK",
    api="/api/ota-updates",
    proposito="Upload, activação e distribuição remota de APKs do Player.",
    escopo_in=["Upload metadados", "Activate", "Disponível no heartbeat", "Designação production"],
    escopo_out=["Instalar por ADB local"],
    vocab=[("versionCode", "build Android"), ("active", "pacote activo")],
    reqs=[
        req("REQ-OTA-001", "Event-driven", "Ao activar update Android, designar canal production."),
        req("REQ-OTA-002", "Ubiquitous", "Heartbeat Android consulta a versão designada."),
    ],
    rns=[
        rn("RN-OTA-001", "Fonte única", "getAvailableUpdate android", "sempre", "priorizar player_release_channels", motivo="Evitar divergência"),
        rn("RN-OTA-002", "Preset Lite/Direct", "mode off/lite", "módulo ota", "off no preset (Pro on)", motivo="Complexidade"),
    ],
    fluxos="```mermaid\nflowchart TD\n  Upload --> Testing --> Activate --> Designate --> PlayerDownload\n```",
    estados=[("testing", "não produção", "→ active"), ("active", "designável/designado", "→ completed/inactive")],
    aceite=[ac("AC-OTA-001", "activar APK Android", "abrir Settings APK", "mostra essa versão como designada")],
    deps=["player-apk-settings", "player-ad"],
    refs=["docs/instalacao/04-PLAYER-AD.md"],
)

add(
    slug="dispatcher",
    nome="Dispatcher",
    modos="all (locked on)",
    atores="owner/admin, operador técnico",
    ui="/dispatcher-manager, /dispatcher-monitor, /dispatcher-debug",
    api="/api/dispatcher-totem, /api/dispatcher-debug, /api/player/dispatch",
    proposito="Motor e monitorização do tráfego servidor↔totens (dispatch plan, timeline, debug).",
    escopo_in=["Gerar/servir DispatchPlan", "Monitor incoming/outgoing", "Debug"],
    escopo_out=["UI de publicação comercial"],
    vocab=[("needsDispatch", "heartbeat indica plano novo"), ("planVersion", "fingerprint do plano")],
    reqs=[
        req("REQ-DSP-001", "Ubiquitous", "dispatcher_admin permanece activo em todos os modes."),
        req("REQ-DSP-002", "Event-driven", "Mudança de conteúdo relevante deve invalidar cache e marcar needsDispatch."),
    ],
    rns=[
        rn("RN-DSP-001", "Plan versioning", "player envia knownPlanVersion", "igual ao servidor", "needsDispatch=false", motivo="Poupar banda"),
        rn("RN-DSP-002", "EMPTY vs UNAVAILABLE", "sem mídias", "intencional", "EMPTY_PLAN; falha de rede ≠ empty", motivo="Estabilidade Player"),
    ],
    fluxos="```mermaid\nflowchart TD\n  Conteudo --> Invalidate --> HeartbeatNeedsDispatch --> GETDispatch --> Player\n```",
    estados=[("plan_cached", "player tem versão", "→ outdated"), ("needs_dispatch", "buscar plano", "→ applied")],
    aceite=[ac("AC-DSP-001", "mode off", "abrir dispatcher monitor", "acessível ao owner")],
    deps=["totems", "campaigns", "publish-totem", "player-ad"],
    refs=["docs/DESENHO-SONOLENCIA-BATIMENTO-POLL-ADAPTIVE.md"],
)

add(
    slug="analytics-ai",
    nome="Analytics / IA",
    modos="Pro",
    atores="admin, marketing, publisher/subscriber",
    ui="/analytics, /ai, /ai-context",
    api="/api/analytics, /api/ai",
    proposito="Analytics de reprodução/rede e assistentes IA.",
    escopo_in=["Métricas agregadas", "Assistentes"],
    escopo_out=["Controlo remoto"],
    vocab=[("impression", "exibição contabilizada")],
    reqs=[req("REQ-ANL-001", "State-driven", "Módulo analytics on apenas no preset Pro.")],
    rns=[rn("RN-ANL-001", "Privacidade de escopo", "consultar analytics", "role limitada", "filtrar por tenant", motivo="ACL")],
    fluxos="```mermaid\nflowchart LR\n  Eventos --> Agregacao --> DashboardAI\n```",
    estados=[("enabled", "Pro", "→ disabled noutros modes")],
    aceite=[ac("AC-ANL-001", "mode lite", "API analytics gate", "403 MODULE_DISABLED")],
    deps=["telemetry-heartbeat", "campaigns"],
    refs=[],
)

add(
    slug="smart-display-fx",
    nome="SmartDisplayFX",
    modos="Lite/Pro opcional",
    atores="admin",
    ui="/smartdisplayfx",
    api="/api/smartdisplayfx/*",
    proposito="Efeitos visuais, regras, timelines e telemetria FX (complemento avançado).",
    escopo_in=["Effects", "Rules", "Timelines", "Sites"],
    escopo_out=["Núcleo Direct obrigatório"],
    vocab=[("FX rule", "regra visual")],
    reqs=[req("REQ-SFX-001", "Optional", "Pode ser activado fora do master switch.")],
    rns=[rn("RN-SFX-001", "Não bloqueia publish core", "FX off", "publicar mídia Direct", "continua possível", motivo="Desacoplamento")],
    fluxos="```mermaid\nflowchart LR\n  Effect --> Timeline --> Display\n```",
    estados=[("module_off", "inactivo", "→ module_on")],
    aceite=[ac("AC-SFX-001", "módulo off", "core publish", "funciona")],
    deps=["system-modules"],
    refs=[],
)


def render(m: dict) -> str:
    lines = []
    a = lines.append
    a(f"# `{m['slug']}` — {m['nome']}")
    a("")
    a("| Campo | Valor |")
    a("|-------|-------|")
    a(f"| **Slug** | `{m['slug']}` |")
    a(f"| **Modos** | {m['modos']} |")
    a(f"| **Atores** | {m['atores']} |")
    a(f"| **UI** | `{m['ui']}` |")
    a(f"| **API** | `{m['api']}` |")
    a("| **Status** | active |")
    a(f"| **Última revisão** | {TODAY} |")
    a("")
    a("---")
    a("")
    a("## 1. Visão e escopo")
    a("")
    a("### Propósito")
    a(m["proposito"])
    a("")
    a("### Dentro do escopo")
    for x in m["escopo_in"]:
        a(f"- {x}")
    a("")
    a("### Fora do escopo")
    for x in m["escopo_out"]:
        a(f"- {x}")
    a("")
    a("### Vocabulário")
    a("| Termo | Significado |")
    a("|-------|-------------|")
    for t, s in m["vocab"]:
        a(f"| {t} | {s} |")
    a("")
    a("---")
    a("")
    a("## 2. Requisitos (EARS)")
    a("")
    a("| ID | Tipo | Requisito |")
    a("|----|------|-----------|")
    for r in m["reqs"]:
        a(f"| {r['id']} | {r['tipo']} | {r['texto']} |")
    a("")
    a("---")
    a("")
    a("## 3. Regras de negócio")
    a("")
    for r in m["rns"]:
        a(f"### {r['id']} — {r['titulo']}")
        a("")
        a("```text")
        a(f"{r['id']} — {r['titulo']}")
        a(f"Quando: {r['quando']}")
        a(f"Se: {r['se']}")
        a(f"Então: {r['entao']}")
        a(f"Excepto: {r['excepto']}")
        a(f"Motivo: {r['motivo']}")
        a("```")
        a("")
    a("---")
    a("")
    a("## 4. Fluxos")
    a("")
    a(m["fluxos"])
    a("")
    a("---")
    a("")
    a("## 5. Estados")
    a("")
    a("| Estado | Significado | Transições típicas |")
    a("|--------|-------------|--------------------|")
    for nome, sig, tr in m["estados"]:
        a(f"| {nome} | {sig} | {tr} |")
    a("")
    a("---")
    a("")
    a("## 6. Critérios de aceite")
    a("")
    for c in m["aceite"]:
        a(f"### {c['id']} ({c['prio']})")
        a("")
        a("```text")
        a(f"DADO {c['dado']}")
        a(f"QUANDO {c['quando']}")
        a(f"ENTÃO {c['entao']}")
        a("```")
        a("")
    a("---")
    a("")
    a("## 7. Dependências e referências")
    a("")
    a("### Módulos relacionados")
    if m["deps"]:
        for d in m["deps"]:
            a(f"- [`{d}`](../{d}/MODULO.md)")
    else:
        a("- —")
    a("")
    a("### Referências")
    if m["refs"]:
        for r in m["refs"]:
            a(f"- `{r}`")
    else:
        a("- —")
    a("")
    return "\n".join(lines)


def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    for m in MODULES:
        d = ROOT / m["slug"]
        d.mkdir(parents=True, exist_ok=True)
        (d / "MODULO.md").write_text(render(m), encoding="utf-8")
    # stdout ASCII-safe on Windows consoles
    print("generated %d modules at %s" % (len(MODULES), ROOT))
    for m in MODULES:
        print("- %s" % m["slug"])


if __name__ == "__main__":
    main()
