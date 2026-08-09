# Histórico técnico — 08/08/2026

**Projeto:** TotemDigital Studio / SmartSignage Pro  
**Branch de referência:** `TotemDigital-MultiAgencia`  
**Data consolidada:** 08/08/2026  
**Escopo:** Player-AD, backend, frontend, Dispatcher, instalação Direct Totem e decisões de evolução do protocolo.

> Este documento registra decisões, diagnósticos, entregas, testes e pendências da jornada técnica. Não contém senhas, tokens ou outros segredos.

## 1. Resumo executivo

O trabalho concentrou-se em estabilizar a reprodução do Player-AD, padronizar a identidade dos dispositivos, tornar a instalação Direct Totem reproduzível e preparar a comunicação para uma rede maior de totens.

Os principais resultados foram:

- eliminação do flicker preto no loop de uma única mídia;
- retirada de heartbeat, dispatch e telemetria HTTP do caminho crítico entre mídias;
- Player-AD evoluído de `2.01/101` para `2.06/106`;
- Device ID normalizado com `trim + uppercase` em clientes, API, persistência e comparações;
- documentação operacional de instalação Direct Totem;
- identificação e apresentação do modo ativo no frontend;
- diagnóstico do tráfego do Monitor Dispatcher;
- telemetria v2 em lote, idempotente e com estado atual por totem;
- frontend em tempo real via WebSocket, com mídia atual, progresso, próxima mídia e estados stale/offline;
- rota unificada `POST /api/player/sync`, com fallback por capacidade para batch v2 e evento legado;
- fila persistente de telemetria protegida contra acesso concorrente;
- decisão de manter HTTP como transporte confiável e condicionar WebSocket/MQTT para dispositivos a gates de escala e operação;
- causa do crash periódico confirmada na fila de telemetria, corrigida em `2.05/105` e reforçada entre múltiplas instâncias em `2.06/106`;
- commit integrado `b64259d9`, publicado na branch e instalado por ADB na TV Box.

O commit `bbfbac3a` estabeleceu a telemetria v2. O commit posterior `b64259d9` concluiu o sync unificado, a próxima mídia, as melhorias do card e o hotfix de concorrência. Particionamento/rollup, retenção automatizada e um canal persistente Player ↔ Backend continuam condicionados aos gates de escala e operação.

## 2. Contexto e objetivos

Os objetivos operacionais foram:

1. manter reprodução contínua, inclusive com rede lenta ou indisponível;
2. impedir reinícios desnecessários e perda de posição da playlist;
3. corrigir rotação e montagem em TV Box Allwinner/retrato;
4. tornar erros de mídia ausente explícitos, sem corromper cache;
5. uniformizar UIN e Device ID;
6. garantir instalação e atualização segura em produção Direct Totem;
7. explicar e reduzir o ruído do Dispatcher;
8. preparar telemetria e monitoramento para centenas ou milhares de totens;
9. preservar compatibilidade com players e rotas antigas durante a evolução.

## 3. Linha do tempo técnica

### 3.1 Base de estabilidade: rotação, restart e mídia ausente

O Player-AD tinha três classes de falha relacionadas:

- montagem/orientação em hardware Allwinner podia ser perdida ao sair do menu de configuração por cinco toques;
- `apply_player_config` provocava cold restart mesmo quando só campos aplicáveis em runtime haviam mudado;
- um novo dispatch podia reposicionar a playlist no índice zero;
- mídia ausente no servidor podia resultar em resposta inadequada ao player e tela preta.

Decisões e correções:

- reaplicar a montagem ao voltar do menu;
- usar soft-apply para configurações que não exigem reinício;
- reservar restart apenas para chaves realmente estruturais;
- comparar assinatura do plano e preservar o índice quando o conteúdo não mudou;
- em binários de player, responder `404` real para mídia ausente, sem entregar placeholder SVG com extensão de vídeo;
- reforçar timeout, skip e backoff para download com falha;
- alinhar storage por instância para impedir DEV de usar `/opt/smart-signage`.

Commits associados:

- `c2b50a54` — evita reset em `apply_player_config` e em `needsDispatch`;
- `24c848c4` — APK 1.95 com soft-apply e preservação de índice;
- `64c497a9` — reaplica montagem ao sair do menu de cinco toques;
- `4ebd1780` — montagem Allwinner estável, skip de 404 e storage multi-instância.

### 3.2 Mídia 404 e isolamento de storage

O diagnóstico mostrou que o Dispatcher entregava a URL correta, mas o arquivo não estava no storage da instância DEV. Os arquivos estavam em produção e o path de DEV apontava ou recaía em `/opt/smart-signage`.

Impactos:

- `GET` da mídia retornava 404;
- cache local não recebia um binário reproduzível;
- player podia ficar em tela vazia/preta;
- DEV e produção deixavam de estar realmente isolados.

A correção persistente passou a alinhar:

- `UPLOAD_PATH`;
- `ASSETS_BASE_PATH`;
- `media.storage.path`;
- diretório de uploads sob o `TDI_OPT_ROOT` de cada instância.

Valores esperados:

```text
Produção: /opt/smart-signage/public/assets/uploads
DEV:      /opt/totemdigital-dev/public/assets/uploads
TESTE:    /opt/totemdigital-test/public/assets/uploads
```

