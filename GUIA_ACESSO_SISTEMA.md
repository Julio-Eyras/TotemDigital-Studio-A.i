# 📋 GUIA DE ACESSO AO SISTEMA SMART SIGNAGE PRO

## 🌐 ENDEREÇOS CORRETOS PARA ACESSO

### ✅ **FRONTEND (Interface Web - Porta 80)**
```
http://192.168.1.105:80
ou
http://192.168.1.105
```

**Este é o acesso principal do sistema!** O Nginx serve o frontend na porta 80.

**Credenciais padrão:**
- **Usuário:** `admin`
- **Senha:** `admin`

---

### 🔧 **BACKEND API (Porta 3000)**
```
http://192.168.1.105:3000/
```

**Agora retorna informações da API:**
- Nome e versão do sistema
- Lista de endpoints disponíveis
- Documentação

**Endpoints importantes:**
- `/health` - Status do sistema
- `/api/auth` - Autenticação
- `/api/dashboard` - Dados do dashboard
- `/api/users` - Gerenciamento de usuários
- `/api/clients` - Gerenciamento de clientes
- `/api/players` - Gerenciamento de players
- `/api/media` - Gerenciamento de mídia
- `/api/playlists` - Gerenciamento de playlists

---

### 📱 **PLAYER (Porta 3000)**
```
http://192.168.1.105:3000/player
```

Interface do player para exibição de conteúdo.

---

## 🚨 **PROBLEMA RESOLVIDO**

### ❌ **Antes:**
Acessar `http://192.168.1.105:3000/` retornava:
```json
{
  "error": "Endpoint não encontrado",
  "path": "/",
  "method": "GET"
}
```

### ✅ **Agora:**
Acessar `http://192.168.1.105:3000/` retorna:
```json
{
  "name": "Smart Signage Pro v2.0",
  "version": "2.0.0",
  "type": "REST API",
  "description": "API Backend do Sistema de Sinalização Digital",
  "endpoints": {
    "health": "/health",
    "api": "/api",
    "authentication": "/api/auth",
    ...
  }
}
```

---

## 📝 **RESUMO**

1. **Para usar o sistema:** Acesse `http://192.168.1.105:80` (porta 80)
2. **Para testar a API:** Acesse `http://192.168.1.105:3000/` (porta 3000)
3. **Para verificar saúde:** Acesse `http://192.168.1.105:3000/health`

---

## 🔄 **PRÓXIMOS PASSOS**

Após fazer `git pull` no servidor:

```bash
# Atualizar código
git pull origin main

# Reiniciar backend para aplicar mudanças
docker compose restart backend

# Verificar se está funcionando
curl http://192.168.1.105:3000/
```

---

**Sistema agora retorna informações úteis em todas as rotas!** 🎉
