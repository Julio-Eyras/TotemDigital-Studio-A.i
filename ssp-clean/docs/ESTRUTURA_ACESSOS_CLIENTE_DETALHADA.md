# 🔐 Estrutura de Acessos - Níveis do Cliente Detalhada

**Data:** 2024-01-XX  
**Versão:** v2.1

---

## 📊 HIERARQUIA COMPLETA DO SISTEMA

```
┌─────────────────────────────────────────────────────────┐
│ 1. ADMIN_SQL (Top Hierarquia - Dados + Sistema)         │
│    - Acesso total ao sistema                            │
│    - Acesso a dados gerais da base de dados            │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ 2. OPERATOR (Top Hierarquia - Apenas Sistema)          │
│    - Acesso a funcionalidades administrativas           │
│    - Acesso a parâmetros do sistema                    │
│    - Acesso a logs do sistema                          │
│    - ❌ NÃO pode acessar dados privados do cliente      │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ 3. GRUPO CLIENTE (Subníveis)                           │
│                                                         │
│    3.1. ADMIN (Cliente)                                 │
│         - Administra parâmetros administrativos        │
│         - Configurações do próprio cliente             │
│         - Gerenciamento de usuários do cliente         │
│                                                         │
│    3.2. GERENTE_MARKETING                               │
│         - Gerencia/cria/analisa campanhas             │
│         - Gerencia/cria/analisa mídias                 │
│         - Gerencia/cria/analisa playlists              │
│         - Total acesso à parte de marketing            │
│                                                         │
│    3.3. EDITORACAO                                      │
│         - Acesso a suprir informações relevantes        │
│         - Acesso a mídias                              │
│         - Upload e edição de conteúdo                 │
│                                                         │
│    3.4. VISUALIZADOR                                    │
│         - Acesso a dados e relatórios                  │
│         - Apenas leitura                               │
│         - ❌ NÃO pode modificar nada                    │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ 4. CLIENT (Cliente Final - Player)                      │
│    - Acesso apenas via API do player                   │
│    - Autenticação de totem                             │
└─────────────────────────────────────────────────────────┘
```

---

## 📋 DETALHAMENTO DOS SUBNÍVEIS DO CLIENTE

### 3.1. ADMIN (Cliente)

**Descrição:** Administrador do cliente com acesso a parâmetros administrativos e configurações.

**Características:**
- ✅ Administra parâmetros administrativos do cliente
- ✅ Configurações do próprio cliente
- ✅ Gerenciamento de usuários do cliente (criar, editar, deletar)
- ✅ Gerenciamento de totens do cliente
- ✅ Acesso a billing do cliente
- ✅ Acesso a relatórios e analytics do cliente
- ✅ Pode criar/editar/deletar campanhas, mídias, playlists
- ✅ Acesso a configurações do cliente

**Restrições:**
- ❌ NÃO pode acessar dados de outros clientes
- ❌ NÃO pode acessar configurações do sistema
- ❌ NÃO pode acessar logs do sistema
- ❌ NÃO pode criar/gerenciar roles

**Permissões:**
- `clients.read` (próprio cliente)
- `clients.update` (próprio cliente)
- `users.*` (usuários do próprio cliente)
- `campaigns.*` (campanhas do próprio cliente)
- `medias.*` (mídia do próprio cliente)
- `playlists.*` (playlists do próprio cliente)
- `totems.*` (totens do próprio cliente)
- `reports.*` (relatórios do próprio cliente)
- `analytics.*` (analytics do próprio cliente)
- `billing.*` (billing do próprio cliente)
- `settings.*` (configurações do cliente)
- `smartdisplayfx.*` (FX do próprio cliente)

---

### 3.2. GERENTE_MARKETING

**Descrição:** Gerente de marketing com total acesso à parte de marketing (campanhas, mídias, playlists).

**Características:**
- ✅ Gerencia/cria/analisa campanhas
- ✅ Gerencia/cria/analisa mídias
- ✅ Gerencia/cria/analisa playlists
- ✅ Total acesso à parte de marketing
- ✅ Acesso a analytics e relatórios de marketing
- ✅ Acesso a SmartDisplayFX (criar/editar efeitos)
- ✅ Acesso a QR Codes
- ✅ Acesso a Tags

**Restrições:**
- ❌ NÃO pode gerenciar usuários
- ❌ NÃO pode acessar billing
- ❌ NÃO pode modificar configurações do cliente
- ❌ NÃO pode gerenciar totens (apenas visualizar)
- ❌ NÃO pode acessar dados de outros clientes

