# Resumo: Reorganização de Menus e Pontos de Login

**Data:** 2026-01-03

---

## ✅ PONTOS DE LOGIN

### 1. **Usuários do Sistema**
- **URL:** `http://192.168.1.110/login`
- **Usa:** LoginPage padrão
- **Redireciona:** `/dashboard`
- **Layout:** `Layout.tsx`

### 2. **Subscribers**
- **URL:** `http://192.168.1.110/subscriber-login` ✅ **JÁ EXISTE**
- **Usa:** SubscriberLogin
- **Redireciona:** `/subscriber/dashboard`
- **Layout:** `SubscriberLayout.tsx`

### 3. **Publishers**
- **URL:** `http://192.168.1.110/publisher-login` ⚠️ **A CRIAR**
- **Usa:** PublisherLogin (a criar)
- **Redireciona:** `/dashboard`
- **Layout:** `PublisherLayout.tsx`

---

## 📋 REORGANIZAÇÃO DOS MENUS

### Estrutura Atual (Plana)
- Menu em lista simples, sem hierarquia
- Todos os itens no mesmo nível

### Estrutura Nova (Hierárquica)
- Menus organizados por seções
- Submenus expansíveis (Collapse)
- Agrupamento lógico por funcionalidade

### Exemplo: Menu OWNER_SYSTEM

**Antes:**
```
Dashboard
Mídia
Playlists
Smart Playlist
...
```

**Depois:**
```
📊 Dashboard Sistema
├─ 📈 Analytics Global
├─ 👥 Usuários Sistema
│  ├─ Listar/Criar/Editar
│  ├─ Gerenciar Roles
│  └─ Gerenciar Flags
├─ ⚙️ Configurações Globais
├─ 📝 Auditoria
├─ 🗄️ SQL Tools
├─ 🏢 Publishers
│  ├─ Listar/Criar/Editar
│  ├─ Locais
│  ├─ Totens
│  └─ Smart TVs
└─ 📢 Subscribers
```

---

## 🔧 IMPLEMENTAÇÃO

### 1. Criar PublisherLogin
- Baseado em SubscriberLogin
- Usar username/email + senha
- Validar user_type = 'publisher_user'

### 2. Reorganizar Layout.tsx
- Converter menu plano em hierárquico
- Adicionar suporte a submenus (Collapse)
- Agrupar por seções lógicas

### 3. Menus por Role
- owner_system: Menu completo hierárquico
- admin_sql: Menu hierárquico (sem owner_system)
- admin: Menu hierárquico (sem SQL Tools)
- operadores: Menus específicos por tipo

---

**Status:** Em implementação
