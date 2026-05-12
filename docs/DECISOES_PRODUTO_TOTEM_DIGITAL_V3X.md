# Decisoes De Produto Totem Digital V3x

Data: 2026-05-12

## Objetivo

Registrar decisoes de produto que devem orientar a V3x antes de novas implementacoes grandes.

## Decisao 1 - SaaS Primeiro

Decisao:

> Priorizar SaaS gerenciado como oferta principal.

Justificativa:

- Melhor recorrencia.
- Mais controle de atualizacoes.
- Menos complexidade para cliente pequeno.
- Melhor suporte.
- Mais facil criar pilotos.
- Mais facil medir uso e melhorar produto.

Self-hosted continua possivel, mas deve ser tratado como oferta enterprise futura.

## Decisao 2 - Player Oficial Inicial

Decisao:

> O player oficial inicial da V3x deve ser Linux Mini-PC com Chrome Kiosk/Electron Player.

Justificativa:

- Mais controle operacional.
- Melhor suporte a autostart.
- Melhor suporte a watchdog.
- Cache local mais previsivel.
- Menos fragmentacao que Android.
- Melhor diagnostico remoto.

Android, webOS, Raspberry Pi e outros players continuam como expansoes, mas nao devem ser o primeiro caminho comercial padrao.

## Decisao 3 - Ativacao Por Codigo

Decisao:

> O provisionamento de telas deve evoluir para ativacao por codigo.

Fluxo desejado:

1. Player inicia sem configuracao manual.
2. Player exibe codigo curto.
3. Usuario acessa painel e vincula a tela.
4. Backend provisiona configuracao automaticamente.
5. Tela passa para estado ativo.

Beneficios:

- Reduz suporte.
- Reduz SSH/manual tecnico.
- Melhora onboarding.
- Torna o produto vendavel para instaladores e revendas.

## Decisao 4 - Dashboard Comercial Primeiro

Decisao:

> O dashboard inicial deve ser comercial, nao tecnico.

Mostrar primeiro:

- Nova publicacao.
- Telas online.
- Telas offline.
- Publicacoes recentes.
- Templates.
- Clientes ativos.
- Alertas simples.

Ocultar ou mover para modo avancado:

- Dispatcher.
- Logs tecnicos.
- Contratos internos.
- Cotas detalhadas.
- Estruturas administrativas.
- Configuracoes complexas.

## Decisao 5 - Publicacao Rapida Como Entrada Principal

Decisao:

> `Publicar em Tela` deve ser a principal acao do produto V3x.

Motivo:

Essa acao traduz o valor do produto para o usuario comum.

O usuario nao compra campanha, playlist ou dispatcher. Ele compra a capacidade de mudar o que aparece na tela.

## Decisao 6 - Templates Premium Como Efeito Wow

Decisao:

> Templates visuais precisam ser tratados como parte central da venda.

Justificativa:

- O cliente compra visual primeiro.
- Demonstracao bonita vende melhor que lista de recursos.
- Cardapios e promocoes precisam parecer profissionais.
- Cases visuais dependem de boa apresentacao.

Templates iniciais:

- Cardapio vertical.
- Cardapio horizontal.
- Promocao do dia.
- Combo/oferta.
- Anuncio institucional.
- Comunicado.

## Decisao 7 - Produto Completo, Nao Apenas Software

Decisao:

> A oferta comercial deve ser uma solucao pronta.

Pacote sugerido:

- Software SaaS.
- Player.
- Mini-PC ou hardware homologado.
- Instalacao.
- Suporte.
- Templates.
- Treinamento.

Beneficios:

- Aumenta ticket.
- Melhora experiencia.
- Reduz variaveis tecnicas.
- Facilita demonstracao.

## Decisao 8 - Prova Social Antes De Expansao Avancada

Decisao:

> Antes de priorizar IA/analytics avancados, criar pilotos reais e cases visuais.

Entregas necessarias:

- Fotos reais.
- Videos curtos.
- Antes/depois.
- Depoimentos.
- Instalacoes funcionando por dias.

Motivo:

O produto entrou em fase de prova social. Novas features valem menos que uma demonstracao real funcionando.

## Decisao 9 - Diferencial Futuro

Decisao:

> O diferencial enterprise futuro sera infraestrutura distribuida resiliente para midia digital.

Evolucoes futuras:

- Cache entre players.
- Sincronizacao inteligente.
- Fallback automatico.
- Recuperacao autonoma.
- Operacao offline total.
- Edge computing.

IA continua relevante, mas nao deve ser posicionada como unico diferencial.

## Regra De Priorizacao

Toda demanda futura deve responder:

1. Ajuda a publicar em menos de 5 minutos?
2. Ajuda a vender para o nicho inicial?
3. Melhora estabilidade do player?
4. Melhora demonstracao visual?
5. Reduz suporte?

Se a resposta for nao para todas, a demanda deve ir para backlog futuro.
