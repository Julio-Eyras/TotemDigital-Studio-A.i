# Candidatos a exclusão ou arquivo externo (patamar atual)

Lista **orientadora**: nada aqui deve ser apagado em massa sem revisão humana. Serve para reduzir ruído no repositório na fase de evolução atual.

---

## 1. Nunca versionar (já devem estar no `.gitignore`)

Gerados localmente — **não commitar**:

| Caminho / padrão | Motivo |
|-------------------|--------|
| `node_modules/` (raiz, `backend/`, `frontend/`, etc.) | Dependências npm |
| `frontend/build/` | Build CRA |
| `backend/dist/` | Build TypeScript |
| `Player-AD/build/`, `SmartSignage-AD/**/build/` | Artefactos Gradle |
| `.env`, `.env.local` | Segredos |
| `TotemDigital-v1.zip`, `TotemDigital-v1/`, `/SmartSignage-Pro-*.zip` (raiz) | Pacotes locais (regra em `.gitignore`) |

---

## 2. Candidatos fortes a sair do Git ou mover para arquivo ZIP externo

### 2.1 `docs/_moved/` (~160 ficheiros, ~1,6 MB)

- Conteúdo **histórico** movido de outras pastas (README antigos, scripts duplicados).
- **Sugestão:** mover para um pacote `docs-arquivo-YYYY.zip` fora do Git **ou** para branch `docs-archive`, mantendo no `main` apenas um `README` com link.
- **Risco se apagar:** baixo se ninguém referencia caminhos `_moved/` na operação diária.

### 2.2 `docs/ModeloERparaGerenciarMídiasEmTvsSmart.zip`

- Diagrama / export **estático**; o modelo em texto atual está em [`MODELO_ER_MIDIAS_SMART_TV_E_TOTENS.md`](./MODELO_ER_MIDIAS_SMART_TV_E_TOTENS.md).
- **Sugestão:** manter até a equipa validar o Markdown; depois pode sair do Git **se** não precisarem do anexo (reduz binários no clone). A pasta de extração local com o mesmo nome fica **ignorada** (`.gitignore`).

---

## 3. Candidatos médios (muitos ficheiros `.md` soltos em `docs/`)

Existem **centenas** de documentos de análise, progresso e resumos (`PROGRESSO_*`, `RESUMO_*`, `ANALISE_*`).

- **Sugestão:** criar `docs/historico/` ou `docs/archive/2024-2025/` e mover em lote documentos claramente obsoletos **após** listagem aprovada.
- **Risco:** links internos quebrados; grep por títulos antes de mover.

Não recomendo apagar sem inventário: muitos ainda descrevem decisões de produto.

---

## 4. Binários e médias de demo

| Local | Nota |
|--------|------|
| `player-web/propagandas/*.mp4`, `player-web/vinhetas/*.mp4` | Ignorados no Git (`.gitignore`); manter só no deploy |
| `install-pendrive/**/*.apk` | Ignorados; gerar no CI/local |

---

## 5. Código morto ou duplicado (revisão manual)

- Pastas de **protótipo** ou **one-off** na raiz que não entram no build.
- Qualquer referência residual a **`ssp-clean`** (já removida): procurar com `git grep ssp-clean`.

---

## 6. O que **não** listar como “lixo”

- `database/smartchannel-db-v2-refactored-part*.sql` — fonte de verdade do schema.
- `database/carga-inicial-v6.sql`, `validate-v6.js` — fluxo v6.
- `scripts/install-smartsignage.sh`, `database/apply-schema-v2.sh` — instalação.
- Players oficiais (`Player-AD/`, `SmartSignage-AD/`, etc.) — produto.

---

**Última revisão:** abril de 2026.
