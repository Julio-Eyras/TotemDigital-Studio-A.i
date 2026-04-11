# Implementação: Filtragem de Menus por Permissões (Role + Flags)

**Data:** 2026-01-03  
**Status:** ✅ Implementado

---

## 🎯 OBJETIVO

Implementar filtragem automática de itens do menu hierárquico baseado em:
1. **Role do usuário** - Verificar se a role tem permissão para acessar o recurso
2. **Flags do usuário** - Verificar se o usuário tem a flag necessária (`flag_smart_0` a `flag_smart_9`)
3. **user_type** - Considerar o tipo de usuário (system_user, publisher_user, subscriber_user)

---

## 🔧 IMPLEMENTAÇÃO

### 1. Função de Filtragem Hierárquica

**Arquivo:** `frontend/src/utils/menuHierarchy.ts`

**Função:** `filterHierarchicalMenu()`

```typescript
function filterHierarchicalMenu(
  items: HierarchicalMenuItem[],
  userRole: UserRole,
  userFlags?: UserFlags | null
): HierarchicalMenuItem[] {
  return items
    .map(item => {
      // 1. Verificar se o item principal tem permissão
      const hasAccess = canAccess(userRole, item.path, userFlags);
      
      if (!hasAccess) {
        return null; // Remover item sem permissão
      }

      // 2. Filtrar subitens recursivamente
      const filteredChildren = item.children
        ? filterHierarchicalMenu(item.children, userRole, userFlags)
        : undefined;

      // 3. Se todos os children foram removidos, remover o item pai também
      // (exceto se o pai tiver acesso direto)
      if (filteredChildren && filteredChildren.length === 0 && item.children && item.children.length > 0) {
        const parentHasDirectAccess = canAccess(userRole, item.path, userFlags);
        if (!parentHasDirectAccess) {
          return null;
        }
        return { ...item, children: undefined };
      }

      return {
        ...item,
        children: filteredChildren && filteredChildren.length > 0 ? filteredChildren : undefined,
      };
    })
    .filter((item): item is HierarchicalMenuItem => item !== null);
}
```

### 2. Função `canAccess()` Melhorada

**Arquivo:** `frontend/src/utils/rolePermissions.ts`

**Melhorias:**
- ✅ Verificação de path pai para subitens
- ✅ Verificação de flags obrigatórias
- ✅ Owner system sempre tem acesso
- ✅ Suporte a paths de subitens (ex: `/users/new`, `/totems/status`)

```typescript
export function canAccess(
  userRole: UserRole | string, 
  path: string,
  userFlags?: Record<string, boolean> | null
): boolean {
  // Owner system sempre tem acesso
  if (userRole === 'owner_system') {
    return true;
  }

  // Buscar permissão exata ou path pai
  let permission = menuPermissions.find(p => p.path === path);
  if (!permission) {
    // Tentar encontrar path pai (ex: /users para /users/new)
    const sortedPermissions = [...menuPermissions].sort((a, b) => b.path.length - a.path.length);
    permission = sortedPermissions.find(p => path.startsWith(p.path + '/'));
  }

  if (!permission) {
    return true; // Compatibilidade: permitir por padrão
  }
  
  // Verificar role
  const hasRole = permission.roles.includes(userRole as UserRole);
  if (!hasRole) {
    return false;
  }
  
  // Verificar flag se necessário
  if (permission.requiredFlag && userFlags) {
    return userFlags[permission.requiredFlag] === true;
  }
  
  return true;
}
```

### 3. Integração no Layout.tsx

**Arquivo:** `frontend/src/components/Layout/Layout.tsx`

**Mudanças:**
- ✅ Importar `useFlags` hook
- ✅ Passar `flags` para `getMenuHierarchyByRole()`
- ✅ Menu automaticamente filtrado por permissões

```typescript
const { flags } = useFlags(); // Hook para acessar flags do usuário

const getMenuItems = (): HierarchicalMenuItem[] => {
  if (!user?.role) {
    return getDefaultMenu();
  }

  // Obter menu hierárquico filtrado por permissões (role + flags)
  const hierarchicalMenu = getMenuHierarchyByRole(
    user.role as UserRole,
    flags // Passar flags do usuário para filtragem
  );
  
  return hierarchicalMenu;
};
```

---

## 📋 PERMISSÕES ADICIONADAS

### Rotas de Subitens

Adicionadas permissões para rotas de subitens que não estavam em `menuPermissions`:

