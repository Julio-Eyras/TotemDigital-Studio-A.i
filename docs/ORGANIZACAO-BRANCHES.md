# Organização de branches e repositórios

**Atualizado:** 2026-07-30  
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
- `origin/HEAD` aponta para `SmartSignage-direc-totem` (default do remoto Studio).

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
| Branch activa | **`SmartSignage-direc-totem`** |
| Tracking | `origin/SmartSignage-direc-totem` |
| Produto | Painel + API compact, install HTTPS 443, Player-AD, direct-totem |

Todo o desenvolvimento recente (install produção, HTTPS, Player-AD anti-flick, mix dispatch, UI Editar totem) está nesta branch neste repositório.

### Comandos habituais

```bash
cd C:\TotemDigital-Studio
git checkout SmartSignage-direc-totem
git pull origin SmartSignage-direc-totem
# …alterações, commit…
git push origin SmartSignage-direc-totem
```

No servidor de produção/staging, o deploy deve fazer `git pull` **desta** branch no clone que aponta para **TotemDigital-Studio** (`origin`), não para o repo legado por engano.

---

## 4. Mapa de linhas de produto (orientação)

Nomes observados nos remotes — usar como referência, não como lista obrigatória a manter todas activas:

| Prefixo / nome | Onde costuma viver | Ideia |
|----------------|--------------------|--------|
| `SmartSignage-direc-totem` | **Studio (`origin`)** | Linha actual compact + totem directo |
| `Instala-TotemDigital-Server.sh` | `scripts/` no Studio | Instalador oficial servidor (menu PT) |
| `Smart-Signage-Studio-V3x` / `Vx4` / `Vx5` | Legado (`totemdigital`) | Gerações Studio anteriores |
| `Totem-Digital-V3x` | Legado | Linha Totem Digital clássica |
| `main` | Legado (`totemdigital`) | Default histórico do repo antigo |
| `feature/…`, `ajuste_…`, `novo_…` | Legado / ad-hoc | Trabalho pontual; preferir nomes abaixo |

---

## 5. Convenção para branches novas

Criar a partir da branch de trabalho actual (`SmartSignage-direc-totem`), nunca “no ar” a partir de um remote errado.

| Tipo | Padrão | Exemplo |
|------|--------|---------|
| Funcionalidade | `feature/<tema-curto>` | `feature/player-seamless-replay` |
| Correção | `fix/<tema-curto>` | `fix/nginx-login-405` |
| Install / ops | `fix/install-<tema>` ou `chore/install-<tema>` | `fix/install-le-rsa` |
| Docs | `docs/<tema>` | `docs/organizacao-branches` |
| Release / tag | tag SemVer no Player-AD / packages quando aplicável | APK `1.94`, Front/Back em `package.json` |

### Boas práticas

1. Uma intenção por branch (evitar misturar install + UI + schema no mesmo PR sem necessidade).
2. Merge (ou fast-forward) de volta para `SmartSignage-direc-totem` após revisão.
3. Push só para `origin` salvo pedido explícito para espelhar no legado.
4. Não force-push em `SmartSignage-direc-totem` / `main` sem acordo explícito.
5. Commits: mensagens curtas no estilo já usado (`fix(…):`, `feat(…):`, `docs:`).

---

## 6. Fluxo recomendado (dia a dia)

```text
C:\TotemDigital-Studio
        │
        ▼
  branch SmartSignage-direc-totem
        │
        ├─► commit local
        │
        └─► push origin  ──►  github.com/Julio-Eyras/TotemDigital-Studio
                                      │
                                      └─► servidor: git pull (mesma branch)
```

Para uma tarefa isolada:

```bash
git checkout SmartSignage-direc-totem
git pull origin SmartSignage-direc-totem
git checkout -b fix/meu-tema
# …trabalho…
git push -u origin fix/meu-tema
# PR → SmartSignage-direc-totem (quando usar PR)
```

---

## 7. Checklist rápido “estou no sítio certo?”

Antes de commit/push ou de orientar outra IA/pessoa:

- [ ] Pasta = `C:\TotemDigital-Studio` (ou clone equivalente do **TotemDigital-Studio**)
- [ ] `git remote get-url origin` → `…/TotemDigital-Studio.git`
- [ ] Branch = `SmartSignage-direc-totem` (ou feature criada a partir dela)
- [ ] `git status -sb` mostra tracking `origin/SmartSignage-direc-totem` (ou a feature no `origin`)
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

**Trabalhamos em `C:\TotemDigital-Studio`, branch `SmartSignage-direc-totem`, lendo e gravando em `origin` → `Julio-Eyras/TotemDigital-Studio`; o remote `totemdigital` (repo antigo) é só referência histórica.**
