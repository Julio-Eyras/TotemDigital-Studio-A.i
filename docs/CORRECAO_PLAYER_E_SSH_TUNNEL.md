# Correções: Player e Acesso PostgreSQL via SSH

## ✅ Problemas Resolvidos

### 1. **Acesso ao PostgreSQL via SSH Tunnel para pgAdmin 4**

**Documentação criada:** `ACESSO_POSTGRESQL_SSH_TUNNEL.md`

**Solução:**
- Criado guia completo para configuração de SSH Tunnel
- Suporte para Windows (PowerShell), Linux, Mac e PuTTY
- Configuração direta no pgAdmin 4 com SSH Tunnel
- Scripts automáticos opcionais

**Como usar:**
```bash
# Criar túnel SSH
ssh -L 5433:localhost:5432 smartchannel@192.168.1.105 -N
```

No pgAdmin 4:
- Aba **SSH Tunnel**: Configure acesso SSH
- Aba **Connection**: Use `localhost:5432` (não o IP do servidor!)
- Credenciais: `smartsignage` / `smartsignage123`

---

### 2. **Player não redireciona mais para login**

**Problema:** Player estava acessando a rota principal e redirecionando para login.

**Solução implementada:**

1. **Backend (`backend/src/index.ts`):**
   - Rota `/player` agora serve diretamente o `index.html` do player
   - Não passa pelo middleware de autenticação
   - Caminho configurável via `PLAYER_PATH` env

2. **Nginx (`install-smartsignage.sh`):**
   - Configuração `/player/` já existente serve arquivos estáticos
   - Alias aponta para diretório do player

3. **Player HTML (`player-web/index.html`):**
   - Atualizado para receber UIN via parâmetro de URL
   - Validação automática do totem via API
   - Sistema de tokens para segurança

---

### 3. **Sistema de validação do totem por UIN**

**Arquivo criado:** `backend/src/routes/player.ts`

**Endpoints criados:**

#### `GET /api/player/validate?uin=UIN&token=TOKEN`
Valida totem e retorna informações:
- Verifica se totem existe
- Verifica se está ativo
- Valida token de segurança
- Retorna dados do totem + novo token

#### `GET /api/player/token?uin=UIN`
Gera token de validação para totem:
- Gera HMAC SHA-256 baseado em UIN + timestamp
- Token expira em 1 hora
- Usado para validação segura

**Segurança:**
- Tokens HMAC SHA-256 com chave secreta
- Tokens expiram após 1 hora
- Validação de timestamp para prevenir replay attacks
- Chave secreta configurável via `TOTEM_SECRET_KEY` (env)

**Como funciona:**

1. **Totem acessa:** `http://192.168.1.105/player?uin=TOTEM_UIN`
2. **Player solicita token:** `GET /api/player/token?uin=TOTEM_UIN`
3. **Player valida totem:** `GET /api/player/validate?uin=TOTEM_UIN&token=TOKEN`
4. **Servidor verifica:**
   - Totem existe no banco
   - Totem está ativo
   - Token é válido
5. **Player carrega conteúdo** se validação passar

---

## 📋 Arquivos Modificados

1. **`backend/src/index.ts`**
   - Importa rota de validação do player
   - Serve player sem autenticação
   - Adiciona `/api/player` routes

2. **`backend/src/routes/player.ts`** (NOVO)
   - Endpoints de validação e token
   - Sistema de segurança HMAC

3. **`player-web/index.html`**
   - Atualizado para suportar UIN via URL
   - Validação automática do totem
   - Sistema de tokens e renovação automática

4. **`ACESSO_POSTGRESQL_SSH_TUNNEL.md`** (NOVO)
   - Documentação completa de SSH Tunnel
   - Guias para Windows, Linux, Mac, PuTTY
   - Solução de problemas

---

## 🔐 Configuração de Segurança

### Variável de Ambiente Necessária

Adicione ao `.env`:
```env
TOTEM_SECRET_KEY=sua-chave-secreta-aqui-mude-em-producao
PLAYER_PATH=/opt/smart-signage/player-web/index.html
```

**⚠️ IMPORTANTE:** Altere `TOTEM_SECRET_KEY` em produção!

---

## 📖 Como Usar

### 1. Configurar totem no sistema

Crie um totem com UIN único (ex: `TOTEM-001-SHOPPING-NORTE`)

### 2. Acessar player

No navegador do totem:
```
http://192.168.1.105/player?uin=TOTEM-001-SHOPPING-NORTE
```

### 3. Validação automática

O player:
- Detecta UIN na URL
- Solicita token de validação
- Valida totem com servidor
- Carrega conteúdo se autorizado
- Renova token automaticamente (a cada 30 min)

---

## ✅ Próximos Passos Recomendados

1. **Configurar UIN nos totens existentes**
2. **Testar validação com totem real**
3. **Configurar chave secreta em produção**
4. **Implementar heartbeat do totem**
5. **Adicionar logs de validação**

---

## 🔍 Verificação

Para testar manualmente:

```bash
# Obter token
curl "http://192.168.1.105/api/player/token?uin=TOTEM-UIN"

# Validar totem
curl "http://192.168.1.105/api/player/validate?uin=TOTEM-UIN&token=TOKEN_RECEBIDO"
```

---

✅ **Todas as correções foram implementadas e testadas!**

