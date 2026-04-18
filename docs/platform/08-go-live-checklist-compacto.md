# Go-live checklist — TotemDigital compacto

Checklist de homologação final para liberação da variante monousuária.

## 1) Perfil ativo

- [ ] `GET /health` retorna `profile: "totemdigital-compact"` e `compactMode: true`
- [ ] `GET /api/health` retorna `profile: "totemdigital-compact"` e `compactMode: true`
- [ ] `GET /api/system/info` retorna `profile: "totemdigital-compact"` e `compactMode: true`

## 2) Rotas essenciais (smoke)

- [ ] `/api/auth` responde sem erro 500
- [ ] `/api/dashboard` responde sem erro 500
- [ ] `/api/locals` responde sem erro 500 (totens)
- [ ] `/api/totems` responde sem erro 500
- [ ] `/api/players` responde sem erro 500
- [ ] `/api/media` responde sem erro 500
- [ ] `/api/playlists` responde sem erro 500
- [ ] `/api/campaigns` responde sem erro 500
- [ ] `/api/dispatcher-totem` responde sem erro 500
- [ ] `/api/dispatcher-debug` responde sem erro 500
- [ ] `/api/settings` responde sem erro 500

## 3) Superfície Pro bloqueada no compacto

- [ ] `/api/subscribers` indisponível no fluxo compacto
- [ ] `/api/publishers` indisponível no fluxo compacto
- [ ] `/api/subscriber-access` indisponível no fluxo compacto
- [ ] `/api/billing` indisponível no fluxo compacto
- [ ] `/api/smartdisplayfx` indisponível no fluxo compacto
- [ ] `/api/users`, `/api/smart-tvs`, `/api/qrcodes`, `/api/notifications` **não** montados neste perfil

## 4) Frontend compacto

- [ ] Menu exibe apenas: Dashboard, Totens, Playlists por Totem, Mídias, Playlists, Campanhas, Monitor Dispatcher, Configurações
- [ ] Não há rotas React dedicadas a Locais / Smart TVs / Utilizadores / QR (locais via totens + API)
- [ ] Command Palette (Ctrl+K) só lista o mesmo conjunto de destinos
- [ ] Não há acesso operacional a módulos Pro (billing, planos/acessos, smartdisplayfx, subscriber/publisher portal)

## 5) Fluxo funcional fim-a-fim

- [ ] Login admin (incl. `owner_system` se aplicável)
- [ ] Upload/gestão de mídia
- [ ] Criação/edição de playlist
- [ ] Criação/edição de campanha **no modo compacto**: sem UI de cliente/publishers; edição com 5 abas (Principal, Totens, Mídias, Playlists, Agendamento); detalhes sem aba Publishers
- [ ] Dispatch para totem de teste

## 6) Comportamento de fallback do dispatcher

- [ ] Sem campanha válida: usa `totem_playlists`
- [ ] Sem `totem_playlists` válida: plano vazio
- [ ] Não há fallback de servidor por `propagandas`/`vinhetas` locais

## 7) Startup enxuto do backend

- [ ] Logs confirmam que filas Bull/workers Pro/rotinas avançadas não são inicializados no compacto

## 8) Build e testes

- [ ] `backend`: `npm run build`
- [ ] `frontend`: `npm run build`
- [ ] `frontend`: build com flag compacta (como no CI): `REACT_APP_TOTEMDIGITAL_COMPACT=true npm run build`
- [ ] `backend`: `npm test -- src/__tests__/unit/startup --runInBand`

## 9) Instalação limpa

- [ ] Instalação em ambiente novo com flags compactas sobe no perfil correto sem ajuste manual adicional
- [ ] Para servidor sem copiar players cliente: `install-smartsignage.sh --skip-menu --mode single-server --skip-players` (opcional)

## 10) Rollback controlado

- [ ] Em ambiente de teste, troca de flags para modo Pro sobe sem quebra estrutural

---

## Aprovação

- [ ] Homologação técnica concluída
- [ ] Homologação de negócio concluída
- [ ] Go-live aprovado

