# Modelo CRUD Subscriber (Assinante) - Proposta

## 📋 Entendimento do Requisito

O usuário quer modelar o CRUD do **Subscriber (Assinante)** de forma similar ao **Publisher**, mas com contexto diferente:

### Publisher tem:
- **Informações** (dados básicos)
- **Locais** (locais físicos)
- **Totens** (players físicos)
- **Smart TVs** (telas físicas)

### Subscriber terá:
- **Informações** (dados básicos da tabela `subscribers`)
- **Mídias** (arquivos carregados: vídeos, imagens, HTML, etc.)
- **Playlists** (organização de mídias segundo critérios)
- **Campanhas** (campanhas publicitárias com mídias e/ou playlists)

---

## 🏗️ Estrutura Proposta

### 1. **Tela Principal (Lista de Subscribers)**

**Conteúdo:**
- Lista todos os subscribers da tabela `subscribers`
- Campos exibidos:
  - `name` (Nome/Razão Social)
  - `contact_name` (Nome do Contato)
  - `email`
  - `phone`, `whatsapp`
  - `address`
  - `description`
  - `is_active` (Status: Ativo/Inativo)
  - `created_at`, `updated_at`

**Funcionalidades:**
- Busca/filtro por nome, email, etc.
- Filtro por status (ativo/inativo)
- Botão "Adicionar Assinante"
- Botão "Editar" em cada card
- Botão "Detalhes" em cada card
- Botão "Excluir" (com confirmação)

---

### 2. **Dialog de Criação/Edição com Abas**

#### **Aba 1: Informações** (Tab 0)
**Conteúdo:**
- Formulário com todos os campos da tabela `subscribers`:
  - Nome/Razão Social (`name`) *
  - Nome do Contato (`contact_name`)
  - Email (`email`)
  - Telefone (`phone`)
  - WhatsApp (`whatsapp`)
  - Endereço (`address`)
  - Descrição (`description`)
  - Status (`is_active`)

**Funcionalidades:**
- Validação de campos obrigatórios
- Salvar/Cancelar

---

#### **Aba 2: Mídias** (Tab 1)
**Conteúdo:**
- Lista de mídias do subscriber (tabela `medias` onde `subscriber_id = subscriber.subscriber_id`)
- Formulário para adicionar/editar mídia:
  - Upload de arquivo (vídeo, imagem, HTML, etc.)
  - Nome (`name`) *
  - Descrição (`description`)
  - Tags (`tags[]`)
  - Status (`status`: draft, pending_approval, approved, rejected, archived)
  - Metadados adicionais

**Funcionalidades:**
- **Adicionar Mídia**: Upload de arquivo + preenchimento de dados
- **Editar Mídia**: Editar dados da mídia (não re-upload)
- **Excluir Mídia**: Remover mídia (com confirmação)
- **Visualizar Mídia**: Preview/thumbnail
- **Filtros**: Por tipo (video, image, html, etc.), por status
- **Validação**: Verificar se mídia pertence ao subscriber

**Relacionamento:**
- `medias.subscriber_id` → `subscribers.subscriber_id` (1:N)

---

#### **Aba 3: Playlists** (Tab 2)
**Conteúdo:**
- Lista de playlists do subscriber (tabela `playlists` onde `subscriber_id = subscriber.subscriber_id`)
- Formulário para adicionar/editar playlist:
  - Nome (`name`) *
  - Descrição (`description`)
  - Status (`is_active`)
  - Configurações de agendamento (`schedule_config` JSONB)
  - **Gerenciamento de Itens da Playlist**:
    - Lista de mídias disponíveis (do subscriber)
    - Adicionar mídia à playlist (criar registro em `playlist_items`)
    - Ordenar itens (drag & drop ou campo `order_index`)
    - Configurar duração de exibição (`display_seconds`)
    - Configurar horários específicos (`start_time`, `end_time`, `days_of_week`)

