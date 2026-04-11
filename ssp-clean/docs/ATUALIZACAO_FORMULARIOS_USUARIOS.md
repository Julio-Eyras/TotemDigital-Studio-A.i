# 📝 Atualização de Formulários de Usuários - Frontend

## ✅ Mudanças Aplicadas

### 1. Interfaces Atualizadas
- ✅ `User` interface atualizada com novos campos
- ✅ `CreateUserRequest` atualizada
- ✅ `UpdateUserRequest` atualizada
- ✅ `UserFlags` interface adicionada
- ✅ Métodos de flags adicionados ao `userApi`

### 2. Estado e Handlers
- ✅ Estado atualizado para incluir publishers
- ✅ Handlers para flags adicionados
- ✅ Filtros atualizados (role, userType)

### 3. Pendências
- ⏳ Atualizar formulário de criação com novos campos
- ⏳ Atualizar formulário de edição com novos campos
- ⏳ Adicionar interface de gerenciamento de flags
- ⏳ Atualizar tabela para mostrar novos campos
- ⏳ Atualizar filtros na UI

## 📋 Campos a Adicionar nos Formulários

### Formulário de Criação/Edição:
1. **Role** - Dropdown com todas as novas roles:
   - owner_system
   - admin_sql
   - admin
   - operador_tecnico
   - operador_faturamento
   - operador_comercial
   - gerente_marketing
   - editoracao
   - visualizador
   - user
   - client
   - publisher_user
   - subscriber_user
   - publisher_subscriber

2. **User Type** - Dropdown:
   - system_user
   - subscriber_user
   - publisher_user
   - publisher_subscriber

3. **Publisher** - Dropdown (se userType for publisher_user ou publisher_subscriber)
4. **Subscriber** - Dropdown (se userType for subscriber_user ou publisher_subscriber)
5. **Is Tenant User** - Switch (para system_user)
6. **Flags** - Seção expandível com checkboxes para cada flag

### Interface de Flags:
- Dialog separado para gerenciar flags
- Checkboxes para cada flag (flag_smart_0 a flag_smart_9)
- Descrições de cada flag
- Botão "Gerenciar Flags" na tabela de usuários