### 3.3 Flicker preto em playlist com uma mídia

O flicker não era o véu de transição: `mediaTransitionEnabled=0` já estava efetivo.

Causa:

1. o único vídeo chegava a `STATE_ENDED`;
2. o ExoPlayer apresentava o shutter preto;
3. heartbeat/dispatch eram processados;
4. somente depois ocorria novo `seek(0)`.

Correção:

- fazer `seek(0)` imediatamente no `ENDED`;
- reiniciar a reprodução antes de qualquer operação de rede;
- no ciclo seguinte, não executar outro seek se o vídeo já estiver tocando.

Resultado observado nos logs:

```text
Loop seamless: seek(0) no ENDED (evita flick preto entre ciclos)
Vídeo contínuo … — já em reprodução pós-ENDED (sem seek)
```

Entrega:

- Player-AD `2.01`, build `101`;
- commit `b76425ae`.

### 3.4 Travamento entre trocas de mídia

Na versão `2.01/101`, o player aparentava recriar cache entre mídias. A investigação demonstrou que o cache não era a causa principal.

Fluxo problemático:

- após a mídia, `runDueServerPolls()` executava no caminho crítico;
- heartbeat podia disparar novo dispatch;
- `video_playback_end` era enviado de forma síncrona;
- o cliente HTTP podia esperar vários segundos e repetir após renovação de token.

Evidência temporal:

```text
00:05:16.535 Fim vídeo
00:05:18.463 Fonte do plano alterada: ONLINE
00:05:18.797 Início vídeo
```

Havia aproximadamente 2,2 segundos de espera de rede entre duas mídias. Em outra captura, um vídeo de cerca de 11 segundos permaneceu quase 30 segundos antes da troca.

Correção aplicada:

- fila assíncrona de telemetria com ordem preservada;
- heartbeat e dispatch executados fora do caminho crítico;
- resultado do polling aplicado somente quando pronto;
- falhas de rede deixam de bloquear a superfície de reprodução;
- configuração existente preservada na instalação ADB com `-NoConfigPush`.

Validação na TV Box:

- transições medidas entre aproximadamente 19 ms e 76 ms;
- playlist continuou mesmo durante falha DNS no heartbeat.

Entrega:

- Player-AD `2.02`, build `102`;
- commit `f3ba91c0`.

### 3.5 Normalização de Device ID

Antes da alteração:

- UIN já era normalizado para maiúsculas e não era sensível a caixa;
- Device ID podia ser comparado de forma exata e, portanto, era case-sensitive;
- registros legados podiam conter misturas de caixa e espaços externos.

Formato canônico definido:

```text
trim + uppercase
```

Abrangência:

- Player-AD: leitura, armazenamento, UI, comandos remotos e cliente Dispatcher;
- backend: middleware de entrada, token de dispositivo, serviços de totem e Smart TV;
- frontend: payloads de criação e atualização;
- players legados relevantes;
- schema definitivo e validação;
- exemplos e configurações.

Compatibilidade:

- comparações de registros legados usam forma canônica;
- a alteração evita invalidar imediatamente cadastros antigos em minúsculas;
- colisões como `abc` e `ABC` devem ser verificadas antes de uma normalização em massa.

Entrega:

- Player-AD `2.03`, build `103`;
- commit `10b3f302`.

## 4. Versões consolidadas

### 4.1 Antes da telemetria v2

Na tela, o estado esperado em parte da jornada era:

```text
Back:  2.1.7
Front: 2.1.11
```

### 4.2 Após telemetria v2

Versões entregues no commit `bbfbac3a`:

```text
Player-AD: 2.04 (build 104)
Backend:   2.1.9
Frontend:  2.1.13
```

### 4.3 Após sync unificado e próxima mídia

Versões entregues no commit `b64259d9`:

```text
Player-AD: 2.05 (build 105)
Backend:   2.1.9
Frontend:  2.1.14
```

### 4.4 Hotfix do contrato sync

Versões locais após corrigir `knownPlanVersion: null`:

```text
Player-AD: 2.06 (build 106)
Backend:   2.1.10
Frontend:  2.1.14 (sem alteração)
```

Observação: a versão exibida pelo frontend pode ser substituída por `REACT_APP_VERSION` no build. Portanto, o número visual isolado não prova que os assets estáticos correspondem ao commit esperado.

## 5. Produção Direct Totem

### 5.1 Perfil esperado

```text
Branch:    TotemDigital-MultiAgencia
Clone:     ~/TotemDigital-Studio
Deploy:    /opt/smart-signage
BD:        smartsignage
Serviço:   smart-signage
Domínio:   totemdigital.app.br
Auxiliar:  porta 8080
```

O perfil Direct Totem ativa o frontend compacto, mantém Dispatcher disponível e deixa MQTT desligado por padrão.

### 5.2 Atualização segura

```bash
cd ~/TotemDigital-Studio

bash scripts/backup-totemdigital-prod.sh \
  --instancia producao \
  --sim

git fetch origin
git checkout TotemDigital-MultiAgencia
git pull --ff-only origin TotemDigital-MultiAgencia

export TDI_GIT_BRANCH=TotemDigital-MultiAgencia

bash scripts/Instala-TotemDigital-Server.sh \
  --modo atualizar \
  --instancia producao \
  --git-pull \
  --sim \
  --dominio totemdigital.app.br
```

