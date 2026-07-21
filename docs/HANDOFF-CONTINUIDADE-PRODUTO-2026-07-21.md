# Handoff de continuidade do produto — TotemDigital / SmartSignage

**Data:** 2026-07-21  
**Branch de trabalho:** `SmartSignage-direc-totem`  
**Repositório:** `https://github.com/Julio-Eyras/TotemDigital`  
**Objetivo deste documento:** exportar o conhecimento acumulado nesta fase de evolução para retomar o trabalho com outras IAs ou desenvolvedores, sem perder contexto, decisões pendentes nem restrições do projeto.

> **Como usar com outra IA:** cole este arquivo (ou o caminho no repo) no início da conversa e diga: *“Continue a partir do HANDOFF-CONTINUIDADE-PRODUTO-2026-07-21.md; não altere código sem autorização explícita.”*

---

## 1. Visão do produto

| Nome | Papel |
|------|--------|
| **SmartSignage Pro** | Plataforma multi-tenant de sinalização digital (admin React + API Node + PostgreSQL) |
| **TotemDigital** | Marca / linha monousuário e identidade visual (Amarelo Petróleo) |
| **Player-AD** | Player Android nativo (Kotlin) para totens |
| **Visual.Interface / TotemDigital.BV** | Mini CMS + player web standalone (protótipo / biblioteca visual) — **ainda não integrado** ao backend principal |

Fluxo operacional central:

```text
Campanha / Playlist → DispatchPlan → Player (AD ou web futuro)
Heartbeat / remote_commands / screenshots / device_tokens
```

Documentos de dados obrigatórios:

- `docs/MODELO_ER_MIDIAS_SMART_TV_E_TOTENS.md`
- `docs/platform/06-totemdigital-monousuario-er-e-fluxo.md`
- `docs/FLUXO_COMPLETO_PLAYER_WEB_CACHE_UIN_DISPATCHER_APROVACAO.md`
- Schema: `database/smartchannel-db-v2-refactored-part*.sql` (fonte da verdade)
- Seeds/validação v6: `database/carga-inicial-v6.sql`, `database/validate-v6.js`

---

## 2. Regras de engenharia (sempre aplicar)

1. **Desenvolvimento só na árvore principal:** `backend/`, `frontend/`, `database/`, `scripts/`, `Player-AD/`, etc. Sem cópia paralela `ssp-clean`.
2. **Schema = fonte da verdade:** alterações de tabelas/índices vão nos `part*.sql` e seeds; **não** criar migrations paliativas temporárias.
3. Atualizar instalador (`scripts/install-smartsignage.sh`, `database/apply-schema-v2.sh`) quando o schema mudar.
4. **Não alterar código sem autorização** quando o utilizador pedir plano/análise prévia.
5. Commits só quando pedidos; mensagens curtas focadas no “porquê”.
6. Respostas ao utilizador em **português**.

---

## 3. Estado atual do repositório (snapshot)

### 3.1 Branch e commits recentes relevantes

| Commit | Resumo |
|--------|--------|
| `e4d0cf1` | Fontes `TotemDigital.BV` + scripts geradores |
| `3fa157a` | `Visual.Interface/install_Visual.Interface.sh` |
| `4cc7e18` | `scripts/install-biblioteca-visual.sh` + `identidade.visual.html` |
| `cff5796` | Demos + rename imersiva Amarelo → Azul |
| `cd05c05` | Variantes animada/celular/imersiva/correção |
| `f15627e` | Fix sobreposição slides desktop (apresentação amarela) |
| `1416ffc` | Apresentações responsivas + nomes |
| `d590667` | Docs ER + remote control + PNG |
| `31ee502` | Player-AD: config UI + barra de ações |

### 3.2 Áreas tocadas nesta fase

- **Player-AD:** layout config 100% altura; botões na barra superior; “Testar conectividade”; “Playlist” com lista `id:nome #duração`; `deviceId` default com hífen (`T1000-Exterminator`).
- **Documentação ER:** `player_settings`, `now_playing`, `remote_commands`, `remote_screenshots`, `device_tokens`.
- **Site (`totemdigital.site/`):** landings A4/full/responsivas (azul e amarelo petróleo), demos, identidade visual.
- **Visual.Interface:** scripts de instalação + projeto extraído `TotemDigital.BV/`.

---

## 4. Identidade visual — Amarelo Petróleo

### 4.1 Fonte de verdade visual

Arquivo de referência principal:

`totemdigital.site/Apresentacao.Totem.Digital.Amarelo.Full.Responsiva.html`

Tokens extraídos:

| Token | Hex / valor | Uso |
|-------|-------------|-----|
| preto / fundo | `#020708`, `#061113`, `#0a1a1c` | backgrounds |
| amarelo | `#ffd21c` | primary / destaques |
| amarelo claro | `#ffe66c` | títulos secundários |
| dourado | `#f3ad13` / `#f5b82e` (variantes demos) | accents |
| texto | `#f4f7f5` | primary text |
| texto suave | `#aebdbc` | secondary |
| verde | `#1fd19a` | success / accent |
| borda | `rgba(255,210,28,.28)` | borders |

