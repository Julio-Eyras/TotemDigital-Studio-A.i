# Guia: Admin Tools - Ferramentas de Administração

## 📋 Visão Geral

A aba **Admin Tools** no painel administrativo fornece ferramentas avançadas para:
- Visualizar logs de registro de totens
- Rastrear requisições por Request ID
- Ver detalhes completos de totens
- Monitorar informações do sistema

## 🚀 Acesso

1. Faça login no painel administrativo
2. No menu lateral, clique em **"Admin Tools"** (ícone de ferramentas)
3. A interface abrirá com 4 abas principais

---

## 📊 Abas Disponíveis

### 1. Logs de Registro

Visualiza todos os totens registrados recentemente.

#### Funcionalidades:

- ✅ **Lista de totens registrados** com informações básicas
- ✅ **Busca** por UIN, identifier ou IP
- ✅ **Filtro por limite** (25, 50, 100, 200 registros)
- ✅ **Expansão de detalhes** para ver informações de hardware
- ✅ **Logs do sistema** relacionados a registros
- ✅ **Atualização manual** dos logs

#### Como usar:

1. A aba abre automaticamente mostrando os últimos 50 registros
2. Use o campo de busca para filtrar por UIN, identifier ou IP
3. Clique no ícone de expansão (▶) para ver detalhes de hardware
4. Clique em "Atualizar" para recarregar os logs
5. Ajuste o limite para ver mais ou menos registros

#### Informações exibidas:

- **ID** do totem
- **Identifier** (nome/identificador)
- **UIN** (formato monospace)
- **Status** (com chip colorido)
- **IP Address**
- **Data de Registro**
- **Hardware Info** (quando expandido):
  - MAC Address
  - Hostname
  - Plataforma
  - Arquitetura

---

### 2. Rastreamento de Requisições

Busca logs específicos por Request ID.

#### Funcionalidades:

- ✅ **Busca por Request ID** (formato: `REG-1234567890-abc123` ou `PLAYER-1234567890-abc123`)
- ✅ **Exibe logs do sistema** relacionados ao Request ID
- ✅ **Exibe totens relacionados** ao Request ID
- ✅ **Cores por tipo de log** (erro, sucesso, aviso)
- ✅ **Copiar logs** para clipboard

#### Como usar:

1. Digite o Request ID no campo de busca
2. Clique em "Buscar" ou pressione Enter
3. Os logs serão exibidos com cores:
   - 🔴 Vermelho: Erros (❌)
   - 🟢 Verde: Sucessos (✅)
   - 🟡 Amarelo: Avisos (⚠️)
4. Clique em "Copiar Logs" para copiar todos os logs
5. Use "Buscar Novamente" para uma nova busca

#### Onde obter Request ID:

- **No player (console do navegador):** Logs começam com `[PLAYER-xxx]`
- **No backend:** Logs começam com `[REG-xxx]`
- **Resposta da API:** Campo `requestId` na resposta

#### Exemplo de Request ID:

```
REG-1699123456-abc123
PLAYER-1699123456-xyz789
```

---

### 3. Detalhes de Totem

Visualiza informações detalhadas de um totem específico.

#### Funcionalidades:

- ✅ **Busca por ID numérico ou UIN**
- ✅ **Informações completas** do totem
- ✅ **Configuração completa** (JSON formatado)
- ✅ **Informações de hardware** detalhadas
- ✅ **Datas e status** completos

#### Como usar:

1. Digite o ID numérico (ex: `1`) ou UIN (ex: `SSP-1234567890`) no campo de busca
2. Clique em "Buscar" ou pressione Enter
3. As informações serão exibidas em cards organizados:
   - Informações Básicas
   - Datas e Status
   - Configuração (JSON)
   - Hardware Info

#### Informações exibidas:

**Básicas:**
- ID, Identifier, UIN, Device ID, Status, IP Address

**Datas:**
- Criado em, Atualizado em, Último visto, Último heartbeat

**Status:**
- Ativo, Bloqueado

**Configuração:**
- JSON completo formatado (com scroll)

**Hardware:**
- MAC Address, Hostname, Plataforma, Arquitetura, Hardware Hash

---

