# Roadmap Totem Digital V3x

Data: 2026-05-12

## Objetivo Do Roadmap

Organizar a evolucao da V3x em fases curtas, com foco em transformar a base tecnica atual em produto comercial simples, demonstravel e vendavel.

## Fase 0 - Fundacao Estrategica

Status: iniciada.

Entregas:

- Documentar estrategia V3x.
- Definir Product Vision.
- Definir fluxo principal: Cliente -> Tela -> Conteudo -> Publicar.
- Registrar decisoes de player, SaaS, ativacao e dashboard.

Criterio de aceite:

- A equipe consegue explicar o produto em uma frase.
- A equipe consegue demonstrar o fluxo principal sem explicar arquitetura interna.

## Fase 1 - Publicacao Rapida

Status: em implementacao inicial.

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

Objetivo:

Permitir que o usuario envie midia diretamente no fluxo de publicacao rapida.

Entregas:

- Upload integrado no wizard.
- Validacao de cota antes do upload.
- Preview da midia.
- Rotacao/conversao quando necessario.
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
- Script Linux kiosk (`scripts/install-player-v3x-linux-kiosk.sh`: autostart, `--systemd-user`, `--linger`, flags Chromium leves).
- Normalizacao do codigo de ativacao (backend `/api/player`, `player-web/js/activationCode.js`, Player-AD `PlayerConfigLoader`).
- Vinculacao inicial de hardware no Player-AD sem editar backend manualmente.
- Autostart.
- Watchdog.
- Watchdog interno no Player-AD para recuperar loop encerrado/falho e video travado.
- Watchdog de reproducao no player-web para pular video que nao inicia ou nao finaliza.
- Cache offline.
- Recuperacao apos queda de rede (player-web ressincroniza em `online`).
- Logs basicos de saude.
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
