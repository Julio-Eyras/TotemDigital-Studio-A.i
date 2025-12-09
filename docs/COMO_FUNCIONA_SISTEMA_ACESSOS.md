# 🔐 Como Funciona o Sistema de Acessos - Guia Completo

**Data:** 2024-01-XX  
**Versão:** v2.1

---

## 📊 VISÃO GERAL

O sistema possui **7 níveis de acesso** organizados em hierarquia:

```
1. ADMIN_SQL (Top) → Sistema + Dados
2. OPERATOR (Top) → Apenas Sistema (SEM dados de clientes)
3. ADMIN (Cliente) → Administra cliente
4. GERENTE_MARKETING (Cliente) → Marketing completo
5. EDITORACAO (Cliente) → Upload/edição de mídias
6. VISUALIZADOR (Cliente) → Apenas leitura
7. CLIENT (Player) → API do player
```

---

## 🎯 COMO FUNCIONA PARA O USUÁRIO

### 1. ADMIN (Cliente)

**O que o usuário vê:**
- ✅ Menu completo (todos os itens)
- ✅ Pode criar/editar/deletar tudo do cliente
- ✅ Pode gerenciar usuários do cliente
- ✅ Pode ver billing
- ✅ Pode modificar configurações

**O que o usuário NÃO vê:**
- ❌ Dados de outros clientes
- ❌ Configurações do sistema
- ❌ Logs do sistema

**Exemplo prático:**
```
João (ADMIN da "Loja ABC")
├── Cria usuário "Maria" (GERENTE_MARKETING)
├── Configura parâmetros da Loja ABC
├── Cria campanha "Black Friday"
├── Faz upload de vídeos
├── Vê billing da Loja ABC
└── ❌ NÃO vê dados da "Loja XYZ"
```

---

### 2. GERENTE_MARKETING

**O que o usuário vê:**
- ✅ Dashboard
- ✅ Mídia (criar/editar/deletar)
- ✅ Playlists (criar/editar/deletar)
- ✅ Smart Playlist
- ✅ Campanhas (criar/editar/deletar)
- ✅ Totems (apenas visualizar)
- ✅ Analytics
- ✅ Relatórios (criar/visualizar)
- ✅ QR Codes
- ✅ Tags
- ✅ SmartDisplayFX
- ✅ IA

**O que o usuário NÃO vê:**
- ❌ Usuários
- ❌ Clientes
- ❌ Billing
- ❌ Configurações

**Exemplo prático:**
```
Maria (GERENTE_MARKETING da "Loja ABC")
├── Cria campanha "Promoção Verão"
├── Faz upload de imagens promocionais
├── Cria playlist "Verão 2024"
├── Vê analytics de campanhas
├── Cria relatório de performance
└── ❌ NÃO pode criar usuários
└── ❌ NÃO pode ver billing
```

---

### 3. EDITORACAO

**O que o usuário vê:**
- ✅ Dashboard
- ✅ Mídia (upload/edição)
- ✅ Tags (criar)
- ✅ Campanhas (apenas visualizar - para contexto)
- ✅ Playlists (apenas visualizar - para contexto)

**O que o usuário NÃO vê:**
- ❌ Criar campanhas
- ❌ Criar playlists
- ❌ Analytics
- ❌ Relatórios
- ❌ Totems
- ❌ Billing
- ❌ Configurações

**Exemplo prático:**
```
Pedro (EDITORACAO da "Loja ABC")
├── Faz upload de imagens de produtos
├── Edita metadados (título, descrição, tags)
├── Organiza mídias em categorias
├── Cria tags para facilitar busca
├── Vê campanhas existentes (para saber o que precisa)
└── ❌ NÃO pode criar campanha
└── ❌ NÃO pode ver analytics
```

---

### 4. VISUALIZADOR

**O que o usuário vê:**
- ✅ Dashboard
- ✅ Mídia (apenas visualizar)
- ✅ Playlists (apenas visualizar)
- ✅ Campanhas (apenas visualizar)
- ✅ Totems (apenas visualizar)
- ✅ Relatórios (apenas visualizar)
- ✅ Analytics (apenas visualizar)
- ✅ SmartDisplayFX (apenas visualizar)

**O que o usuário NÃO vê:**
- ❌ Botões de criar/editar/deletar
- ❌ Upload de arquivos
- ❌ Modificação de qualquer coisa

**Exemplo prático:**
```
Ana (VISUALIZADOR da "Loja ABC")
├── Vê todas as campanhas
├── Vê todas as mídias
├── Vê playlists
├── Vê relatórios de performance
├── Vê analytics
└── ❌ NÃO pode modificar nada
└── ❌ NÃO pode criar nada
```

---

## 🔒 VALIDAÇÃO NO BACKEND

### Como Funciona

1. **Usuário faz login** → Recebe token JWT com role
2. **Usuário faz requisição** → Token enviado no header
3. **Middleware `authMiddleware`** → Valida token e adiciona `req.user`
4. **Middleware `blockClientDataAccess`** → Bloqueia OPERATOR de dados de clientes
5. **Middleware `authorizeRole`** → Valida se role tem permissão
6. **Rota processa** → Retorna dados ou erro 403

### Exemplo de Fluxo

```
1. Maria (GERENTE_MARKETING) tenta criar campanha
   → POST /api/campaigns
   → Token válido ✅
   → authorizeRole(['admin', 'gerente_marketing']) ✅
   → Campanha criada ✅

2. Pedro (EDITORACAO) tenta criar campanha
   → POST /api/campaigns
   → Token válido ✅
   → authorizeRole(['admin', 'gerente_marketing']) ❌
   → 403 Forbidden ❌

3. Ana (VISUALIZADOR) tenta ver campanhas
   → GET /api/campaigns
   → Token válido ✅
   → authorizeRole(['admin', 'gerente_marketing', 'visualizador']) ✅
   → Lista de campanhas retornada ✅
```

