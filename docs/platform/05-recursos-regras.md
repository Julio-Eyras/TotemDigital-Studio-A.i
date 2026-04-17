# Recursos e Regras - SmartSignage Pro

## Recursos do Sistema

### 1. Gerenciamento de Campanhas

#### Criação de Campanha
- **Campos Obrigatórios**: título, start_date, end_date
- **Campos Opcionais**: start_time, end_time, days_of_week, timezone
- **Vinculação**: totens diretos ou publishers (grupos)
- **Prioridade**: 0-100 (padrão: 50)
- **Status**: draft, pending_approval, active, paused, completed, rejected

#### Regras de Campanha
- Uma campanha pode ter múltiplas playlists
- Playlist com maior prioridade é selecionada
- Campanha deve estar ativa (`is_active=true`) e `status='active'` para ser considerada
- Campanha direta (via `campaign_totems`) tem precedência sobre campanha via publisher

### 2. Gerenciamento de Playlists

#### Criação de Playlist
- **Campos Obrigatórios**: name, subscriber_id
- **Itens**: ordem definida por `order_index`
- **Duração**: cada item tem `display_seconds` (padrão: duração da mídia)
- **Status**: ativa/inativa (`is_active`)

#### Regras de Playlist
- Apenas mídias com status `approved` ou `published` podem ser adicionadas
- Itens devem estar ativos (`is_active=true`)
- Ordem de exibição respeita `order_index` (crescente)

### 3. Gerenciamento de Mídias

#### Tipos Suportados
- **Vídeo**: MP4, WebM, MOV
- **Imagem**: JPG, PNG, GIF, WebP
- **HTML5**: Páginas web interativas

#### Regras de Mídia
- Upload máximo: configurável (padrão: 500MB)
- Formatos validados no upload
- Thumbnail gerado automaticamente para vídeos
- Status: pending, processing, approved, published, rejected
- Apenas mídias `approved` ou `published` podem ser usadas em playlists

### 4. Gerenciamento de Totens

#### Cadastro de Totem
- **Campos Obrigatórios**: name, uin, local_id
- **UIN**: Identificador único (formato: UIN-{CATEGORIA}-{NUMERO}-{ANO})
- **Status**: online, offline, error, maintenance
- **Heartbeat**: atualizado a cada 30 segundos

#### Regras de Totem
- Totem deve estar ativo (`is_active=true`) para receber conteúdo
- Totem deve estar online para exibir conteúdo
- Totem **sem campanhas válidas** recebe do servidor, quando existir, o plano montado a partir da **playlist consolidada** (`totem_playlists`); se não houver playlist utilizável, o servidor pode devolver **plano vazio** — o player pode então usar **cache** ou **vinheta/asset local** conforme implementação do cliente

### 5. Dispatcher (Motor de Decisão)

#### Recursos do Dispatcher
- **Cache**: Planos cacheados por 60 segundos
- **Validação Temporal**: Verifica horários e datas
- **Validação Técnica**: Verifica compatibilidade de mídias
- **Validação Comercial**: Aplica regras de negócio (tier, time share)
- **Resolução de Conflitos**: Seleciona melhor campanha quando múltiplas válidas

#### Regras do Dispatcher
- Busca campanhas diretas primeiro, depois via publisher
- Valida acesso subscriber → publisher antes de considerar campanha
- Respeita timezone do totem/local
- Cache por totem + timestamp (arredondado ao minuto)
- Se nenhum candidato de campanha produzir plano válido: tenta **playlist consolidada do totem** (`totem_playlists`); se ainda assim não houver plano, devolve **plano vazio** (sem montar lista a partir de pastas `propagandas`/`vinhetas` no servidor)

### 6. Player (Reprodutor)

#### Recursos do Player
- **Cache Local**: IndexedDB para mídias e planos
- **Streaming**: Reprodução enquanto baixa em background
- **Sincronização**: Atualiza plano a cada 15 minutos
- **Heartbeat**: Envia status a cada 30 segundos
- **Eventos**: Registra reproduções e erros

#### Regras do Player
- Player solicita plano via `/api/player/dispatch`
- Se erro na API ou plano vazio → **cache offline** do último plano / mídias já em disco local; **vinheta local** é política do player, não fallback gerado pelo servidor
- Mídias são baixadas em background para cache
- Player detecta mudanças de playlist e envia evento `playlist_end`

### 7. Sistema de Permissões (RBAC)

#### Roles Disponíveis
- **admin**: Acesso completo ao sistema
- **publisher**: Gerencia totens e aprova campanhas
- **subscriber**: Cria campanhas e conteúdo
- **viewer**: Apenas visualização

#### Permissões Principais
- `create_campaign`: Criar campanhas
- `approve_campaign`: Aprovar/rejeitar campanhas
- `manage_totems`: Gerenciar totens
- `manage_media`: Upload e aprovação de mídias
- `view_analytics`: Visualizar relatórios

### 8. Analytics e Eventos

