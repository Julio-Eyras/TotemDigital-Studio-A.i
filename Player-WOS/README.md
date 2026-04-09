# Player-WOS

Versao webOS inspirada no comportamento do `Player-AD` (Android):

- heartbeat + dispatch com token;
- playback em loop de video/imagem;
- fallback por plano persistido (`localStorage`);
- fallback local `propagandas:vinheta` configuravel;
- eventos de playback (`/api/player/event`).

## Estrutura

- `appinfo.json`: manifesto webOS.
- `index.html` + `styles.css`: shell do player.
- `js/`: modulos principais.
- `config/player-config.example.json`: modelo de configuracao.

## Fluxo principal

1. `ConfigLoader.load()`
2. `DispatcherApi.heartbeat()`
3. `DispatcherApi.getDispatchPlan()`
4. `PlayerControllerWOS.start()` e loop de playback
5. telemetria por `PlayerEventsClient`

## Configuracao

Copiar `config/player-config.example.json` para `config/player-config.json` e ajustar:

- `serverUrl`
- `uin`
- `deviceId`
- `fallbackPropagandasPerVinheta`
- `fallbackPropagandas` / `fallbackVinhetas`

## Observacao

Esta primeira base do `Player-WOS` ja espelha os blocos centrais do Player-AD.
Se quiser, no proximo passo eu faco o hardening para deploy LG (packaging ipk, scripts deploy e compatibilidade de paths USB por modelo webOS).