### 4.2 Frontend admin (MUI) — propostas (PENDENTE AUTORIZAÇÃO)

Estado atual do tema:

- `frontend/src/theme/theme.ts` + `designTokens.ts`
- Redux `uiSlice`: `theme: light|dark` + `darkTone: carvao|grafite|suave`
- Menu na AppBar (`Layout.tsx`)

Propostas apresentadas (nada implementado ainda):

| Opção | Descrição | Complexidade |
|-------|-----------|--------------|
| **A** | Novo `darkTone: 'petroleo'` (só fundos/tons) | Muito baixa |
| **B** | A + `primary` amarelo nos botões/links | Baixa |
| **C** | B + CssBaseline com gradientes da landing | Média |

**Recomendação registada:** começar por A, validar, evoluir para B.  
**Status:** utilizador pediu para **guardar a conversa / deixar para depois** — **não implementar sem nova autorização.**

---

## 5. Site / apresentações (`totemdigital.site/`)

### 5.1 Convenção de nomes (em evolução)

- `Software.SmartSignage-*-A4.html` / `*-Full.html`
- `Apresentacao.Totem.Digital.Amarelo.*` / `*.Azul.*`
- Sufixos: `.Full`, `.Full.Responsiva`, `.animada`, `.celular`, `.correcao`, `.imersiva`
- Demos: `Demos amarelo petroleo.html`, `Demos1.html`, `identidade.visual.html`

### 5.2 Bug corrigido — sobreposição no desktop

**Sintoma:** no desktop, cabeçalho/logo e rodapé sobrepunham conteúdo; no telemóvel estava OK.  
**Causa:** `.slide { align-items: center }` + `.conteudo { margin: auto }` centravam verticalmente conteúdo longo sob o header/footer fixos.  
**Correção (`f15627e`):**

- slides: `align-items: flex-start`
- conteúdo: `margin: 0 auto`
- capa mantém `justify-content: center`

### 5.3 Compactação Linux (nota operacional)

```bash
tar -czvf arquivo.tar.gz nome-do-diretorio/
```

---

## 6. Visual.Interface / TotemDigital.BV (biblioteca visual)

### 6.1 O que é (e o que não é)

**É:** instalador + mini-app Express que:

- serve um player web full-screen (tema ouro/petróleo);
- expõe CRUD `/api/contents` em `data/contents.json`;
- tipos: `text`, `image`, `video`, `html`, `url`;
- rotação por `duration` + refresh periódico.

**Não é:** biblioteca npm importável, nem substituto do SmartSignage (sem Postgres, multi-tenant, DispatchPlan, heartbeat, Player-AD).

### 6.2 Árvore relevante

```text
Visual.Interface/
├── TotemDigital.BV/                 # fontes versionadas (Fase 0 feita)
│   ├── server.js
│   ├── public/{index.html,style.css,app.js}
│   ├── data/contents.json
│   ├── package.json, .env.example, README.md
├── TotemDigital.BV.sh               # gerador (UTF-8 melhor)
├── totemdigital_fixed.sh            # gerador duplicado (encoding ruim)
└── install_Visual.Interface.sh      # instalador monolítico antigo

scripts/install-biblioteca-visual.sh # variante paralela (overlap)
```

### 6.3 Pontos fortes

- Fontes já extraídas do shell (bom para evolução).
- Write atómico do JSON (`.tmp` + rename).
- `sanitizeContent` com merge no PUT.
- Tema visual alinhado à marca.
- Player simples e compreensível (~240 linhas).

### 6.4 Problemas conhecidos (débito técnico)

1. **UTF-8 quebrado** em vários ficheiros de `TotemDigital.BV/` (`ConteÃºdo`, etc.).
2. **`.env` não é carregado** no `server.js` (falta `dotenv` ou EnvironmentFile).
3. **API aberta** se `API_KEY` vazia.
4. Tipo **`html` sem sanitização** → XSS se API pública.
5. **Três scripts geradores/instaladores** sobrepostos.
6. Sem `package-lock.json` / `.gitignore` para `node_modules`.
7. Vídeo com `controls` (pode ser indesejado em totem).
8. Sem integração DispatchPlan / UIN / device token.

### 6.5 Planos de integração com SmartSignage (PENDENTE ESCOLHA)

| Opção | Ideia | Estimativa | Risco |
|-------|-------|------------|-------|
| **A (recomendada)** | Player web BV consome **DispatchPlan** do SmartSignage | 3–5 dias (Fase 0+1) | Baixo |
| **B** | BV como motor de boards → exporta para `medias` html/iframe | 1–2 semanas | Médio |
| **C** | Absorver BV no monólito (admin React + API oficial) | 3–5 semanas | Médio-alto |

Fases sugeridas:

