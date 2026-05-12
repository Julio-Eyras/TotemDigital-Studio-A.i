# Estratégia Totem Digital V3x

Data: 2026-05-12
Branch de trabalho: `Totem-Digital-V3x`

## Contexto

Este documento registra o alinhamento estratégico definido a partir da análise do estado atual do projeto Totem Digital / QuadraX-menu e da conversa sobre os próximos rumos do produto.

O projeto já deixou de ser apenas uma ideia técnica. Ele possui base real de produto, com backend, frontend administrativo, gestão de anunciantes, planos, contratos, mídias, playlists, campanhas, totens, dispatcher, players e estrutura de instalação.

O desafio principal da V3x não é aumentar a complexidade técnica. O desafio é transformar a base atual em uma oferta comercial simples, clara e vendável.

## Decisão Principal

A V3x deve ser tratada como uma fase de produto comercial.

O objetivo não é reescrever o sistema, nem remover sua arquitetura avançada. O objetivo é criar uma camada de simplicidade por cima da estrutura atual.

Diretriz central:

> Não simplificar a arquitetura. Simplificar a oferta.

Por dentro, o sistema continua robusto. Por fora, o usuário comum deve enxergar um fluxo direto:

> Cliente -> Tela -> Conteúdo -> Publicar

## Primeiro Nicho

O primeiro nicho comercial da V3x será:

> Telas comerciais para negócios locais.

Dentro desse nicho entram:

- Totens digitais.
- Anúncios em TVs e painéis.
- Restaurantes e cardápios digitais.
- Lancherias, cafés, bares e hamburguerias.
- Mercados pequenos, lojas e comunicação visual local.

Esse nicho foi escolhido porque parece ser o caminho mais rápido para vender, demonstrar valor e aproveitar a estrutura que o sistema já possui.

## Produto Inicial

Nome conceitual de trabalho:

- Totem Digital Display Manager.
- Totem Digital Menu & Ads.
- QuadraX Display Manager.

Promessa comercial:

> Controle suas TVs, totens e cardápios digitais de forma fácil, remota e profissional.

Mensagem para o cliente:

> Publique cardápios, promoções e anúncios nas suas telas em minutos.

## Princípio Norteador

A V3x deve ser guiada por esta meta:

> Um cliente novo deve conseguir publicar algo em uma tela real em menos de 5 minutos.

Tudo que dificultar essa meta deve ser escondido, automatizado, simplificado ou movido para modo avançado.

## Fluxo Ideal Para o Usuário

O usuário final não deve precisar entender inicialmente termos como `publisher`, `subscriber`, `contrato`, `plano`, `dispatcher`, `campanha` ou `playlist`.

Fluxo desejado:

1. Criar cliente ou estabelecimento.
2. Cadastrar tela, TV ou totem.
3. Escolher tipo de publicação: cardápio, anúncio, promoção ou comunicado.
4. Enviar mídia ou escolher template.
5. Publicar.

Por trás desse fluxo, o sistema pode criar ou usar automaticamente contratos, planos, playlists, campanhas e vínculos técnicos.

## Complexidade Como Bastidor

Os recursos avançados atuais não devem ser removidos. Eles devem ficar como bastidor ou modo avançado.

Devem ficar menos visíveis no primeiro uso:

- Contratos complexos.
- Planos técnicos.
- Dispatcher detalhado.
- Permissões avançadas.
- Status internos.
- Configurações técnicas.
- Campos administrativos que não ajudam a primeira publicação.

Devem continuar disponíveis para administração:

- Planos e contratos.
- Limites e cotas.
- Regras de acesso.
- Campanhas avançadas.
- Playlists detalhadas.
- Auditoria e logs.
- Configurações do sistema.

## Evolução Por Módulos

A visão da V3x é evoluir o produto por módulos.

O núcleo inicial deve ser simples e vendável:

> Cliente, tela, conteúdo e publicação rápida.

Módulos atuais e futuros:

- Módulo Cardápio Digital: produtos, categorias, preços, combos, promoções e horários.
- Módulo Anúncios / Mídia Indoor: campanhas, playlists, agendamentos e grupos de telas.
- Módulo Totens: telas verticais, paisagem/retrato, ativação por código e operação em quiosques.
- Módulo Contratos e Planos: limites, cobranças, franquias, permissões e quotas.
- Módulo Monitoramento: online/offline, última conexão, saúde do player e armazenamento.
- Módulo IA Futuro: criação de artes, sugestões, analytics e automação.
- Módulo Enterprise Futuro: multiempresa, APIs, integrações, relatórios avançados e edge/cache distribuído.

Frase de orientação:

> A V3x entrega publicação simples e confiável. Os módulos adicionam poder conforme o cliente cresce.

## Prioridades Da V3x

1. Publicação rápida.
2. Cadastro simplificado de cliente.
3. Cadastro simplificado de tela ou totem.
4. Templates comerciais para cardápio, promoção, anúncio e comunicado.
5. Player confiável, com cache, reconexão, autostart e tolerância a falhas.
6. Dashboard comercial com telas online, conteúdos publicados, clientes ativos e armazenamento usado.
7. Modo avançado para contratos, planos, campanhas, permissões e regras técnicas.

## O Que Evitar Agora

Para não dispersar a evolução do produto, a V3x deve evitar priorizar no curto prazo:

- IA complexa.
- Analytics avançado.
- Visão computacional.
- Reconhecimento facial.
- Holografia.
- Múltiplos módulos futuristas antes do produto base estar vendável.

Esses itens podem ser diferenciais premium futuros, mas não devem atrasar pilotos reais.

## Estratégia Comercial Inicial

A primeira oferta deve ser simples:

> Sistema para publicar cardápios, promoções e anúncios em TVs e totens.

Mercado inicial:

- Restaurantes.
- Lancherias.
- Cafés.
- Bares.
- Pequenos mercados.
- Lojas locais.
- Recepções e ambientes comerciais.

Modelo de venda sugerido:

- Taxa inicial de instalação, configuração e treinamento.
- Mensalidade por tela ou por faixa de telas.
- Serviços opcionais de criação de artes, templates, suporte e instalação de hardware.

## Critério De Sucesso

A V3x será bem-sucedida se conseguir:

- Demonstrar valor em uma TV ou totem real rapidamente.
- Reduzir o esforço do cliente para publicar conteúdo.
- Esconder complexidade técnica no primeiro uso.
- Operar de forma estável e confiável.
- Gerar pilotos reais e cases comerciais.

## Conclusão

A decisão estratégica é não abandonar a visão grande do projeto, mas organizar sua evolução.

A V3x deve transformar o Totem Digital em um produto vendável primeiro, mantendo a arquitetura atual como vantagem competitiva.

Resumo final:

> A V3x não é uma reconstrução. É o empacotamento comercial da base técnica atual para criar um produto simples, modular e escalável.
