# Modo multi-agência — master switch

**Branch:** `TotemDigital-MultiAgencia`  
**Repo:** TotemDigital-Studio  

## Decisões (validadas)

| ID | Escolha |
|----|---------|
| D1 | Ao desligar multi-agência, Direct Totem **volta automaticamente** |
| D2 | Portal e SmartDisplayFX **fora** do botão (só avançado) |
| D3 | Ao desligar: **não apaga dados**; esconde menu/API |
| D4 | Botão: `owner_system` e `admin_sql` |
| D5 | Painel de módulos em **Opções avançadas** (colapsado) |

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

- Checklist de activação no painel (organização, totems, Redis, portal, restart)
- 403 `MODULE_DISABLED` com mensagem a apontar para o Modo multi-agência
- Gates: `/api/clients`, `/api/advanced-schedules`, `/api/playlist-engine`
- Workers condicionados aos módulos no boot — ver `docs/ETAPA-E-MULTI-AGENCIA-WORKERS.md`

## Fora de escopo

- DNS/portal one-click  
- Seed automático de 2ª agência / anunciante demo  
- Hot-reload de workers sem restart do processo  
- Apagar dados ao desligar  
