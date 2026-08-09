# Organização de branches e repositórios

**Atualizado:** 2026-08-09  
**Âmbito:** produto TotemDigital / SmartSignage (modo compact + direct-totem)

Este documento define **onde** o código vive, **qual branch** é a de trabalho actual e como organizar branches novas sem misturar remotes legados.

---

## 1. Diretório local de trabalho

| Item | Valor |
|------|--------|
| Raiz do projeto (esta máquina) | `C:\TotemDigital-Studio` |
| Árvore de desenvolvimento | `backend/`, `frontend/`, `database/`, `scripts/`, `Player-AD/` |
| Fonte de verdade de schema | ficheiros definitivos em `database/` (não migrations temporárias) |

> Não usar cópias paralelas fora desta árvore (ex.: `ssp-clean`) como destino de alterações.

---

## 2. Repositórios Git (remotes)

Há **dois** remotes configurados no clone local. O de leitura/gravação do dia a dia é só o **`origin`**.

| Remote | URL | Papel |
|--------|-----|--------|
| **`origin`** | `https://github.com/Julio-Eyras/TotemDigital-Studio.git` | **Principal** — pull/push da linha TotemDigital Studio / direct-totem |
| `totemdigital` | `https://github.com/Julio-Eyras/TotemDigital.git` | Legado / histórico (linhas V3x–Vx5, `main`, etc.) |

### Regra operacional

- **Ler e gravar** (commit + push + deploy): sempre `origin` + branch de trabalho actual.
- O remote `totemdigital` serve para **consulta**, cherry-pick pontual ou comparação histórica — **não** é o destino padrão de push desta fase.
- `origin/main` é a linha operacional canônica a partir da promoção do
  baseline `4bc88462`.
- `TotemDigital-MultiAgencia` permanece como branch de origem e histórico da
  promoção.

```bash
# Confirmar
git remote -v
git branch -vv
git status -sb
```

---

## 3. Branch de trabalho actual

| Item | Valor |
|------|--------|
| Branch operacional | **`main`** |
| Tracking | `origin/main` |
| Origem da promoção | `origin/TotemDigital-MultiAgencia` |
| Baseline funcional | `4bc88462` |
| Versões | Frontend `2.1.17` · Backend `2.1.11` · Player-AD `2.07/107` |
| Produto | Direct Totem · Multi Lite · Multi Pro · Player-AD |

Novas correções de produção devem partir de `main`. A branch
`TotemDigital-MultiAgencia` preserva a linha que originou esta promoção.

### Comandos habituais

```bash
cd C:\TotemDigital-Studio
git checkout main
git pull --ff-only origin main
# …alterações, commit…
git push origin main
```

No servidor de produção/staging, o deploy deve fazer `git pull` de `origin/main`
no clone que aponta para **TotemDigital-Studio**, não para o repositório legado.

---

## 4. Mapa de linhas de produto (orientação)

Nomes observados nos remotes — usar como referência, não como lista obrigatória a manter todas activas:

| Prefixo / nome | Onde costuma viver | Ideia |
|----------------|--------------------|--------|
| `main` | **Studio (`origin`)** | Linha operacional canônica |
| `TotemDigital-MultiAgencia` | **Studio (`origin`)** | Origem histórica da promoção de 2026-08-09 |
| `SmartSignage-direc-totem` | **Studio (`origin`)** | Linha anterior compact + totem direto |
| `Instala-TotemDigital-Server.sh` | `scripts/` no Studio | Instalador oficial servidor (menu PT) |
| `Smart-Signage-Studio-V3x` / `Vx4` / `Vx5` | Legado (`totemdigital`) | Gerações Studio anteriores |
| `Totem-Digital-V3x` | Legado | Linha Totem Digital clássica |
| `main` | Legado (`totemdigital`) | Branch homônima no repo antigo; não confundir com `origin/main` |
| `feature/…`, `ajuste_…`, `novo_…` | Legado / ad-hoc | Trabalho pontual; preferir nomes abaixo |

---

## 5. Convenção para branches novas

Criar a partir da branch operacional `main`, nunca a partir de um remote errado.

| Tipo | Padrão | Exemplo |
|------|--------|---------|
| Funcionalidade | `feature/<tema-curto>` | `feature/player-seamless-replay` |
| Correção | `fix/<tema-curto>` | `fix/nginx-login-405` |
| Install / ops | `fix/install-<tema>` ou `chore/install-<tema>` | `fix/install-le-rsa` |
| Docs | `docs/<tema>` | `docs/organizacao-branches` |
| Release / tag | tag SemVer no Player-AD / packages quando aplicável | APK `1.94`, Front/Back em `package.json` |

### Boas práticas

1. Uma intenção por branch (evitar misturar install + UI + schema no mesmo PR sem necessidade).
2. Merge (ou fast-forward) de volta para `main` após revisão.
3. Push só para `origin` salvo pedido explícito para espelhar no legado.
4. Não force-push em `main` ou nas branches históricas de release.
5. Commits: mensagens curtas no estilo já usado (`fix(…):`, `feat(…):`, `docs:`).

---

## 6. Fluxo recomendado (dia a dia)

```text
C:\TotemDigital-Studio
        │
        ▼
         branch main
        │
        ├─► commit local
        │
        └─► push origin  ──►  github.com/Julio-Eyras/TotemDigital-Studio
                                      │
                                      └─► servidor: git pull (mesma branch)
```

Para uma tarefa isolada:

```bash
git checkout main
git pull --ff-only origin main
git checkout -b fix/meu-tema
# …trabalho…
git push -u origin fix/meu-tema
# PR → main (quando usar PR)
```

---

## 7. Checklist rápido “estou no sítio certo?”

Antes de commit/push ou de orientar outra IA/pessoa:

- [ ] Pasta = `C:\TotemDigital-Studio` (ou clone equivalente do **TotemDigital-Studio**)
- [ ] `git remote get-url origin` → `…/TotemDigital-Studio.git`
- [ ] Branch = `main` (ou feature criada a partir dela)
- [ ] `git status -sb` mostra tracking `origin/main` (ou a feature no `origin`)
- [ ] Não fazer push por default para o remote `totemdigital`

---

## 8. Relação com outros documentos

| Documento | Relação |
|-----------|---------|
| `docs/HANDOFF-CONTINUIDADE-PRODUTO-2026-07-21.md` | Contexto de produto; branch de trabalho |
| `docs/INSTALL-PRODUCAO-COMPACT-DIRECT-TOTEM-HTTPS-443.md` | Deploy na linha compact/direct-totem |
| `.cursor/rules/schema-as-source-of-truth.mdc` | Schema só na árvore principal do repo |

---

## 9. Resumo numa frase

**Trabalhamos em `C:\TotemDigital-Studio`, branch operacional `main`, lendo e
gravando em `origin` → `Julio-Eyras/TotemDigital-Studio`; o remote
`totemdigital` (repo antigo) é somente referência histórica.**
