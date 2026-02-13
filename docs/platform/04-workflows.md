# Workflows e Processos - SmartSignage Pro

## Visão Geral dos Workflows

Este documento descreve os principais workflows e processos do sistema SmartSignage Pro.

## 1. Workflow de Criação e Exibição de Campanha

### Fluxo Completo

```
1. Criação de Mídia
   └── Upload de arquivo (vídeo/imagem)
   └── Aprovação pelo Publisher
   └── Status: approved/published

2. Criação de Playlist
   └── Adicionar mídias aprovadas
   └── Definir ordem de exibição
   └── Configurar duração de cada item

3. Criação de Campanha
   └── Vincular playlist(s)
   └── Definir agendamento (data/hora/dias)
   └── Vincular totens ou publishers
   └── Definir prioridade

4. Validação pelo Dispatcher
   └── Validação temporal (horário válido?)
   └── Validação técnica (mídia compatível?)
   └── Validação comercial (regras de negócio)
   └── Resolução de conflitos (múltiplas campanhas)

5. Geração de Plano de Exibição
   └── Dispatcher seleciona campanha vencedora
   └── Gera plano com itens ordenados
   └── Cache do plano (1 minuto)

6. Player Solicita Plano
   └── GET /api/player/dispatch?uin=...
   └── Backend retorna plano de exibição
   └── Player carrega mídias e reproduz

7. Registro de Eventos
   └── Player envia eventos (playback_start, playback_end)
   └── Sistema registra em event_logs
   └── Analytics atualizado
```

## 2. Workflow do Dispatcher (Motor de Decisão)

### Processo de Decisão

```
1. Recebe Requisição
   └── totemId, timestamp, timezone

2. Verifica Cache
   └── Se existe plano cacheado válido → retorna
   └── Senão → continua

3. Busca Candidatos
   └── Campanhas diretas (campaign_totems)
   └── Campanhas via publisher (campaign_publishers)
   └── Filtra por: ativo, status=active, acesso válido

4. Validação Temporal
   └── Data/hora dentro do período da campanha?
   └── Dia da semana válido?
   └── Horário do dia válido?
   └── Timezone considerado

5. Validação Comercial (Fase 1.3)
   └── Tier comercial (premium/standard/remnant)
   └── Time share percent
   └── Máximo de slots consecutivos
   └── Máximo de impressões por hora

6. Validação Técnica
   └── Mídias compatíveis com totem?
   └── Resolução adequada?
   └── Formato suportado?

7. Validação de Integridade
   └── Playlist tem itens válidos?
   └── Mídias existem e estão aprovadas?

8. Resolução de Conflitos
   └── Múltiplos candidatos válidos?
   └── Aplica estratégia (priority, score, mix)
   └── Seleciona vencedor

9. Geração de Plano
   └── Converte playlist em DispatchPlan
   └── Adiciona metadados (campanha, validade)
   └── Ordena itens por order_index

10. Cache e Log
    └── Salva plano no cache (60s TTL)
    └── Registra decisão em dispatcher_log
    └── Retorna plano ao player
```

### Estratégias de Resolução

- **Priority**: Campanha com maior prioridade vence
- **Score**: Calcula score baseado em múltiplos fatores
- **Mix**: Combina múltiplas campanhas em uma playlist única

## 3. Workflow do Player

### Ciclo de Vida do Player

```
1. Inicialização
   └── Carrega configuração (UIN, servidor)
   └── Inicializa cache (IndexedDB)
   └── Obtém device token
   └── Inicializa media player

2. Obtenção de Plano
   └── GET /api/player/dispatch
   └── Se sucesso → usa plano
   └── Se erro → usa cache offline ou vinheta padrão

3. Reprodução
   └── Para cada item do plano:
       ├── Verifica cache local
       ├── Se em cache → reproduz do cache
       ├── Senão → streaming + download em background
       └── Envia evento (playback_start)

4. Fim de Item
   └── Envia evento (playback_end)
   └── Avança para próximo item
   └── Loop até fim da playlist

5. Sincronização Periódica
   └── A cada 15 minutos → solicita novo plano
   └── Detecta mudanças de playlist
   └── Atualiza cache

6. Heartbeat
   └── A cada 30 segundos → envia heartbeat
   └── Recebe comandos remotos pendentes
   └── Atualiza status do totem
```