**Funcionalidades:**
- **Adicionar Playlist**: Criar nova playlist
- **Editar Playlist**: Editar dados da playlist
- **Excluir Playlist**: Remover playlist (com confirmação)
- **Gerenciar Itens**: Adicionar/remover/reordenar mídias na playlist
- **Validação**: Verificar se playlist e mídias pertencem ao subscriber

**Relacionamentos:**
- `playlists.subscriber_id` → `subscribers.subscriber_id` (1:N)
- `playlist_items.playlist_id` → `playlists.playlist_id` (1:N)
- `playlist_items.media_id` → `medias.media_id` (N:1)
- Mídias devem pertencer ao mesmo subscriber da playlist

---

#### **Aba 4: Campanhas** (Tab 3)
**Conteúdo:**
- Lista de campanhas do subscriber (tabela `campaigns` onde `subscriber_id = subscriber.subscriber_id`)
- Formulário para adicionar/editar campanha:
  - Título (`title`) *
  - Descrição (`description`)
  - Tipo (`campaign_type`: general, scheduled, interactive, recurring)
  - Prioridade (`priority`: 1-10)
  - Camada Comercial (`commercial_tier`: premium, standard, remnant)
  - Datas (`start_date`, `end_date`)
  - Horários (`start_time`, `end_time`)
  - Dias da Semana (`days_of_week` JSON)
  - Status (`status`: draft, pending_approval, approved, active, paused, finished, deleted)
  - Público-alvo (`target_audience` JSONB)
  - **Gerenciamento de Conteúdo**:
    - **Mídias Individuais**: Adicionar mídias diretamente à campanha (via `campaign_medias`)
      - Selecionar mídias do subscriber
      - Configurar duração, ordem, prioridade
      - Configurar agendamento específico
    - **Playlists**: Adicionar playlists à campanha (via `campaign_playlists`)
      - Selecionar playlists do subscriber
      - Configurar prioridade

**Funcionalidades:**
- **Adicionar Campanha**: Criar nova campanha
- **Editar Campanha**: Editar dados da campanha
- **Excluir Campanha**: Remover campanha (com confirmação)
- **Gerenciar Mídias**: Adicionar/remover mídias individuais
- **Gerenciar Playlists**: Adicionar/remover playlists
- **Validação**: Verificar se campanha, mídias e playlists pertencem ao subscriber

**Relacionamentos:**
- `campaigns.subscriber_id` → `subscribers.subscriber_id` (1:N)
- `campaign_medias.campaign_id` → `campaigns.campaign_id` (N:M)
- `campaign_medias.media_id` → `medias.media_id` (N:M)
- `campaign_playlists.campaign_id` → `campaigns.campaign_id` (N:M)
- `campaign_playlists.playlist_id` → `playlists.playlist_id` (N:M)

---

## 📊 Diagrama de Relacionamentos

```
SUBSCRIBERS (1)
  │
  ├── (1:N) MEDIAS
  │     └── (N:1) PLAYLIST_ITEMS
  │           └── (N:1) PLAYLISTS (1:N com SUBSCRIBERS)
  │
  ├── (1:N) PLAYLISTS
  │     ├── (1:N) PLAYLIST_ITEMS
  │     │     └── (N:1) MEDIAS
  │     └── (N:M) CAMPAIGN_PLAYLISTS
  │           └── (N:1) CAMPAIGNS
  │
  └── (1:N) CAMPAIGNS
        ├── (N:M) CAMPAIGN_MEDIAS
        │     └── (N:1) MEDIAS
        └── (N:M) CAMPAIGN_PLAYLISTS
              └── (N:1) PLAYLISTS
```

---

## 🎯 Funcionalidades por Aba

### **Aba Mídias**
- ✅ Listar mídias do subscriber
- ✅ Upload de arquivo (vídeo, imagem, HTML, etc.)
- ✅ Editar metadados da mídia
- ✅ Excluir mídia
- ✅ Preview/thumbnail
- ✅ Filtros (tipo, status)
- ✅ Validação de ownership

