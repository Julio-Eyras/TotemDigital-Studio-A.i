# Guia de Integração dos Players com o Dispatcher-Totem

## Visão Geral

Este documento define **como os players clientes** (totens, Smart TVs, web, desktop) devem se integrar ao backend para:

- Autenticar o dispositivo (via **UIN** + `deviceId` + `platform` + `appVersion`).
- Obter o **plano de exibição** diretamente do **Dispatcher-Totem**.
- Manter **heartbeat** e telemetria atualizados.

Toda a comunicação é feita via rotas em `/api/player`, que internamente usam:

- `DispatcherTotemService` (motor de decisão).
- `TotemService` (dados do totem).
- `DeviceTokenService` + tabela `device_tokens` (sessões e telemetria).

---

## 1. Identidade do Dispositivo

Cada player deve identificar-se com:

- **UIN** (`uin`): Identificador único do totem.
- **Device ID** (`deviceId`): ID físico/OS da TV ou SBC (ex.: Android ID, webOS deviceId, serial).
- **Platform** (`platform`): Ex.: `webos`, `tizen`, `android`, `linux`, `windows`, `browser`.
- **App Version** (`appVersion`): Versão do app/player (ex.: `2.1.0`).

Essas informações são usadas para:

- Amarrar o player ao registro em `totems` / `smart_tvs`.
- Registrar/atualizar a sessão em `device_tokens`.
- Ajudar na auditoria e debugging.

---

## 2. Fluxo Geral de Integração

### 2.1 Primeira Execução / Início de Sessão

1. Player coleta:
   - `uin`
   - `deviceId`
   - `platform`
   - `appVersion`
2. Player chama:

```http
GET /api/player/token?uin={UIN}&deviceId={DEVICE_ID}&platform={PLATFORM}&appVersion={APP_VERSION}
```

3. Backend:
   - Gera **token HMAC** (compatibilidade antiga).
   - Cria/atualiza registro em `device_tokens` com:
     - `totem_id` (se conseguir resolver pelo UIN),
     - `uin`, `device_id`, `platform`, `app_version`,
     - `token`, `expires_at`, `last_seen_at`, `ip_address`, `user_agent`.

4. Resposta:

```json
{
  "token": "1699999999999:abcdef0123456789...", 
  "expiresIn": 3600
}
```

5. Player salva `token` localmente (memória / storage).

### 2.2 Obtenção de Plano de Exibição (Dispatcher)

Para obter o plano de exibição corrente, o player chama:

```http
GET /api/player/dispatch
  ?uin={UIN}
  &token={TOKEN}
  [&deviceId={DEVICE_ID}]
  [&timestamp={ISO_8601}]
  [&timezone={TZ}]
```

- `uin` (obrigatório)
- `token` (obrigatório) — mesmo token retornado em `/token`
- `deviceId` (opcional, mas recomendado)
- `timestamp` (opcional; se não enviado, o backend usará `NOW()`)
- `timezone` (opcional; ex.: `America/Sao_Paulo`)

#### Validação de segurança

O backend aceitará a requisição se **qualquer uma** das validações passar:

1. **Token HMAC válido**: `validateTotemToken(uin, token)`
2. **Token em `device_tokens` válido**:
   - `token` = `device_tokens.token`
   - `uin` = `device_tokens.uin`
   - (`deviceId` = `device_tokens.device_id` se informado)
   - `status = 'active'`
   - `expires_at` > `NOW()`

Se ambas falharem → `401 Token inválido ou expirado`.

#### Resposta de sucesso (com plano)

```json
{
  "success": true,
  "fromCache": false,
  "executionTimeMs": 42,
  "plan": {
    "totemId": 1,
    "timestamp": "2026-01-14T02:40:00.000Z",
    "playlistId": 1,
    "playlistName": "Playlist Black Friday - Entrada",
    "mediaItems": [
      {
        "mediaId": 1,
        "order": 0,
        "duration": 10,
        "url": "/media/shopping/black-friday-banner.jpg",
        "mediaType": "image",
        "metadata": {
          "width": 1920,
          "height": 1080,
          "mimeType": "image/jpeg"
        }
      },
      {
        "mediaId": 2,
        "order": 1,
        "duration": 30,
        "url": "/media/shopping/ofertas-video.mp4",
        "mediaType": "video",
        "metadata": {
          "width": 1920,
          "height": 1080,
          "mimeType": "video/mp4"
        }
      }
    ],
    "totalDuration": 40,
    "priority": 10,
    "source": "campaign",
    "sourceId": 1,
    "validityStart": "2026-01-14T02:00:00.000Z",
    "validityEnd": "2026-01-14T03:00:00.000Z",
    "metadata": {
      "resolution": "1920x1080",
      "orientation": "landscape",
      "campaignId": 1,
      "campaignTitle": "Promoção Black Friday"
    }
  }
}
```

