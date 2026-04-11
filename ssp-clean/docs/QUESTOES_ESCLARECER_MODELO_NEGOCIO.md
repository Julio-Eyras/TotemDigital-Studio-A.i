# Questões a Esclarecer - Modelo de Negócio

## 🎯 Resumo Executivo

Este documento lista todas as questões que precisam ser esclarecidas antes de implementar as renomeações e refatorações do modelo E.R.

---

## 1️⃣ Subscriptions - Publisher ou Subscriber?

### Contexto
- Você mencionou: "subscriptions podem ser do HOST/Publishers (se modelo B - host paga)"
- Mas também: "assinantes pagam por anúncios, lotes, etc." sim o host atual Publishers tambem pode anunciar publicar em sua rede de totens e gerir as playlists hibrido

### Questão
**Subscriptions são de Publishers (se pagam para usar sistema) OU de Subscribers (se assinam plano de anúncios)?** hibrido 

### Opções

#### Opção A: Subscriptions apenas de Publishers
- Publishers podem ter subscription (pagam mensalidade para usar plataforma)
- Subscribers **não têm subscriptions**, apenas pagam por uso (via `subscriber_billing`)

#### Opção B: Ambos podem ter Subscriptions este aqui 
- Publishers: subscription para usar plataforma
- Subscribers: subscription para plano de anúncios (ex: plano básico, premium)

### Proposta Recomendada
**Opção A:** 
- `subscriptions` → `publisher_subscriptions` (Publisher paga para usar plataforma)
- Subscribers pagam via `subscriber_billing` (por campanha, lote, etc.)

### Pergunta para Você
Qual modelo você prefere? Subscribers têm subscriptions ou apenas billing por uso? ambos hibrido 

---

## 2️⃣ Users - Tenant Users vs Publisher Users

### Contexto
- Users são usuários do sistema SmartSignage
- Admin e Operador são users do sistema. admin e operadores sempre tem o campo publisher_id
- Users pertencem ao Publisher (via `publisher_id`) correto 

### Questões
1. **Users podem ser "tenant users" (admin/operador do sistema) sem `publisher_id`? por lembrar nisso a tabela users deve de se acrescentar um campo publisher_id apontando para a tabela publisher**
   - Ou todos users têm `publisher_id`, e tenant users têm um Publisher especial "SmartSignage Pro"? nao. um registro na tabela users podem ser de 3 tipos. <User_System>,<User_Subcriber>, <User_Publisher>. cada usuario no sistema tem suas respectivas regras de acesso rbacs
   - Como distinguir tenant users de publisher users? em principio todo tenant user tem sempre o campo user_id limpo mas agora tem de remodelar a tabela pois os estados podem ser 3 system user, subcriber user e publish user. 

### Opções


