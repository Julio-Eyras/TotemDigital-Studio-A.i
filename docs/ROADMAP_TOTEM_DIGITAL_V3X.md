# Roadmap Totem Digital V3x

Data: 2026-05-12

## Objetivo Do Roadmap

Organizar a evolucao da V3x em fases curtas, com foco em transformar a base tecnica atual em produto comercial simples, demonstravel e vendavel.

## Estado Resumido (codigo e docs no repositorio)

| Fase | No repo (implementado / documentado) | Fora do repo ou etapa seguinte |
|------|----------------------------------------|--------------------------------|
| 0 | `docs/PRODUCT_VISION_V3X.md` (visao e fluxo principal) | Workshops internos, decisoes comerciais finais |
| 1 | `POST /api/quick-publish`, pagina `/quick-publish`, presets e segmentos | Cobertura de testes E2E e hardening por perfil |
| 2 | Upload no fluxo, preview local, validacao previa de plano (`media`) e storage, opcao **9:16** pos-upload | Conversao automatica pesada de video (ffmpeg em fila), se necessario |
| 3 | Codigo de ativacao, rotas player, painel Totens, Player-AD | UX dedicada «tipo Netflix» se ainda nao cumprir criterio |
| 4 | Kiosk Linux, politicas Chromium, verificacao, heartbeat, docs; **esqueleto** `electron-player/` | OTA, branding, builds `.deb`/`.AppImage` |
| 5 | Modo compacto; `REACT_APP_DASHBOARD_COMMERCIAL_FOCUS` no dashboard e **menu Pro** (sem Dispatcher, atalho Nova publicacao); Command Palette alinhada | Reducao adicional de jargao em todas as paginas Pro |
| 6 | Templates/segmentos no dashboard e QuickPublish; previsualizacao comercial no wizard | Demonstracao em TV real, packs de arte, marketplace |
| 7+ | Checklists podem referir scripts/docs de instalacao | Pilotos reais, SaaS cloud, modulos avancados (produto/infra) |

## Fase 0 - Fundacao Estrategica

Status: em curso (visao documentada).

Entregas:

- Documentar estrategia V3x.
- Definir Product Vision (`docs/PRODUCT_VISION_V3X.md`).
- Definir fluxo principal: Cliente -> Tela -> Conteudo -> Publicar.
- Registrar decisoes de player, SaaS, ativacao e dashboard.

Criterio de aceite:

- A equipe consegue explicar o produto em uma frase.
- A equipe consegue demonstrar o fluxo principal sem explicar arquitetura interna.

## Fase 1 - Publicacao Rapida

Status: funcional no painel e API; continuar validacao em campo.

Objetivo:

Permitir publicar midia existente em uma tela/totem sem configurar manualmente playlist e campanha.

Entregas:

- Pagina `Publicar em Tela`.
- API `POST /api/quick-publish`.
- Presets comerciais iniciais.
- Criacao automatica de playlist.
- Criacao automatica de campanha.
- Vinculo automatico com totem/tela.
- Regeneracao do conteudo do player.

Criterio de aceite:

- Selecionar anunciante.
- Selecionar contrato ativo.
- Selecionar tela/totem.
- Selecionar midia aprovada.
- Clicar em publicar.
- Conteudo chegar ao player sem abrir manualmente Playlists ou Campanhas.

## Fase 2 - Upload Dentro Do Fluxo

Status: upload no wizard com validacao de limites, preview local, opcao 9:16 pos-envio (imagem/video) e correcao da API de transformacao com rotacao 0.

Objetivo:

Permitir que o usuario envie midia diretamente no fluxo de publicacao rapida.

Entregas:

- Upload integrado no wizard.
- Validacao de cota antes do upload (chamadas a `/api/subscribers/:id/validate/plan-limits` e `.../validate/storage` antes do `POST /media/upload`).
- Preview da midia (preview local do ficheiro selecionado; PDF/áudio sem preview visual).
- Rotacao/conversao quando necessario (apos upload: opcao 9:16 no wizard + correcao API `transform` com `rotationDegrees=0` e `fit=9:16`).
- Associacao automatica da midia recem enviada a publicacao.

Criterio de aceite:

- Usuario escolhe arquivo, envia e publica no mesmo fluxo.
- Nao precisa entrar na tela Mídias.

## Fase 3 - Ativacao De Telas

Objetivo:

Criar experiencia de ativacao semelhante a Netflix/YouTube TV.

Fluxo:

1. Player abre em modo nao ativado.
2. Player exibe codigo curto.
3. Usuario acessa painel e vincula o codigo.
4. Tela recebe configuracao automaticamente.

Entregas:

- Geracao de codigo de ativacao.
- Tela de ativacao no painel.
- Resumo no painel com aguardando player e aguardando aprovacao.
- Atalhos do dashboard para filtros de ativacao e telas offline.
- Endpoint de claim/provisionamento.
- Vinculacao por codigo no Player-AD usando `/api/player/register`.
- Estado do player: aguardando ativacao, ativo, expirado.
- Registro de diagnostico basico.

Criterio de aceite:

- Instalar player sem editar arquivo manual.
- Vincular tela pelo painel em poucos passos.

## Fase 4 - Player Oficial V3x

Objetivo:

Definir uma experiencia oficial suportada para os primeiros pilotos.

Direcao recomendada:

> Linux Mini-PC + Chrome Kiosk/Electron Player.

Motivos:

- Mais controle.
- Autostart.
- Watchdog.
- Cache local.
- Menos fragmentacao que Android.
- Melhor diagnostico remoto.

Entregas:

- Guia oficial do player V3x (`docs/PLAYER_OFICIAL_V3X.md`).
- Script Linux kiosk (`scripts/install-player-v3x-linux-kiosk.sh`: autostart, `--systemd-user`, `--linger`, flags CLI, `--install-chromium-policy`, rotação de log).
- Verificacao pos-instalacao kiosk (`scripts/verify-player-v3x-kiosk.sh`).
- Politicas Chromium geridas (`player-web/chromium-policies/managed-totemdigital-v3x.json`).
- Player Electron empacotado (OTA e branding): ver `docs/ELECTRON_PLAYER_V3X_NEXT.md` e pasta `electron-player/` (shell inicial); piloto suportado com Chromium kiosk.
- Normalizacao do codigo de ativacao (backend `/api/player`, `player-web/js/activationCode.js`, Player-AD `PlayerConfigLoader`).
- Vinculacao inicial de hardware no Player-AD via `POST /api/player/register` e aprovacao em Totens (sem SQL manual; UX de «Aplicar» apos vincular melhorada).
- Autostart.
- Watchdog.
- Watchdog interno no Player-AD para recuperar loop encerrado/falho e video travado.
- Watchdog de reproducao no player-web para pular video que nao inicia ou nao finaliza.
- Cache offline.
- Recuperacao apos queda de rede (player-web ressincroniza em `online`).
- Logs basicos de saude (painel + heartbeat; log local kiosk com rotação ~5 MB).
- Resumo de saude do player persistido no heartbeat e visivel em Totens.

Criterio de aceite:

- Player reinicia e volta a reproduzir sozinho.
- Conteudo continua quando a conexao cai.
- Admin consegue ver ultima conexao e status.

## Fase 5 - Dashboard Comercial

Objetivo:

Trocar a primeira impressao de painel tecnico por painel comercial.

Entregas:

- Botao primario: Nova Publicacao.
- Telas online/offline.
- Publicacoes recentes.
- Templates em destaque.
- Clientes ativos.
- Alertas simples.

Nao mostrar inicialmente:

- Dispatcher.
- Logs tecnicos.
- Tabelas administrativas.
- Contratos internos.
- Cotas detalhadas.

Criterio de aceite:

- Usuario entende a proxima acao em menos de 10 segundos.

Implementacao inicial (modo compacto `REACT_APP_TOTEMDIGITAL_COMPACT=true`):

- Menu lateral sem entrada **Dispatcher**; item de atalho **Nova publicacao** (`/quick-publish`).
- Dashboard: oculta bloco tecnico «Resumo operacional» e grelha longa de anunciantes; cartao simples **Clientes**; cartao **Estado rapido** com hora da ultima atualizacao em vez de «Sistema operacional» generico.
- Command palette (Ctrl+K) alinhada ao mesmo conjunto de paginas comerciais.

Modo Pro (opcional): definir `REACT_APP_DASHBOARD_COMMERCIAL_FOCUS=true` no build do frontend para o mesmo layout comercial no `/dashboard` sem ativar o modo compacto completo. Com esta flag, o menu lateral Pro deixa de mostrar **Dispatcher** e ganha atalho **Nova publicacao** ao nivel do Dashboard (Command Palette alinhada).

## Fase 6 - Templates Premium

Objetivo:

Criar o efeito visual que ajuda a vender.

Entregas:

- Templates para cardapio.
- Templates para promocao.
- Templates para anuncio.
- Templates para comunicado.
- Templates inteligentes por segmento comercial.
- Templates verticais 9:16.
- Templates horizontais 16:9.

Primeira fatia no painel (dashboard):

- Atalho **Institucional** em «Templates em destaque» (abre publicacao rapida com preset `institutional`); presets `menu`, `promotion`, `ad`, `announcement` ja expostos no mesmo bloco.
- Atalhos **9:16** (preset cardapio / restaurante) e **16:9** (preset anuncio / varejo) sob a grelha de templates.
- **Segmentos sugeridos** (chips: Restaurante, Varejo, Igreja/evento, Clínica, Hotel, Academia) alinhados ao `QuickPublish`.

Criterio de aceite:

- Demonstracao visual causa impacto imediato em TV real.
- Cliente consegue imaginar o uso no proprio negocio.

## Fase 7 - Pilotos Comerciais

Objetivo:

Validar o produto em ambiente real.

Entregas:

- 2 a 3 clientes piloto.
- Fotos e videos reais.
- Antes/depois.
- Depoimentos.
- Checklist de instalacao.
- Registro de problemas de player.

Criterio de aceite:

- Pelo menos um piloto usando o sistema em tela real por varios dias.
- Material visual suficiente para venda.

## Fase 8 - SaaS Comercial

Objetivo:

Preparar venda recorrente.

Direcao:

> SaaS gerenciado primeiro. Self-hosted apenas para enterprise.

Entregas:

- Ambiente cloud gerenciado.
- Planos por tela/faixa.
- Setup inicial pago.
- Atualizacoes centralizadas.
- Suporte remoto.
- Backup e observabilidade.

Criterio de aceite:

- Novo cliente pode ser criado sem instalacao manual de backend.
- Atualizacoes do produto nao dependem do cliente.

## Fase 9 - Modulos Avancados

Objetivo:

Expandir depois da base comercial validada.

Modulos futuros:

- Cardapio com produtos/precos.
- IA para artes.
- SmartDisplay Animate para transformar arte estatica em video.
- Analytics.
- Marketplace de templates.
- Multi-tela sincronizado.
- AI Director para adaptar conteudo por contexto.
- QuadraX Mesh para cache compartilhado e failover local.
- Edge AI e sensores para modo presenca.
- Revendas/franquias.
- APIs publicas.
- Edge/cache distribuido.

Criterio de aceite:

- Cada modulo aumenta receita ou reduz churn.
- Nenhum modulo compromete o fluxo de 5 minutos.
