# Por que as playlists por totem não aparecem?

Este documento explica o fluxo necessário para que **Playlists por Totem** e o **Dispatcher** mostrem conteúdo, e como resolver "Nenhuma playlist encontrada" e "No options" na aba Playlists da campanha.

## Resumo rápido

1. **"No options" na aba Playlists da campanha**  
   Não existe nenhuma **Playlist** cadastrada para o assinante. Crie em **Assinantes > Playlists**, adicione mídias à playlist e depois selecione essa playlist na campanha.

2. **"Nenhuma playlist encontrada" em Playlists por Totem**  
   A playlist consolidada por totem só existe depois que o sistema **gera** essa playlist. Isso exige:
   - Contrato do assinante com um **plano** que tenha acesso ao publisher (configuração **plan_publisher_access**).
   - Campanha ativa com o **publisher** (ex.: "totem digital") em PUBLICADORES e com **playlists** e/ou **mídias diretas**.
   - Ter executado **Regenerar** na tela Playlists por Totem, ou o totem ter pedido plano ao backend (heartbeat/dispatch).

3. **409 (Conflict) ao criar contrato de publisher**  
   O **número do contrato** já existe para esse publisher. Use outro número ou edite o publicador e corrija o número do contrato.

4. **WebSocket "Unexpected response code: 200"**  
   O pedido a `/ws` está a ser respondido com HTTP 200 (ex.: página HTML) em vez de upgrade WebSocket (101). Garanta que o **proxy reverso (ex.: Nginx)** encaminha `/ws` para o **backend** com `Upgrade: websocket` e `Connection: upgrade`. Veja `nginx/nginx-reverse-proxy.conf` (bloco `location /ws`).

---

## Fluxo completo para as playlists aparecerem

Ordem recomendada: **Subscriber → Contrato (assinante) + Plano com acesso ao publisher → Mídias → Playlist (opcional) → Campanha → Playlists por Totem / Dispatcher**.

### 1. Assinante (Subscriber)

- Cadastre o assinante em **Assinantes**.

### 2. Contrato do assinante e acesso ao publisher

- Crie um **Contrato (Assinante)** vinculado a um **Plano**.
- O **Plano** precisa ter **acesso ao publisher** onde os totens estão (ex.: "totem digital").  
  Isso é feito em **plan_publisher_access**: o plano deve ter permissão para o publisher. Sem isso, o motor de playlists considera que o assinante não pode exibir nada naquele publisher e a playlist consolidada fica vazia.

### 3. Mídias

- Cadastre mídias em **Assinantes > Mídias**.

### 4. Playlist (recomendado para "No options")

- Em **Assinantes > Playlists**, crie uma **Playlist**, dê um nome e **adicione mídias** a ela.
- Se não existir nenhuma playlist, na campanha a aba **PLAYLISTS** mostra "No options" e não há como associar playlist à campanha.

### 5. Campanha

- Crie/edite a **Campanha**:
  - **PUBLICADORES**: selecione o publisher onde os totens estão (ex.: "totem digital").
  - **PLAYLISTS**: selecione a(s) playlist(s) criada(s) (ou use só **MÍDIAS** com "Mídias Diretas").
  - **TOTENS**: os totens impactados são derivados dos publishers selecionados.

Sem playlist associada e sem mídias diretas, a campanha não contribui itens para a playlist do totem.

### 6. Playlists por Totem e Dispatcher

- A lista em **Playlists por Totem** vem da tabela **totem_playlists**, preenchida quando o **motor de playlists** gera (ou regenera) a playlist para cada totem.
- Selecione o **Publisher** (e opcionalmente o Totem) e clique em **Regenerar** para forçar a geração.
- Se mesmo assim não aparecer nada, confira:
  - O assinante da campanha tem **contrato ativo** com **plano** que tem **acesso a esse publisher** (plan_publisher_access).
  - A campanha está **ativa**, com **data de início/fim** válidas e com o **publisher** em PUBLICADORES.
  - Há **playlist(s)** e/ou **mídias diretas** na campanha.

---

## Erros comuns no console

| Erro | Causa provável | Ação |
|------|----------------|------|
| `api/contracts/publisher-contracts` 409 | Número de contrato de publisher já existe para esse publisher | Usar outro número de contrato ou editar o existente |
| WebSocket `Unexpected response code: 200` | Proxy não faz upgrade de `/ws` para o backend | Configurar proxy (ex.: Nginx) com `location /ws` e headers Upgrade/Connection |
| 404 em `assets/uploads/subscriber-X/medias/...` | Caminho de mídia incorreto ou ficheiro não existe no servidor | Verificar upload e path da mídia no backend |