### 4. Informações do Sistema

Monitora o estado do sistema e estatísticas.

#### Funcionalidades:

- ✅ **Informações do sistema** (Node.js, plataforma, uptime)
- ✅ **Uso de memória** detalhado
- ✅ **Estatísticas de totens** (total, pendentes, online, offline)
- ✅ **Registros recentes** (últimos 10)
- ✅ **Atualização manual** das informações

#### Como usar:

1. A aba carrega automaticamente ao ser aberta
2. Clique em "Atualizar" para recarregar as informações
3. Use os cards coloridos para ver estatísticas rápidas

#### Informações exibidas:

**Sistema:**
- Node Version
- Plataforma (Linux, Windows, etc.)
- Ambiente (development, production)
- Uptime (formato: Xd Xh Xm)

**Memória:**
- RSS (Resident Set Size)
- Heap Total
- Heap Used
- External
- Array Buffers

**Estatísticas de Totens:**
- 📊 Total de Totens
- ⏳ Pendentes de Aprovação
- ✅ Online
- ⚫ Offline
- 📈 Registrados nas últimas 24h

**Registros Recentes:**
- Lista dos últimos 10 totens registrados
- Com UIN, IP, status e data

---

## 🔍 Casos de Uso

### Caso 1: Verificar se um totem foi registrado

1. Vá em **Admin Tools** → **Logs de Registro**
2. Use o campo de busca com o UIN do totem
3. Se encontrado, clique para expandir e ver detalhes

### Caso 2: Rastrear uma requisição que falhou

1. Anote o Request ID do console do navegador ou logs do backend
2. Vá em **Admin Tools** → **Rastreamento de Requisições**
3. Digite o Request ID e clique em "Buscar"
4. Analise os logs para identificar o problema

### Caso 3: Ver detalhes completos de um totem

1. Vá em **Admin Tools** → **Detalhes de Totem**
2. Digite o ID ou UIN do totem
3. Veja todas as informações detalhadas

### Caso 4: Monitorar saúde do sistema

1. Vá em **Admin Tools** → **Informações do Sistema**
2. Verifique:
   - Uso de memória
   - Estatísticas de totens
   - Registros recentes
3. Use "Atualizar" periodicamente

---

## 📝 Notas Importantes

### Request IDs

- Cada requisição tem um Request ID único
- Request IDs são válidos por tempo limitado (logicamente)
- Use o Request ID para rastrear uma requisição específica
- Request IDs são gerados automaticamente pelo sistema

### Logs do Sistema

- Logs são coletados do backend quando disponíveis
- Se não houver logs disponíveis, apenas totens serão mostrados
- Para logs completos, use o script de diagnóstico: `scripts/diagnose-player-registration.sh`

### Performance

- Limites recomendados:
  - Logs de Registro: 50-100 registros
  - Rastreamento: Busque por Request ID específico
  - Sistema: Atualize manualmente quando necessário

### Permissões

- Admin Tools requer permissões de administrador
- Alguns endpoints podem estar disponíveis apenas para debug

---

## 🐛 Troubleshooting

### Problema: Nenhum log aparece

**Solução:**
1. Verifique se o backend está rodando
2. Verifique se há totens registrados no banco
3. Tente aumentar o limite de registros
4. Use o script de diagnóstico para verificar logs no servidor

### Problema: Request ID não encontrado

**Solução:**
1. Verifique se o Request ID está correto
2. Verifique se a requisição foi feita recentemente
3. Logs antigos podem não estar disponíveis
4. Use o script de diagnóstico para buscar logs completos

### Problema: Erro ao carregar informações

**Solução:**
1. Verifique se o backend está acessível
2. Verifique se o usuário tem permissões de admin
3. Verifique o console do navegador para erros
4. Tente atualizar a página

---

## 📚 Recursos Relacionados

- **Guia de Coleta de Logs:** `docs/COLETA_LOGS_DIAGNOSTICO.md`
- **Script de Diagnóstico:** `scripts/diagnose-player-registration.sh`
- **Endpoints de Debug:** `backend/src/routes/debug.ts`

---

**Última atualização:** 2025-11-04  
**Versão:** 2.1.0

