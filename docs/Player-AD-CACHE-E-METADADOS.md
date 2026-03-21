## Player-AD – Cache de Mídias e Metadados (`propagandas`)

Este documento define como o Player-AD (Android TV) gerencia:

- a **pasta de cache local** `propagandas`
- o arquivo de **metadados** `metadata.json`
- a **política de limpeza (LRU)** com limite de tamanho
- o **histórico de plays por dia** (`sum_play`)

O objetivo é espelhar o comportamento conceitual já existente nos players atuais (player-web, Tizen, webOS, Linux), mas adaptado ao storage do Android.

---

### 1. Diretório de cache `propagandas`

No Player-AD, o cache de mídias fica numa pasta única chamada `propagandas`.

Exemplo de caminho físico (não é fixo, depende da instalação):

- App normal (sem root):  
  `context.getExternalFilesDir(null)/propagandas`  
  Ex.: `/sdcard/Android/data/br.com.smartchannel.playerad/files/propagandas`

- App de sistema (opcional):  
  `/data/local/smartsignage/propagandas`

**Regra:** todo o fluxo de cache trabalha **somente dentro** dessa pasta `propagandas`.

---

### 2. Arquivo de metadados `metadata.json`

Dentro de `propagandas`, haverá um arquivo:

- `propagandas/metadata.json`

Formato: mapa de `mediaId` (string) para objeto de metadados:

```json
{
  "2": {
    "mediaId": 2,
    "fileName": "2.mp4",
    "size": 12345678,
    "checksum": "abc123...",
    "mimeType": "video/mp4",
    "downloadedAt": 1773368278854,
    "lastAccessed": 1773368290000,
    "valid": true,
    "sum_play": {
      "2026-03-12": 5,
      "2026-03-13": 2
    }
  }
}
```

Campos:

- **mediaId**: ID numérico da mídia (igual ao `mediaId` do `DispatchPlan`).
- **fileName**: nome do arquivo salvo em `propagandas` (ex.: `2.mp4`).
- **size**: tamanho do arquivo em bytes.
- **checksum**: checksum (ex.: SHA-256) opcional para validar integridade.
- **mimeType**: tipo MIME (ex.: `video/mp4`).
- **downloadedAt**: timestamp (ms desde epoch) do download inicial.
- **lastAccessed**: timestamp (ms) da última vez que o arquivo foi usado em playback a partir do cache.
- **valid**:
  - `true`: arquivo físico deve existir em `propagandas` e contar para o cache.
  - `false`: arquivo físico foi removido, mas os metadados/histórico permanecem.
- **sum_play**: objeto `{ "yyyy-MM-dd": count }` com histórico de plays por dia.

---

### 3. Operações principais sobre metadados

#### 3.1. Ao baixar uma mídia (download concluído com sucesso)

Entrada: `mediaId`, `fileName`, `size`, `checksum` (se houver), `mimeType`.

Passos:

1. Escrever/atualizar o arquivo físico em `propagandas/fileName`.
2. Carregar `metadata.json` (ou objeto em memória).
3. Atualizar/definir a entrada de `mediaId`:
   - `mediaId`: valor numérico.
   - `fileName`: nome do arquivo salvo.
   - `size`: bytes do arquivo salvo.
   - `checksum`: se calculado.
   - `mimeType`: se conhecido.
   - `downloadedAt`: se não existir, definir `now`; se existir, pode ser mantido.
   - `lastAccessed`: definir `now`.
   - `valid`: **sempre `true`** após download bem-sucedido.
   - `sum_play`:
     - Se já existir (download de mídia que já esteve em cache), preservar o objeto.
     - Se não existir, inicializar como `{}` (objeto vazio).
4. Persistir `metadata.json` no disco.

#### 3.2. Ao tocar uma mídia a partir do cache

Condição: playback usa arquivo local em `propagandas` (não streaming).

Passos:

1. Carregar/ter em memória os metadados para `mediaId`.
2. Atualizar:
   - `lastAccessed = now`.
3. Atualizar `sum_play`:
   - Determinar a data atual em formato `yyyy-MM-dd` (ex.: `"2026-03-13"`).
   - Se `sum_play[hoje]` existir:
     - `sum_play[hoje] = sum_play[hoje] + 1`
   - Senão:
     - `sum_play[hoje] = 1`
4. Persistir `metadata.json`.

Observação: para playback via streaming (quando ainda não há cache), **não** incrementamos `sum_play` (ou, se desejado, podemos contar apenas quando o cache estiver presente – a decisão aqui é contar apenas usos que passaram pelo cache).

#### 3.3. Ao remover um ficheiro físico (limpeza / LRU)

Quando o algoritmo de limpeza decide remover uma mídia do cache:

1. Apagar o arquivo físico: `propagandas/fileName`.
2. Carregar metadados de `mediaId`.
3. Atualizar:
   - `valid = false`
   - `size`: pode ser mantido (tamanho “histórico” do arquivo).
   - `fileName`, `checksum`, `mimeType`, `downloadedAt`, `sum_play` são **mantidos**.
4. Persistir `metadata.json`.

Assim, o histórico de uso (incluindo `sum_play`) é preservado mesmo após remoção do arquivo físico.

---

### 4. Política de cache (LRU, limite 1000 MB)

Configuração:

- `maxCacheSizeBytes = 1000 * 1024 * 1024` (1 GB).  
  Valor pode ser lido de config (JSON) ou de default embutido.

#### 4.1. Cálculo do tamanho atual do cache

- Carregar `metadata.json`.
- Somar `size` **apenas** das entradas com:
  - `valid === true`
- Isso gera `currentCacheSizeBytes`.

#### 4.2. Decisão de limpeza

- Se `currentCacheSizeBytes <= maxCacheSizeBytes`:
  - Não é necessário limpar.

- Se `currentCacheSizeBytes > maxCacheSizeBytes`:
  - Construir uma lista de entradas com `valid === true`.
  - Ordenar por `lastAccessed` crescente (mais antigo primeiro).
  - Iterar removendo:
    - Para cada entrada em ordem:
      - Apagar arquivo físico `propagandas/fileName`.
      - Atualizar metadados:
        - `valid = false`
      - Recalcular `currentCacheSizeBytes` subtraindo o `size` daquela mídia.
      - Parar quando `currentCacheSizeBytes <= maxCacheSizeBytes` ou quando não houver mais entradas `valid === true` a remover.

#### 4.3. Considerações

- Entradas com `valid === false`:
  - **Não contam** para o tamanho atual do cache.
  - São mantidas apenas como histórico (com `sum_play`, `downloadedAt`, etc.).

- Na leitura de cache:
  - Ao buscar uma mídia, só consideramos como “em cache” se:
    - há entrada de `mediaId` em `metadata.json` **e**
    - `valid === true` **e**
    - o arquivo físico existe em `propagandas/fileName`.

---

### 5. Resumo das regras implementadas

- **Diretório único de cache:** `propagandas`.
- **Metadados por mídia em JSON:** `propagandas/metadata.json`.
- **Ao baixar:** cria/atualiza entrada com `valid=true`, preservando `sum_play` existente.
- **Ao tocar do cache:** atualiza `lastAccessed` e incrementa `sum_play[hoje]`.
- **Ao limpar:** remove arquivo físico, marca `valid=false`, mantém `sum_play` e demais campos (histórico).
- **LRU com limite 1000 MB:** remove mídias menos acessadas recentemente até ficar dentro do limite, considerando apenas mídias `valid=true`.

