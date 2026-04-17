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
- `/api/totems`
- `/api/media`
- `/api/playlists`
- `/api/campaigns`
- `/api/dispatcher-totem`

### Rotas Pro (devem ficar indisponíveis no compacto)

- `/api/subscribers`
- `/api/publishers`
- `/api/subscriber-access`
- `/api/billing`
- `/api/smartdisplayfx`

Critério: no compacto, essas rotas não devem estar ativas como fluxo operacional.

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

## 4) Verificar startup enxuto do backend

Nos logs de inicialização, conferir mensagens indicando que no compacto **não** foram inicializados:

- filas Bull
- workers Pro
- rotinas avançadas de mix/engine/alertas

## 5) Sanidade final

- Login com usuário admin funcional
- Dispatcher responde para totem de teste
- Sem erros críticos no console backend/frontend

