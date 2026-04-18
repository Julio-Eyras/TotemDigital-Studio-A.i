# Teste rápido — modo compacto TotemDigital

Este guia valida se a instância está realmente em perfil **monousuário compacto**.

## Pré-condições

- Backend com `TOTEMDIGITAL_COMPACT=true`
- Frontend com `REACT_APP_TOTEMDIGITAL_COMPACT=true`
- Backend e frontend rebuildados após alterar `.env`

## 1) Verificar perfil ativo na API

Executar:

```bash
curl -s http://localhost:3000/health
curl -s http://localhost:3000/api/health
curl -s http://localhost:3000/api/system/info
```

Resultado esperado:

- `profile: "totemdigital-compact"`
- `compactMode: true`

## 2) Verificar superfície de rotas

### Rotas essenciais (devem responder normalmente)

- `/api/auth`
- `/api/dashboard`
- `/api/locals` (utilizada pela UI de totens)
- `/api/totems`
- `/api/players` (ex.: campanhas)
- `/api/media`
- `/api/playlists`
- `/api/campaigns`
- `/api/dispatcher-totem`
- `/api/dispatcher-debug`
- `/api/settings`
- `/api/alerts`
- `/api/logs`
- `/api/playlist-engine` (ex.: `totem-playlists`)

### Rotas Pro (devem ficar indisponíveis no compacto)

- `/api/subscribers`
- `/api/publishers`
- `/api/subscriber-access`
- `/api/billing`
- `/api/smartdisplayfx`

### Rotas Pro / consola que o compacto **não monta** no backend

- `/api/users` (gestão de utilizadores)
- `/api/smart-tvs`
- `/api/qrcodes` e `/api/qr-codes`
- `/api/notifications`

Critério: no compacto, as rotas Pro não devem estar ativas; as da segunda lista também não existem neste perfil (ver [política detalhada](./09-politica-rotas-totemdigital-compacto.md)).

## 3) Verificar frontend compacto

No menu principal, validar presença de:

- Dashboard
- Totens
- Playlists por Totem
- Mídias
- Playlists
- Campanhas
- Monitor Dispatcher
- Configurações

E validar ausência de módulos Pro (billing, smartdisplayfx, planos/acessos, subscriber/publisher portal).

### Command Palette (Ctrl+K)

No compacto, só devem aparecer destinos alinhados ao menu (sem Subscribers/Publishers).

### Mídias, Playlists e Playlists por totem

No separador **Rede** (DevTools), ao navegar nestas páginas, **não** devem aparecer pedidos a `/api/subscribers` nem a `/api/publishers` (o upload de mídia também não deve chamar validações de plano/storage do subscriber). Em **Playlists por totem**, o filtro por publisher não deve aparecer.

## 4) Campanhas (fluxo UI compacto)

Validar que a página **Campanhas** não depende de cliente/subscriber/publishers e não dispara chamadas a rotas Pro removidas.

### Criar campanha

- Abrir **Criar** e confirmar que **não** aparecem campos "Cliente (Subscriber)" nem "Publishers".
- Preencher título, datas opcionais, playlists e/ou mídias e/ou totens (lista alinhada a `/api/players` ou seleção de totem).
- Guardar e verificar que a campanha aparece na grelha **sem** erros 404/500 na rede para `/api/publishers`, `/api/subscriber-access`, etc.

### Editar campanha

- Abrir **Editar** e confirmar **5 abas**: Principal, Totens, Mídias, Playlists, Agendamento (sem Publicadores nem Smart TVs).
- Na aba **Totens**, confirmar que a lista de totens carrega (via `/api/totems`) e que é possível associar/remover totens.
- Na aba **Agendamento**, o texto deve referir TotemDigital/dispatcher (sem validação de publishers).

### Detalhes (ver campanha)

- Abrir **Ver detalhes** e confirmar que **não** existe aba "Publishers"; a aba **Totens** deve mostrar nomes reais quando há `totemIds` (resolução via `/api/totems/:id`).

### Consola do browser

- Durante criar/editar/ver campanhas, não devem aparecer falhas repetidas por chamadas a APIs Pro desligadas no backend compacto.

## 5) Verificar startup enxuto do backend

Nos logs de inicialização, conferir mensagens indicando que no compacto **não** foram inicializados:

- filas Bull
- workers Pro
- rotinas avançadas de mix/engine/alertas

## 6) Sanidade final

- Login com usuário admin funcional
- Dispatcher responde para totem de teste
- Sem erros críticos no console backend/frontend

## 7) Erros **502 Bad Gateway** ou WebSocket **Unexpected response code: 200**

**502 em quase todos os `/api/...`:** o Nginx está a fazer proxy mas o **Node (backend) não responde** na porta esperada (por defeito `3000`) — serviço parado, crash em loop, ou `proxy_pass` para IP/porta errados.

No servidor:

```bash
sudo systemctl status smart-signage --no-pager
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/api/health
sudo journalctl -u smart-signage -n 80 --no-pager
```

Se `health` não for 200, recompilar e reiniciar a partir do diretório do projeto (ajusta o caminho se a instalação for em `/opt/smart-signage`):

```bash
cd ~/TotemDigital/backend && npm run build && sudo systemctl restart smart-signage
```

**WebSocket `/ws` com código 200:** o pedido não está a ser enviado ao Node com **upgrade** HTTP; o bloco `location /ws` em falta ou a ficar **atrás** de um `try_files` que devolve o `index.html` da SPA. O instalador gera `location /ws { proxy_pass http://localhost:3000; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; ... }`. Comparar com `/etc/nginx/sites-enabled/smart-signage` e recarregar: `sudo nginx -t && sudo systemctl reload nginx`. Script de apoio: `scripts/fix-nginx-websocket.sh`.