#### Opção B: Flag em Users
```sql
users (
    id,
    publisher_id INTEGER, -- NULL se for tenant user
    is_tenant_user BOOLEAN DEFAULT false, -- True se for admin/operador do sistema
    ...
);


### Proposta Recomendada
**Opção B:** Flag `is_tenant_user` em `users`
- Mais simples
- Não cria Publisher artificial
- Facilita queries
creio esta ser a melhor

### Pergunta para Você
Como você prefere modelar tenant users (admin/operador) vs 
publisher users? creio nao ter entendido mas se refere a opcao b acima? 
expliqueme 
---

## 3️⃣ Publisher pode ser Subscriber? (Flag `both`)

### Contexto
- Você mencionou: Publisher tem flag `is_subscriber`, `is_publisher`, ou `both`
- Publisher pode ser também um Subscriber sim creio ser melhor o que voce opina? 

### Questões
1. **Um Publisher que também é Subscriber tem registro duplicado?**
   - Ou um único registro em `publishers` com `client_type = 'both'`?

2. **Se `both`, como funciona billing?**
   - Têm `subscriber_billing` E `publisher_billing`?
   - Ou billing unificado?

3. **Se `both`, como funciona acesso?**
   - Têm acesso de Publisher (gerenciar totens) E Subscriber (criar campanhas)?

### Opções

#### Opção A: Um Registro com Flag
```sql
publishers (
    publisher_id,
    name,
    client_type TEXT, -- 'subscriber', 'publisher', 'both'
    is_subscriber BOOLEAN,
    is_publisher BOOLEAN,
    ...
);
-- Se both, tem registros em subscriber_billing E publisher_billing
```

#### Opção B: Dois Registros Separados (não recomendado)
- Um registro em `publishers`
- Um registro em `subscribers`
- Relacionamento N:1 entre eles

### Proposta Recomendada
**Opção A:** Flag `client_type = 'both'`
- Um único registro
- Billing separado: `subscriber_billing` E `publisher_billing`
- Acesso combinado (RBAC define o que pode fazer) esta aqui entao. 

### Pergunta para Você
Como você prefere modelar Publishers que também são Subscribers?
a opcao a
---

## 4️⃣ Playlists - Subscriber ou Publisher?

### Contexto
- Você mencionou: "Publisher gerencia mídias, playlists, campanhas próprias"
- E também: "Subscriber gerencia mídias, playlists, campanhas"

### Questão
**Playlists são sempre de Subscribers (anunciantes) ou também podem ser de Publishers (conteúdo próprio)?** cada um tem suas proprias midias, playlists, campanhas, e acasso com nives de seguranca. rback o assinantet pode criar,editar,excluir midias,playlists, campanhas. como estas campanhas,playlists sao integradas com a menageria de playlists na rede vinculada o publisher tem acesso limitado as midias,playlist,campanhas que foram executadas em sua rede de totens e smarttv.  m

#### Opção B: Playlists Podem Ser de Ambos
```sql
playlists (
    playlist_id,
    subscriber_id INTEGER, -- Se playlist de anunciante
    publisher_id INTEGER,  -- Se playlist do publisher (conteúdo próprio)
    ...
    CONSTRAINT chk_playlist_owner CHECK (
        (subscriber_id IS NOT NULL AND publisher_id IS NULL) OR
        (subscriber_id IS NULL AND publisher_id IS NOT NULL)
    )
);
```

### Proposta Recomendada
**Opção B:** Playlists podem ser de ambos
- Subscribers criam playlists para suas campanhas
- Publishers criam playlists para conteúdo próprio (ex: mídia institucional)

### Pergunta para Você
Publishers podem criar suas próprias playlists (conteúdo próprio), ou apenas Subscribers criam playlists? sim o publisher pode criar conteudo proprio. 

---

## 5️⃣ Execution Logs - Qual Cliente?

### Contexto
- `execution_logs` tem `client_id`
- Pode representar Subscriber (anunciante da campanha) ou Publisher (dono do totem) tem que rever estes campos pois possivelmente vai ter alteracao ja que os conceitos na tabela client foram alterados. mas creio ser  Publisher (dono do totem)

### Questão
**`execution_logs.client_id` representa Subscriber (anunciante) ou Publisher (dono do totem)?** Publisher (dono do totem)

### Análise
- `execution_logs` tem `campaign_id` (campanha é de Subscriber)
- `execution_logs` tem `totem_id` (totem é de Publisher)
- `execution_logs.client_id` provavelmente representa Subscriber (anunciante) 


### Opções

#### Opção B: Ambos (Explicito)
```sql
execution_logs (
    log_id,
    totem_id,
    campaign_id,
    subscriber_id INTEGER, -- Anunciante
    publisher_id INTEGER,  -- Dono do totem (derivado via totem_id → local_id → publisher_id)
    ...
);
```
use esta aqui  opcao b 
### Pergunta para Você

Em `execution_logs`, o que `client_id` atual representa? Subscriber ou Publisher? publisher 

---

## 6️⃣ Revenue Share - Fixo ou Variável?

### Contexto
- Publishers podem receber percentual de revenue share sim 
- Percentual pode ser fixo ou variável por publisher sim 

### Questão
**Percentual de revenue share é fixo (ex: sempre 70%) ou variável por publisher (conforme contrato)?** sim conforme contrato 

### Opções

#### Opção B: Variável por Publisher
- Cada publisher tem seu percentual (via `publisher_contracts`)
- Pode variar conforme contrato

### Proposta Recomendada
**Opção B:** Variável por Publisher
- Mais flexível
- Armazenado em `publisher_contracts.revenue_share_percentage`
- Permite diferentes acordos comerciais

### Pergunta para Você
opcao b
---

## 7️⃣ Modelo Híbrido - Como Funciona?

### Contexto
- Você confirmou: "será o modelo híbrido"
- Publisher pode receber % E pagar subscription

### Questão
**No modelo híbrido, como funciona a lógica de billing?**

### Cenários

#### Cenário 1: Publisher Recebe % E Paga Subscription
```
Publisher recebe 70% de campanha de R$ 1.000 = R$ 700
Publisher paga subscription mensal de R$ 500
Resultado líquido: Publisher recebe R$ 700 - paga R$ 500 = R$ 200 líquido
```

#### Cenário 2: Apenas Revenue Share
```
Publisher recebe 70% de campanha de R$ 1.000 = R$ 700
Não paga subscription
```

#### Cenário 3: Apenas Subscription
```
Publisher paga R$ 500/mês
Não recebe revenue share
```

### Questões
1. Subscription é descontada do revenue share ou são separadas?
2. Publisher pode ter crédito acumulado (recebe mais do que paga)?
3. Como funciona cobrança/billing mensal?

### Proposta
- Billing separado: `publisher_billing` para revenue share (outgoing) e subscription (incoming)
- Sistema calcula saldo líquido
- Relatório mensal mostra: recebimentos - pagamentos = saldo

### Pergunta para Você
Como funciona exatamente o modelo híbrido? Subscription desconta do revenue share ou são contas separadas? usar billing separado 

---

## 8️⃣ Armazenamento de Documentos (Contratos)

### Contexto
- Você mencionou: armazenar contratos em PDF, DOC, DOCX
- Contratos definem regras de revenue share e de assinantes 

### Questão
**Onde armazenar documentos de contratos? no sistema de arquivos do servidor do backend em um path configuravel para isso. No banco ou sistema de arquivos nao porque depous compleca externalizar **

### Opções


#### Opção B: Sistema de Arquivos
```sql
publisher_contracts (
    contract_id,
    contract_document_path TEXT, -- Caminho no filesystem
    contract_document_filename TEXT,
    ...
);
```

### Proposta Recomendada
**Opção B:** Sistema de arquivos
- Mais eficiente para arquivos grandes
- Facilita backup e versionamento
- Caminho armazenado no banco

### Pergunta para Você
Como você prefere armazenar documentos de contratos? opcao b

---

## 9️⃣ Aprovação de Payouts - Workflow

### Contexto
- Você mencionou: "o usuario do sistema smartsignage com autorizacao rbac para isto. e/ou o admin do sistema"
- Payouts precisam ser aprovados antes de pagar a parte administrativa do sistema cuidara das regras e aprimoramento agora implemente o basico 


### Questão
**Como funciona o workflow de aprovação de payouts?**
o assinante insere midias, playlists,campanhas este tem visualizacao somente sobre seus dados.
estas playlist e campanhas ne mixam com outras playlists e campanhas oriundas de outros assnantes e as distribui pela rede smartsignage 

### Proposta de Workflow

1. **Geração Automática:**
   - Sistema gera `publisher_billing` com `status = 'pending'`
   - `billing_type = 'revenue_share'` ou `'payout'`

2. **Aprovação:**
   - Usuário com permissão RBAC `approve_payout` aprova
   - Campo `approved_by` e `approved_at` preenchidos
   - Status muda para `'approved'`

3. **Pagamento:**
   - Sistema processa pagamento (integração com gateway)
   - Status muda para `'paid'`
   - `paid_at` preenchido

4. **Rejeição (se necessário):**
   - Usuário pode rejeitar com motivo
   - Status muda para `'rejected'`

### Pergunta para Você
Este workflow está correto? Há outras etapas necessárias?
inicialmente sim 
---

## 🔟 Billing de Subscribers - Tipos de Pagamento

### Contexto
- Você mencionou: "pagam por anúncios, ou lotes de exibicoes, quantidades de totens, smarttv, tempo, fator determinado por regra"

### Questão
**Como modelar todos esses tipos de pagamento em `subscriber_billing`?**

### Opções de `billing_type`:

```sql
billing_type TEXT:
  - 'advertisement' (por anúncio)
  - 'exhibition_lot' (lote de exibições)
  - 'totem_quantity' (quantidade de totens)
  - 'smarttv_quantity' (quantidade de smart TVs)
  - 'time_based' (tempo)
  - 'rule_based' (regra customizada)
