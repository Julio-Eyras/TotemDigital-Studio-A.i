# Configuração do Player em Porta Separada

## 📋 Visão Geral

O Smart Signage Pro permite configurar o player para rodar em uma porta separada do backend principal. Isso é útil para:

- **Isolamento de recursos**: Separar o tráfego do player do tráfego administrativo
- **Balanceamento de carga**: Distribuir requisições entre portas diferentes
- **Segurança**: Expor apenas a porta do player em firewalls específicos
- **Debug**: Testar o player independentemente do backend

## 🔧 Configuração

### 1. Variável de Ambiente

Adicione no arquivo `.env` do backend:

```bash
# Porta separada para o player (opcional)
# Se definida, cria um servidor Express separado apenas para servir o player
# Se não definida ou 0, o player é servido na mesma porta do backend (PORT)
PLAYER_PORT=6691
```

**Valores:**
- `0` ou não definido: Player é servido na mesma porta do backend (padrão)
- `6691` (ou qualquer porta): Cria servidor Express separado na porta especificada

### 2. Nginx (Opcional)

Se você estiver usando Nginx como proxy reverso, você pode configurar para fazer proxy para a porta separada:

#### Opção A: Usar variável de ambiente no Nginx

No arquivo `nginx-complete.conf` ou similar:

```nginx
location /player {
    # Se PLAYER_PORT estiver definido, usar porta separada
    # Caso contrário, usar backend padrão
    set $player_backend "http://backend:${BACKEND_INTERNAL_PORT}";
    
    # Se PLAYER_PORT=6691, descomente e ajuste:
    # set $player_backend "http://backend:6691";
    
    proxy_pass $player_backend;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # Buffers maiores para player
    proxy_buffer_size 256k;
    proxy_buffers 8 512k;
    proxy_busy_buffers_size 512k;
    proxy_temp_file_write_size 512k;
}
```

#### Opção B: Acesso direto (sem Nginx)

Se não estiver usando Nginx, você pode acessar o player diretamente:

```
http://IP-DO-SERVIDOR:6691
```

## 🚀 Como Funciona

### Com PLAYER_PORT definido (ex: 6691)

1. **Backend principal** inicia na porta padrão (ex: 3000)
   - Serve API, admin, etc.

2. **Servidor do player** inicia na porta separada (ex: 6691)
   - Serve apenas arquivos estáticos do player (`/player`)
   - Servidor Express dedicado e isolado

3. **Nginx** (se configurado) faz proxy de `/player` para `http://backend:6691`

### Sem PLAYER_PORT (padrão)

1. **Backend principal** serve tudo na mesma porta (ex: 3000)
   - API: `http://localhost:3000/api`
   - Player: `http://localhost:3000/player`
   - Admin: `http://localhost:3000/admin`

## 📝 Exemplos de Uso

### Exemplo 1: Player na porta 6691

**`.env` do backend:**
```bash
PORT=3000
PLAYER_PORT=6691
```

**Acesso:**
- Backend: `http://192.168.1.110:3000`
- Player: `http://192.168.1.110:6691`

### Exemplo 2: Player na mesma porta (padrão)

**`.env` do backend:**
```bash
PORT=3000
# PLAYER_PORT não definido ou = 0
```

**Acesso:**
- Backend: `http://192.168.1.110:3000`
- Player: `http://192.168.1.110:3000/player`

### Exemplo 3: Com Nginx na porta 80

**Nginx (`/etc/nginx/sites-available/smart-signage`):**
```nginx
server {
    listen 80;
    server_name _;
    
    # Player (proxy para porta separada)
    location /player {
        proxy_pass http://localhost:6691;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://localhost:3000;
        # ... outras configurações
    }
    
    # Frontend Admin
    location / {
        root /opt/smart-signage/frontend/build;
        try_files $uri $uri/ /index.html;
    }
}
```

**Acesso:**
- Admin: `http://192.168.1.110/`
- API: `http://192.168.1.110/api`
- Player: `http://192.168.1.110/player` (proxy para porta 6691)

## ⚠️ Observações Importantes

1. **Firewall**: Se usar porta separada, certifique-se de abrir a porta no firewall:
   ```bash
   sudo ufw allow 6691/tcp
   ```

2. **CORS**: O servidor do player tem CORS configurado para aceitar requisições de qualquer origem (apenas para arquivos estáticos). As APIs continuam usando as configurações de CORS do backend principal.

3. **API do Player**: As APIs do player (`/api/player/*`) continuam sendo servidas pelo backend principal, não pelo servidor separado. O servidor separado serve apenas os arquivos estáticos (HTML, JS, CSS).

4. **Logs**: Os logs do servidor do player aparecem com o prefixo `[Player Server]` nos logs do backend.

## 🔍 Verificação

Após configurar, verifique os logs do backend ao iniciar:

```
[Player Server] Servidor do player iniciado na porta 6691
```

Se a porta já estiver em uso, você verá:

```
[Player Server] Porta 6691 já está em uso. Player será servido na porta do backend.
```

## 📚 Referências

- [Configuração do Backend](../backend/src/config/env.ts)
- [Servidor Principal](../backend/src/index.ts)
- [Configuração do Nginx](../nginx/nginx-complete.conf)
