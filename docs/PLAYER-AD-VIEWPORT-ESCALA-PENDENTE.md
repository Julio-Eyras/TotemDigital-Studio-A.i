# Player-AD — viewport / escala (pendente)

**Estado:** só investigação (2026-07-25). **Não implementar** até pedido explícito.

## Fato atual (código 1.82+)

- O **layout** (`contentHost` / `PlayerView` / `ImageView`) é `match_parent` — ocupa 100% da área útil.
- O **conteúdo** de vídeo **não** preenche sempre sem barras: usa `MediaViewportRotation.VideoScaleMode.FIT` (contain).
  - Comentário em `PlayerController`: *“largura cheia em landscape 16:9; letterbox Y se sobrar altura — sem stretch”*.
  - Constante: `VIDEO_VIEWPORT_SCALE = VideoScaleMode.FIT`.
- Pipeline vídeo: `RESIZE_MODE_FILL` na surface + matrix FIT no `TextureView` (evita stretch oval).
- Imagens:
  - landscape → `FIT_CENTER` (pode letterbox);
  - portrait → `CENTER_CROP` (preenche, corta).
- Existe `VideoScaleMode.ZOOM` (cover: preenche viewport, corta excedente) e é o default da API `applyToPlayerView`, mas o player **força FIT** no vídeo.

## Onde olhar

- `Player-AD/.../playback/PlayerController.kt` — `VIDEO_VIEWPORT_SCALE`, `applyFullscreenVideoScale`, escala de imagem
- `Player-AD/.../util/MediaViewportRotation.kt` — `FIT` vs `ZOOM`, `applyTextureTransform`
- `Player-AD/.../util/FullscreenViewport.kt` — frame ExoPlayer MATCH_PARENT (não decide contain/cover)

## Melhoria futura (quando pedir)

Se a regra de negócio for **sempre 100% sem bordas pretas** (aceitando crop):

1. Vídeo: `VIDEO_VIEWPORT_SCALE = ZOOM` (ou política por tipo/orientação).
2. Imagem landscape: alinhar a `CENTER_CROP` (ou política unificada).
3. Validar em TV_BOX / montagem com `ViewDisplayRotation` (fallback visual) e aspect ratios reais do catálogo.
4. Decidir se stretch (distort) nunca é opção — hoje o desenho rejeita stretch de propósito.

## Relacionado (já feito / separado)

- Flicker `eff=0x0`, dedupe de rotação visual, `ensureForegroundChrome`, keep-alive no `onPause` — build **1.82**; não confundir com esta decisão de escala.