**Permissões:**
- `campaigns.*` (todas as ações)
- `medias.*` (todas as ações)
- `playlists.*` (todas as ações)
- `smart-playlist.*` (todas as ações)
- `analytics.read` (leitura)
- `reports.read` (leitura)
- `reports.create` (criar relatórios de marketing)
- `qr-codes.*` (todas as ações)
- `tags.*` (todas as ações)
- `smartdisplayfx.*` (todas as ações)
- `totems.read` (apenas leitura)
- `ai.*` (acesso a IA para marketing)

**Não pode:**
- ❌ `users.*` (nenhuma ação)
- ❌ `billing.*` (nenhuma ação)
- ❌ `clients.update` (atualização do cliente)
- ❌ `settings.*` (configurações)
- ❌ `totems.update` (atualização de totens)
- ❌ `totems.delete` (deletar totens)

---

### 3.3. EDITORACAO

**Descrição:** Editoração com acesso a suprir informações relevantes e mídias.

**Características:**
- ✅ Acesso a suprir informações relevantes
- ✅ Acesso a mídias (upload, edição, organização)
- ✅ Upload de conteúdo
- ✅ Edição de metadados de mídia
- ✅ Organização de mídias em pastas/categorias
- ✅ Visualização de campanhas e playlists (para contexto)

**Restrições:**
- ❌ NÃO pode criar/modificar campanhas
- ❌ NÃO pode criar/modificar playlists
- ❌ NÃO pode gerenciar usuários
- ❌ NÃO pode acessar billing
- ❌ NÃO pode acessar analytics detalhados
- ❌ NÃO pode modificar configurações

**Permissões:**
- `medias.read` (leitura)
- `medias.create` (criar/upload)
- `medias.update` (editar metadados)
- `medias.delete` (deletar mídias próprias)
- `campaigns.read` (leitura - para contexto)
- `playlists.read` (leitura - para contexto)
- `tags.read` (leitura)
- `tags.create` (criar tags para mídias)

**Não pode:**
- ❌ `campaigns.create` (criar campanhas)
- ❌ `campaigns.update` (modificar campanhas)
- ❌ `playlists.create` (criar playlists)
- ❌ `playlists.update` (modificar playlists)
- ❌ `users.*` (nenhuma ação)
- ❌ `billing.*` (nenhuma ação)
- ❌ `analytics.*` (nenhuma ação)
- ❌ `reports.*` (nenhuma ação)
- ❌ `settings.*` (configurações)

---

### 3.4. VISUALIZADOR

**Descrição:** Visualizador com acesso a dados e relatórios, apenas leitura.

**Características:**
- ✅ Acesso a dados e relatórios
- ✅ Apenas leitura
- ✅ Visualização de campanhas
- ✅ Visualização de mídias
- ✅ Visualização de playlists
- ✅ Visualização de analytics
- ✅ Visualização de relatórios
- ✅ Visualização de dashboards

**Restrições:**
- ❌ NÃO pode modificar nada
- ❌ NÃO pode criar nada
- ❌ NÃO pode deletar nada
- ❌ NÃO pode fazer upload de mídias

**Permissões:**
- `campaigns.read` (apenas leitura)
- `medias.read` (apenas leitura)
- `playlists.read` (apenas leitura)
- `totems.read` (apenas leitura)
- `reports.read` (apenas leitura)
- `analytics.read` (apenas leitura)
- `smartdisplayfx.read` (apenas leitura)
- `dashboard.read` (apenas leitura)

**Não pode:**
- ❌ Qualquer ação de escrita (`create`, `update`, `delete`)
- ❌ Upload de arquivos
- ❌ Modificação de configurações

---

## 🔒 MATRIZ DE PERMISSÕES - GRUPO CLIENTE

| Recurso | ADMIN | GERENTE_MARKETING | EDITORACAO | VISUALIZADOR |
|---------|-------|-------------------|------------|--------------|
| **clients.*** | ✅ (próprio) | ❌ | ❌ | ❌ |
| **users.*** | ✅ (próprio cliente) | ❌ | ❌ | ❌ |
| **campaigns.*** | ✅ Todas | ✅ Todas | ✅ (read) | ✅ (read) |
| **medias.*** | ✅ Todas | ✅ Todas | ✅ (read/create/update/delete) | ✅ (read) |
| **playlists.*** | ✅ Todas | ✅ Todas | ✅ (read) | ✅ (read) |
| **smart-playlist.*** | ✅ Todas | ✅ Todas | ❌ | ❌ |
| **totems.*** | ✅ Todas | ✅ (read) | ❌ | ✅ (read) |
| **reports.*** | ✅ Todas | ✅ (read/create) | ❌ | ✅ (read) |
| **analytics.*** | ✅ Todas | ✅ (read) | ❌ | ✅ (read) |
| **billing.*** | ✅ Todas | ❌ | ❌ | ❌ |
| **settings.*** | ✅ (cliente) | ❌ | ❌ | ❌ |
| **qr-codes.*** | ✅ Todas | ✅ Todas | ❌ | ❌ |
| **tags.*** | ✅ Todas | ✅ Todas | ✅ (read/create) | ❌ |
| **smartdisplayfx.*** | ✅ Todas | ✅ Todas | ❌ | ✅ (read) |
| **ai.*** | ✅ Todas | ✅ Todas | ❌ | ❌ |