#### Resposta quando não há plano

```json
{
  "success": false,
  "error": "Não foi possível gerar plano de exibição",
  "fromCache": false,
  "executionTimeMs": 25
}
```

O player deve tratar esse caso com:
- Conteúdo padrão,
- Tela de standby,
- Ou tentar novamente após intervalo seguro.

### 2.3 Heartbeat e Comandos Remotos

Para manter o totem marcado como **online** e receber comandos remotos (`remote_commands`), o player chama periodicamente:

```http
POST /api/player/heartbeat
  ?uin={UIN}
  &token={TOKEN}
  [&deviceId={DEVICE_ID}]
```

Body (JSON):

```json
{
  "status": "online",
  "version": "2.1.0",
  "firmwareVersion": "1.0.3",
  "ipAddress": "192.168.0.10",
  "config": {
    "resolution": "1920x1080",
    "orientation": "landscape"
  },
  "metrics": {
    "cpuUsage": 12.5,
    "memoryUsage": 45.3,
    "diskUsage": 30.1
  },
  "executedCommands": [123, 124]
}
```

Resposta:

```json
{
  "success": true,
  "token": "1700000000000:...", 
  "pendingCommands": [
    {
      "id": 130,
      "type": "restart",
      "data": { "reason": "remote_admin" },
      "priority": 10
    }
  ]
}
```

O player deve:
- Atualizar `token` se vier novo.
- Executar comandos em `pendingCommands` e reportar IDs em `executedCommands` na próxima chamada.

---

## 3. Fluxos por Tipo de Player

### 3.1 `player-client` (núcleo multi-plataforma)

**Onde integrar:**
- `core/api/client.js`:
  - Implementar funções:
    - `getToken(uin, deviceId, platform, appVersion)`
    - `dispatch(uin, token, deviceId, timestamp?, timezone?)`
    - `heartbeat(uin, token, deviceId, payload)`
- `core/heartbeat/service.js`:
  - Usar `heartbeat(...)` periodicamente.
- `core/scheduler/scheduler.js`:
  - Consumir `plan` do dispatcher em vez de playlists diretas.
- `core/cache/LocalPlaylistManager.js`:
  - Armazenar localmente o último `DispatchPlan` para modo offline.

**Plataformas (`platforms/*`):**
- Cada plataforma (Android, webOS, Tizen, Linux, Windows) deve:
  - Coletar `deviceId`, `platform`, `appVersion`.
  - Chamar `getToken()` na inicialização.
  - Repassar `uin`, `deviceId`, `token` para as chamadas subsequentes.

### 3.2 `player-web`

**Fluxo sugerido (JavaScript no browser):**

1. Obter `uin`:
   - De `localStorage`, ou
   - De querystring (`?uin=...`), ou
   - De QR code escaneado.
2. Gerar um `deviceId` estável (ex.: hash de `navigator.userAgent + screen.width + screen.height`), ciente das limitações.
3. Chamar:

```js
const resToken = await fetch(`/api/player/token?uin=${uin}&deviceId=${deviceId}&platform=browser&appVersion=2.1.0`);
const { token } = await resToken.json();
```

4. Obter plano:

```js
const url = `/api/player/dispatch?uin=${uin}&token=${token}&deviceId=${deviceId}`;
const resPlan = await fetch(url);
const data = await resPlan.json();
if (data.success && data.plan) {
  // Executar plano (loop de imagens/vídeos)
}
```

5. Enviar heartbeat a cada N segundos:

```js
await fetch(`/api/player/heartbeat?uin=${uin}&token=${token}&deviceId=${deviceId}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    status: 'online',
    version: '2.1.0',
    ipAddress: null, // optional
    metrics: { /* opcional */ },
    executedCommands: lastExecutedCommandIds
  })
});
```

### 3.3 Players de Smart TV (webOS, Tizen, Android)

Em todos os casos, a lógica é a mesma do `player-client`, com diferenças de coleta de `deviceId`:

- **Android**:
  - `deviceId`: Android ID (`Settings.Secure.ANDROID_ID`) ou ID próprio do app.
  - `platform`: `"android"`.
- **webOS**:
  - `deviceId`: ID da TV via API do webOS (ex.: `deviceId` do `webOSServiceBridge`).
  - `platform`: `"webos"`.
- **Tizen**:
  - `deviceId`: ID retornado pelas APIs do Tizen (ex.: `tizen.systeminfo.getCapability("http://tizen.org/system/tizenid")`).
  - `platform`: `"tizen"`.

Todos:
- Chamam `/api/player/token`, `/api/player/dispatch`, `/api/player/heartbeat` com esses parâmetros.

---

## 4. `device_tokens`: Como é usado pelo Backend

### 4.1 Criação/renovação

- Em `/api/player/token`:
  - Chama `DeviceTokenService.createOrUpdateToken(...)` com:
    - `totemId` (quando encontrado),
    - `uin`, `deviceId`, `platform`, `appVersion`,
    - `ipAddress`, `userAgent`.
- Em `/api/player/heartbeat`:
  - Também chama `createOrUpdateToken(...)` para renovar TTL e telemetria.

### 4.2 Validação

- Em `/api/player/heartbeat` e `/api/player/dispatch`:
  - Primeiro tenta `validateTotemToken` (HMAC).
  - Depois tenta `DeviceTokenService.validateToken(uin, token, { deviceId, ip, userAgent })`.
  - Se **ambos** falharem → `401`.

### 4.3 Vantagens

- Permite:
  - Bloquear um dispositivo específico (revogar tokens).
  - Ver de quais IPs/UA os players estão conectando.
  - Saber qual versão do app está em cada totem/TV.
  - Base para alertas e auditoria.

---

## 5. Roadmap para os Players

### Fase 1 – Backend pronto (STATUS: EM ANDAMENTO)

- [x] Tabela `device_tokens` criada.
- [x] Serviço `DeviceTokenService` implementado.
- [x] `/api/player/token` passando a registrar em `device_tokens`.
- [x] `/api/player/heartbeat` validando também via `device_tokens` e renovando.
- [x] `/api/player/dispatch` criado, integrado ao `DispatcherTotemService`.

### Fase 2 – Integração `player-client`

- [ ] Atualizar `core/api/client.js` para usar as novas rotas.
- [ ] Atualizar `core/heartbeat/service.js` para enviar `deviceId`, `platform`, `appVersion`.
- [ ] Ajustar `scheduler` e `cache` para trabalhar com `DispatchPlan` como fonte primária.
- [ ] Validar plataformas Android/webOS/Tizen/Linux/Windows com o novo fluxo.

### Fase 3 – Integração `player-web`

- [ ] Ajustar `player-web/index.html` para:
  - Pedir/receber `uin`.
  - Gerar um `deviceId` estável.
  - Usar `/api/player/token`, `/dispatch` e `/heartbeat`.

### Fase 4 – Integração FX/SmartDisplayFX

- [ ] Definir como `DispatchPlan` expõe triggers/FX.
- [ ] Ajustar `player-fx` + `Player-SmartDisplayFX-client` (`FxEngine`, `PlayerBridge`) para consumir esses dados.
- [ ] Garantir que efeitos acompanham a timeline de mídia do dispatcher.

---

## 6. Checklist para Implementação nos Players

1. **Coleta de Identidade**
   - [ ] `uin`
   - [ ] `deviceId`
   - [ ] `platform`
   - [ ] `appVersion`

2. **Token Inicial**
   - [ ] Chamar `/api/player/token`
   - [ ] Guardar `token` retornado

3. **Plano de Exibição**
   - [ ] Chamar `/api/player/dispatch` com `uin`, `token`, `deviceId`
   - [ ] Tratar casos de `success=false`
   - [ ] Executar `plan.mediaItems` em loop

4. **Heartbeat**
   - [ ] Enviar `POST /api/player/heartbeat` a cada N segundos
   - [ ] Atualizar `token` se vier novo
   - [ ] Executar `pendingCommands`

5. **Tratamento de Erros**
   - [ ] Reagir a `401` renovando token via `/token`
   - [ ] Reagir a `403` (totem bloqueado/inativo) com tela de aviso
   - [ ] Reagir a falhas de rede com modo offline (cache local)

6. **Cache e Download de Mídias** (Obrigatório para totens, opcional para TVs)
   - [ ] Implementar download de mídias do `DispatchPlan`
   - [ ] Armazenar mídias em cache local (totem: obrigatório, TV: opcional)
   - [ ] Validar checksums de integridade
   - [ ] Implementar política de limpeza LRU
   - [ ] Persistir último `DispatchPlan` para modo offline
   - [ ] Implementar servidor HTTP local (totem) para servir TVs

---

## 8. Cache e Armazenamento Local

### 8.1 Princípios Fundamentais

O Smart Signage Pro foi projetado com **resiliência offline** como requisito fundamental:

- **Totem = Hub Local**: Armazena mídias para si e para TVs associadas
- **Download > Streaming**: Download assíncrono + reprodução local (não streaming contínuo)
- **Topologia em Estrela**: Totem centraliza e distribui conteúdo localmente

**Documentação completa**: Ver `docs/ARQUITETURA-CACHE-ARMAZENAMENTO-LOCAL.md`

### 8.2 Fluxo de Download de Mídias

Após receber o `DispatchPlan`, o player deve:

1. **Identificar mídias necessárias**:
   ```javascript
   const mediaItems = plan.mediaItems; // Array de mediaItems do DispatchPlan
   ```

2. **Verificar cache local**:
   ```javascript
   for (const item of mediaItems) {
     const cachedPath = getCachedMediaPath(item.mediaId, item.url);
     if (await fileExists(cachedPath)) {
       // Validar checksum se disponível
       if (await validateChecksum(cachedPath, item.checksum)) {
         // Usar mídia do cache
         continue;
       } else {
         // Arquivo corrompido, remover e baixar novamente
         await removeFile(cachedPath);
       }
     }
     
     // Download necessário
     await downloadMedia(item.mediaId, item.url);
   }
   ```

3. **Download de mídia**:
   ```http
   GET /api/media/{mediaId}/download
   Authorization: Bearer {token}
   ```
   
   Resposta: Arquivo binário (vídeo/imagem/áudio)

4. **Salvar em cache local**:
   ```javascript
   const cachePath = `${CACHE_DIR}/media/${mediaId}_${checksum}.${ext}`;
   await saveFile(cachePath, mediaData);
   await saveMetadata(mediaId, { url, checksum, downloadedAt, ... });
   ```

### 8.3 Estrutura de Cache (Totem)

```
{cache_dir}/
├── dispatch_plan.json          # Último DispatchPlan recebido
├── media/
│   ├── {mediaId}_{checksum}.{ext}
│   └── ...
├── thumbnails/
│   └── ...
└── metadata/
    └── {mediaId}.json