```

### Campos Adicionais Necessários:

```sql
subscriber_billing (
    billing_id,
    subscriber_id,
    billing_type,
    amount,
    metadata JSONB, -- Armazena detalhes específicos:
      -- exhibition_lot: {"lot_size": 1000, "exhibitions_used": 750}
      -- totem_quantity: {"totem_count": 10, "days": 30}
      -- time_based: {"start_date": "...", "end_date": "...", "hourly_rate": 50}
      -- rule_based: {"rule_id": 123, "rule_params": {...}}
    ...
);
```

### Pergunta para Você
Esta estrutura atende todos os tipos de pagamento? Há outros tipos a considerar?

---

## 📋 Resumo das Questões

| # | Questão | Urgência | Impacto |
|---|---------|----------|---------|
| 1 | Subscriptions - Publisher ou Subscriber? | 🔴 Alta | Estrutura de `subscriptions` |
| 2 | Users - Tenant vs Publisher | 🔴 Alta | Estrutura de `users` |
| 3 | Publisher pode ser Subscriber? | 🟡 Média | Flags em `publishers` |
| 4 | Playlists - Subscriber ou Publisher? | 🟡 Média | Estrutura de `playlists` |
| 5 | Execution Logs - Qual cliente? | 🟡 Média | Estrutura de `execution_logs` |
| 6 | Revenue Share - Fixo ou variável? | 🟢 Baixa | Configuração |
| 7 | Modelo Híbrido - Como funciona? | 🔴 Alta | Lógica de billing |
| 8 | Armazenamento de documentos | 🟢 Baixa | Implementação |
| 9 | Workflow de aprovação | 🟡 Média | Lógica de negócio |
| 10 | Tipos de pagamento Subscriber | 🟡 Média | Estrutura de billing |

---

**Aguardando suas respostas para finalizar o modelo e criar scripts de migração!**

otimo tudo isso 