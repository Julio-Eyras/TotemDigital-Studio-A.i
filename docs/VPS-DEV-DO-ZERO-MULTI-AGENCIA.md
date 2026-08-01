# VPS — criar instância **dev** do zero (branch MultiAgência)

**Repo:** `https://github.com/Julio-Eyras/TotemDigital-Studio.git`  
**Branch:** `TotemDigital-MultiAgencia`  
**Domínio:** `dev.totemdigital.app.br`  
**Clone:** `~/TotemDigital-Studio-dev`  
**Deploy:** `/opt/totemdigital-dev` · BD `smartsignage_dev` · API `:3001`

> Correr como **utilizador normal** (não root). O script pede `sudo` quando precisa.

---

## 0. DNS (antes)

```text
dev.totemdigital.app.br  → A → IP do VPS
```

Opcional portal (depois): `*.publisher.dev.totemdigital.app.br` e `*.subscriber.…`

---

## 1. Pré-requisitos no VPS

```bash
# Node 18+, git, nginx, postgresql, certbot — tipicamente já existem se produção está no mesmo VPS
node -v
git --version
nginx -v
sudo -n true 2>/dev/null || echo "precisa de sudo interactivo"
```

---

## 2. Clone / branch de trabalho (bootstrap)

Se **ainda não** tem o repo neste user:

```bash
cd ~
git clone --branch TotemDigital-MultiAgencia \
  https://github.com/Julio-Eyras/TotemDigital-Studio.git \
  TotemDigital-Studio
cd ~/TotemDigital-Studio
git status -sb
# deve mostrar: TotemDigital-MultiAgencia
```

Se **já** tem o clone (ex. produção no mesmo home):

```bash
cd ~/TotemDigital-Studio
git fetch origin
git checkout TotemDigital-MultiAgencia
git pull --ff-only
```

---

## 3. Simulação (recomendado)

```bash
cd ~/TotemDigital-Studio
export TDI_GIT_BRANCH=TotemDigital-MultiAgencia
bash scripts/Instala-TotemDigital-Server.sh \
  --modo producao --instancia dev --sim --dry-run \
  --email SEU_EMAIL@dominio \
  --owner-user Owner
```

Confirme no plano: clone `~/TotemDigital-Studio-dev`, domínio `dev.totemdigital.app.br`, porta `3001`.

---

## 4. Instalação do zero (cria clone + BD + Nginx + systemd + LE)

```bash
cd ~/TotemDigital-Studio
export TDI_GIT_BRANCH=TotemDigital-MultiAgencia

bash scripts/Instala-TotemDigital-Server.sh \
  --modo producao --instancia dev --sim \
  --email SEU_EMAIL@dominio \
  --owner-user Owner
```

O instalador:

1. Clona `TotemDigital-MultiAgencia` → `~/TotemDigital-Studio-dev` (se ainda não existir)
2. Cria BD `smartsignage_dev` + schema/seeds
3. Build backend/frontend → `/opt/totemdigital-dev`
4. systemd `smart-signage-dev`
5. Nginx `totemdigital-dev` + cert LE para `dev.totemdigital.app.br`

**Logins provisionados (dev):**

| Utilizador | Password |
|------------|----------|
| `dev` | `dev123` |
| `dev.publisher` | `dev123` |

URL: `https://dev.totemdigital.app.br/login`

---

## 5. Se o clone dev já existia na branch errada

```bash
cd ~/TotemDigital-Studio-dev
git fetch origin
git checkout TotemDigital-MultiAgencia
git pull --ff-only

cd ~/TotemDigital-Studio
bash scripts/Instala-TotemDigital-Server.sh \
  --modo atualizar --instancia dev --git-pull --sim
```

---

## 6. Testar multi-agência no painel

1. Login `dev` / `dev123`
2. Complementos do sistema → activar **Modo multi-agência**
3. Recarregar UI (hot-reload de workers; se o aviso pedir, `sudo systemctl restart smart-signage-dev`)
4. Portal DNS (opcional): domínio `dev.totemdigital.app.br`, modo `public_wildcard`

Pipeline simulado no clone:

```bash
cd ~/TotemDigital-Studio-dev
node scripts/sim-portal-pipeline.mjs
```

---

## 7. Wipe só da BD dev (recomeçar dados, manter código)

```bash
cd ~/TotemDigital-Studio
bash scripts/Instala-TotemDigital-Server.sh --modo wipe --instancia dev
# interactivo — confirme domínio e frases pedidas
```

---

## 8. Checklist rápido pós-install

```bash
systemctl status smart-signage-dev --no-pager
curl -sS https://dev.totemdigital.app.br/api/health | head
sudo nginx -t
git -C ~/TotemDigital-Studio-dev rev-parse --abbrev-ref HEAD
# → TotemDigital-MultiAgencia
```

---

## Notas

- `--modo producao --instancia dev` **não** mexe em `/opt/smart-signage` (produção).
- `TDI_GIT_BRANCH` controla a branch do clone novo (default: branch actual do `~/TotemDigital-Studio`, senão `TotemDigital-MultiAgencia`).
- Purge comercial destrutivo: ver `docs/DESENHO-PURGE-DADOS-COMERCIAIS.md` (ainda não implementado).
