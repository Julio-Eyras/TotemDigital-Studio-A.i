# WebSocket: "Unexpected response code: 200"

## Sintoma

No Dispatcher Monitor (e em qualquer tela que use WebSocket para `/ws`), o browser mostra:

```text
WebSocket connection to 'ws://HOST/ws?token=...' failed: Error during WebSocket handshake: Unexpected response code: 200
```

## Causa

O Nginx está a responder ao pedido **GET /ws** com **HTTP 200** (por exemplo a servir `index.html` ou outra página) em vez de fazer o **upgrade** para WebSocket (resposta **101 Switching Protocols**).

Isso acontece quando:

1. **Não existe `location /ws`** no server block que trata do teu acesso (ex.: ao aceder por IP como `http://192.168.1.110`, é muitas vezes o `default_server`).
2. O pedido cai em `location /` com `try_files ... /index.html`, e o Nginx devolve o HTML com código 200.

## Solução

1. **Correção automática (recomendado)**  
   No servidor, a partir do repositório:

   ```bash
   cd /opt/smart-signage   # ou o caminho do projeto
   sudo ./scripts/fix-nginx-websocket.sh
   ```

   O script:
   - Usa o config ativo (sites-enabled) ou, na falta dele, `sites-available/smart-signage` / `default`.
   - Se já existir `location /ws` com `proxy_pass`, só recarrega o Nginx.
   - Caso contrário, insere o bloco `location /ws` (proxy para o backend com upgrade) e recarrega o Nginx.

2. **Acesso por IP (ex.: 192.168.1.110)**  
   Se o site for acedido por IP, o pedido pode ser tratado pelo **default** e não pelo config do smart-signage. Nesse caso, aplicar o bloco `/ws` também no default:

   ```bash
   sudo NGINX_CONFIG=/etc/nginx/sites-available/default ./scripts/fix-nginx-websocket.sh
   ```

3. **Config gerado pelo instalador**  
   O `scripts/install-smartsignage.sh` já gera um server block com:

   - `location ^~ /api/`
   - `location /ws` (proxy para o backend com `Upgrade` e `Connection "upgrade"`)
   - `location /`, etc.

   Se a instalação foi feita com uma versão antiga do script ou o config foi alterado à mão, pode faltar o `location /ws`; o passo 1 ou 2 corrige.

## Bloco necessário no Nginx

Dentro do `server { ... }` que serve a aplicação (e, se for o caso, o default_server):

```nginx
location /ws {
    proxy_pass http://localhost:3000;   # ou a porta do backend (BACKEND_PORT)
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    proxy_read_timeout 86400s;
    proxy_send_timeout 86400s;
}
```

Depois: `sudo nginx -t` e `sudo systemctl reload nginx`.

## Referências

- Script de correção: `scripts/fix-nginx-websocket.sh`
- Instalador (bloco `/ws`): `scripts/install-smartsignage.sh` (vários server blocks)
- Frontend que abre o WebSocket: `DispatcherMonitor.tsx` (e `index.tsx` para o erro no console)