---

## 📝 DIFERENÇAS ENTRE OS SUBNÍVEIS

### ADMIN vs GERENTE_MARKETING

| Aspecto | ADMIN | GERENTE_MARKETING |
|---------|-------|-------------------|
| **Usuários** | ✅ Gerencia | ❌ Não gerencia |
| **Billing** | ✅ Acesso | ❌ Sem acesso |
| **Configurações** | ✅ Modifica | ❌ Não modifica |
| **Totens** | ✅ Gerencia | ✅ Apenas visualiza |
| **Marketing** | ✅ Total | ✅ Total |

### GERENTE_MARKETING vs EDITORACAO

| Aspecto | GERENTE_MARKETING | EDITORACAO |
|---------|-------------------|------------|
| **Campanhas** | ✅ Cria/Modifica | ✅ Apenas visualiza |
| **Playlists** | ✅ Cria/Modifica | ✅ Apenas visualiza |
| **Mídias** | ✅ Total | ✅ Upload/Edição |
| **Analytics** | ✅ Acesso | ❌ Sem acesso |
| **Relatórios** | ✅ Cria/Visualiza | ❌ Sem acesso |

### EDITORACAO vs VISUALIZADOR

| Aspecto | EDITORACAO | VISUALIZADOR |
|---------|-----------|-------------|
| **Mídias** | ✅ Upload/Edição | ✅ Apenas visualiza |
| **Tags** | ✅ Cria | ❌ Sem acesso |
| **Campanhas** | ✅ Visualiza | ✅ Visualiza |
| **Relatórios** | ❌ Sem acesso | ✅ Visualiza |

---

## 🎯 CASOS DE USO

### Caso 1: ADMIN do Cliente
**Cenário:** João é ADMIN do cliente "Loja ABC"
- ✅ Pode criar usuários para a Loja ABC
- ✅ Pode configurar parâmetros da Loja ABC
- ✅ Pode gerenciar totens da Loja ABC
- ✅ Pode ver billing da Loja ABC
- ✅ Pode criar campanhas, mídias, playlists
- ❌ NÃO pode ver dados da "Loja XYZ"

### Caso 2: GERENTE_MARKETING
**Cenário:** Maria é GERENTE_MARKETING do cliente "Loja ABC"
- ✅ Pode criar campanhas de marketing
- ✅ Pode criar playlists
- ✅ Pode fazer upload de mídias
- ✅ Pode ver analytics de campanhas
- ✅ Pode criar relatórios de marketing
- ❌ NÃO pode criar usuários
- ❌ NÃO pode ver billing
- ❌ NÃO pode modificar configurações

### Caso 3: EDITORACAO
**Cenário:** Pedro é EDITORACAO do cliente "Loja ABC"
- ✅ Pode fazer upload de mídias
- ✅ Pode editar metadados de mídias
- ✅ Pode organizar mídias
- ✅ Pode criar tags para mídias
- ✅ Pode visualizar campanhas (para contexto)
- ❌ NÃO pode criar campanhas
- ❌ NÃO pode criar playlists
- ❌ NÃO pode ver analytics

### Caso 4: VISUALIZADOR
**Cenário:** Ana é VISUALIZADOR do cliente "Loja ABC"
- ✅ Pode ver campanhas
- ✅ Pode ver mídias
- ✅ Pode ver playlists
- ✅ Pode ver relatórios
- ✅ Pode ver analytics
- ❌ NÃO pode modificar nada
- ❌ NÃO pode criar nada
- ❌ NÃO pode deletar nada

---

## 🔧 PRÓXIMOS PASSOS - IMPLEMENTAÇÃO

1. **Atualizar Schema SQL**
   - Adicionar roles: `gerente_marketing`, `editoracao`
   - Atualizar role `viewer` para `visualizador`
   - Configurar permissões específicas

2. **Atualizar Middlewares**
   - Ajustar proteções para novos níveis
   - Validar acesso por subnível

3. **Atualizar Frontend**
   - Filtrar menu por subnível
   - Mostrar/ocultar botões baseado em permissões

4. **Testes**
   - Testar cada subnível
   - Validar restrições

---

**Última atualização:** 2024-01-XX

