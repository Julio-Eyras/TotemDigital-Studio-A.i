# 🚀 PLANO DE MIGRAÇÃO v2.0 → v2.1

## 📋 Objetivo

Remover Prisma completamente e usar PostgreSQL diretamente via `pg`, desconsiderando SQLite completamente.

---

## 🏷️ VERSIONAMENTO

### Estado Atual: v2.0 (com Prisma)
- Tag: `v2.0.0` - Estado antes da migração
- Branch: `main` (atual)

### Nova Versão: v2.1 (sem Prisma, PostgreSQL puro)
- Tag: `v2.1.0` - Versão após migração
- Branch: `release/v2.1.0` (nova branch para desenvolvimento)

---

## 📦 ETAPAS DA MIGRAÇÃO

### FASE 1: PREPARAÇÃO E VERSIONAMENTO ✅

#### 1.1 Criar Tag v2.0.0 (Estado Atual)
```bash
# Garantir que tudo está commitado
git add -A
git commit -m "chore: Finalizar v2.0 antes da migração"

# Criar tag v2.0.0
git tag -a v2.0.0 -m "Versão 2.0.0 - Com Prisma e suporte a SQLite"
git push origin v2.0.0
```

#### 1.2 Criar Branch para v2.1.0
```bash
# Criar nova branch
git checkout -b release/v2.1.0
git push -u origin release/v2.1.0
```

#### 1.3 Atualizar Versão
- `package.json`: `"version": "2.1.0"`
- `backend/package.json`: `"version": "2.1.0"`
- `frontend/package.json`: `"version": "2.1.0"`
- README.md: Atualizar referências de versão

---

### FASE 2: ANÁLISE DO CÓDIGO ATUAL 🔍

#### 2.1 Mapear Uso do Prisma
- [ ] Listar todos os arquivos que usam Prisma
- [ ] Identificar queries SQL raw vs Prisma queries
- [ ] Mapear modelos do Prisma schema
- [ ] Identificar dependências do Prisma Client

#### 2.2 Mapear Uso do SQLite
- [ ] Encontrar referências ao SQLite
- [ ] Verificar configurações de banco
- [ ] Identificar código específico do SQLite

#### 2.3 Verificar Seeds
- [ ] Listar todos os arquivos de seed
- [ ] Verificar se seeds cobrem todas as 40 tabelas
- [ ] Corrigir seeds faltantes

---

### FASE 3: IMPLEMENTAÇÃO DA MIGRAÇÃO 🔧

#### 3.1 Instalar PostgreSQL Client (`pg`)
```bash
cd backend
npm install pg @types/pg
npm uninstall @prisma/client prisma
```

#### 3.2 Criar Novo Módulo de Database
**Arquivo**: `backend/src/config/database-pg.ts`
```typescript
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Pool de conexões PostgreSQL
let pool: pg.Pool;

export const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'smartsignage',
  user: process.env.DB_USER || 'smartsignage',
  password: process.env.DB_PASSWORD || 'smartsignage123',
  max: 20, // máximo de conexões no pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

export function initializeDatabase(): Promise<pg.Pool> {
  if (!pool) {
    pool = new Pool(dbConfig);
    
    // Testar conexão
    return pool.query('SELECT NOW()')
      .then(() => {
        console.log('✅ PostgreSQL conectado com sucesso');
        return pool;
      })
      .catch((error) => {
        console.error('❌ Erro ao conectar ao PostgreSQL:', error);
        throw error;
      });
  }
  return Promise.resolve(pool);
}

export function getDatabase(): pg.Pool {
  if (!pool) {
    throw new Error('Database não inicializado. Chame initializeDatabase() primeiro.');
  }
  return pool;
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    console.log('✅ PostgreSQL desconectado');
  }
}

// Helper para queries com parâmetros ($1, $2, etc.)
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<T>> {
  const db = getDatabase();
  return db.query<T>(text, params);
}

// Helper para transações
export async function transaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const db = getDatabase();
  const client = await db.connect();
  
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

#### 3.3 Substituir DatabaseWrapper
**Arquivo**: `backend/src/config/database.ts`
```typescript
// Re-export do novo módulo
export * from './database-pg';
```

#### 3.4 Remover Dependências do Prisma
- [ ] Remover `backend/prisma/` diretório
- [ ] Remover `schema.prisma`
- [ ] Remover imports de `@prisma/client`
- [ ] Remover `prisma` do package.json

#### 3.5 Atualizar Serviços
Para cada serviço que usa Prisma:
- [ ] Substituir `prisma.user.findUnique()` por `query('SELECT * FROM users WHERE id = $1', [id])`
- [ ] Substituir `prisma.$queryRawUnsafe()` por `query()`
- [ ] Criar interfaces TypeScript para type safety manual
- [ ] Adicionar validação de tipos

**Exemplo de Migração**:
```typescript
// ANTES (com Prisma)
const user = await prisma.user.findUnique({
  where: { id: 1 },
  include: { client: true }
});

