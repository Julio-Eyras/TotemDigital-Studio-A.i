# Changelog - SmartSignage Pro

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Documentação
- `scripts/post-deploy-compact-check.sh`: validação pós-deploy do modo compacto (systemd, health, build frontend, cópia em `/opt/smart-signage/frontend/build`, `nginx -t`, HTTP local); referenciado em `docs/technical/04-instalacao.md`.
- `docs/platform/06-totemdigital-monousuario-er-e-fluxo.md`: E.R. e fluxo **antes (Pro)** vs **depois (TotemDigital operacional)**; cadeia de fallback do dispatcher alinhada ao código; ligação aos PNG do ER completo (`docs/diagrams/`) e dica de zoom para o núcleo TotemDigital.
- `docs/user/01-introducao.md`: título e secção **TotemDigital** com os mesmos links (Markdown + PNG).
- Workflows, recursos-regras, FAQ, design de player e arquitetura: texto alinhado à política **campanha → `totem_playlists` → plano vazio** (sem plano gerado pelo servidor a partir de `propagandas`/`vinhetas` em disco).
- `docs/technical/04-instalacao.md`: verificação visual da marca no modo compacto (login/menu/título com **Smart Signage Compact**) + bloco de comandos de validação pós-deploy (health, build frontend compacto e reload do Nginx).

### Alterado
- **Dispatcher:** removida a montagem de plano de fallback a partir de ficheiros locais `propagandas`/`vinhetas` no servidor; mantém-se apenas o fallback por **playlist consolidada** do totem.
- **Modo compacto TotemDigital:** novas flags `TOTEMDIGITAL_COMPACT` (backend) e `REACT_APP_TOTEMDIGITAL_COMPACT` (frontend) para reduzir superfície Pro (subdomínios, billing/acessos multiagência, módulos avançados) e manter foco operacional monousuário.
- **Startup backend no modo compacto:** filas Bull e workers/tarefas Pro (Invoice, Subscriber Access Notification, Playlist Mix/Engine, carga de agendamentos avançados e cron de alertas) não são inicializados.
- **Bootstrap de perfis separado:** inicialização Pro e Compact extraídas para módulos dedicados (`startupPro` e `startupCompact`), reduzindo acoplamento no `index.ts`.
- **Registro de rotas por perfil:** rotas Compact e Pro extraídas para registradores dedicados (`registerCompactRoutes` e `registerProRoutes`), com carregamento condicional do bloco Pro.

## [2.1.0] - 2026-01-26

> **Nota:** v2.1 usa PostgreSQL diretamente (sem Prisma). Migração completa de v2.0.

### Adicionado
- Player Web com cache completo (IndexedDB)
- Vinheta padrão SmartSignage quando não há plano de exibição
- Dashboard Rede Visual (/network-topology): Publishers → Locals → Totens → Smart TVs com mídias atreladas
- Sistema de alertas (totem offline, FPS baixo, taxa de falha, disco) com cron e integração email/Slack/webhook
- Validação de integridade em seeds (validate-seeds.sql)
- Suporte a `mediaId=0` e `playlistId=0` em eventos (vinheta padrão)
- Coluna `playlist_id` em `event_logs` para rastreamento completo
- Documentação completa do sistema (workflows, recursos, regras)
- Script de instalação melhorado com suporte a `vinhetas` e `propagandas`

### Corrigido
- Erro "column rc.id does not exist" no heartbeat (usar `command_id`)
- Erro "Não foi possível gerar plano de exibição" quando sem campanhas (retorna plano vazio)
- Validação de eventos do player aceita valores 0 e null
- Player resiliente: exibe vinheta padrão mesmo com erro na API
- Schema `event_logs` inclui `playlist_id` desde criação

### Alterado
- Dispatcher retorna plano vazio (vinheta) em vez de erro quando sem candidatos
- Player usa vinheta padrão quando API retorna erro ou plano vazio
- Install script copia `vinhetas` e `propagandas` automaticamente com player-web

### Removido
- Dependência de migrations para instalações novas (schema corrigido)
- Prisma (PostgreSQL direto via `pg`)

## [2.0.0] - 2025-12-01

### Adicionado
- Sistema de Dispatcher inteligente (resolução de conflitos)
- Validação comercial (tiers, time share, slots consecutivos)
- Cache de planos de exibição (60s TTL)
- Sistema de eventos completo (event_logs)
- Analytics e relatórios avançados
- RBAC (Role-Based Access Control)
- Suporte a 2FA (autenticação de dois fatores)
- API completa para players
- Player HTML5 com cache local

### Alterado
- Schema refatorado (v2.0)
- Arquitetura modularizada
- Performance otimizada

## [1.0.0] - 2025-01-01

### Adicionado
- Versão inicial do sistema
- Gerenciamento básico de campanhas e playlists
- Upload e gerenciamento de mídias
- Cadastro de totens
- Interface administrativa básica

---

## Tipos de Mudanças

- **Adicionado**: Novas funcionalidades
- **Alterado**: Mudanças em funcionalidades existentes
- **Depreciado**: Funcionalidades que serão removidas
- **Removido**: Funcionalidades removidas
- **Corrigido**: Correções de bugs
- **Segurança**: Correções de vulnerabilidades
