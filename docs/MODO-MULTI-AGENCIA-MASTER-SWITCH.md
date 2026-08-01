# Modo multi-agência — master switch

**Branch:** `TotemDigital-MultiAgencia`  
**Repo:** TotemDigital-Studio  

## Decisão de produto (2026-08) — Direct Totem vs Pro

Concordância validada:

| Opção | Ideia | Estado |
|-------|--------|--------|
| **A** | Dois produtos claros: **Direct Totem** *ou* **Pro multi-agência** | **Agora** — venda e suporte simples |
| **B** | Perfil futuro `multi_agency_lite`: várias orgs + publicar + mídias, **sem** billing/campanhas/playlists | **Só se** clientes pedirem multi-loja sem ERP de mídia |
| **C** | Multi-agência ON + Direct Totem ON no mesmo painel | **Evitar** — menus e expectativas colidem |

Implicações:

- O master switch continua **mutuamente exclusivo** (ON = Pro; OFF = Direct Totem). Não implementar C.
- D3 mantém-se: OFF **não apaga** dados (arquivo silencioso). Purge só como fluxo destrutivo explícito, separado.
- `multi_agency_lite` (B) **não** entra no roadmap activo até haver pedido comercial claro.

## Decisões (validadas)

| ID | Escolha |
|----|---------|
| D1 | Ao desligar multi-agência, Direct Totem **volta automaticamente** |
| D2 | Portal e SmartDisplayFX **fora** do botão (só avançado) |
| D3 | Ao desligar: **não apaga dados**; esconde menu/API |
| D4 | Botão: `owner_system` e `admin_sql` |
| D5 | Painel de módulos em **Opções avançadas** (colapsado) |
| D6 | Produto: A agora · B sob procura · C proibido (ver secção acima) |

## Comportamento

- **OFF (default lógico do preset núcleo):** Direct Totem + simple; comercial off  
- **ON:** preset comercial/ops; Direct Totem off; portal/FX preservados se já estavam on  
- Persiste `installation.modules` + sincroniza `installation.profile`  
- API: `PUT /api/installation/multi-agency` body `{ "enabled": true|false }`  
- UI: `/settings/system-modules`
- Ao activar com **zero** organizações: cria organização owner (bootstrap mínimo)

## Testar

```bash
cd ~/TotemDigital-Studio && git fetch && git checkout TotemDigital-MultiAgencia && git pull
bash scripts/Instala-TotemDigital-Server.sh --modo atualizar --instancia dev --git-pull --sim
```

1. Login owner/admin_sql → Complementos do sistema  
2. Activar multi-agência → confirmar dialog → reload → **reiniciar backend** → menu Pro  
3. Desactivar → Direct Totem de volta; dados não apagados → reiniciar backend  
4. Checklist no painel (organização, Redis, restart)

## Hardening entregue

- Checklist de activação no painel (organização, totems, Redis, portal, workers)
- 403 `MODULE_DISABLED` com mensagem a apontar para o Modo multi-agência
- Gates: `/api/clients`, `/api/advanced-schedules`, `/api/playlist-engine`
- Workers condicionados aos módulos no boot — `docs/ETAPA-E-MULTI-AGENCIA-WORKERS.md`
- Hot-reload de workers ao mudar o modo — `docs/ETAPA-F-MULTI-AGENCIA-HOT-RELOAD-WORKERS.md`

## Fora de escopo (produto)

- Apagar dados ao desligar multi-agência  

## Operacional restante (VPS)

Guia passo a passo: **`docs/VPS-DEV-DO-ZERO-MULTI-AGENCIA.md`**

1. `git pull` + update com seeds `portal.*`
2. Complementos → Portal: domínio, Cloudflare zone/IP, SSL email
3. Env: `CLOUDFLARE_API_TOKEN=…`
4. Sync Nginx: `sudo PORTAL_NGINX_SITE=/etc/nginx/sites-available/… bash scripts/sync-portal-hosts.sh`
5. Cert wildcard: `sudo bash scripts/issue-portal-wildcard-cert.sh --base-domain … --email …`  

Purge explícito (desenho): `docs/DESENHO-PURGE-DADOS-COMERCIAIS.md`
