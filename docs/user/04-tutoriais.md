# Tutoriais - SmartSignage Pro

## Índice de Tutoriais

1. [Criar sua Primeira Campanha](#criar-sua-primeira-campanha)
2. [Upload e Organização de Mídias](#upload-e-organização-de-mídias)
3. [Configurar Agendamento Avançado](#configurar-agendamento-avançado)
4. [Gerenciar Múltiplos Totens](#gerenciar-múltiplos-totens)
5. [Criar Relatórios Personalizados](#criar-relatórios-personalizados)

## Criar sua Primeira Campanha

### Passo 1: Preparar Mídias

1. Acesse **Mídias** → **Upload**
2. Faça upload de vídeos/imagens
3. Aguarde aprovação do publisher
4. Verifique status: **Aprovada** ou **Publicada**

### Passo 2: Criar Playlist

1. Acesse **Playlists** → **Nova Playlist**
2. Nome: "Minha Primeira Playlist"
3. Clique em **Adicionar Mídias**
4. Selecione mídias aprovadas
5. Reordene arrastando ou usando ↑↓
6. Configure duração de cada item
7. Clique em **Salvar**

### Passo 3: Criar Campanha

1. Acesse **Campanhas** → **Nova Campanha**
2. Preencha:
   - Título: "Campanha de Lançamento"
   - Data Início: Hoje
   - Data Fim: Daqui a 30 dias
   - Horário: 08:00 - 22:00
   - Dias: Segunda a Domingo
3. Selecione a playlist criada
4. Selecione totens ou publishers
5. Prioridade: 50
6. Clique em **Salvar**

### Passo 4: Submeter para Aprovação

1. Na página da campanha, clique em **Submeter para Aprovação**
2. Aguarde aprovação do publisher
3. Status mudará para **Ativa** quando aprovada

### Passo 5: Verificar Exibição

1. Acesse o totem (URL: `http://servidor/player/?uin=UIN-DO-TOTEM`)
2. Verifique se o conteúdo está sendo exibido
3. Monitore eventos em **Analytics** → **Eventos**

## Upload e Organização de Mídias

### Upload em Lote

1. Acesse **Mídias** → **Upload**
2. Selecione múltiplos arquivos (Ctrl+Click)
3. Preencha informações comuns:
   - Categoria: "Promoções"
   - Descrição: "Campanha Verão 2026"
4. Clique em **Upload Todos**

### Organizar por Pastas/Categorias

1. Use o campo **Categoria** ao fazer upload
2. Filtre por categoria em **Mídias** → Filtros
3. Crie tags personalizadas (se disponível)

### Otimização de Vídeos

**Antes do Upload:**
- Resolução: 1920x1080 (Full HD)
- Formato: MP4 (H.264)
- Bitrate: 5-10 Mbps
- Duração: 15-60 segundos (recomendado)

**Ferramentas:**
- **FFmpeg**: `ffmpeg -i input.mp4 -c:v libx264 -crf 23 -preset medium output.mp4`
- **HandBrake**: Interface gráfica para conversão

## Configurar Agendamento Avançado

### Campanha com Horários Específicos

1. Crie campanha normalmente
2. Configure **Horário Início**: 09:00
3. Configure **Horário Fim**: 18:00
4. Selecione **Dias da Semana**: Segunda a Sexta
5. Salve

**Resultado**: Campanha exibe apenas em dias úteis, das 9h às 18h.

### Múltiplas Campanhas com Prioridades

**Cenário**: Campanha Premium (manhã) + Campanha Standard (tarde)

1. **Campanha Premium**:
   - Horário: 08:00 - 12:00
   - Prioridade: 80
   - Totens: Todos

2. **Campanha Standard**:
   - Horário: 12:00 - 22:00
   - Prioridade: 50
   - Totens: Todos

**Resultado**: Dispatcher seleciona Premium pela manhã (maior prioridade) e Standard à tarde.

### Campanha Sazonal

1. Crie campanha com período longo (ex: 3 meses)
2. Configure dias específicos (ex: apenas finais de semana)
3. Use horários específicos (ex: 10:00 - 20:00)
4. Vincule a múltiplos totens via publisher

## Gerenciar Múltiplos Totens

### Cadastro em Lote

1. Prepare planilha CSV com:
   ```
   nome,uin,local_id
   Totem Loja 1,UIN-SHOPPING-001-2025,1
   Totem Loja 2,UIN-SHOPPING-002-2025,1
   ```

2. Use importação em massa (se disponível) ou cadastre manualmente

### Agrupar por Publisher

1. Crie **Publisher**: "Shopping Center ABC"
2. Crie **Locais** dentro do publisher: "Loja 1", "Loja 2", etc.
3. Vincule totens aos locais
4. Ao criar campanha, vincule ao **Publisher** (aplica a todos os totens)

### Monitoramento Centralizado

1. Acesse **Dashboard**
2. Visualize status de todos os totens
3. Use filtros por publisher/local
4. Configure alertas para totens offline

## Criar Relatórios Personalizados

### Relatório de Campanha

1. Acesse **Relatórios** → **Campanhas**
2. Selecione período: Últimos 30 dias
3. Selecione campanha específica
4. Clique em **Gerar**

**Métricas Disponíveis:**
- Total de impressões
- Visualizações completas
- Taxa de conclusão
- Erros de reprodução
- Totens que exibiram

### Relatório de Totem

1. Acesse **Relatórios** → **Totens**
2. Selecione totem específico
3. Período: Última semana
4. Clique em **Gerar**

**Métricas Disponíveis:**
- Uptime (% tempo online)
- Total de impressões
- Campanhas exibidas
- Erros e problemas
- Horários de pico

### Exportar Dados

1. Gere relatório
2. Clique em **Exportar**
3. Escolha formato: **CSV** ou **PDF**
4. Download automático

### Análise Avançada

1. Exporte dados em CSV
2. Importe em Excel/Google Sheets
3. Crie gráficos personalizados
4. Compare períodos diferentes

## Dicas Avançadas

### Performance

- **Playlists Curtas**: 5-10 itens para melhor performance
- **Cache**: Player cacheia mídias automaticamente
- **Otimização**: Comprima vídeos antes do upload

### Organização

- **Nomenclatura**: Use nomes descritivos (ex: "Promoção-Verão-2026-V1")
- **Categorias**: Organize mídias por categoria
- **Tags**: Use tags para busca rápida

### Troubleshooting

- **Totem Offline**: Verifique conexão de rede e status do player
- **Conteúdo Não Aparece**: Verifique aprovação e período da campanha
- **Erros de Reprodução**: Verifique formato e integridade da mídia

## Próximos Passos

- [Manual do Usuário](./02-manual-usuario.md) - Referência completa
- [FAQ](./03-faq.md) - Perguntas frequentes
