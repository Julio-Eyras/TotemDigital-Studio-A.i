# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

## [2.1.0] - 2025-11-03 ✅ CONCLUÍDA

### 🚀 Migração Major: Remoção do Prisma - COMPLETA

#### Adicionado
- Suporte direto ao PostgreSQL via `pg` client
- Novo módulo `database-pg.ts` com connection pooling
- Interfaces TypeScript para type safety manual
- Scripts de validação de seeds para todas as 40 tabelas
- Script de preparação para migração (`scripts/prepare-v2.1-migration.sh`)
- Plano completo de migração documentado (`PLANO_MIGRACAO_V2.1.md`)

#### Removido ✅
- ✅ Prisma ORM (`@prisma/client`, `prisma`) - **REMOVIDO COMPLETAMENTE**
- ✅ Schema Prisma (`prisma/schema.prisma`) - **REMOVIDO**
- ✅ Suporte ao SQLite completamente removido
- ✅ DatabaseWrapper que convertia SQL para Prisma - **SUBSTITUÍDO**
- ✅ Opção SQLite do instalador - **REMOVIDA**
- ✅ Geração do Prisma Client no Dockerfile.backend - **REMOVIDA**
- ✅ Referências ao Prisma em scripts de instalação - **LIMPA**

#### Alterado
- Todas as queries agora usam PostgreSQL diretamente
- Schema agora é gerenciado exclusivamente via `schema-postgresql.sql`
- Seeds agora são gerenciados exclusivamente via `init-data.sql`
- Melhor performance com connection pooling nativo do PostgreSQL
- Instalador agora requer apenas PostgreSQL

#### Corrigido
- Todas as 40 tabelas do modelo E.R. agora são criadas corretamente
- Seeds para todas as tabelas agora são populados corretamente
- Conflitos entre schema SQL e Prisma resolvidos
- Boolean comparison errors corrigidos (`is_active = 1` → `is_active = true`)

#### Melhorias
- Player na porta 80 (público)
- Painel Administrativo na porta 8080 (com login)
- Validação de totem por UIN com segurança HMAC
- Documentação completa de acesso SSH ao PostgreSQL

---

## [2.0.0] - 2025-11-03

### Estado Preservado
- Última versão com Prisma ORM
- Suporte a PostgreSQL e SQLite
- DatabaseWrapper para compatibilidade com SQL raw queries
- Schema Prisma incompleto (15 modelos vs 40 tabelas do modelo E.R.)
- Player redirecionando para login (corrigido na v2.1.0)

### Características
- Sistema de sinalização digital profissional
- Suporte a múltiplos clientes e totens
- Gestão de campanhas e playlists
- Analytics e relatórios
- API REST completa
- Interface administrativa React

---

**Última atualização**: 2025-11-03

