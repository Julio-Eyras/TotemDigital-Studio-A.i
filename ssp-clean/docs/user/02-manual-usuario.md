# Manual do Usuário - SmartSignage Pro

## Índice

1. [Primeiros Passos](#primeiros-passos)
2. [Gerenciamento de Campanhas](#gerenciamento-de-campanhas)
3. [Gerenciamento de Playlists](#gerenciamento-de-playlists)
4. [Gerenciamento de Mídias](#gerenciamento-de-mídias)
5. [Gerenciamento de Totens](#gerenciamento-de-totens)
6. [Relatórios e Analytics](#relatórios-e-analytics)
7. [Configurações](#configurações)

## Primeiros Passos

### Login no Sistema

1. Acesse a URL do sistema (ex: `http://192.168.1.110`)
2. Informe seu **email** e **senha**
3. Se 2FA estiver habilitado, informe o código de autenticação
4. Clique em **Entrar**

### Dashboard

Após login, você verá o dashboard com:
- **Resumo de campanhas**: Ativas, pausadas, concluídas
- **Totens online/offline**: Status dos dispositivos
- **Estatísticas**: Impressões, visualizações, erros
- **Atividades recentes**: Últimas ações do sistema

## Gerenciamento de Campanhas

### Criar Nova Campanha

1. Acesse **Campanhas** → **Nova Campanha**
2. Preencha os campos:
   - **Título**: Nome da campanha
   - **Data Início**: Data de início da exibição
   - **Data Fim**: Data de término
   - **Horário**: Início e fim do horário diário (opcional)
   - **Dias da Semana**: Selecione os dias (opcional)
   - **Prioridade**: 0-100 (padrão: 50)
3. Selecione **Playlist(s)** para a campanha
4. Vincule **Totens** ou **Publishers**:
   - **Direto**: Selecione totens específicos
   - **Via Publisher**: Selecione publishers (grupos de totens)
5. Clique em **Salvar**

### Status da Campanha

- **Rascunho (draft)**: Campanha criada mas não submetida
- **Aguardando Aprovação (pending_approval)**: Aguardando aprovação do publisher
- **Ativa (active)**: Campanha aprovada e em exibição
- **Pausada (paused)**: Temporariamente pausada
- **Concluída (completed)**: Período de exibição finalizado
- **Rejeitada (rejected)**: Rejeitada pelo publisher

### Editar Campanha

1. Acesse **Campanhas** → Selecione a campanha
2. Clique em **Editar**
3. Modifique os campos desejados
4. Clique em **Salvar**

**Nota**: Campanhas ativas podem ser editadas, mas mudanças podem levar alguns minutos para refletir nos totens.

## Gerenciamento de Playlists

### Criar Nova Playlist

1. Acesse **Playlists** → **Nova Playlist**
2. Informe o **Nome** da playlist
3. Adicione **Descrição** (opcional)
4. Clique em **Adicionar Mídias**
5. Selecione mídias aprovadas da biblioteca
6. Arraste para reordenar (ou use os botões ↑↓)
7. Configure a **Duração** de cada item (em segundos)
8. Clique em **Salvar**

### Ordem de Exibição

- Itens são exibidos na ordem definida (`order_index`)
- Use os botões ↑↓ ou arraste para reordenar
- A ordem é salva automaticamente

### Duração dos Itens

- **Vídeos**: Duração padrão = duração do arquivo
- **Imagens**: Duração padrão = 10 segundos (configurável)
- **HTML5**: Duração padrão = 30 segundos (configurável)

## Gerenciamento de Mídias

### Upload de Mídia

1. Acesse **Mídias** → **Upload**
2. Selecione o arquivo (vídeo, imagem ou HTML5)
3. Preencha:
   - **Nome**: Nome da mídia
   - **Descrição**: Descrição opcional
   - **Categoria**: Categoria para organização
4. Clique em **Upload**

### Formatos Suportados

- **Vídeo**: MP4, WebM, MOV
- **Imagem**: JPG, PNG, GIF, WebP
- **HTML5**: Arquivos HTML, ZIP com HTML

### Aprovação de Mídia

**Para Publishers:**
1. Acesse **Mídias** → **Pendentes**
2. Revise cada mídia
3. Clique em **Aprovar** ou **Rejeitar**
4. Se rejeitar, informe o motivo

**Status:**
- **Pendente (pending)**: Aguardando aprovação
- **Processando (processing)**: Processando arquivo
- **Aprovada (approved)**: Aprovada, pode ser usada
- **Publicada (published)**: Publicada e disponível
- **Rejeitada (rejected)**: Rejeitada, não pode ser usada

## Gerenciamento de Totens

### Cadastrar Totem

1. Acesse **Totens** → **Novo Totem**
2. Preencha:
   - **Nome**: Nome do totem
   - **UIN**: Identificador único (ex: UIN-SHOPPING-001-2025)
   - **Local**: Selecione o local
   - **Descrição**: Descrição opcional
3. Clique em **Salvar**

### Status do Totem

- **Online**: Totem conectado e funcionando
- **Offline**: Totem desconectado
- **Erro**: Totem com problemas
- **Manutenção**: Totem em manutenção

### Monitoramento

- **Último Heartbeat**: Última comunicação do totem
- **Playlist Atual**: Playlist sendo exibida
- **Estatísticas**: Impressões, erros, uptime

### Comandos Remotos

1. Acesse **Totens** → Selecione o totem → **Comandos**
2. Selecione o tipo de comando:
   - **Restart**: Reiniciar player
   - **Reboot**: Reiniciar dispositivo
   - **Update**: Atualizar software
   - **Clear Cache**: Limpar cache local
3. Clique em **Enviar**

## Relatórios e Analytics

### Relatório de Campanhas

1. Acesse **Relatórios** → **Campanhas**
2. Selecione período (data início/fim)
3. Selecione campanha(s) específica(s) ou todas
4. Clique em **Gerar Relatório**

**Métricas:**
- Impressões (quantas vezes foi exibida)
- Visualizações completas
- Taxa de conclusão
- Erros de reprodução

### Relatório de Totens

1. Acesse **Relatórios** → **Totens**
2. Selecione totem(s) ou todos
3. Selecione período
4. Clique em **Gerar Relatório**

**Métricas:**
- Uptime (tempo online)
- Total de impressões
- Erros e problemas
- Campanhas exibidas

### Exportação

- Relatórios podem ser exportados em **CSV** ou **PDF**
- Clique em **Exportar** após gerar o relatório

## Configurações

### Perfil do Usuário

1. Clique no seu nome (canto superior direito)
2. Selecione **Perfil**
3. Edite:
   - Nome, email, telefone
   - Foto de perfil
   - Preferências de notificação
4. Clique em **Salvar**

### Configurações do Sistema (Admin)

1. Acesse **Configurações** → **Sistema**
2. Configure:
   - **Limites de Upload**: Tamanho máximo de arquivos
   - **Cache**: Tempo de cache do dispatcher
   - **Notificações**: Configurações de email/SMS
   - **Integrações**: APIs externas

## Dicas e Boas Práticas

### Campanhas
- Use **prioridades** para controlar qual campanha é exibida quando há conflito
- Configure **horários** específicos para campanhas sazonais
- Use **publishers** para aplicar campanha a múltiplos totens de uma vez

### Playlists
- Mantenha playlists **curtas** (5-10 itens) para melhor performance
- Use **durações adequadas** para cada tipo de mídia
- Teste playlists antes de vincular a campanhas ativas

### Mídias
- **Otimize vídeos** antes do upload (compressão adequada)
- Use **resoluções padrão** (1920x1080 para vídeos)
- **Nomeie arquivos** de forma descritiva

### Totens
- **Monitore** status dos totens regularmente
- Configure **alertas** para totens offline
- Use **comandos remotos** para manutenção sem acesso físico

## Próximos Passos

- [Tutoriais](./04-tutoriais.md) - Passo a passo detalhado
- [FAQ](./03-faq.md) - Perguntas frequentes