Os parâmetros de e-mail e usuário proprietário devem ser fornecidos localmente conforme o ambiente, sem registrá-los em histórico público.

### 5.3 Instalação limpa via motor

`--fresh` ou modo de instalação nova pode apagar/recriar o banco. Só deve ser usado após backup e confirmação de que não se trata de uma atualização.

O fluxo limpo usa `scripts/install-smartsignage.sh` com:

- `--fresh`;
- `--mode single-server-prod`;
- preset TotemDigital;
- perfil compacto;
- `--direct-totem`;
- site/painel separados;
- players e MQTT somente quando necessários.

Não reproduzir credenciais ou senhas na linha de comando/documentação.

### 5.4 Armadilhas Git encontradas no VPS

#### Branch local inexistente

Sintoma:

```text
pathspec 'TotemDigital-MultiAgencia' did not match any file(s) known to git
```

O clone usava refspec restrito. Foi necessário buscar explicitamente a referência remota e criar a branch local.

#### Tracking não reconhecido

Sintoma:

```text
fatal: cannot set up tracking information;
starting point 'origin/TotemDigital-MultiAgencia' is not a branch
```

Solução adotada: criar a branch local a partir de `refs/remotes/origin/...` sem `--track` e usar pull explícito:

```bash
git pull --ff-only origin TotemDigital-MultiAgencia
```

#### Alterações locais bloqueando pull

Arquivos como `frontend/package.json` e lockfiles haviam sido alterados localmente.

Para preservar:

```bash
git stash push -u -m "backup local antes da atualização"
```

Para descartar apenas arquivos conhecidos:

```bash
git restore \
  database/smartchannel-db-v2-refactored-part18-playback-telemetry.sql \
  frontend/package-lock.json \
  frontend/package.json

git pull --ff-only origin TotemDigital-MultiAgencia
```

Não executar `git stash pop` automaticamente após atualizar, pois isso pode restaurar versões antigas de arquivos de versão/lock.

No rollout do commit `b64259d9`, esse procedimento liberou o fast-forward de `bbfbac3a` para `b64259d9`. O checkout terminou no commit esperado, permanecendo apenas `manage.sh` e o relatório `validacao-sistema-*.txt` como arquivos locais não rastreados. Esses artefatos não impediram o pull e não devem ser adicionados ao Git automaticamente.

#### Arquivos gerados pelo instalador

PDFs, compat SQL, `manage.sh` e relatórios de validação podem deixar o clone sujo. Antes de remover:

1. conferir se são gerados;
2. preservar qualquer customização operacional;
3. usar `git restore` apenas nos rastreados;
4. usar `git clean -f -- <arquivos explícitos>` apenas após revisão.

## 6. Menu Complementos e modos operacionais

Em produção, “Complementos do sistema” não aparecia no modo Direct Totem, embora o usuário fosse `owner_system`.

Diagnóstico:

- o código atual permitia o item para `owner_system` e `admin_sql`;
- produção provavelmente servia assets anteriores ao commit que corrigiu o menu;
- frontend DEV e PROD mostravam a mesma versão `2.1.11`, apesar de builds diferentes.

Correção operacional:

- atualizar/recompilar frontend;
- reiniciar serviço;
- invalidar cache do navegador.

Melhoria implementada:

- `Direct Totem (On/Off)`;
- `Multi-agência Lite (On/Off)`;
- `Multi-agência Pro (On/Off)`;
- lateral do painel mostra o modo ativo.

Commit:

- `b369d769` — exibe modo ativo da instalação.

O Dispatcher permanece disponível nos três modos; o seu módulo não deve, sozinho, transformar Lite em Pro.

## 7. Diagnóstico do tráfego Dispatcher

### 7.1 Incoming e outgoing

O monitor mostrava duas linhas para uma única transação:

- `incoming`: requisição recebida;
- `outgoing`: resposta enviada.

Isso duplicava visualmente o volume, mas não significava dois envios pelo player.

### 7.2 Eventos de reprodução

O tráfego frequente era principalmente:

```text
POST /api/player/event
```

Tipos observados:

- `image_display`;
- `video_playback_start`;
- `video_playback_end`;
- `html_display` no player, inicialmente não aceito pelo backend.

Objetivos:

- proof-of-play;
- histórico operacional;
- relatórios/analytics;
- diagnóstico.

Uma imagem em loop de cinco segundos pode gerar:

- 12 requisições por minuto;
- 17.280 eventos por dia por dispositivo;
- 34.560 linhas no monitor se request e response forem exibidos separadamente.

### 7.3 Heartbeat

Rota:

```text
POST /api/player/heartbeat
```

Funções:

- presença e último contato;
- saúde, memória, storage e cache;
- mídia atual resumida;
- comandos remotos;
- configuração de horário;
- OTA;
- versão do plano e necessidade de novo dispatch.

O intervalo inicial é próximo de 30 segundos e pode crescer adaptativamente até cerca de 10 minutos em sonolência.

### 7.4 Dispatch

O heartbeat não carrega a playlist completa. Ele informa versão e necessidade:

```json
{
  "planVersion": "...",
  "needsDispatch": true
}
```