## 4. Workflow de Autenticação e Autorização

### Fluxo de Login

```
1. Usuário faz login
   └── POST /api/auth/login
   └── Valida credenciais
   └── Verifica 2FA (se habilitado)

2. Geração de Tokens
   └── Access Token (JWT, 1 hora)
   └── Refresh Token (7 dias)
   └── Retorna tokens ao cliente

3. Requisições Autenticadas
   └── Header: Authorization: Bearer <token>
   └── Middleware valida token
   └── Verifica permissões (RBAC)

4. Refresh Token
   └── Token expira → usa refresh token
   └── Gera novo access token
   └── Continua sessão
```

### Sistema de Permissões (RBAC)

- **Roles**: admin, publisher, subscriber, viewer
- **Permissions**: create_campaign, approve_campaign, manage_totems, etc.
- **Verificação**: Middleware verifica permissão antes de executar ação

## 5. Workflow de Aprovação de Campanha

### Processo de Aprovação

```
1. Subscriber cria campanha
   └── Status: draft

2. Subscriber submete para aprovação
   └── Status: pending_approval

3. Publisher revisa campanha
   └── Verifica conteúdo
   └── Verifica agendamento
   └── Verifica mídias

4. Publisher aprova/rejeita
   └── Aprova → status: active
   └── Rejeita → status: rejected (com motivo)

5. Campanha ativa
   └── Dispatcher considera para exibição
   └── Player pode receber plano com esta campanha
```

## 6. Workflow de Upload e Aprovação de Mídia

### Processo de Mídia

```
1. Upload
   └── POST /api/media/upload
   └── Valida formato e tamanho
   └── Salva arquivo em storage
   └── Gera thumbnail (se vídeo)
   └── Status: pending

2. Processamento
   └── Extrai metadados (duração, resolução)
   └── Valida integridade do arquivo
   └── Status: processing

3. Aprovação
   └── Publisher revisa mídia
   └── Aprova → status: approved
   └── Publica → status: published
   └── Rejeita → status: rejected

4. Uso em Playlist
   └── Apenas mídias approved/published
   └── Validação técnica antes de exibir
```

## 7. Workflow de Comandos Remotos

### Processo de Comando

```
1. Admin cria comando
   └── POST /api/totems/:id/commands
   └── Tipo: restart, reboot, update, etc.
   └── Status: pending

2. Player recebe no heartbeat
   └── GET /api/player/heartbeat
   └── Retorna comandos pendentes

3. Player executa comando
   └── Executa ação localmente
   └── POST /api/totems/:id/commands/:id/complete
   └── Status: completed

4. Sistema registra
   └── Atualiza status do comando
   └── Registra em event_logs
   └── Notifica admin (se configurado)
```

## 8. Workflow de Analytics e Relatórios

### Coleta de Dados

```
1. Eventos do Player
   └── playback_start, playback_end, error
   └── Registrados em event_logs

2. Decisões do Dispatcher
   └── Campanha selecionada, candidatos
   └── Registrados em dispatcher_log

3. Agregação
   └── Views materializadas atualizadas
   └── Cálculo de métricas (impressões, views)

4. Relatórios
   └── Consulta views agregadas
   └── Filtros por período, campanha, totem
   └── Exportação (CSV, PDF)
```

## Regras de Negócio Importantes

### Validação Temporal
- Campanha deve estar dentro do período start_date → end_date
- Horário deve estar dentro de start_time → end_time
- Dia da semana deve estar em days_of_week
- Timezone do totem é considerado

### Prioridade
- Campanha direta (campaign_totems) tem prioridade sobre campanha via publisher
- Prioridade numérica: maior número = maior prioridade
- Em caso de empate: score calculado (tier, tempo, etc.)

### Cache
- Planos cacheados por 60 segundos (1 minuto)
- Cache por totem + timestamp (arredondado ao minuto)
- Cache pode ser ignorado com skipCache=true

### Validação Comercial
- Premium: maior prioridade, mais slots
- Standard: prioridade média
- Remnant: preenche espaços vazios
- Time share: percentual de tempo por campanha
- Máximo de slots consecutivos respeitado

## Próximos Passos

- [Recursos e Regras](./05-recursos-regras.md) - Detalhes de recursos e regras
- [Arquitetura](./01-arquitetura.md) - Arquitetura técnica do sistema
