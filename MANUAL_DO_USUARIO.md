# Manual do Usuário - SmartSignage Pro v2.1

**Versão:** 2.1.0  
**Data:** Dezembro 2025

---

## 📋 Índice

1. [Introdução](#introdução)
2. [Conceitos Fundamentais](#conceitos-fundamentais)
3. [Primeiros Passos](#primeiros-passos)
4. [Gerenciando Anunciantes (Subscribers)](#gerenciando-anunciantes-subscribers)
5. [Gerenciando Publicadores (Publishers)](#gerenciando-publicadores-publishers)
6. [Gerenciando Campanhas](#gerenciando-campanhas)
7. [Gerenciando Mídias](#gerenciando-mídias)
8. [Gerenciando Playlists](#gerenciando-playlists)
9. [Gerenciando Totens e Smart TVs](#gerenciando-totens-e-smart-tvs)
10. [Analytics e Relatórios](#analytics-e-relatórios)
11. [Billing e Cobranças](#billing-e-cobranças)
12. [FAQ - Perguntas Frequentes](#faq---perguntas-frequentes)

---

## Introdução

O **SmartSignage Pro** é uma plataforma completa de sinalização digital que permite gerenciar campanhas publicitárias em múltiplos locais, totens e Smart TVs de forma centralizada e intuitiva.

### O que você pode fazer com o SmartSignage Pro?

- ✅ Criar e gerenciar campanhas publicitárias
- ✅ Upload e organização de mídias (imagens, vídeos, HTML5)
- ✅ Criar playlists personalizadas
- ✅ Gerenciar totens e Smart TVs remotamente
- ✅ Visualizar analytics e relatórios detalhados
- ✅ Controlar billing e cobranças
- ✅ Gerenciar múltiplos anunciantes e publicadores

---

## Conceitos Fundamentais

### 1. Subscribers (Anunciantes/Assinantes)

**Subscribers** são os anunciantes que compram espaço publicitário na plataforma para exibir suas campanhas. Eles pagam pela utilização do sistema e pela publicação de seus conteúdos.

**Exemplo:** Uma empresa de restaurantes que quer exibir seus anúncios em totens de shopping centers.

### 2. Publishers (Publicadores)

**Publishers** são os proprietários dos totens e Smart TVs que disponibilizam seus displays para exibir campanhas publicitárias. Eles recebem uma porcentagem da receita (revenue share) das campanhas exibidas.

**Exemplo:** Um shopping center que possui totens instalados e deseja monetizar exibindo anúncios.

### 3. Locals (Locais)

**Locals** são os locais físicos onde os totens estão instalados. Um publisher pode ter múltiplos locals.

**Exemplo:** Entrada principal do shopping, praça de alimentação, área do cinema.

### 4. Totens

**Totens** são os micro-servidores edge que controlam as Smart TVs. Cada totem está associado a um local específico.

### 5. Smart TVs

**Smart TVs** são os displays físicos controlados pelos totens. Cada Smart TV está conectada a um totem.

### 6. Campanhas

**Campanhas** são conjuntos organizados de conteúdo publicitário criados por subscribers para serem exibidos em totens específicos.

### 7. Mídias

**Mídias** são os arquivos de conteúdo (imagens, vídeos, HTML5) que compõem as campanhas.

### 8. Playlists

**Playlists** são sequências ordenadas de mídias que podem ser atreladas a uma ou mais campanhas, que serão reproduzidas nos totens. 

**Como funcionam:**

1. **Criação de Playlists:** Playlists são criadas de forma independente e funcionam como **candidatas** a serem usadas em campanhas. Uma playlist pode ser associada a uma ou múltiplas campanhas.

2. **Playlist do Totem:** A playlist final de cada totem é o **mix inteligente** de todas as playlists e campanhas atreladas a ele. O sistema combina automaticamente todas as campanhas ativas em um totem para criar uma única playlist de execução.

3. **Ordenação e Classificação:** As playlists dos totens são classificadas, ordenadas e/ou disparadas sob determinadas regras sistemáticas ou por **Inteligência Artificial**, incluindo:
   - **Tags** de conteúdo e contexto
   - **Reconhecimento de transeuntes** (detecção de público)
   - **Análise de sentimento** e contexto emocional
   - **Priorização** por campanha e subscriber
   - **Regras temporais** (horário, dia da semana)
   - E outras regras configuráveis

---

## Primeiros Passos

### Acessando o Sistema

1. Acesse a URL do sistema (fornecida pelo administrador)
2. Faça login com suas credenciais
3. Você será redirecionado para o dashboard principal

### Dashboard Principal

O dashboard exibe:
- 📊 Estatísticas gerais (totens ativos, campanhas, mídias)
- 📈 Gráficos de performance
- 🔔 Notificações e alertas
- ⚡ Acesso rápido às funcionalidades principais

---

## Gerenciando Anunciantes (Subscribers)

### Criando um Subscriber

1. Acesse **Subscribers** no menu lateral
2. Clique em **Novo Subscriber**
3. Preencha os dados:
   - Nome/Razão Social
   - Contato
   - Email
   - Telefone
   - WhatsApp (opcional)
   - Endereço
4. Clique em **Salvar**

### Editando um Subscriber

1. Acesse **Subscribers**
2. Clique no subscriber desejado
3. Clique em **Editar**
4. Faça as alterações necessárias
5. Clique em **Salvar**

### Desativando um Subscriber

1. Acesse **Subscribers**
2. Clique no subscriber desejado
3. Clique em **Desativar**
4. Confirme a ação

**Nota:** Subscribers desativados não podem criar novas campanhas, mas campanhas existentes continuam ativas até o término.

---

## Gerenciando Publicadores (Publishers)

### Criando um Publisher

1. Acesse **Publishers** no menu lateral
2. Clique em **Novo Publisher**
3. Preencha os dados:
   - Nome/Razão Social
   - Contato
   - Email
   - Telefone
   - Descrição
4. Selecione o tipo:
   - **Publisher**: Apenas publicador
   - **Subscriber**: Apenas anunciante
   - **Both**: Ambos
5. Clique em **Salvar**

### Adicionando Locais a um Publisher

1. Acesse **Publishers**
2. Clique no publisher desejado
3. Vá para a aba **Locais**
4. Clique em **Adicionar Local**
5. Preencha:
   - Nome do local
   - Endereço
   - Cidade, Estado, CEP
   - Coordenadas (latitude/longitude - opcional)
   - Descrição
6. Clique em **Salvar**

---

## Gerenciando Campanhas

### Criando uma Campanha

1. Acesse **Campanhas** no menu lateral
2. Clique em **Nova Campanha**
3. Preencha os dados básicos:
   - Nome da campanha
   - Subscriber (anunciante)
   - Data de início
   - Data de término
   - Descrição
4. Configure os totens/locais onde a campanha será exibida
5. **Associe playlists à campanha:**
   - Selecione uma ou mais playlists já criadas (candidatas)
   - Ou crie uma nova playlist durante a criação da campanha
6. Clique em **Salvar**

**Nota:** Você só pode associar playlists que pertencem ao mesmo subscriber da campanha.

### Ativando/Desativando uma Campanha

1. Acesse **Campanhas**
2. Clique na campanha desejada
3. Use o toggle **Ativo/Inativo**
4. Confirme a ação

### Visualizando Performance de uma Campanha

1. Acesse **Campanhas**
2. Clique na campanha desejada
3. Vá para a aba **Analytics**
4. Visualize:
   - Número de exibições
   - Totens que exibiram
   - Período de exibição
   - Métricas de engajamento

---

## Gerenciando Mídias

### Upload de Mídias

1. Acesse **Mídias** no menu lateral
2. Clique em **Upload**
3. Selecione o arquivo (imagem, vídeo ou HTML5)
4. Preencha os metadados:
   - Nome
   - Descrição
   - Tags (opcional)
   - Duração (para vídeos)
5. Clique em **Upload**

**Formatos Suportados:**
- **Imagens:** JPG, PNG, GIF, WebP
- **Vídeos:** MP4, WebM, HLS
- **HTML5:** Arquivos HTML, JS, CSS (compactados)

**Tamanho Máximo:** 100MB por arquivo

### Organizando Mídias

Você pode:
- Criar pastas/categorias
- Adicionar tags
- Filtrar por tipo, data, subscriber
- Buscar por nome ou descrição

### Editando Mídias

1. Acesse **Mídias**
2. Clique na mídia desejada
3. Clique em **Editar**
4. Altere os metadados
5. Clique em **Salvar**

**Nota:** Não é possível substituir o arquivo. Para alterar, faça um novo upload.

---

## Gerenciando Playlists

### O Que São Playlists?

**Playlists** são sequências ordenadas de mídias que podem ser atreladas a uma ou mais campanhas. Elas são criadas independentemente das campanhas e podem ser reutilizadas em múltiplas campanhas.

**Características:**
- ✅ Criadas antes ou durante a criação de campanhas
- ✅ Podem ser reutilizadas em múltiplas campanhas
- ✅ Podem existir sem estar associadas a nenhuma campanha (candidatas)
- ✅ Cada playlist pertence a um subscriber específico

**Como Funciona a Playlist do Totem:**

Quando um totem executa seu conteúdo, ele não reproduz playlists individuais, mas sim uma **playlist mixada** que combina:

1. **Todas as campanhas ativas** associadas ao totem
2. **Todas as playlists** dessas campanhas
3. **Ordenação inteligente** baseada em:
   - Regras sistemáticas (prioridade, horário, tags)
   - Inteligência Artificial (reconhecimento de transeuntes, sentimento, contexto)
   - Configurações de campanha e playlist

O sistema automaticamente combina tudo isso para criar uma experiência de reprodução otimizada e contextual.

### Criando uma Playlist

1. Acesse **Playlists** no menu lateral
2. Clique em **Nova Playlist**
3. Preencha:
   - Nome da playlist
   - Subscriber (proprietário da playlist)
   - Descrição
4. Adicione mídias:
   - Clique em **Adicionar Mídia**
   - Selecione as mídias
   - Arraste para ordenar
   - Configure duração de exibição (se aplicável)
5. Clique em **Salvar**

**Nota:** Após criar, a playlist estará disponível como **candidata** para ser associada a campanhas. Quando associada a campanhas que estão vinculadas a totens, essa playlist fará parte do mix de conteúdo reproduzido nos totens.

### Como a Playlist é Mixada no Totem

Quando você associa campanhas a um totem, o sistema:

1. **Coleta** todas as playlists de todas as campanhas ativas desse totem
2. **Aplica regras sistemáticas:**
   - Prioridade da campanha
   - Horários de execução
   - Tags de conteúdo
3. **Aplica Inteligência Artificial (quando disponível):**
   - Reconhecimento de transeuntes (ajusta conteúdo baseado no público presente)
   - Análise de sentimento (adapta o tom do conteúdo)
   - Contexto temporal e ambiental
4. **Gera a playlist final** do totem que será executada

### Ordenando Mídias em uma Playlist

1. Acesse a playlist
2. Arraste e solte as mídias na ordem desejada
3. As alterações são salvas automaticamente

### Aprovação de Playlists

Playlists podem precisar de aprovação antes de serem publicadas:

1. Após criar/editar uma playlist, ela ficará com status **Pendente**
2. Um administrador revisará a playlist
3. A playlist será aprovada ou rejeitada
4. Você receberá uma notificação sobre o status

---

## Gerenciando Totens e Smart TVs

### Visualizando Totens

1. Acesse **Totens** no menu lateral
2. Visualize a lista de todos os totens
3. Filtre por:
   - Publisher
   - Local
   - Status (online/offline)
   - Campanhas ativas

### Status dos Totens

- 🟢 **Online**: Totem conectado e funcionando
- 🔴 **Offline**: Totem desconectado
- 🟡 **Erro**: Totem com problemas
- 🔵 **Manutenção**: Totem em manutenção
- 🟣 **Sincronizando**: Totem sincronizando conteúdo

### Visualizando Smart TVs

1. Acesse **Totens**
2. Clique em um totem
3. Vá para a aba **Smart TVs**
4. Visualize todas as TVs conectadas ao totem

### Controle Remoto

Você pode enviar comandos remotos para totens:

1. Acesse o totem desejado
2. Clique em **Controle Remoto**
3. Selecione o comando:
   - Reiniciar
   - Atualizar conteúdo
   - Obter status
   - Alterar configurações
4. Confirme o comando

---

## Analytics e Relatórios

### Dashboard de Analytics

O dashboard exibe:
- 📊 Total de exibições
- 👥 Totens ativos
- 📅 Campanhas em execução
- 💰 Receita gerada
- 📈 Gráficos de tendência

### Relatórios Disponíveis

1. **Relatório de Campanhas**
   - Performance por campanha
   - Totens que exibiram
   - Período de exibição

2. **Relatório de Totens**
   - Status de cada totem
   - Campanhas exibidas
   - Tempo de atividade

3. **Relatório de Mídias**
   - Mídias mais visualizadas
   - Performance por tipo
   - Engajamento

4. **Relatório de Subscribers**
   - Campanhas por subscriber
   - Receita gerada
   - Uso do sistema

### Exportando Relatórios

1. Acesse **Relatórios**
2. Selecione o tipo de relatório
3. Configure os filtros (data, subscriber, totem, etc.)
4. Clique em **Gerar Relatório**
5. Clique em **Exportar** (PDF, Excel, CSV)

---

## Billing e Cobranças

### Billing de Subscribers (Anunciantes)

Subscribers são cobrados por:
- Criação de campanhas
- Upload de mídias
- Armazenamento
- Exibição de campanhas

**Visualizando Faturas:**

1. Acesse **Billing > Subscriber Billing**
2. Visualize todas as faturas
3. Filtre por:
   - Subscriber
   - Status (pendente/pago/falhou)
   - Período
4. Clique em uma fatura para ver detalhes

### Billing de Publishers (Publicadores)

Publishers recebem revenue share (percentual da receita) por exibir campanhas.

**Visualizando Receitas:**

1. Acesse **Billing > Publisher Billing**
2. Visualize todos os pagamentos
3. Filtre por:
   - Publisher
   - Status (pendente/pago)
   - Período
4. Veja o revenue share por campanha

### Contratos

Contratos podem ser associados a:
- Subscribers (contratos de anúncio)
- Publishers (contratos de revenue share)

**Gerenciando Contratos:**

1. Acesse **Contratos**
2. Clique em **Novo Contrato**
3. Preencha:
   - Tipo (subscriber/publisher)
   - Entidade relacionada
   - Data de início/término
   - Termos e condições
   - Upload de documento (PDF/DOC)
4. Clique em **Salvar**

---

## FAQ - Perguntas Frequentes

### Como faço para criar minha primeira campanha?

1. Crie/verifique se existe um subscriber
2. Faça upload das mídias necessárias
3. Crie uma playlist com essas mídias (a playlist será uma candidata)
4. Crie a campanha e associe a playlist criada aos totens desejados

**Fluxo:** Mídias → Playlist (candidata) → Campanha → Totens

### Posso editar uma campanha que já está em execução?

Sim, mas as alterações podem levar alguns minutos para serem aplicadas nos totens.

### Como sei se um totem está funcionando?

Acesse **Totens** e verifique o status. Totens online aparecem em verde, offline em vermelho.

### Posso cancelar uma campanha antes do término?

Sim. Acesse a campanha e clique em **Desativar**. A campanha será removida dos totens nas próximas horas.

### Como faço para pagar uma fatura?

Faturas podem ser pagas via cartão de crédito, transferência bancária ou PIX, dependendo das opções disponíveis na sua conta.

### O que acontece se um totem ficar offline?

O sistema continuará tentando sincronizar quando o totem voltar online. Campanhas agendadas serão exibidas assim que o totem estiver disponível.

### Posso usar minhas próprias mídias?

Sim! Faça upload das suas mídias no formato suportado. O sistema aceita imagens, vídeos e conteúdo HTML5 interativo.

### Como funciona o revenue share para publishers?

Publishers recebem um percentual da receita das campanhas exibidas em seus totens. O percentual é definido no contrato.

### Posso criar playlists com conteúdo HTML5 interativo?

Sim! O sistema suporta conteúdo HTML5. Faça upload dos arquivos (HTML, CSS, JS) e eles serão reproduzidos nos totens.

### Como contato o suporte?

Entre em contato através do email de suporte fornecido pelo administrador ou use o sistema de tickets dentro da plataforma.

---

## Glossário

- **Subscriber**: Anunciante/Assinante que compra espaço publicitário
- **Publisher**: Proprietário de totens que disponibiliza displays
- **Local**: Local físico onde totens estão instalados
- **Totem**: Micro-servidor edge que controla Smart TVs
- **Smart TV**: Display físico controlado por totem
- **Campanha**: Conjunto organizado de conteúdo publicitário que associa playlists a totens
- **Mídia**: Arquivo de conteúdo (imagem, vídeo, HTML5)
- **Playlist**: Sequência ordenada de mídias que funciona como candidata para ser usada em campanhas
- **Revenue Share**: Percentual da receita pago a publishers
- **Billing**: Sistema de cobranças e pagamentos

---

**Última Atualização:** Dezembro 2025  
**Versão do Manual:** 2.1.0

Para mais informações técnicas, consulte o **Manual Técnico**.