Quando necessário:

```text
GET /api/player/dispatch
```

O plano completo contém playlist, mídias, duração, campanha, ordem e versão.

Decisão mantida:

- heartbeat leve;
- dispatch sob demanda;
- consulta de segurança adaptativa;
- plano completo fora de pulsos sem mudança.

## 8. Decisões sobre heartbeat, eventos e dispatch

Princípios acordados:

1. heartbeat não deve bloquear reprodução;
2. eventos de playback não devem depender do heartbeat;
3. dispatch completo só deve ser transferido quando muda;
4. posição do vídeo não deve ser enviada a cada segundo;
5. o navegador calcula progresso localmente com `startedAt`, `durationMs` e `expectedEndAt`;
6. telemetria normal mantém start/end/error/skip;
7. diagnóstico detalhado usa lease temporário;
8. fila persistente, idempotência e ACK são mais importantes do que apenas reduzir o número de rotas.

Hover não deve ligar/desligar telemetria no player:

- comando via heartbeat pode chegar tarde;
- o cursor pode sair antes da ativação;
- fechar o navegador pode impedir desativação;
- múltiplos operadores podem observar o mesmo totem.

O hover deve somente assinar/desassinar o frontend do WebSocket. Diagnóstico detalhado deve ser uma ação explícita, com expiração automática.

## 9. Telemetria v2 — commit `bbfbac3a`

Commit:

```text
bbfbac3a feat(telemetry): escala playback e monitoramento em tempo real
```

### 9.1 Player-AD `2.04/104`

- eventos unificados `media.play.started`, `media.play.ended` e `media.play.error`;
- lote de até 50 eventos;
- `eventId`, `bootId`, sequência e `playbackSessionId`;
- fila persistente;
- retry com backoff/jitter;
- ACK e idempotência;
- fallback para endpoint legado;
- telemetria fora do caminho crítico;
- suporte a observação temporária.

### 9.2 Backend `2.1.9`

- `POST /api/player/events/batch`;
- compatibilidade com `POST /api/player/event`;
- aceitação/correção do HTML;
- estado quente em `totem_playback_state`;
- leases de observação;
- WebSocket segmentado por totem;
- schema definitivo em `part18`;
- correlação do monitor por `traceId`.

Estruturas principais:

- `playback_events`;
- `totem_playback_state`;
- `telemetry_observation_leases`.

### 9.3 Frontend `2.1.13`

- card de reprodução ao vivo;
- progresso calculado localmente;
- assinatura WebSocket por totem;
- botão de diagnóstico/observação temporária;
- Monitor Dispatcher agrupável e filtrável;
- endpoint, evento, mídia, UIN, status e duração HTTP.

### 9.4 Limite operacional observado

Após a entrega, o card ainda podia mostrar:

```text
Sem estado de reprodução recente
Lease ativo — aguardando heartbeat
```

Interpretação:

- estado normal deveria vir de eventos v2, sem lease;
- lease dependia do heartbeat apenas para diagnóstico detalhado;
- ausência de estado sugeria backend/schema v2 não aplicado, endpoint batch em fallback ou erro de ingestão.

### 9.5 Evolução integrada — commit `b64259d9`

- `POST /api/player/sync` combina, conforme o payload, heartbeat, eventos e resultados de comandos;
- processamento evita executar trabalho pesado de heartbeat quando o envelope contém somente eventos;
- Player-AD usa fallback por capacidade com cooldown e reprobe;
- `media.play.started` inclui `context.nextMedia` de forma cíclica;
- frontend normaliza contratos novo e legado;
- card exibe mídia atual, ID, duração, progresso, horários e próxima mídia;
- estados stale/offline ficam explícitos;
- diagnóstico por lease permanece separado do fluxo normal de playback.

### 9.6 Hotfix de compatibilidade e resiliência

O primeiro teste em produção do botão “Testar conectividade” retornou HTTP 400, embora `/api/health` estivesse saudável.

Causa:

- Player-AD enviava `knownPlanVersion: null` quando ainda não conhecia o plano;
- backend aceitava somente string ou campo ausente;
- o fallback do sync não se aplicava a HTTP 400.

Correção:

- Player-AD omite `knownPlanVersion` quando vazio;
- backend `2.1.10` aceita `null` de APKs anteriores e o remove do envelope normalizado;
- teste unitário cobre explicitamente esse contrato.

O contrato de dispatch também passou a declarar semanticamente:

```json
{
  "planState": "ACTIVE|EMPTY",
  "planVersion": "...",
  "plan": {
    "mediaItems": []
  }
}
```

- `ACTIVE` exige ao menos uma mídia;
- `EMPTY` exige lista vazia e representa decisão autoritativa do servidor;
- falha HTTP/rede representa estado indisponível e não é convertida em `EMPTY`;
- resposta 2xx sem `planState` continua compatível somente se possuir uma lista de mídias legada válida;
- resposta malformada, sem estado e sem lista, é rejeitada antes de substituir o último plano persistido.

Durante a validação ADB, também foram corrigidos:

- lock da fila elevado para compartilhamento entre todas as instâncias do cliente no processo;
- arquivo temporário da fila passou a ter nome único;
- plano vazio online passa ao estado explícito `EMPTY_PLAN`;
- em `EMPTY_PLAN`, não há releitura recorrente do plano persistido nem busca de fallback local;
- dispatch de segurança fica suspenso e somente `needsDispatch` recebido no heartbeat autoriza nova busca;
- o estado termina apenas quando o novo dispatch indicado pelo heartbeat contém mídia;
- HTTP 429 agora respeita `retryAfterSeconds`, limitado a 15 minutos.

O log confirmou heartbeat via sync como `OK`. Após o excesso de tentativas anterior, o servidor respondeu temporariamente 429/900 segundos; o Player-AD `2.06/106` fez somente uma tentativa e programou o próximo ciclo para 900000 ms, sem novo crash.

A versão final com validação semântica de `planState` foi compilada e testada. A reinstalação desse último APK ficou pendente porque a TV Box deixou de aparecer em `adb devices`; uma compilação anterior de `2.06/106` permanece instalada.

## 10. WebSocket, MQTT e decisão arquitetural

### 10.1 Estado atual

WebSocket já existia no backend em `/ws` para:

- painel;
- Monitor Dispatcher;
- logs/notificações em tempo real.

O Player-AD continuava usando HTTP/Retrofit para heartbeat, dispatch e eventos.

MQTT estava previsto no instalador:

- Mosquitto;
- MQTT TCP e sobre WebSocket;
- ACL e credenciais;
- integração principal com SmartDisplayFX.

Porém, o Player-AD ainda não possuía cliente MQTT, protocolo de tópicos, QoS, ACK, sessão offline e reconexão completa.

### 10.2 Decisão

Arquitetura de curto prazo:

```text
Player-AD → Backend: HTTP em lote, persistente e idempotente
Backend → Frontend: WebSocket segmentado
Backend → Player-AD: heartbeat para comandos não urgentes
```

Não ativar Mosquitto apenas porque o instalador suporta o broker. Broker ativo sem cliente/protocolo do Player-AD acrescenta superfície de ataque e operação sem benefício.

### 10.3 Gates para canal persistente

Somente avançar quando:

- telemetria v2 estiver estável em produção;
- autenticação por dispositivo estiver consolidada;
- ACL por organização/totem estiver testada;
- ACK, idempotência e reentrega estiverem definidos;
- reconexão e sessão offline forem comprovadas;
- múltiplas instâncias do backend tiverem distribuição de mensagens;
- fallback HTTP permanecer funcional;
- métricas de volume/latência justificarem o canal.

Direção:

- WebSocket para centenas de totens e baixa latência;
- MQTT QoS 1 para milhares de totens, múltiplas regiões e reentrega;
- mesmo contrato lógico entre HTTP, WebSocket e MQTT.

## 11. Crash periódico do Player-AD

Após instalar `2.04/104`, houve relato de crash periódico. A investigação posterior encontrou:

```text
java.util.ConcurrentModificationException
br.com.smartchannel.playerad.api.PlayerEventsClient.rewriteQueue()
```

Causa:

- `persistInbox()` adicionava eventos à lista `pending` e reescrevia o JSONL;
- `flushLoop()` e `flushLegacy()` removiam eventos e reescreviam o mesmo arquivo;
- essas corrotinas operavam simultaneamente sobre a mesma `MutableList`;
- `rewriteQueue()` podia iterar enquanto outra coroutine alterava a coleção.

Hotfix incorporado ao Player-AD `2.05/105`:

- `queueLock` serializa leitura, mutação e snapshot da fila;
- operações de rede continuam fora do lock;
- fallback legado acumula os itens processados e os remove atomicamente ao final;
- gravação do arquivo temporário e troca do JSONL ocorrem dentro da mesma seção crítica.

Validação:

- `testDebugUnitTest`: aprovado;
- `assembleRelease`: aprovado;
- APK instalado com sucesso por ADB na TV Box;
- aplicativo iniciado;
- nenhum `AndroidRuntime`/`PlayerAd:E` observado na verificação inicial de 45 segundos.

Se o crash reaparecer, coletar:

```powershell
adb devices -l
adb logcat -b crash -d -v threadtime
adb logcat -d -v threadtime
adb shell dumpsys dropbox --print
adb shell dumpsys activity exit-info br.com.smartchannel.playerad
```

## 12. Plano de ação e execução

### Fase 0 — validar produção

- confirmar backend `2.1.10`, frontend `2.1.14` e Player-AD `2.06/106`;
- confirmar `POST /api/player/events/batch` com status 200;
- confirmar tabelas v2;
- verificar atualização de `totem_playback_state`;
- confirmar WebSocket do card;
- capturar o crash se reaparecer.

Gate: não iniciar nova mudança de protocolo enquanto o estado v2 não estiver comprovado ponta a ponta.

### Fase 1 — card orientado a eventos (implementada)

Exibição desejada:

```text
ID 10 · Institucional
▶ 00:12 / 00:30 · iniciado 18:40:10
Próxima: ID 11 · Campanha Agosto · 00:15
```

Alterações entregues em `b64259d9`:

- incluir `mediaId`, nome e duração em todo start;
- incluir `context.nextMedia` sem nova requisição;
- atualizar estado quente imediatamente;
- transmitir via WebSocket;
- separar reprodução normal de diagnóstico por lease;
- marcar estado stale/offline.