---

## 🎨 VALIDAÇÃO NO FRONTEND

### Como Funciona

1. **Usuário faz login** → Role salva no `localStorage`
2. **Layout carrega** → Filtra menu baseado na role
3. **Usuário clica em item** → Navega para página
4. **Página carrega** → Mostra/oculta botões baseado em role
5. **Usuário tenta ação** → Backend valida novamente

### Exemplo de Menu Filtrado

**Maria (GERENTE_MARKETING) vê:**
```
✅ Dashboard
✅ Mídia
✅ Playlists
✅ Smart Playlist
✅ Campanhas
✅ Totems
✅ Analytics
✅ Relatórios
✅ QR Codes
✅ Tags
✅ SmartDisplayFX
✅ IA
❌ Usuários (oculto)
❌ Clientes (oculto)
❌ Billing (oculto)
❌ Configurações (oculto)
```

**Pedro (EDITORACAO) vê:**
```
✅ Dashboard
✅ Mídia
✅ Tags
✅ Campanhas (apenas visualizar)
✅ Playlists (apenas visualizar)
❌ Smart Playlist (oculto)
❌ Analytics (oculto)
❌ Relatórios (oculto)
❌ Totems (oculto)
```

**Ana (VISUALIZADOR) vê:**
```
✅ Dashboard
✅ Mídia (apenas visualizar)
✅ Playlists (apenas visualizar)
✅ Campanhas (apenas visualizar)
✅ Totems (apenas visualizar)
✅ Relatórios (apenas visualizar)
✅ Analytics (apenas visualizar)
✅ SmartDisplayFX (apenas visualizar)
❌ Todos os botões de criar/editar/deletar (ocultos)
```

---

## 📋 MATRIZ DE ACESSO - RESUMO

| Funcionalidade | ADMIN | GERENTE_MARKETING | EDITORACAO | VISUALIZADOR |
|----------------|-------|-------------------|------------|--------------|
| **Criar Campanha** | ✅ | ✅ | ❌ | ❌ |
| **Editar Campanha** | ✅ | ✅ | ❌ | ❌ |
| **Ver Campanha** | ✅ | ✅ | ✅ | ✅ |
| **Upload Mídia** | ✅ | ✅ | ✅ | ❌ |
| **Editar Mídia** | ✅ | ✅ | ✅ | ❌ |
| **Ver Mídia** | ✅ | ✅ | ✅ | ✅ |
| **Criar Playlist** | ✅ | ✅ | ❌ | ❌ |
| **Editar Playlist** | ✅ | ✅ | ❌ | ❌ |
| **Ver Playlist** | ✅ | ✅ | ✅ | ✅ |
| **Ver Analytics** | ✅ | ✅ | ❌ | ✅ |
| **Criar Relatório** | ✅ | ✅ | ❌ | ❌ |
| **Ver Relatório** | ✅ | ✅ | ❌ | ✅ |
| **Gerenciar Usuários** | ✅ | ❌ | ❌ | ❌ |
| **Ver Billing** | ✅ | ❌ | ❌ | ❌ |
| **Configurações** | ✅ | ❌ | ❌ | ❌ |

---

## 🔐 SEGURANÇA

### Proteções Implementadas

1. **Backend sempre valida** → Mesmo que frontend mostre, backend bloqueia
2. **Token JWT** → Não pode ser falsificado
3. **Middleware em camadas** → Múltiplas validações
4. **Auditoria** → Todas as ações de ADMIN_SQL e OPERATOR são logadas

### Exemplo de Segurança

```
Cenário: Pedro (EDITORACAO) tenta criar campanha via API direta

1. Frontend não mostra botão "Criar Campanha" ✅
2. Mas se tentar via Postman/curl:
   → POST /api/campaigns
   → Token válido ✅
   → authorizeRole(['admin', 'gerente_marketing']) ❌
   → 403 Forbidden ❌
   → Ação bloqueada ✅
```

---

## 📝 CASOS DE USO REAIS

### Caso 1: Loja de Roupas

**Estrutura:**
- **ADMIN:** João (dono da loja)
- **GERENTE_MARKETING:** Maria (responsável por campanhas)
- **EDITORACAO:** Pedro (faz upload de fotos de produtos)
- **VISUALIZADOR:** Ana (vendedora que precisa ver campanhas)

**Fluxo:**
1. João cria usuários e configura loja
2. Maria cria campanha "Liquidação"
3. Pedro faz upload de fotos dos produtos
4. Maria cria playlist com as fotos
5. Ana vê a campanha nas telas da loja

---

### Caso 2: Shopping Center

**Estrutura:**
- **ADMIN:** Carlos (gerente do shopping)
- **GERENTE_MARKETING:** Sofia (responsável por todas as lojas)
- **EDITORACAO:** Lucas (faz upload de conteúdo das lojas)
- **VISUALIZADOR:** Vários (gerentes de lojas individuais)

**Fluxo:**
1. Carlos configura shopping e cria usuários
2. Sofia cria campanhas para todo o shopping
3. Lucas faz upload de conteúdo de cada loja
4. Gerentes de lojas veem suas campanhas

---

## ✅ CONCLUSÃO

O sistema de acessos funciona em **duas camadas**:

1. **Frontend:** Filtra menu e botões baseado na role
2. **Backend:** Valida todas as ações, mesmo que frontend permita

Isso garante que:
- ✅ Usuários veem apenas o que podem usar
- ✅ Ações não autorizadas são bloqueadas
- ✅ Segurança em múltiplas camadas
- ✅ Auditoria de ações críticas

---

**Última atualização:** 2024-01-XX

