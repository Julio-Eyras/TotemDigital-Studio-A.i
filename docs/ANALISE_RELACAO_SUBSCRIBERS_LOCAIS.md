# Análise: Relação Subscribers ↔ Locais

## 🔍 Problema Identificado

O modelo atual permite que **Subscribers tenham locais próprios** através da coluna `subscriber_id` na tabela `locals`. No entanto, isso está **conflitando com o modelo de negócio correto**.

---

## 📊 Modelo Atual (Implementado)

### Estrutura do Banco de Dados

```sql
-- Tabela locals permite tanto publisher_id quanto subscriber_id
CREATE TABLE locals (
    local_id SERIAL PRIMARY KEY,
    publisher_id INTEGER,  -- Opcional
    subscriber_id INTEGER, -- Opcional (adicionado na migração 005)
    name TEXT NOT NULL,
    ...
    CONSTRAINT chk_local_owner CHECK (
        (publisher_id IS NOT NULL AND subscriber_id IS NULL) OR
        (publisher_id IS NULL AND subscriber_id IS NOT NULL)
    )
);
```

### Problema Conceitual

**❌ Modelo Atual:**
- Subscribers podem ter locais próprios (`subscriber_id` em `locals`)
- Subscribers podem ter totens e Smart TVs próprios
- Isso cria uma duplicação: tanto Publishers quanto Subscribers podem ter locais

**✅ Modelo Correto (Conceitual):**
- **Publishers** são os **proprietários físicos** dos locais, totens e Smart TVs
- **Subscribers** são **anunciantes** que compram espaço publicitário
- Subscribers **acessam** locais de Publishers através de **planos e contratos**
- Subscribers **NÃO possuem** locais próprios

---

## 🎯 Modelo de Negócio Correto

### Hierarquia Correta

```
PUBLISHERS (Proprietários Físicos)
  └── LOCALS (Locais físicos onde estão os totens)
      └── TOTEMS (Dispositivos físicos)
          └── SMART_TVS (Telas físicas)

SUBSCRIBERS (Anunciantes)
  └── CONTRATOS (Planos contratados)
      └── ACESSO A PUBLISHERS (Através de subscriber_publisher_access)
          └── ACESSO A LOCAIS (Locais dos publishers acessíveis)
```

### Fluxo Correto

1. **Publisher** cria seus **locais físicos** (shopping, farmácia, supermercado, etc.)
2. **Publisher** instala **totens e Smart TVs** nesses locais
3. **Subscriber** (anunciante) contrata um **plano**
4. O plano define quais **publishers** o subscriber pode acessar
5. O subscriber cria **campanhas publicitárias** que são exibidas nos **locais dos publishers** acessíveis

---

## 🔧 Solução Proposta

### Opção 1: Remover `subscriber_id` de `locals` (Recomendado)

**Ação:**
- Remover a coluna `subscriber_id` da tabela `locals`
- Remover a constraint `chk_local_owner`
- Tornar `publisher_id` obrigatório novamente
- Atualizar o código frontend/backend para não permitir que subscribers criem locais

**Vantagens:**
- Modelo mais claro e alinhado com o negócio
- Evita confusão sobre quem é o proprietário do local
- Subscribers acessam locais através de planos, não possuem locais

**Desvantagens:**
- Requer migração de dados (se houver dados existentes)
- Requer atualização do código

### Opção 2: Manter mas Restringir (Alternativa)

**Ação:**
- Manter `subscriber_id` em `locals` mas **restringir seu uso**
- Permitir apenas para casos especiais (ex: subscribers que também são publishers)
- Documentar claramente que o uso normal é através de planos

**Vantagens:**
- Flexibilidade para casos especiais
- Não requer migração imediata

**Desvantagens:**
- Modelo menos claro
- Pode gerar confusão

---

## 📝 Recomendação

**Recomendo a Opção 1** por ser mais alinhada com o modelo de negócio:

1. **Locais pertencem a Publishers** - são entidades físicas
2. **Subscribers acessam locais através de planos** - são anunciantes
3. **Acesso é controlado por `subscriber_publisher_access`** - já implementado

### Implementação Sugerida

1. **Criar migração** para remover `subscriber_id` de `locals`
2. **Atualizar frontend** para remover a funcionalidade de criar locais para subscribers
3. **Atualizar backend** para validar que apenas publishers podem criar locais
4. **Criar interface** para subscribers visualizarem locais acessíveis através de planos

---

## 🔄 Relação Correta: Subscribers → Locais

### Como Subscribers Acessam Locais

```sql
-- Locais acessíveis por um subscriber (através de planos)
SELECT DISTINCT
    l.local_id,
    l.name AS local_name,
    l.address,
    p.publisher_id,
    p.name AS publisher_name,
    spa.access_type,
    spa.expires_at
FROM subscriber_publisher_access spa
JOIN publishers pub ON spa.publisher_id = pub.publisher_id
JOIN locals l ON l.publisher_id = pub.publisher_id
WHERE spa.subscriber_id = :subscriber_id
  AND spa.is_active = true
  AND (spa.expires_at IS NULL OR spa.expires_at > CURRENT_TIMESTAMP)
  AND spa.revoked_at IS NULL
  AND l.is_active = true;
```

### Interface Sugerida para Subscribers

Em vez de permitir que subscribers criem locais, a interface deveria mostrar:

1. **"Locais Acessíveis"** - Lista de locais dos publishers que o subscriber pode acessar através de seus planos
2. **"Criar Campanha"** - Permitir criar campanhas para os locais acessíveis
3. **"Estatísticas"** - Estatísticas dos locais acessíveis

---

## ✅ Conclusão

O modelo atual está **tecnicamente funcional**, mas **conceitualmente incorreto**. A relação correta é:

- **Publishers** → **Locais** (propriedade física)
- **Subscribers** → **Planos** → **Acesso a Publishers** → **Acesso a Locais dos Publishers**

A implementação atual permite que subscribers tenham locais próprios, o que não faz sentido no contexto do negócio onde subscribers são anunciantes que compram espaço publicitário nos locais dos publishers.