### Fase 2 — otimização de eventos

- manter start/end/error/skip;
- lote de 2–5 segundos, máximo 50;
- flush antecipado para erro/evento crítico;
- gzip quando vantajoso;
- ACK parcial;
- idempotência e retry;
- nenhuma posição por segundo.

Essa base foi criada em `bbfbac3a` e integrada ao sync/fallback em `b64259d9`. O próximo passo é medir volume, duplicidade e latência em produção.

### Fase 3 — rota unificada (implementada)

Endpoint entregue:

```text
POST /api/player/sync
```

Envelope:

```json
{
  "schemaVersion": 1,
  "syncId": "...",
  "heartbeat": {},
  "events": [],
  "commandResults": [],
  "knownPlanVersion": "..."
}
```

Resposta:

```json
{
  "serverTime": "...",
  "eventAck": {},
  "heartbeat": {
    "commands": [],
    "telemetryObservation": {},
    "planVersion": "...",
    "needsDispatch": false
  }
}
```

Regras:

- autenticar uma vez por sync;
- não executar heartbeat pesado quando houver somente eventos;
- preservar `/heartbeat`, `/events/batch` e `/event` como fallback;
- manter dispatch completo separado, salvo quando realmente mudou;
- usar cooldown/reprobe de capacidade no player.

O Player-AD tenta `/api/player/sync` primeiro. Em caso de capacidade indisponível, recua para `/api/player/events/batch` e depois para `/api/player/event`, mantendo cooldowns independentes e revalidação posterior. O ACK aceita o envelope unificado e o formato batch anterior.

### Fase 4 — cadências

- presença: 30–60 segundos;
- saúde detalhada: 5–15 minutos;
- dispatch de segurança: adaptativo, até cerca de 30 minutos;
- eventos: orientados a transições e enviados em lote;
- diagnóstico: lease de 60–120 segundos.

### Fase 5 — escala e retenção

- uma linha quente por totem;
- histórico particionado por data;
- rollups horários/diários;
- retenção de eventos detalhados por 30–90 dias;
- debug bruto por 24–72 horas;
- heartbeat não deve gerar uma linha histórica por pulso;
- eliminar N+1 na listagem de cards;
- executar consolidação/limpeza por job explícito, inicialmente não destrutivo por padrão.

### Fase 6 — canal persistente

Só após os gates:

1. estabilizar contrato `/sync`;
2. transportar o mesmo envelope por WebSocket;
3. avaliar MQTT QoS 1 conforme volume/regiões;
4. manter HTTP `/sync` como fallback.

## 13. Commits relevantes

```text
c2b50a54  fix(player-ad): evita reset em apply_player_config e needsDispatch
24c848c4  chore(player-ad): APK release 1.95 com soft-apply e preservacao de indice
64c497a9  fix(player-ad): reaplica montagem ao sair do menu 5 toques
4ebd1780  fix(player-ad,storage): montagem Allwinner estavel e path multi-instancia
b76425ae  fix(player-ad): elimina flick preto no loop de uma unica midia
57a5ff2e  docs(install): consolida procedimentos de implantacao
f3ba91c0  fix(player-ad): elimina bloqueios de rede entre midias
10b3f302  feat(device-id): normaliza identificadores em todo o sistema
b369d769  feat(ui): exibe modo ativo da instalacao
a259ec44  chore(player-ad): atualiza APK release 2.03
bbfbac3a  feat(telemetry): escala playback e monitoramento em tempo real
b64259d9  feat(telemetry): unifica sincronizacao e estado de reproducao
```

## 14. Testes e validações executados

### Player-AD

- `assembleRelease`;
- `testDebugUnitTest`;
- instalação ADB preservando configuração;
- confirmação por `dumpsys package`;
- validação de PID;
- logs de replay seamless;
- medição de transições;
- reprodução durante falha DNS;
- testes do cliente de eventos/ACK da telemetria;
- testes do ACK unificado e da próxima mídia cíclica;
- build `2.05/105` da integração e hotfix final `2.06/106`;
- reinstalação ADB bem-sucedida na TV Box.

### Backend

- teste unitário de `playbackTelemetryService`;
- validação dos tipos de eventos e amostras de observação;
- testes do serviço de sync;
- cinco testes do contrato integrado de telemetria aprovados;
- sete testes do serviço/contrato sync aprovados após o hotfix de `null`;
- build TypeScript;
- testes de normalização de Device ID/UIN.

### Frontend

- testes dos utilitários de playback;
- seis testes de estado quente, progresso, IDs e próxima mídia aprovados;
- testes de agrupamento/filtros do Dispatcher;
- testes do modo ativo da instalação;
- build de produção.

### Banco e instalador

- `node --check database/validate-v6.js`;
- `bash -n database/apply-schema-v2.sh`;
- `bash -n scripts/install-smartsignage.sh`;
- `git diff --check`;
- lint dos arquivos alterados.

Limitação registrada:

- schema v2 não foi aplicado localmente durante a entrega por ausência de `psql` e Docker no ambiente Windows;
- a validação real do schema ficou obrigatória no servidor de teste/produção.

## 15. Riscos e mitigação

### Riscos

