# Validação: Driver de Banco de Dados PostgreSQL

**Data:** 2026-01-03  
**Problema:** Adicionar validação explícita para garantir que apenas PostgreSQL seja usado

---

## 🔍 PROBLEMA IDENTIFICADO

O sistema é **PostgreSQL-only**, mas não havia validação explícita do `DB_DRIVER` no backend. Se um valor incorreto fosse configurado, o sistema poderia tentar usar um driver não suportado.

---

## ✅ CORREÇÃO APLICADA

### 1. Validação em `backend/src/config/env.ts`

Adicionada validação do `DB_DRIVER` ao carregar a configuração:

```typescript
const dbDriver = getEnv('DB_DRIVER', 'postgresql');

// Validar que apenas PostgreSQL é suportado
if (dbDriver !== 'postgresql' && dbDriver !== 'postgres') {
  throw new Error(
    `❌ ERRO: Driver de banco de dados '${dbDriver}' não é suportado. ` +
    `Apenas PostgreSQL é suportado (DB_DRIVER=postgresql). ` +
    `Verifique SQL (único suportado).`
  );
}
```

### 2. Validação em `backend/src/config/database-pg.ts`

Adicionada validação adicional na inicialização do banco:

```typescript
export async function initializeDatabase(): Promise<pg.Pool> {
  try {
    // Validar que o driver configurado é PostgreSQL
    if (config.driver !== 'postgresql' && config.driver !== 'postgres') {
      throw new Error(
        `❌ ERRO: Driver de banco de dados '${config.driver}' não é suportado. ` +
        `Apenas PostgreSQL é suportado (DB_DRIVER=postgresql). ` +
        `Verifique SQL (único suportado).`
      );
    }
    // ... resto do código
  }
}
```

---

## 📋 VALORES ACEITOS

O sistema aceita os seguintes valores para `DB_DRIVER`:
- ✅ `postgresql` (padrão)
- ✅ `postgres` (alternativo)

Qualquer outro valor resultará em erro imediato.

---

## 🎯 RESULTADO ESPERADO

Se um driver inválido for configurado, o sistema mostrará:

```
❌ ERRO: Driver de banco de dados 'sqlite' não é suportado. 
Apenas PostgreSQL é suportado (DB_DRIVER=postgresql). 
Verifique SQL (único suportado).
```

E o backend **não iniciará** até que o problema seja corrigido.

---

## ✅ CHECKLIST

- [x] Validação em `env.ts` (carregamento de configuração)
- [x] Validação em `database-pg.ts` (inicialização do banco)
- [x] Mensagem de erro clara e informativa
- [x] Suporte a `postgresql` e `postgres` (ambos válidos)

---

**Última atualização:** 2026-01-03