### **Aba Playlists**
- ✅ Listar playlists do subscriber
- ✅ Criar/editar/excluir playlist
- ✅ Adicionar mídias à playlist (arrastar e soltar ou seleção)
- ✅ Reordenar itens (drag & drop)
- ✅ Configurar duração de exibição por item
- ✅ Configurar agendamento por item
- ✅ Validação: mídias devem pertencer ao subscriber

### **Aba Campanhas**
- ✅ Listar campanhas do subscriber
- ✅ Criar/editar/excluir campanha
- ✅ Adicionar mídias individuais à campanha
- ✅ Adicionar playlists à campanha
- ✅ Configurar agendamento da campanha
- ✅ Configurar público-alvo
- ✅ Configurar prioridade e camada comercial
- ✅ Validação: mídias e playlists devem pertencer ao subscriber

---

## 🔧 APIs Necessárias

### **Mídias**
- `GET /api/subscribers/:id/medias` - Listar mídias do subscriber
- `POST /api/media` - Criar mídia (upload + dados)
- `PUT /api/media/:id` - Atualizar mídia
- `DELETE /api/media/:id` - Excluir mídia
- `GET /api/media/:id` - Obter detalhes da mídia

### **Playlists**
- `GET /api/subscribers/:id/playlists` - Listar playlists do subscriber
- `POST /api/playlists` - Criar playlist
- `PUT /api/playlists/:id` - Atualizar playlist
- `DELETE /api/playlists/:id` - Excluir playlist
- `GET /api/playlists/:id/items` - Listar itens da playlist
- `POST /api/playlists/:id/items` - Adicionar item à playlist
- `PUT /api/playlists/:id/items/:itemId` - Atualizar item
- `DELETE /api/playlists/:id/items/:itemId` - Remover item
- `PUT /api/playlists/:id/items/reorder` - Reordenar itens

### **Campanhas**
- `GET /api/subscribers/:id/campaigns` - Listar campanhas do subscriber
- `POST /api/campaigns` - Criar campanha
- `PUT /api/campaigns/:id` - Atualizar campanha
- `DELETE /api/campaigns/:id` - Excluir campanha
- `GET /api/campaigns/:id/medias` - Listar mídias da campanha
- `POST /api/campaigns/:id/medias` - Adicionar mídia à campanha
- `DELETE /api/campaigns/:id/medias/:mediaId` - Remover mídia
- `GET /api/campaigns/:id/playlists` - Listar playlists da campanha
- `POST /api/campaigns/:id/playlists` - Adicionar playlist à campanha
- `DELETE /api/campaigns/:id/playlists/:playlistId` - Remover playlist

---

## 📝 Observações Importantes

1. **Isolamento de Dados**: Todas as operações devem validar que mídias, playlists e campanhas pertencem ao subscriber correto
2. **Validação de Relacionamentos**: 
   - Mídias em playlists devem pertencer ao mesmo subscriber
   - Playlists em campanhas devem pertencer ao mesmo subscriber
   - Mídias em campanhas devem pertencer ao mesmo subscriber
3. **Upload de Arquivos**: A aba de mídias precisa de suporte para upload de arquivos (vídeos, imagens, HTML, etc.)
4. **Drag & Drop**: Considerar implementar drag & drop para reordenar itens de playlist
5. **Preview**: Mostrar preview/thumbnail das mídias na lista

---

## ✅ Confirmação

Este modelo está correto? Devo prosseguir com a implementação?

**Estrutura proposta:**
1. **Informações** - Dados básicos do subscriber
2. **Mídias** - Upload e gerenciamento de arquivos
3. **Playlists** - Organização de mídias com critérios
4. **Campanhas** - Campanhas publicitárias com mídias e/ou playlists