- schema novo não aplicado e player recuando silenciosamente ao legado;
- frontend novo com backend antigo;
- assets estáticos em cache, apesar de mesma versão visual;
- fila de eventos crescer durante longos períodos offline;
- duplicidade caso ACK/idempotência falhem;
- retenção indefinida de milhões de eventos;
- canal persistente sem ACL ou reentrega;
- pull bloqueado por arquivos gerados no VPS;
- `--fresh`/wipe usado no ambiente errado;
- restauração de stash antigo sobre package/lock atual;
- crash sem stack trace.

### Mitigações

- rollout canário;
- métricas por endpoint e fallback;
- limites rígidos de fila/lote;
- idempotência por evento;
- backup antes de deploy;
- schema aplicado antes de ativar o novo card;
- manutenção temporária das rotas antigas;
- retenção e rollup antes de escala massiva;
- HTTP fallback permanente;
- captura ADB/DropBox no próximo crash.

## 16. Rollback

### Servidor

```bash
cd ~/TotemDigital-Studio

bash scripts/restore-totemdigital-prod.sh \
  ~/backups/producao-AAAAMMDD_HHMMSS \
  --instancia producao \
  --sim
```

Restaurar `.env`, Nginx ou certificados somente se esses componentes também tiverem sido alterados.

### Código

- voltar a um commit conhecido em clone de recuperação;
- executar instalador em modo atualizar;
- não usar reset destrutivo no clone de produção;
- manter backup de BD/uploads compatível com o commit.

### Player-AD

- conservar APK anterior validado;
- instalar via `adb install -r -d -g`;
- usar `-NoConfigPush` para não substituir UIN, Device ID, URL e rotação;
- confirmar versão e PID após rollback.

## 17. Checklist de produção

### Antes

- [ ] backup de BD, uploads e configurações concluído;
- [ ] branch `TotemDigital-MultiAgencia` confirmada;
- [ ] commit esperado confirmado;
- [ ] diretório Git revisado;
- [ ] versões alvo documentadas;
- [ ] DNS, HTTPS e portas verificados;
- [ ] TV Box disponível para teste;
- [ ] APK anterior guardado.

### Deploy

- [ ] aplicar schema definitivo sem erros;
- [ ] executar `validate-v6.js`;
- [ ] build backend e frontend;
- [ ] reiniciar `smart-signage`;
- [ ] testar Nginx;
- [ ] validar `/api/health`;
- [ ] confirmar `/api/player/events/batch`;
- [ ] instalar Player-AD com `-NoConfigPush`;
- [ ] confirmar versão instalada.

### Funcional

- [ ] heartbeat atualiza presença;
- [ ] dispatch só baixa plano quando necessário;
- [ ] mídia atual aparece no card sem lease;
- [ ] start/end/error chegam em lote;
- [ ] `totem_playback_state` muda;
- [ ] WebSocket atualiza somente assinantes autorizados;
- [ ] Monitor agrupa request/response;
- [ ] filtros por endpoint/evento/UIN/status funcionam;
- [ ] reprodução continua durante falha de rede;
- [ ] loop de uma mídia não apresenta flicker;
- [ ] 404 é pulado sem hang;
- [ ] rotação permanece após abrir/fechar configuração;
- [ ] Direct Totem e Complementos aparecem conforme papel/build.

### Escala e operação

- [ ] tamanho da fila offline monitorado;
- [ ] duplicidade de eventos medida;
- [ ] retenção definida;
- [ ] rollup testado antes da exclusão;
- [ ] volume por totem e por dia medido;
- [ ] gate de WebSocket/MQTT documentado;
- [ ] fallback HTTP testado.

### Pós-deploy

- [ ] observar logs do serviço;
- [ ] observar crash/ANR/OOM no Player-AD;
- [ ] confirmar que o clone do VPS permaneceu limpo ou explicar arquivos gerados;
- [ ] registrar commit, versões, horário e resultado do rollout;
- [ ] manter janela de rollback.

## 18. Estado ao encerrar este registro

Implementado e versionado:

- telemetria v2 do commit `bbfbac3a`;
- integração do commit `b64259d9`;
- Player-AD `2.07/107`;
- backend `2.1.11`;
- frontend `2.1.17`;
- `POST /api/player/sync` com fallback compatível;
- ACK unificado e idempotência preservada;
- `nextMedia` cíclica no evento de início e no estado do card;
- card com ID, nome, duração, progresso, horários e estados stale/offline;
- correção da `ConcurrentModificationException` na fila persistente;
- correção de `knownPlanVersion: null` no contrato sync;
- fila protegida entre instâncias e arquivos temporários únicos;
- backoff de plano vazio e respeito ao `Retry-After` em HTTP 429;
- modo ativo no painel;
- Device ID canônico;
- documentação de instalação;
- correções de flicker, bloqueio de rede, 404, restart e rotação.

Publicação e implantação:

- commit operacional `4bc88462` enviado para `origin/TotemDigital-MultiAgencia`;
- APK `2.05/105` instalado no rollout inicial;
- APK hotfix `2.06/106` compilado, instalado e iniciado na TV Box por ADB;
- APK operacional `2.07/107` compilado, instalado e iniciado na TV Box por ADB;
- frontend `2.1.17` e backend `2.1.11` implantados em produção;
- `manage.sh` e `scripts/instalar.sh` incorporados ao repositório no commit
  `a7c33b91`;