#### Eventos Registrados
- `video_playback_start`: Início de reprodução
- `video_playback_end`: Fim de reprodução
- `video_playback_error`: Erro na reprodução
- `image_display`: Exibição de imagem
- `playlist_start`: Início de playlist
- `playlist_end`: Fim de playlist

#### Regras de Analytics
- Eventos registrados em `event_logs`
- Decisões do dispatcher em `dispatcher_log`
- Views materializadas agregam dados para relatórios
- Dados históricos mantidos para análise

## Regras de Negócio Detalhadas

### 1. Validação Temporal

#### Período da Campanha
```sql
campaign.start_date <= timestamp <= campaign.end_date
```

#### Horário do Dia
```sql
campaign.start_time <= hora_atual <= campaign.end_time
```

#### Dia da Semana
```sql
dia_da_semana IN campaign.days_of_week
-- Exemplo: ['monday', 'tuesday', 'wednesday']
```

#### Timezone
- Campanha pode ter timezone próprio
- Totem usa timezone do local (ou padrão: America/Sao_Paulo)
- Conversão automática aplicada

### 2. Validação Comercial

#### Tiers Comerciais
- **Premium**: Prioridade alta, mais slots consecutivos permitidos
- **Standard**: Prioridade média, slots padrão
- **Remnant**: Preenche espaços vazios, menor prioridade

#### Time Share Percent
- Percentual de tempo que uma campanha pode ocupar
- Exemplo: 30% = campanha pode ocupar até 30% do tempo total
- Calculado por hora/período

#### Máximo de Slots Consecutivos
- Limita quantos itens consecutivos uma campanha pode ter
- Evita monopolização da exibição

#### Máximo de Impressões por Hora
- Limita quantas vezes uma campanha pode ser exibida por hora
- Previne saturação de conteúdo

### 3. Resolução de Conflitos

#### Quando Múltiplas Campanhas São Válidas

1. **Prioridade**: Campanha com maior `priority` vence
2. **Score**: Se empate, calcula score baseado em:
   - Tier comercial (premium > standard > remnant)
   - Tempo restante da campanha
   - Tempo desde última exibição
3. **Mix**: Se configurado, combina múltiplas campanhas em uma playlist única

#### Estratégia de Mix
- Combina itens de múltiplas campanhas
- Respeita time share de cada campanha
- Alterna entre campanhas respeitando limites

### 4. Cache e Performance

#### Cache do Dispatcher
- **TTL**: 60 segundos (1 minuto)
- **Chave**: `dispatcher:totem:{totemId}:{timestampMinuto}`
- **Conteúdo**: Plano completo + candidatos (opcional)

#### Cache do Player
- **IndexedDB**: Mídias e planos
- **TTL**: Indefinido (até nova sincronização)
- **Limite**: 500MB padrão (configurável)

### 5. Validação de Integridade

#### Mídia Válida
- Arquivo existe no storage
- Status: `approved` ou `published`
- `is_active = true`
- Formato suportado pelo totem

#### Playlist Válida
- Tem pelo menos 1 item ativo
- Todos os itens têm mídias válidas
- `is_active = true`

#### Campanha Válida
- Status: `active`
- `is_active = true`
- Período válido (data/hora)
- Tem pelo menos 1 playlist válida

### 6. Regras de Acesso

#### Subscriber → Publisher
- Subscriber precisa ter acesso ao publisher
- Acesso via `subscriber_publisher_access`
- Contrato ativo e não expirado

#### Campanha → Totem
- Via direto: `campaign_totems` vincula campanha ao totem
- Via publisher: Totem no local do publisher vinculado à campanha

### 7. Regras de Agendamento

#### Sobreposição de Campanhas
- Múltiplas campanhas podem estar ativas simultaneamente
- Dispatcher resolve conflitos por prioridade/score
- Apenas uma campanha é selecionada por vez (exceto mix)

#### Agendamento Recorrente
- Campanha pode ter `days_of_week` para repetição semanal
- `start_time` e `end_time` definem horário diário
- Período `start_date` → `end_date` define validade total

## Limites e Restrições

### Limites de Upload
- **Mídia**: 500MB (configurável)
- **Thumbnail**: Gerado automaticamente (máx. 2MB)

### Limites de Performance
- **Cache Dispatcher**: 60 segundos TTL
- **Sincronização Player**: A cada 15 minutos
- **Heartbeat**: A cada 30 segundos

### Limites de Negócio
- **Time Share**: 0-100% por campanha
- **Slots Consecutivos**: Configurável por campanha
- **Impressões/Hora**: Configurável por campanha

## Próximos Passos

- [Workflows](./04-workflows.md) - Fluxos de trabalho detalhados
- [TotemDigital monousuário: E.R. e fluxo](./06-totemdigital-monousuario-er-e-fluxo.md) - Modelo e fluxo antes/depois
- [Arquitetura](./01-arquitetura.md) - Arquitetura técnica
- [API](./../technical/01-api.md) - Documentação da API
