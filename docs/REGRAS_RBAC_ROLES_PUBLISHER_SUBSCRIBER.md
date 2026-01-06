# 📋 Regras RBAC - Mapeamento de Roles para Recursos

## 🎯 Objetivo

Definir regras claras de mapeamento entre roles e recursos (`publisher_id`/`subscriber_id`), garantindo que:
- Roles relacionadas a publishers requerem `publisher_id`
- Roles relacionadas a subscribers requerem `subscriber_id`
- Roles do sistema não requerem nenhum dos dois
- Flags RBAC sinalizam a qual recurso/sub-item se aplicam

## 📊 Mapeamento de Roles para Recursos

### Roles do Sistema (não requerem `publisher_id` nem `subscriber_id`)
```typescript
'system' → {
  'owner_system',
  'admin_sql',
  'admin',
  'operador_tecnico',
  'operador_faturamento',
  'operador_comercial',
  'gerente_marketing',
  'editoracao',
  'visualizador',
  'user'
}
```

**Regras**:
- ✅ `publisher_id` = NULL
- ✅ `subscriber_id` = NULL
- ✅ `user_type` = 'system_user'
- ✅ `is_tenant_user` = true (se for admin/operador)

### Roles de Publisher (requerem `publisher_id`)
```typescript
'publisher' → {
  'publisher_user'
}
```

**Regras**:
- ✅ `publisher_id` = obrigatório
- ✅ `subscriber_id` = NULL
- ✅ `user_type` = 'publisher_user'
- ❌ Erro se `publisher_id` não fornecido

### Roles de Subscriber (requerem `subscriber_id`)
```typescript
'subscriber' → {
  'subscriber_user'
}
```

**Regras**:
- ✅ `subscriber_id` = obrigatório
- ✅ `publisher_id` = NULL
- ✅ `user_type` = 'subscriber_user'
- ❌ Erro se `subscriber_id` não fornecido

### Roles Mistas (podem usar ambos)
```typescript
'both' → {
  'publisher_subscriber'
}
```

**Regras**:
- ✅ `publisher_id` OU `subscriber_id` = obrigatório (pelo menos um)
- ✅ `user_type` = 'publisher_subscriber'
- ❌ Erro se nenhum dos dois for fornecido

## 🔧 Implementação

### Backend - Validação Automática

**Arquivo**: `backend/src/services/userService.ts`

```typescript
const ROLE_RESOURCE_MAPPING: Record<string, 'publisher' | 'subscriber' | 'system' | 'both'> = {
  // System roles
  'owner_system': 'system',
  'admin_sql': 'system',
  'admin': 'system',
  'operador_tecnico': 'system',
  'operador_faturamento': 'system',
  'operador_comercial': 'system',
  'gerente_marketing': 'system',
  'editoracao': 'system',
  'visualizador': 'system',
  'user': 'system',
  
  // Publisher roles
  'publisher_user': 'publisher',
  
  // Subscriber roles
  'subscriber_user': 'subscriber',
  
  // Mixed roles
  'publisher_subscriber': 'both',
};

// Validação automática em createUser()
const resourceType = ROLE_RESOURCE_MAPPING[role] || 'system';

if (resourceType === 'publisher') {
  if (!publisherId) {
    throw new Error(`Role '${role}' requer publisher_id`);
  }
  // ... validação de publisher existe
}

if (resourceType === 'subscriber') {
  if (!subscriberId) {
    throw new Error(`Role '${role}' requer subscriber_id`);
  }
  // ... validação de subscriber existe
}

if (resourceType === 'both') {
  if (!publisherId && !subscriberId) {
    throw new Error(`Role '${role}' requer publisher_id ou subscriber_id`);
  }
  // ... validação de publisher/subscriber existe
}
```

## 🚩 Flags RBAC e Recursos

### Flags por Recurso

As flags `flag_smart_0` a `flag_smart_9` podem ser configuradas para sinalizar acesso a recursos específicos:

**Exemplo de Mapeamento de Flags**:
- `flag_smart_0`: Acesso técnico (totens, smart TVs)
- `flag_smart_1`: Acesso a publishers
- `flag_smart_2`: Acesso a subscribers
- `flag_smart_3`: Acesso a campanhas
- `flag_smart_4`: Acesso a mídias
- `flag_smart_5`: Acesso a relatórios
- `flag_smart_6`: Acesso a faturamento
- `flag_smart_7`: Acesso comercial
- `flag_smart_8`: Acesso a configurações
- `flag_smart_9`: Acesso administrativo

### Validação de Flags por Recurso

**Exemplo**: Um usuário com role `publisher_user` e `publisher_id = 5`:
- ✅ Pode acessar recursos do publisher #5
- ✅ Flags podem restringir acesso a sub-recursos (ex: `flag_smart_0` para totens)
- ❌ Não pode acessar recursos de outros publishers
- ❌ Não pode acessar recursos de subscribers (a menos que tenha `publisher_subscriber`)

## 📋 Tabela de Validação

| Role | Resource Type | publisher_id | subscriber_id | Validação |
|------|--------------|--------------|--------------|-----------|
| `owner_system` | system | NULL | NULL | ✅ Sem validação |
| `admin_sql` | system | NULL | NULL | ✅ Sem validação |
| `admin` | system | NULL | NULL | ✅ Sem validação |
| `operador_tecnico` | system | NULL | NULL | ✅ Sem validação |
| `operador_faturamento` | system | NULL | NULL | ✅ Sem validação |
| `operador_comercial` | system | NULL | NULL | ✅ Sem validação |
| `gerente_marketing` | system | NULL | NULL | ✅ Sem validação |
| `editoracao` | system | NULL | NULL | ✅ Sem validação |
| `visualizador` | system | NULL | NULL | ✅ Sem validação |
| `user` | system | NULL | NULL | ✅ Sem validação |
| `publisher_user` | publisher | ✅ Obrigatório | NULL | ✅ Valida publisher existe |
| `subscriber_user` | subscriber | NULL | ✅ Obrigatório | ✅ Valida subscriber existe |
| `publisher_subscriber` | both | ✅ Opcional | ✅ Opcional | ✅ Valida pelo menos um |

## ✅ Checklist de Implementação

- [x] Removido role "client" do sistema
- [x] Criado mapeamento `ROLE_RESOURCE_MAPPING`
- [x] Implementada validação automática em `createUser()`
- [x] Implementada validação automática em `updateUser()`
- [x] Validação de publisher existe
- [x] Validação de subscriber existe
- [x] Removidas todas as referências a `clientId`
- [x] Frontend atualizado (removido "client" dos dropdowns)
- [x] Documentação criada

## 🎯 Próximos Passos

1. **Flags por Recurso**: Implementar lógica de flags que sinalizam acesso a recursos específicos
2. **Middleware de Validação**: Criar middleware que valida acesso baseado em role + publisher_id/subscriber_id
3. **Testes**: Criar testes unitários para validação de roles e recursos
4. **Documentação de Flags**: Documentar mapeamento detalhado de flags para recursos/sub-recursos