// DEPOIS (PostgreSQL direto)
interface User {
  id: number;
  username: string;
  email: string;
  client_id: number | null;
  client_name?: string; // do JOIN
}

const result = await query<User>(`
  SELECT u.*, c.name as client_name
  FROM users u
  LEFT JOIN clients c ON u.client_id = c.id
  WHERE u.id = $1
`, [1]);

const user = result.rows[0];
```

#### 3.6 Remover Referências ao SQLite
- [ ] Remover `sqlite3` do package.json
- [ ] Remover código específico do SQLite
- [ ] Atualizar configurações para PostgreSQL apenas
- [ ] Remover opção SQLite do instalador

#### 3.7 Atualizar Scripts de Instalação
**Arquivo**: `install-smartsignage.sh`
- [ ] Remover opção SQLite do menu
- [ ] Remover código de instalação do SQLite
- [ ] Garantir que apenas PostgreSQL é usado
- [ ] Remover `prisma generate` e `prisma db push`
- [ ] Garantir que `schema-postgresql.sql` é executado corretamente

#### 3.8 Corrigir Seeds
**Arquivo**: `database/carga-inicial-db-smarsignage-v4.sql`
- [ ] Verificar que todas as 40 tabelas têm seeds
- [ ] Corrigir ordem de inserção (respeitar foreign keys)
- [ ] Garantir dados correlacionados corretos
- [ ] Adicionar seeds faltantes

**Tabelas para verificar**:
- ✅ clients
- ✅ hosts
- ✅ locals
- ✅ totems
- ✅ smart_tvs
- ✅ campaigns
- ✅ medias
- ✅ playlists
- ✅ playlist_items
- ✅ campaign_playlists
- ✅ campaign_totems
- ✅ qr_codes
- ✅ short_links
- ✅ remote_commands
- ✅ analytics_sessions
- ✅ analytics_emotions
- ✅ analytics_gestures
- ✅ analytics_qr_scans
- ✅ ai_models
- ✅ execution_logs
- ✅ system_logs
- ✅ webhook_configs
- ✅ webhook_deliveries
- ✅ alert_rules
- ✅ alert_logs
- ✅ emotion_data
- ✅ gesture_data
- ✅ behavior_data
- ✅ ml_models
- ✅ totem_ml_config
- ✅ ml_sessions
- ✅ roles
- ✅ permissions
- ✅ user_roles
- ✅ role_permissions
- ✅ approval_workflows
- ✅ audit_logs
- ✅ aggregated_metrics
- ✅ device_certificates
- ✅ users (já tem)

---

### FASE 4: TESTES E VALIDAÇÃO ✅

#### 4.1 Testes Unitários
- [ ] Atualizar testes para usar `pg` ao invés de Prisma
- [ ] Criar mocks para PostgreSQL
- [ ] Executar suite de testes completa

#### 4.2 Testes de Integração
- [ ] Testar conexão com PostgreSQL
- [ ] Testar queries básicas (SELECT, INSERT, UPDATE, DELETE)
- [ ] Testar transações
- [ ] Testar JOINs complexos

#### 4.3 Testes de Instalação
- [ ] Testar instalação completa em servidor limpo
- [ ] Verificar que todas as tabelas são criadas
- [ ] Verificar que todos os seeds são populados
- [ ] Testar login e operações básicas

#### 4.4 Validação de Schema
- [ ] Verificar que todas as 40 tabelas existem
- [ ] Verificar foreign keys
- [ ] Verificar índices
- [ ] Verificar triggers

---

### FASE 5: DOCUMENTAÇÃO 📚

#### 5.1 Atualizar Documentação
- [ ] Atualizar README.md
- [ ] Atualizar CHANGELOG.md
- [ ] Documentar mudanças na v2.1
- [ ] Atualizar guias de instalação

#### 5.2 Documentar Nova API
- [ ] Documentar novo módulo `database-pg.ts`
- [ ] Exemplos de uso do `query()`
- [ ] Exemplos de transações
- [ ] Guia de migração de Prisma → pg

---

## 📊 CHECKLIST DE MIGRAÇÃO

### Preparação
- [ ] Criar tag v2.0.0
- [ ] Criar branch release/v2.1.0
- [ ] Atualizar versões nos package.json

### Remoção do Prisma
- [ ] Remover `@prisma/client` e `prisma` do package.json
- [ ] Remover diretório `backend/prisma/`
- [ ] Remover `schema.prisma`
- [ ] Remover imports do Prisma

### Implementação PostgreSQL
- [ ] Instalar `pg` e `@types/pg`
- [ ] Criar `database-pg.ts`
- [ ] Atualizar `database.ts`
- [ ] Substituir todas as chamadas do Prisma

### Remoção do SQLite
- [ ] Remover `sqlite3` do package.json
- [ ] Remover código específico do SQLite
- [ ] Atualizar instalador

### Seeds
- [ ] Verificar seeds de todas as 40 tabelas
- [ ] Corrigir ordem de inserção
- [ ] Garantir dados correlacionados

### Testes
- [ ] Testes unitários passando
- [ ] Testes de integração passando
- [ ] Instalação completa funcionando

### Documentação
- [ ] README atualizado
- [ ] CHANGELOG atualizado
- [ ] Guias atualizados

---

## 🚨 RISCOS E MITIGAÇÕES

### Risco 1: Queries quebradas
**Mitigação**: Testar todas as queries após migração

### Risco 2: Perda de type safety
**Mitigação**: Criar interfaces TypeScript para todas as tabelas

### Risco 3: Performance degradada
**Mitigação**: Usar connection pooling e otimizar queries

### Risco 4: Seeds incompletos
**Mitigação**: Validar seeds de todas as 40 tabelas antes de release

---

## 📅 CRONOGRAMA ESTIMADO

- **Fase 1 (Preparação)**: 1 hora
- **Fase 2 (Análise)**: 2 horas
- **Fase 3 (Implementação)**: 8-12 horas
- **Fase 4 (Testes)**: 4-6 horas
- **Fase 5 (Documentação)**: 2-3 horas

**Total Estimado**: 17-24 horas

---

## ✅ CRITÉRIOS DE CONCLUSÃO

A migração está completa quando:
1. ✅ Tag v2.0.0 criada
2. ✅ Branch release/v2.1.0 criada
3. ✅ Prisma completamente removido
4. ✅ SQLite completamente removido
5. ✅ PostgreSQL funcionando via `pg`
6. ✅ Todas as 40 tabelas criadas corretamente
7. ✅ Todos os seeds populados corretamente
8. ✅ Todos os testes passando
9. ✅ Instalação completa funcionando
10. ✅ Documentação atualizada

---

## 📝 NOTAS FINAIS

- Esta migração é **irreversível** - Prisma não pode ser facilmente restaurado
- Backups são **essenciais** antes de iniciar
- Testar em ambiente de desenvolvimento primeiro
- Validar todos os seeds antes de marcar como completo

---

**Última atualização**: 2025-11-03
**Versão do Plano**: 1.0

