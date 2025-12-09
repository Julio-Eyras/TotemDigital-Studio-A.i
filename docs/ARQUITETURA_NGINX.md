# Arquitetura Nginx - Smart Signage Pro (OBSOLETO)

## 📊 **Resumo da Arquitetura**

> Este documento descreve a arquitetura ANTERIOR com dois containers Nginx.
> A arquitetura ATUAL utiliza um único Nginx integrado ao container do frontend.
> Consulte: `ARQUITETURA_NGINX_SIMPLIFICADA.md`.

### (Histórico) **Eram 2 containers Nginx**

```
┌─────────────────────────────────────────────────────────┐
│                     Internet                             │
│                        ↓                                 │
│                   Porta 80                               │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ↓
        ┌───────────────────────────────┐
        │   Container: nginx             │
        │   (Reverse Proxy Principal)    │
        │   - Roteia requisições         │
        │   - Porta 80 (externa)         │
        └───────────┬───────────────────┘
                    │
        ┌───────────┴───────────────┐
        │                           │
        ↓                           ↓
┌───────────────┐         ┌──────────────────┐
│ Container:    │         │ Container:       │
│ frontend      │         │ backend          │
│               │         │                  │
│ Nginx Alpine  │         │ Node.js/Express  │
│ + React Build │         │                  │
│               │         │ Porta 3000       │
│ Porta 80      │         │ (interno)        │
│ (interno)     │         │                  │
│               │         │ NÃO usa Nginx    │
│ Serve arquivos│         │                  │
│ estáticos     │         │ API REST         │
└───────────────┘         └──────────────────┘
```

## 🔍 **Detalhamento**

### **1. Container Backend** (`smartsignage-backend`)
- **Tecnologia**: Node.js + Express
- **Porta**: 3000 (interna e externa para acesso direto)
- **Nginx**: ❌ NÃO usa Nginx
- **Função**: API REST, endpoints `/api/*`, `/player`, `/health`

### **2. Container Frontend** (`smartsignage-frontend`)
- **Tecnologia**: Nginx Alpine + Build do React
- **Porta**: 80 (interna), 3001 (externa para acesso direto)
- **Nginx**: ✅ SIM, tem seu próprio Nginx
- **Configuração**: `nginx/frontend-static.conf`
- **Função**: Serve arquivos estáticos do React (HTML, JS, CSS)
- **Características**:
  - SPA routing (`try_files $uri $uri/ /index.html`)
  - Cache para assets estáticos
  - Health check endpoint

### **3. Container Nginx Principal** (`smartsignage-nginx`)
- **Tecnologia**: Nginx Alpine (somente reverse proxy)
- **Porta**: 80 (externa - porta principal)
- **Nginx**: ✅ SIM, é o reverse proxy principal
- **Configuração**: `nginx/nginx.conf` + `nginx/frontend.conf`
- **Função**: Roteamento inteligente
  - `/api/*` → `proxy_pass http://backend:3000`
  - `/player` → `proxy_pass http://backend:3000`
  - `/` → `proxy_pass http://frontend:80`

## 🎯 **Por que essa arquitetura?**

### **Vantagens:**
1. ✅ **Isolamento**: Cada serviço independente
2. ✅ **Escalabilidade**: Pode escalar frontend/backend separadamente
3. ✅ **Cache**: Frontend pode ter cache próprio
4. ✅ **SPA Routing**: Nginx do frontend lida com rotas do React
5. ✅ **SSL/TLS**: Pode configurar HTTPS no nginx principal facilmente

### **Desvantagens:**
1. ⚠️ **Complexidade**: Mais containers para gerenciar
2. ⚠️ **Latência**: Requisição passa por 2 Nginx (principal → frontend)

## (Histórico) **Problema identificado na época**

O Nginx principal está mostrando "Welcome to nginx!" porque:
1. O proxy para `frontend:80` pode estar falhando
2. O Nginx principal não tem tratamento de erro adequado
3. O Alpine tem arquivos padrão que estão sendo servidos

## (Histórico) **Solução aplicada à época**

1. **Remover arquivos padrão do Alpine** no container nginx principal
2. **Não definir `root`** no nginx principal (só proxy)
3. **Tratamento de erro customizado** - retorna JSON ao invés de HTML padrão
4. **`default_server`** para garantir que é o server block principal

## (Concluído) **Arquitetura simplificada adotada**
Agora utilizamos Nginx integrado no `frontend` para servir estáticos e fazer proxy direto para o `backend`. Veja `ARQUITETURA_NGINX_SIMPLIFICADA.md`.

Se os problemas persistirem, podemos simplificar:

### **Opção 1: Nginx único servindo tudo**
```
┌─────────────────────────────────┐
│   Nginx Principal (porta 80)    │
│   - Serve arquivos estáticos    │
│     via volume mount            │
│   - Proxy para /api/* → backend │
└─────────────────────────────────┘
```

### **Opção 2: Manter atual, mas melhorar**
- Adicionar health checks mais robustos
- Timeouts maiores
- Retry logic

## (Histórico) **Comandos para diagnóstico**

```bash
# Verificar containers Nginx
docker ps | grep nginx

# Logs do Nginx principal
docker logs smartsignage-nginx

# Logs do Frontend (Nginx interno)
docker logs smartsignage-frontend

# Testar conexão interna
docker exec smartsignage-nginx curl http://frontend:80
docker exec smartsignage-nginx curl http://backend:3000/health
```

## (Histórico) **Conclusão**

A arquitetura atual com **2 Nginx é correta e recomendada** para produção. O problema não é a arquitetura, mas sim:
1. Configuração de erro handling
2. Remoção de arquivos padrão
3. Validação de que o frontend está respondendo

As correções implementadas devem resolver o problema de mostrar a página padrão.

