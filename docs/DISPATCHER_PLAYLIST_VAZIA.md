# Por que o player recebe DispatchPlan com playlist vazia?

Quando o **player-web** (ou o totem) chama a API de dispatch (`/api/player/dispatch?uin=td-academia&...`) e recebe um plano com `mediaItems: []` e `playlistId: 0`, significa que o **dispatcher** não encontrou **nenhuma campanha candidata** para aquele totem.

## Como o dispatcher escolhe as campanhas

O dispatcher só considera campanhas que atendem **ao mesmo tempo**:

1. **Campanha ativa** – `status = 'active'`, `is_active = true`, dentro do período (start_date/end_date).
2. **Vinculação ao totem ou ao publisher do totem:**
   - **Direto:** a campanha está em `campaign_totems` para **este totem**, **e**
   - o assinante da campanha tem acesso ao publisher desse totem (`subscriber_publisher_access_active`);  
   **ou**
   - **Por publisher:** a campanha está em `campaign_publishers` para o **publisher** ao qual o totem pertence (totem → local → publisher), **e**
   - o assinante da campanha tem acesso a esse publisher.

Se a campanha do assinante (ex.: "padaria pao quentinho") **não** tiver:
- nenhum **publisher** associado em "Publicadores", e  
- nenhum **totem** associado em "Totens",

então ela **nunca** entra na lista de candidatos e o plano volta vazio.

## O que fazer

1. **Editar a campanha do assinante**  
   Em **Assinantes** → **Editar Anunciante** (ex.: padaria pao quentinho) → aba **CAMPANHAS** → editar a campanha (ex.: "campanha pao quentinho").

2. **Associar onde a campanha deve aparecer**
   - Aba **PUBLICADORES**: adicionar o **publisher** ao qual o totem pertence (ex.: o publisher do "TD-Academia").  
   - Ou aba **TOTENS**: adicionar o próprio totem (ex.: TD-Academia / totem 10).

3. **Salvar** a campanha (botão "Atualizar Campanha" / "Salvar").

4. **Conferir acesso do assinante ao publisher**  
   O assinante precisa ter acesso a esse publisher (contrato/plano com esse publisher). Caso contrário, mesmo com campanha vinculada ao publisher, o dispatcher não inclui a campanha.

## Diagnóstico no backend

- **Endpoint de diagnóstico:**  
  `GET /api/dispatcher-totem/:totemId/diagnostics`  
  (ex.: `GET /api/dispatcher-totem/10/diagnostics` para o totem 10 / td-academia).

- Resposta inclui:
  - `totem.publisherId` – publisher do totem
  - `counts.dispatcherQuery` – contagem de campanhas:
    - `directWithAccess` – campanhas em `campaign_totems` para este totem com acesso ok
    - `groupWithAccess` – campanhas em `campaign_publishers` para esse publisher com acesso ok
  - `hasCandidates` – se há algum candidato
  - `suggestion` – texto sugerindo o que ajustar quando não há candidatos

Quando **directWithAccess** e **groupWithAccess** são 0, o plano volta vazio. A solução é sempre **associar a campanha ao publisher ou ao totem** e garantir o acesso do assinante a esse publisher.

## Player-web em modo debug

Se o plano vier vazio, o backend envia em `plan.metadata`:

- `noCandidatesReason` – mensagem explicando por que não há candidatos
- `diagnosticsUrl` – caminho do endpoint de diagnóstico

No painel de debug do player-web, ao solicitar o DispatchPlan, essa mensagem é exibida quando a playlist está vazia, e o diagnóstico pode ser chamado em `GET {baseURL}{diagnosticsUrl}`.
