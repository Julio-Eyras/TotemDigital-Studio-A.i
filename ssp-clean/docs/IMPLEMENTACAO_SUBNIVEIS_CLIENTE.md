# 🔧 Implementação - Subníveis do Cliente

**Data:** 2024-01-XX  
**Status:** ✅ Implementado

---

## 📋 MUDANÇAS REALIZADAS

### 1. ✅ Schema SQL Atualizado

**Roles Atualizadas:**
- ✅ `admin` - Descrição atualizada: "Administra parâmetros administrativos e configurações do próprio cliente"
- ✅ `gerente_marketing` - **NOVO**: "Gerencia/cria/analisa campanhas, mídias, playlists. Total acesso à parte de marketing"
- ✅ `editoracao` - **NOVO**: "Acesso a suprir informações relevantes e mídias. Upload e edição de conteúdo"
- ✅ `visualizador` - Renomeado de `viewer`: "Acesso a dados e relatórios, apenas leitura"

**Permissões Configuradas:**

#### ADMIN (Cliente)
- ✅ Todas as permissões do cliente (users, campaigns, medias, playlists, totems, reports, analytics, billing, settings, etc.)

#### GERENTE_MARKETING
- ✅ Marketing completo: campaigns, medias, playlists, smart-playlist, qr-codes, tags, smartdisplayfx, ai (todas as ações)
- ✅ Analytics e reports (read, create)
- ✅ Totens (apenas read)
- ❌ Sem acesso: users, billing, clients, settings

#### EDITORACAO
- ✅ Mídias (read, create, update, delete)
- ✅ Tags (read, create)
- ✅ Campanhas e playlists (apenas read para contexto)
- ❌ Sem acesso: criação de campanhas, playlists, analytics, reports

#### VISUALIZADOR
- ✅ Apenas leitura: campaigns, medias, playlists, totems, reports, analytics, smartdisplayfx, dashboard
- ❌ Sem acesso: qualquer ação de escrita

---

### 2. ✅ Frontend Atualizado

**`rolePermissions.ts`:**
- ✅ Tipo `UserRole` atualizado com novos roles
- ✅ Permissões de menu ajustadas para cada subnível

**Menu Filtrado por Subnível:**

| Item | ADMIN | GERENTE_MARKETING | EDITORACAO | VISUALIZADOR |
|------|-------|-------------------|------------|--------------|
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| Mídia | ✅ | ✅ | ✅ | ✅ |
| Playlists | ✅ | ✅ | ❌ | ✅ |
| Smart Playlist | ✅ | ✅ | ❌ | ❌ |
| Campanhas | ✅ | ✅ | ❌ | ✅ |
| Totems | ✅ | ✅ | ❌ | ✅ |
| Usuários | ✅ | ❌ | ❌ | ❌ |
| Clientes | ✅ | ❌ | ❌ | ❌ |
| Analytics | ✅ | ✅ | ❌ | ✅ |
| Relatórios | ✅ | ✅ | ❌ | ✅ |
| QR Codes | ✅ | ✅ | ❌ | ❌ |
| Faturamento | ✅ | ❌ | ❌ | ❌ |
| IA | ✅ | ✅ | ❌ | ❌ |
| Tags | ✅ | ✅ | ✅ | ❌ |
| SmartDisplayFX | ✅ | ✅ | ❌ | ✅ |
| Configurações | ✅ | ❌ | ❌ | ❌ |

---

## 🎯 COMO FUNCIONA

### Hierarquia de Acesso

```
ADMIN (Cliente)
├── Pode tudo do cliente
├── Gerencia usuários
├── Configurações
└── Billing

GERENTE_MARKETING
├── Marketing completo
│   ├── Campanhas (criar/modificar)
│   ├── Mídias (criar/modificar)
│   ├── Playlists (criar/modificar)
│   └── SmartDisplayFX (criar/modificar)
├── Analytics e Relatórios
└── ❌ Sem acesso a: usuários, billing, configurações

EDITORACAO
├── Mídias (upload/edição)
├── Tags (criar)
└── Visualização de campanhas/playlists (para contexto)
└── ❌ Sem acesso a: criar campanhas, playlists, analytics

VISUALIZADOR
├── Apenas leitura
└── ❌ Sem acesso a: qualquer modificação
```

---

## 📝 EXEMPLOS DE USO

### Exemplo 1: GERENTE_MARKETING

**Login:** maria@loja.com  
**Role:** `gerente_marketing`

**Pode fazer:**
- ✅ Criar campanha "Black Friday 2024"
- ✅ Fazer upload de vídeos promocionais
- ✅ Criar playlist "Promoções"
- ✅ Ver analytics de campanhas
- ✅ Criar relatório de performance

**NÃO pode fazer:**
- ❌ Criar usuário novo
- ❌ Ver billing
- ❌ Modificar configurações do cliente
- ❌ Gerenciar totens (apenas visualizar)

---

### Exemplo 2: EDITORACAO

**Login:** pedro@loja.com  
**Role:** `editoracao`

**Pode fazer:**
- ✅ Fazer upload de imagens/vídeos
- ✅ Editar metadados de mídias
- ✅ Criar tags para organizar mídias
- ✅ Ver campanhas existentes (para contexto)

**NÃO pode fazer:**
- ❌ Criar nova campanha
- ❌ Criar playlist
- ❌ Ver analytics
- ❌ Ver relatórios

---

### Exemplo 3: VISUALIZADOR

**Login:** ana@loja.com  
**Role:** `visualizador`

**Pode fazer:**
- ✅ Ver todas as campanhas
- ✅ Ver todas as mídias
- ✅ Ver playlists
- ✅ Ver relatórios
- ✅ Ver analytics

**NÃO pode fazer:**
- ❌ Modificar qualquer coisa
- ❌ Criar qualquer coisa
- ❌ Deletar qualquer coisa

---

## 🔒 VALIDAÇÕES NO BACKEND

### Middleware de Proteção

O middleware `blockClientDataAccess` já protege OPERATOR de acessar dados de clientes. Agora também valida os subníveis:

- **GERENTE_MARKETING**: Pode acessar marketing, mas não users/billing/settings
- **EDITORACAO**: Pode acessar apenas medias e tags (com restrições)
- **VISUALIZADOR**: Apenas leitura (validação nas rotas)

---

## ✅ CHECKLIST

- [x] Schema SQL atualizado com novos roles
- [x] Permissões configuradas para cada subnível
- [x] Frontend atualizado com filtros de menu
- [ ] Testes de cada subnível
- [ ] Validação de restrições

---

**Última atualização:** 2024-01-XX

