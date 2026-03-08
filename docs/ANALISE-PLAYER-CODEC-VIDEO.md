# Análise: Player não reconhece codec de vídeo (só diagnóstico)

## Objetivo

Entender por que o player-web pode falhar com “não reconhece codec” / vídeo não reproduz, **sem alterar código**. Direção para futuras correções.

---

## 1. Onde o player reproduz vídeo

- **Ficheiro:** `player-web/js/app.js`
- **Classe:** `MediaPlayerHTML5`
- **Método:** `_playVideo(url, durationSec, finish)` (linhas ~695–719)

Fluxo:

1. Cria um único elemento `<video>`.
2. Atribui `v.src = url` (uma única URL).
3. Não usa `<source type="...">` nem vários `<source>`.
4. Não chama `canPlayType()` antes de reproduzir.
5. Em erro, chama `_mediaErrorMessage()` que interpreta `MediaError.code`.

---

## 2. Códigos de erro de vídeo (HTML5 MediaError)

Em `_mediaErrorMessage` (linhas ~641–655):

- **1 = MEDIA_ERR_ABORTED** – reprodução abortada (ex.: mudança de src).
- **2 = MEDIA_ERR_NETWORK** – falha de rede.
- **3 = MEDIA_ERR_DECODE** – falha ao decodificar (frequentemente **codec não suportado** ou ficheiro corrompido).
- **4 = MEDIA_ERR_SRC_NOT_SUPPORTED** – **formato/codec não suportado** pelo browser.

O sintoma “player não reconhece codec” costuma aparecer como **code 3 (DECODE)** ou **code 4 (SRC_NOT_SUPPORTED)**.

---

## 3. De onde vêm as URLs de vídeo

- **Dispatcher / API:** `backend/src/services/dispatcherTotemService.ts`
  - URL pode ser:
    - `normalizeDownloadUrl(file_path)` → path relativo tipo `/assets/uploads/...` (servido por Nginx/Express).
    - Fallback: `/api/media/:id/stream` (em outros fluxos há `/api/media/:id/download`).
- **Fallback (propagandas/vinhetas):** URLs como `/api/player-static/vinhetas/Smartsignage-interface-111.mp4` ou `/api/player-static/propagandas/...`.
- **Backend:** extensões consideradas vídeo: `.mp4`, `.webm`, `.mov`, `.avi`, `.mkv`, `.m4v`, `.ogv` (ex.: `backend/src/routes/player.ts` linha 22, `dispatcherTotemService.ts` linha 788).

Ou seja: o player só recebe **uma URL** e coloca em `<video src="...">`. Não há escolha de formato nem hint de codec.

---

## 4. Por que o browser pode “não reconhecer” o codec

- **Conteúdo real vs extensão:** o ficheiro pode ser `.mp4` mas ter inside **H.265/HEVC**; muitos browsers (Chrome em vários OS, Firefox) não suportam HEVC em `<video>`.
- **WebM em Safari:** Safari não suporta WebM/VP8/VP9; se a URL for `.webm`, falha.
- **Sem hint de tipo:** como não se usa `<source type="video/mp4; codecs=avc1.42E01E">` (ou equivalente), o browser só tem a URL e o `Content-Type` (se existir) para decidir; em alguns casos isso leva a SRC_NOT_SUPPORTED ou DECODE.
- **Content-Type errado ou em falta:** se o servidor servir o ficheiro com `Content-Type` incorreto ou genérico, o browser pode recusar ou falhar ao decodificar.
- **Codec no container:** mesmo em MP4, codecs como **HEVC**, **VP9 em MP4**, ou áudio **AAC** em perfis não suportados podem gerar erro de decode/support.

Nada disto é “bug” no player em si; é a combinação **formato real do ficheiro + suporte do browser + forma como o vídeo é exposto (uma única src, sem type)**.

---

## 5. O que o player **não** faz (e que afecta reconhecimento de codec)

- Não usa `HTMLMediaElement.canPlayType(type)` antes de escolher a URL.
- Não usa múltiplos `<source>` com `type` (ex.: `video/mp4; codecs="avc1.42E01E"` e `video/webm; codecs="vp9"`) para fallback por browser.
- Não define `type` no elemento (ou em `<source>`) a partir do `mimeType`/metadata que a API já pode enviar (ex.: `metadata.mimeType` em `mediaItems`).
- Não trata explicitamente os códigos 3 e 4 (ex.: mensagem “formato/codec não suportado” ou fallback para próximo item).
- Não há transcodificação no backend: o ficheiro é servido como está; se o codec não for suportado pelo browser, o player não tem alternativa no mesmo ficheiro.

---

## 6. Backend e tipos MIME

- **Config:** `video/mp4`, `video/webm`, `video/ogg` permitidos (ex.: `backend/src/config/env.ts`, `mediaConfig.ts`).
- **Download:** rota `/api/media/:id/download` usa `res.download(filePath, media.name)`; o `Content-Type` depende do Express/ficheiro (extensão ou mimetype da base de dados).
- **Stream:** em alguns fluxos usa-se `/api/media/:id/stream`; seria importante garantir que essa rota (se existir) envia o `Content-Type` correto (ex.: `video/mp4`) para o ficheiro servido.

Ou seja: a direção de “reconhecimento de codec” passa também por **servir com Content-Type correto** e, no player, por **dar mais informação ao browser** (e eventualmente fallback).

---

## 7. Resumo e direção para depois

| O quê | Onde | Conclusão |
|-------|------|-----------|
| Reprodução de vídeo | `player-web/js/app.js` → `MediaPlayerHTML5._playVideo` | Uma única `<video src=url>`, sem `type` nem múltiplos `<source>`. |
| Erro “codec” | `_mediaErrorMessage` + `MediaError.code` 3 e 4 | DECODE ou SRC_NOT_SUPPORTED = formato/codec não suportado pelo browser. |
| Origem da URL | Dispatcher / API → `normalizeDownloadUrl` ou `/api/media/.../stream` ou `/api/player-static/...` | URL única; formato real do ficheiro (H.264 vs HEVC, etc.) não é validado nem anunciado ao player. |
| Tipos permitidos | Backend env / mediaConfig | video/mp4, video/webm, video/ogg; extensões .mp4, .webm, .mov, etc. |
| Falta no player | app.js | Sem `canPlayType`, sem `<source type="...">`, sem uso de `mimeType` da API para hint. |
| Falta no servidor | Opcional | Garantir Content-Type correto em stream/download; eventualmente transcodificação ou múltiplas versões (ex.: H.264 + WebM) para fallback. |

**Direção sugerida (para implementação futura, não feita aqui):**

1. **Player:** usar `mediaItem` metadata (ex.: `mimeType`) para definir `<source type="...">` ou pelo menos um hint; considerar múltiplos `<source>` (ex.: MP4 H.264 e WebM) se o backend passar a servir mais de um formato.
2. **Player:** antes de dar play, opcionalmente usar `canPlayType()` para o MIME/codec e, em caso de não suporte, saltar para o próximo item ou mostrar mensagem clara (“formato não suportado”).
3. **Backend:** garantir que as rotas que servem vídeo (download/stream) enviam `Content-Type` correto (ex.: `video/mp4` para .mp4 com H.264).
4. **Conteúdo:** preferir ficheiros **H.264 em MP4** para máximo suporte em browsers; evitar HEVC/WebM-only se o target for Safari e Chrome antigos.

Nenhuma alteração de código foi feita; este documento é apenas análise e base para decisão de próximos passos.