- linha operacional aprovada para promoção de
  `TotemDigital-MultiAgencia` para `main` no repositório principal.

Pendente de comprovação operacional prolongada:

- aplicação e funcionamento do schema v2 em produção;
- observação prolongada de escala e retenção;
- ausência do crash em observação de longa duração;
- retenção real em escala.

Ainda sujeito a implementação e gates:

- rollup e retenção automatizados;
- canal persistente Player ↔ Backend.

## 19. Correção do estado de reprodução no card

O card de Publicar em Totem passou a usar uma estratégia híbrida:

- ao manter o cursor sobre um totem habilitado, consulta imediatamente
  `GET /api/totems/:id/playback-state`;
- mantém a assinatura WebSocket como fonte principal das atualizações seguintes;
- quando o WebSocket está desconectado, consulta o estado por REST a cada 10 segundos;
- informa visualmente se está em tempo real, conectando ou usando o fallback REST;
- não assina, consulta nem inicia lease de observação para totem desabilitado;
- apresenta `Totem desabilitado` no lugar de dados antigos de reprodução.

O backend também passou a rejeitar consulta de playback, criação/renovação de
lease e assinatura WebSocket para totens desabilitados. Encerrar um lease
continua permitido para garantir limpeza operacional.

## 20. Correção da URL WebSocket em produção

Com `REACT_APP_API_URL=https://totemdigital.app.br/api`, o frontend preservava
incorretamente o caminho `/api` ao montar a URL WebSocket e tentava conectar em
`wss://totemdigital.app.br/api/ws`. O endpoint real do backend e do proxy Nginx
é `/ws`.

O frontend `2.1.16` passou a extrair somente `host:porta` da URL absoluta da API
e a derivar corretamente `ws:` ou `wss:` do protocolo configurado. A correção
vale para o card de reprodução, Monitor Dispatcher e visualizador de logs,
todos consumidores da função compartilhada.

## 21. Decisão transitória de segurança do JWT no WebSocket

Foi avaliada a substituição imediata do JWT na query string por cookie
`HttpOnly` ou ticket WebSocket descartável. A decisão foi adiar essa migração
porque ela alcança login, refresh, logout, sessões, CSRF, proxy e reconexão,
criando risco desproporcional na reta final.

Medidas aplicadas agora:

- manutenção do handshake existente para preservar compatibilidade;
- `wss://` obrigatório em produção;
- URL corrigida para `/ws`;
- `access_log off` em todos os blocos `/ws` gerados pelo instalador;
- atualização de `scripts/fix-nginx-websocket.sh` para aplicar a proteção
  também em servidores já instalados;
- orientação explícita para redigir tokens em capturas e diagnósticos.

Requisitos de evolução foram registrados em
`docs/websocket-nginx-unexpected-response-200.md`: comparar cookie seguro e
ticket descartável, definir revogação, CSRF, múltiplos ambientes, migração,
testes, métricas e rollback antes de qualquer implementação.

## 22. Estado conectado sem atualização do card

Após a correção de `/api/ws` para `/ws`, o card passou a indicar conexão
WebSocket, mas podia permanecer em uma mídia antiga. A análise encontrou duas
lacunas de recuperação:

- com o WebSocket conectado, o frontend interrompia completamente a
  reconciliação REST, portanto uma assinatura recusada ou broadcast perdido
  mantinha o último estado indefinidamente;
- o Player-AD persistia por seis horas a conclusão de que `/api/player/sync` e
  `/api/player/events/batch` não eram suportados. Isso podia ocorrer quando o
  APK era instalado antes do backend novo. Durante esse período usava o evento
  legado, que não contém todos os campos exigidos pelo card.

Correções:

- frontend `2.1.17`: mantém WebSocket como via imediata e reconcilia por REST a
  cada 15 segundos somente para os cards sob observação;
- Player-AD `2.07/107`: invalida o cooldown antigo, reduz a revalidação de
  capacidade para 15 minutos e registra código/resposta de falhas HTTP dos
  endpoints modernos;
- desconectado, o frontend mantém o fallback REST de 10 segundos.

Essa estratégia preserva baixo tráfego: não existe polling dos cards sem
cursor/observação, e uma atualização WebSocket continua aparecendo
imediatamente.

## 23. Baseline operacional aprovado

Em 9 de agosto de 2026, a combinação abaixo foi validada como operacional:

- frontend `2.1.17`;
- backend `2.1.11`;
- Player-AD `2.07`, build `107`;
- código funcional no commit `4bc88462`;
- origem da promoção: `origin/TotemDigital-MultiAgencia`;
- destino canônico: `origin/main`.

Evidências observadas:

- WebSocket conectado em `/ws`;
- card avançando mídia atual, duração, progresso e próxima mídia;
- reconciliação REST ativa apenas durante observação do card;
- agenda desligando a tela no horário configurado;
- ao entrar no período off, a reprodução encerra e deixa de avançar mídias;
- APK `2.07/107` instalado e iniciado na TV Box de referência.

Melhoria pós-baseline, sem bloquear a promoção: manter heartbeat reduzido no
modo off e apresentar no card o estado explícito “Tela desligada por agenda”,
com relógio extrapolado a partir do último heartbeat.