```

### 8.4 Modo Offline

Quando a Internet cai:

1. **Totem**:
   - Carrega último `DispatchPlan` do cache (`dispatch_plan.json`)
   - Verifica mídias no cache local
   - Se todas disponíveis → continua reprodução normal
   - Se faltam mídias → usa playlist de fallback
   - Continua servindo TVs via HTTP local

2. **Smart TV**:
   - Detecta timeout ao buscar novo plano do totem
   - Usa último plano conhecido (se cacheado)
   - Busca mídias do totem via HTTP local
   - Se totem offline → mostra tela de standby

### 8.5 Servidor HTTP Local (Totem)

Totens devem expor servidor HTTP local para servir mídias às TVs associadas:

**Endpoint de mídia**:
```
http://{totem-ip}:8080/media/{mediaId}
```

**Endpoint de plano** (opcional, para TVs consultarem diretamente):
```
http://{totem-ip}:8080/api/dispatch?uin={uin}
```

**Implementação mínima**:
- Servidor HTTP simples (ex.: Express, http-server)
- Servir arquivos estáticos do diretório de cache
- Suportar range requests para streaming parcial

### 8.6 Recomendações por Plataforma

#### Totem (Obrigatório)
- ✅ Cache completo de mídias
- ✅ Download automático de novas mídias
- ✅ Servidor HTTP local
- ✅ Política de limpeza LRU
- ✅ Validação de checksums

#### Smart TV - webOS/Tizen (Opcional/Leve)
- ✅ Cache de configuração
- ✅ Cache de assets leves (< 10 MB)
- ❌ Cache pesado de mídias (buscar do totem)
- ✅ Busca mídias do totem via HTTP local

#### Smart TV - Android Box (Opcional/Completo)
- ✅ Cache completo (como totem)
- ✅ Download direto do backend (se necessário)
- ✅ Fallback para totem

#### player-web (Browser)
- ❌ Sem cache persistente (limitações do browser)
- ✅ Streaming direto do backend/totem
- ✅ Cache em memória durante sessão

---

## 7. Conclusão

Com este contrato:

- Todos os players (totem, Smart TV, web, desktop) passam a:
  - Autenticar-se de forma consistente.
  - Delegar a decisão de conteúdo ao **Dispatcher-Totem**.
  - Alimentar telemetria e segurança via `device_tokens`.

Isso prepara o terreno para:

- IA avançada baseada em comportamento real dos dispositivos.
- Auditoria e controle fino de cada totem/TV/player.
- Atualizações OTA e comandos remotos mais seguros.

