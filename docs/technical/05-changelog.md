# Changelog - SmartSignage Pro

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [2.1.0] - 2026-01-26

### Adicionado
- Player Web com cache completo (IndexedDB)
- Vinheta padrão SmartSignage quando não há plano de exibição
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