| Fase | Escopo | Tempo |
|------|--------|-------|
| 0 | Extrair fontes do `.sh` | **Feito** (`TotemDigital.BV/`) |
| 1 | Adapter DispatchPlan + auth device | 2–3 dias |
| 2 | Preview admin + tema | 2–3 dias |
| 3 | Sync boards → medias (opcional B) | 5–8 dias |
| 4 | UI nativa + deprecar Express (opcional C) | 10–15 dias |

**Status:** análise feita; **aguardar confirmação** da opção (A/B/C) antes de alterar código de integração.

Melhorias pré-integração sugeridas: corrigir UTF-8 a partir de `TotemDigital.BV.sh`; unificar scripts; `dotenv` + API key obrigatória; sanitizar HTML; `.gitignore`.

---

## 7. Player-AD — mudanças desta fase

Arquivos-chave:

- `Player-AD/src/main/res/layout/activity_debug_config.xml`
- `Player-AD/src/main/java/.../ui/DebugConfigActivity.kt`
- `Player-AD/src/main/java/.../ui/ConfigOrientationPreview.kt`
- `Player-AD/src/main/java/.../config/PlayerConfigLoader.kt`

Comportamento atual da barra superior:

- Salvar e iniciar
- Testar conectividade (ex-heartbeat)
- Playlist (ex-DispatchPlan) — lista mídias `id:nome #duração`
- Vincular código ao hardware

Default `deviceId`: `T1000-Exterminator` (hífen, sem espaço).

Instalação ADB (Windows): `scripts/install-player-adb.ps1`

---

## 8. Frontend admin — temas

- Temas: claro + escuros `carvao` / `grafite` / `suave`
- Persistência: `localStorage.theme`, `localStorage.darkTone`
- Primary atual: azul MUI `#1976d2`
- **Amarelo Petróleo no admin:** só planeado (secção 4.2)

Plano separado (só análise): converter front em app Android/iOS (PWA → Capacitor → RN/Flutter). **Não executado.**

---

## 9. Decisões pendentes do utilizador

Marcar ao retomar:

- [ ] Autorizar tema admin **Amarelo Petróleo** (A / B / C)?
- [ ] Autorizar integração Visual BV (A / B / C)?
- [ ] Corrigir UTF-8 + limpar scripts duplicados do Visual.Interface?
- [ ] Qual apresentação HTML é “oficial” para demos comerciais?
- [ ] Player web BV em produção ou só demo/lab?

---

## 10. Mapa rápido de ficheiros (para IAs)

| Tema | Caminhos |
|------|----------|
| Tema MUI | `frontend/src/theme/*`, `frontend/src/store/slices/uiSlice.ts`, `frontend/src/components/Layout/Layout.tsx` |
| Apresentação amarela | `totemdigital.site/Apresentacao.Totem.Digital.Amarelo.Full.Responsiva.html` |
| BV player | `Visual.Interface/TotemDigital.BV/**` |
| Dispatch / ER | `docs/MODELO_ER_*`, `docs/FLUXO_COMPLETO_PLAYER_*` |
| Schema | `database/smartchannel-db-v2-refactored-part*.sql` |
| Player Android | `Player-AD/` |
| Install BV | `Visual.Interface/*.sh`, `scripts/install-biblioteca-visual.sh` |

---

## 11. Prompt modelo para continuar com outra IA

```text
Contexto: repositório TotemDigital, branch SmartSignage-direc-totem.
Lê e segue: docs/HANDOFF-CONTINUIDADE-PRODUTO-2026-07-21.md
Regras: schema nos part*.sql; português; não alterar código sem eu autorizar.
Tarefa atual: [descrever — ex.: "Opção A integração BV com DispatchPlan" ou "tema petroleo A"].
Antes de editar: resume o plano em 5 bullets e espera confirmação.
```

---

## 12. Histórico conversacional (tópicos desta fase)

1. Player-AD config UI (altura, botões, Playlist, deviceId).
2. Atualização modelos ER + PNG.
3. Plano apps mobile (apenas análise).
4. Landings / apresentações full + responsivas; fix sobreposição desktop.
5. Proposta tema Amarelo Petróleo no frontend (adiada).
6. Análise e extração Visual.Interface / TotemDigital.BV; planos A/B/C.
7. Este handoff para continuidade multi-IA.

---

## 13. Critério de atualização deste documento

Atualizar este handoff (ou criar `HANDOFF-CONTINUIDADE-PRODUTO-AAAA-MM-DD.md` novo) quando:

- uma decisão pendente da secção 9 for tomada;
- a integração BV ou o tema petróleo forem iniciados;
- houver mudança de branch principal de trabalho;
- surgir débito técnico bloqueante novo.

Manter o `docs/README.md` a apontar para o handoff **mais recente**.

---

*Documento gerado para continuidade de produto. Não substitui o schema SQL nem os fluxos técnicos detalhados; complementa-os com decisões, estado e intenções desta fase.*