- `/users/new` - Criar usuário
- `/users/roles` - Gerenciar roles
- `/users/flags` - Gerenciar flags
- `/publishers/new` - Criar publisher
- `/clients/new` - Criar subscriber
- `/totems/status` - Status técnico
- `/totems/config` - Configurações
- `/smart-tvs/by-totem` - Smart TVs por totem
- `/smart-tvs/config` - Configurações
- `/players/status` - Status de players
- `/ota-updates/history` - Histórico de atualizações
- `/billing/invoices` - Faturas
- `/billing/payments` - Pagamentos
- `/billing/history` - Histórico
- `/subscriber-publisher-access/new` - Criar contrato
- `/plan-publisher-access/config` - Configurações de planos
- `/publishers/details` - Detalhes (visualização)
- `/clients/details` - Detalhes (visualização)
- `/campaigns/stats` - Estatísticas

---

## 🎯 FLUXO DE FILTRAGEM

### Exemplo: OPERADOR_TECNICO com `flag_smart_0 = true`

**Menu Completo:**
```
📊 Dashboard Técnico
├─ 🖥️ Totens
│  ├─ Listar Totens ✅
│  ├─ Status Técnico ✅
│  └─ Configurações ✅
├─ 📺 Smart TVs
│  ├─ Listar Smart TVs ✅
│  ├─ Status por Totem ✅
│  └─ Configurações ✅
├─ 💻 Players
│  ├─ Listar Players ✅
│  └─ Status ✅
├─ 🔄 OTA Updates
│  ├─ Gerenciar Atualizações ✅ (flag_smart_1)
│  └─ Histórico ✅ (flag_smart_1)
└─ 🔧 Admin Tools ✅ (flag_smart_2)
```

**Se `flag_smart_1 = false`:**
```
📊 Dashboard Técnico
├─ 🖥️ Totens ✅
├─ 📺 Smart TVs ✅
├─ 💻 Players ✅
└─ 🔄 OTA Updates ❌ (removido - sem flag_smart_1)
```

**Se `flag_smart_2 = false`:**
```
📊 Dashboard Técnico
├─ 🖥️ Totens ✅
├─ 📺 Smart TVs ✅
├─ 💻 Players ✅
└─ 🔧 Admin Tools ❌ (removido - sem flag_smart_2)
```

---

## ✅ VANTAGENS

1. **Filtragem Automática:** Itens e subitens são filtrados automaticamente
2. **Respeita Permissões:** Baseado em `rolePermissions.ts`
3. **Verifica Flags:** Considera `flag_smart_0` a `flag_smart_9`
4. **Recursivo:** Filtra toda a hierarquia (pais e filhos)
5. **Performance:** Filtragem acontece uma vez ao carregar o menu

---

## 🔍 EXEMPLOS DE FILTRAGEM

### Exemplo 1: OPERADOR_TECNICO sem `flag_smart_1`

**Antes:**
```
🔄 OTA Updates
├─ Gerenciar Atualizações
└─ Histórico
```

**Depois:**
```
(Item removido completamente)
```

### Exemplo 2: ADMIN sem permissão para `/users/flags`

**Antes:**
```
👥 Usuários Sistema
├─ Listar Usuários
├─ Criar Usuário
├─ Gerenciar Roles
└─ Gerenciar Flags
```

**Depois:**
```
👥 Usuários Sistema
├─ Listar Usuários
├─ Criar Usuário
└─ Gerenciar Roles
(Flags removido)
```

### Exemplo 3: OPERADOR_COMERCIAL (apenas visualização)

**Menu Completo:**
```
📊 Dashboard Comercial
├─ 🏢 Publishers (Visualização)
│  ├─ Listar Publishers ✅
│  └─ Detalhes ✅
├─ 📢 Subscribers (Visualização)
│  ├─ Listar Subscribers ✅
│  └─ Detalhes ✅
├─ 📢 Campanhas (Visualização)
│  ├─ Listar Campanhas ✅
│  └─ Estatísticas ✅
└─ 📊 Relatórios Comerciais ✅
```

---

## 📝 CHECKLIST

- [x] Função `filterHierarchicalMenu()` implementada
- [x] Função `canAccess()` melhorada para suportar paths de subitens
- [x] Permissões adicionadas para rotas de subitens
- [x] Integração com `useFlags` hook no Layout.tsx
- [x] Filtragem recursiva de subitens
- [x] Remoção de itens pais quando todos os children são removidos
- [x] Verificação de flags obrigatórias

---

## 🎯 RESULTADO

O menu hierárquico agora:
- ✅ Respeita permissões baseadas em **role**
- ✅ Verifica **flags** obrigatórias (`flag_smart_0` a `flag_smart_9`)
- ✅ Filtra **itens e subitens** automaticamente
- ✅ Remove itens sem permissão da hierarquia
- ✅ Mantém apenas itens acessíveis ao usuário

---

**Última atualização:** 2026-01-03
