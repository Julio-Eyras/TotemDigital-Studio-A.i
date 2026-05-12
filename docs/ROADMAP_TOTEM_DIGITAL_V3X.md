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
- Endpoint de claim/provisionamento.
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

- Guia oficial do player V3x.
- Script de instalacao/provisionamento.
- Autostart.
- Watchdog.
- Cache offline.
- Recuperacao apos queda de rede.
- Logs basicos de saude.

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
- Analytics.
- Marketplace de templates.
- Revendas/franquias.
- APIs publicas.
- Edge/cache distribuido.

Criterio de aceite:

- Cada modulo aumenta receita ou reduz churn.
- Nenhum modulo compromete o fluxo de 5 minutos.
